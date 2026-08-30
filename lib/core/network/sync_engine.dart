import 'dart:convert';

import 'domain/remote_data_sink.dart';
import 'domain/sync_operation.dart';
import 'infrastructure/datasources/sync_conflict_datasource.dart';
import 'infrastructure/datasources/sync_cursor_datasource.dart';
import 'infrastructure/datasources/sync_operation_datasource.dart';
import 'infrastructure/models/sync_operation_record.dart';
import 'sync_entity_mapper.dart';

/// Sinxronlash natijasi (bir pass).
class SyncRunResult {
  final int attempted;
  final int synced;
  final int failed;
  final int permanent;
  final int conflicts;

  /// Pull'da remote'dan qo'llangan yozuvlar soni (PHASE 1).
  final int pulled;

  const SyncRunResult({
    required this.attempted,
    required this.synced,
    required this.failed,
    required this.permanent,
    required this.conflicts,
    this.pulled = 0,
  });

  bool get anyIssues => failed > 0 || permanent > 0 || conflicts > 0;
}

/// Bitta remote entity'ni qo'llash natijasi (pull).
class _ApplyOutcome {
  final bool applied;
  final bool conflict;
  final String winner; // 'local' | 'remote'

  const _ApplyOutcome({
    required this.applied,
    this.conflict = false,
    this.winner = '',
  });
}

/// Offline mutation queue consumer + remote pull consumer — production
/// sync engine (BIDIRECTIONAL, sync contract §5-7).
///
/// OQIM (contract):
/// ```text
/// PUSH:  LOCAL WRITE → pendingSync=true → enqueue → put/delete → mark
/// PULL:  cursor → fetchChanged → conflict resolution → applyRemote → cursor++
/// ```
///
/// Retry (push): exponential backoff (2^retryCount soniya, maks 10 daqiqa),
/// [maxRetries] dan keyin permanent (avtomatik qayta urinilmaydi).
///
/// Conflict (PHASE 1, contract §7): deterministik g'olib —
///   1) yuqori versiya g'olib;
///   2) teng versiyada kattaroq [deviceId] g'olib (soatlar ishonchsiz).
/// Har bir divergence [SyncConflictDataSource]'da audit qilinadi va
/// yo'qotilgan lokal operatsiya queue'da `conflict` sifatida saqlanadi
/// (admin ko'rib chiqadi — jim data loss YO'Q).
class SyncEngine {
  final RemoteDataSink _remote;
  final SyncOperationDataSource _queue;
  final SyncCursorDataSource _cursorDs;
  final SyncConflictDataSource _conflictDs;
  final List<SyncEntityMapper> _mappers;
  final String deviceId;

  /// Exponential backoff asos (soniya).
  final int backoffBaseSeconds;

  /// Maksimal qayta urinishlar (keyin permanent).
  final int maxRetries;

  /// Bitta pass'da yuboriladigan maksimal yozuvlar soni.
  final int batchLimit;

  /// Bitta pull batch'ida olinadigan maksimal yozuvlar soni.
  final int pullBatchLimit;

  SyncEngine({
    required RemoteDataSink remote,
    required SyncOperationDataSource queue,
    required SyncCursorDataSource cursorDataSource,
    required SyncConflictDataSource conflictDataSource,
    required List<SyncEntityMapper> mappers,
    required this.deviceId,
    this.backoffBaseSeconds = 2,
    this.maxRetries = 8,
    this.batchLimit = 100,
    this.pullBatchLimit = 200,
  })  : _remote = remote,
        _queue = queue,
        _cursorDs = cursorDataSource,
        _conflictDs = conflictDataSource,
        _mappers = mappers;

  /// Remote sozlanganmi? Sozlanmagan bo'lsa sync qilinmaydi (offline-first).
  bool get isEnabled => _remote.isConfigured;

  /// Navbatdagi (pending) yozuvlar soni — UI statusi uchun.
  Future<int> pendingCount() async {
    try {
      return await _queue.pendingCount();
    } catch (_) {
      return 0;
    }
  }

  /// Bitta sinxronlash pass'ini bajaradi: PUSH (pending yuborish) + PULL
  /// (remote o'zgarishlarni qo'llash). Har ikki yo'nalish bitta pass'da.
  Future<SyncRunResult> processOnce({DateTime? now}) async {
    if (!isEnabled) {
      return const SyncRunResult(
        attempted: 0,
        synced: 0,
        failed: 0,
        permanent: 0,
        conflicts: 0,
      );
    }

    // 0) Crash recovery: oldingi (to'xtatilgan) pass'dan qolgan `inFlight`
    //    yozuvlar pending'ga qaytariladi (push tomoni).
    await _queue.resetInFlightToPending();

    // 1) PUSH — mapper'lardan pending yozuvlarni yig'ib queue'ga (UPSERT).
    for (final mapper in _mappers) {
      try {
        final entities = await mapper.fetchPending();
        for (final entity in entities) {
          await _queue.enqueue(
            entityType: entity.entityType,
            entityId: entity.entityId,
            operationType: entity.operationType,
            payload: entity.payload,
            version: entity.version,
            deviceId: deviceId,
            now: now,
          );
        }
      } catch (_) {
        // Bitta mapper xatosi butun syncni to'xtatmaydi.
      }
    }

    // 2) Yuborilishi kerak bo'lgan operatsiyalar (due + retry muddati yetgan).
    final due = await _queue.dueOperations(now: now);
    final toProcess = due.take(batchLimit).toList();

    var synced = 0;
    var failed = 0;
    var permanent = 0;
    var pushConflicts = 0;

    for (final op in toProcess) {
      await _queue.markInFlight(op.operationId);
      final result = await _push(op);
      if (result.success) {
        await _queue.markSynced(op.operationId);
        await _ackMapper(op);
        synced++;
      } else if (result.permanentFailure) {
        await _queue.markPermanent(op.operationId, result.error ?? '');
        await _failMapper(op, result.error ?? '', permanent: true);
        permanent++;
      } else if (result.conflict) {
        await _queue.markConflict(op.operationId, result.remoteVersion ?? 0);
        await _failMapper(op, result.error ?? '', permanent: false);
        pushConflicts++;
      } else if (op.retryCount + 1 >= maxRetries) {
        await _queue.markPermanent(op.operationId, result.error ?? '');
        await _failMapper(op, result.error ?? '', permanent: true);
        permanent++;
      } else {
        await _queue.markFailed(
          op.operationId,
          result.error ?? '',
          backoffBaseSeconds: backoffBaseSeconds,
        );
        failed++;
      }
    }

    // 3) PULL — remote o'zgarishlarni cursor bo'yicha olib, deterministik
    //    conflict resolution bilan qo'llaymiz (PHASE 1, contract §5-7).
    final pull = await _pullPhase(now: now);

    return SyncRunResult(
      attempted: toProcess.length,
      synced: synced,
      failed: failed,
      permanent: permanent,
      conflicts: pushConflicts + pull.conflicts,
      pulled: pull.pulled,
    );
  }

  // ═══════════════════════════════ PULL (PHASE 1) ═══════════════════════

  Future<_PullOutcome> _pullPhase({DateTime? now}) async {
    var pulled = 0;
    var conflicts = 0;

    for (final mapper in _mappers) {
      var since = await _cursorFor(mapper.entityType);
      var more = true;
      while (more) {
        final batch = await _remote.fetchChanged(
          entityType: mapper.entityType,
          since: since,
          limit: pullBatchLimit,
        );
        if (batch.isEmpty) break;

        DateTime maxSeen = since;
        for (final remote in batch) {
          final outcome = await _applyRemote(mapper, remote);
          if (outcome.applied) pulled++;
          if (outcome.conflict) conflicts++;
          if (remote.updatedAt.isAfter(maxSeen)) maxSeen = remote.updatedAt;
        }

        // Cursor faqat batch muvaffaqiyatli qo'llangandan keyin suriladi —
        // pass o'rtasida qulasa, keyingi pass shu cursor'dan davom etadi
        // (applyRemote idempotent, contract §5).
        await _cursorDs.set(mapper.entityType, maxSeen);
        since = maxSeen;

        // Batch limit'ga yetmagan bo'lsa — boshqa ma'lumot yo'q.
        if (batch.length < pullBatchLimit) more = false;
      }
    }

    return _PullOutcome(pulled: pulled, conflicts: conflicts);
  }

  /// Joriy cursor (mavjud bo'lmasa epoch — bootstrap, contract §5).
  Future<DateTime> _cursorFor(String entityType) async {
    final cursor = await _cursorDs.get(entityType);
    return cursor?.lastPulledAt ?? DateTime.fromMillisecondsSinceEpoch(0);
  }

  /// Bitta remote entity'ni deterministik conflict resolution bilan qo'llaydi
  /// (contract §7):
  ///
  /// G'olib: yuqori versiya; teng versiyada kattaroq [deviceId].
  /// - Remote g'olib → [applyRemote] + divergence bo'lsa conflict audit;
  ///   lokal pending operatsiya queue'da `conflict` sifatida saqlanadi.
  /// - Lokal g'olib → remote qo'llanmaydi; lokal pending op push'da hal qilinadi.
  Future<_ApplyOutcome> _applyRemote(
    SyncEntityMapper mapper,
    RemoteEntity remote,
  ) async {
    final local = await mapper.localState(remote.entityId);

    // Lokal yozuv yo'q — remote qo'llanadi (insert).
    if (local == null) {
      await mapper.applyRemote(remote);
      return const _ApplyOutcome(applied: true);
    }

    final remoteWins = remote.version > local.version ||
        (remote.version == local.version &&
            remote.updatedByDeviceId.compareTo(deviceId) > 0);

    // Divergence: teng versiya, turli qurilmalar (contract §7).
    final divergence = remote.version == local.version &&
        remote.updatedByDeviceId != deviceId;

    if (remoteWins) {
      if (divergence || local.pendingSync) {
        await _conflictDs.record(
          entityType: mapper.entityType,
          entityId: remote.entityId,
          localVersion: local.version,
          remoteVersion: remote.version,
          winner: 'remote',
          direction: 'pull',
          localDeviceId: deviceId,
          remoteDeviceId: remote.updatedByDeviceId,
        );
      }
      // Yo'qotilgan lokal o'zgarish jimgina yo'qolmaydi — queue'da conflict
      // sifatida saqlanadi (admin ko'rib chiqishi uchun).
      if (local.pendingSync) {
        await _queue.markConflict(
          '${mapper.entityType}:${remote.entityId}',
          remote.version,
        );
      }
      await mapper.applyRemote(remote);
      return const _ApplyOutcome(applied: true, conflict: true, winner: 'remote');
    }

    // Lokal g'olib.
    if (divergence) {
      await _conflictDs.record(
        entityType: mapper.entityType,
        entityId: remote.entityId,
        localVersion: local.version,
        remoteVersion: remote.version,
        winner: 'local',
        direction: 'pull',
        localDeviceId: deviceId,
        remoteDeviceId: remote.updatedByDeviceId,
      );
      return const _ApplyOutcome(applied: false, conflict: true, winner: 'local');
    }

    // Oddiy holat: lokal allaqachon yangiroq/ekvivalent — qo'llanmaydi.
    return const _ApplyOutcome(applied: false);
  }

  // ═══════════════════════════════ PUSH (mavjud) ═══════════════════════

  Future<RemoteWriteResult> _push(SyncOperationRecord op) async {
    try {
      final payload = _decodePayload(op.payload);
      if (op.operationType == SyncOperationType.delete.name) {
        return await _remote.delete(
          entityType: op.entityType,
          entityId: op.entityId,
          version: op.version,
          deviceId: deviceId,
        );
      }
      return await _remote.put(
        entityType: op.entityType,
        entityId: op.entityId,
        operationType: SyncOperationType.fromName(op.operationType),
        payload: payload,
        version: op.version,
        deviceId: deviceId,
      );
    } catch (e) {
      return RemoteWriteResult.failure(e.toString());
    }
  }

  Future<void> _ackMapper(SyncOperationRecord op) async {
    for (final mapper in _mappers) {
      if (mapper.entityType == op.entityType) {
        try {
          await mapper.markSynced(op.entityId, op.version);
        } catch (_) {
          // Lokal bayroq o'chmasa ham queue'dan olib tashlandi — keyingi
          // pass'da qayta yuborilishi mumkin (idempotent put).
        }
        return;
      }
    }
  }

  Future<void> _failMapper(
    SyncOperationRecord op,
    String error, {
    required bool permanent,
  }) async {
    for (final mapper in _mappers) {
      if (mapper.entityType == op.entityType) {
        try {
          await mapper.markSyncFailed(op.entityId, error, permanent: permanent);
        } catch (_) {
          // Lokal bayroq qoladi — keyingi pass'da qayta uriniladi.
        }
        return;
      }
    }
  }

  static Map<String, dynamic> _decodePayload(String payload) {
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
      return const <String, dynamic>{};
    } catch (_) {
      return const <String, dynamic>{};
    }
  }
}

class _PullOutcome {
  final int pulled;
  final int conflicts;

  const _PullOutcome({required this.pulled, required this.conflicts});
}
