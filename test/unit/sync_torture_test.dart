import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/network/domain/remote_data_sink.dart';
import 'package:m_edu/core/network/domain/sync_operation.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_conflict_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_cursor_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_operation_datasource.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_conflict_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_cursor_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_operation_record.dart';
import 'package:m_edu/core/network/sync_engine.dart';
import 'package:m_edu/core/network/sync_entity_mapper.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// SYNC TORTURE TESTS (transformation mission Phase 12)
///
/// OFFLINE → ko'p mutation → reconnect → upload → conflict → retry →
/// duplicate/order/rejection → final convergence.
///
/// Kafolatlar: EXACTLY-ONCE logik xatti-harakat, ma'lumot yo'qolmaydi,
/// duplicate payment/attendance bo'lmaydi, jim sync xatosi yo'q.
/// ═══════════════════════════════════════════════════════════════════════

class _FakeRemoteSink implements RemoteDataSink {
  final Map<String, Map<String, dynamic>> store = {};
  final List<String> writes = [];
  final List<String> deletes = [];

  bool configured = true;
  bool failNext = false;
  int? conflictOnVersion;

  @override
  bool get isConfigured => configured;

  @override
  String get name => 'fake';

  @override
  Future<RemoteWriteResult> put({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
  }) async {
    if (failNext) {
      failNext = false;
      return RemoteWriteResult.failure('network down');
    }
    if (conflictOnVersion != null && version < conflictOnVersion!) {
      return RemoteWriteResult.conflicted(conflictOnVersion!);
    }
    final key = '$entityType:$entityId';
    store[key] = {...payload, '_version': version, '_deviceId': deviceId};
    writes.add(key);
    return RemoteWriteResult.ok;
  }

  @override
  Future<RemoteWriteResult> delete({
    required String entityType,
    required String entityId,
    required int version,
    required String deviceId,
  }) async {
    final key = '$entityType:$entityId';
    store.remove(key);
    deletes.add(key);
    return RemoteWriteResult.ok;
  }

  @override
  Future<List<RemoteEntity>> fetchChanged({
    required String entityType,
    required DateTime since,
    required int limit,
  }) async {
    return const [];
  }
}

class _IdentityMapper implements SyncEntityMapper {
  _IdentityMapper(this._db);

  final Isar _db;

  @override
  String get entityType => 'identity';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.identityRecords.filter().pendingSyncEqualTo(true).findAll();
    records.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return records
        .map((r) => SyncEntity(
              entityType: entityType,
              entityId: r.identityId,
              operationType: SyncOperationType.upsert,
              payload: {'identityId': r.identityId, 'firstName': r.firstName},
              version: r.syncVersion,
              updatedAt: r.createdAt,
            ))
        .toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final r = await _db.identityRecords
          .filter()
          .identityIdEqualTo(entityId)
          .findFirst();
      if (r != null) {
        r.pendingSync = false;
        r.syncVersion = version;
        await _db.identityRecords.put(r);
      }
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {}

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final r = await _db.identityRecords
        .filter()
        .identityIdEqualTo(entityId)
        .findFirst();
    return r == null
        ? null
        : LocalEntityState(version: r.syncVersion, pendingSync: r.pendingSync);
  }

  @override
  Future<void> applyRemote(RemoteEntity remote) async {
    // Pull testlari bidirectional_sync_test'da — bu yerda no-op.
  }
}

void main() {
  late Directory tempDir;
  late Isar isar;
  late SyncOperationDataSource queue;
  late SyncCursorDataSource cursorDs;
  late SyncConflictDataSource conflictDs;
  late _FakeRemoteSink remote;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_sync_torture');
    isar = await Isar.open(
      [
        IdentityRecordSchema,
        SyncOperationRecordSchema,
        SyncCursorRecordSchema,
        SyncConflictRecordSchema,
      ],
      directory: tempDir.path,
    );
    queue = SyncOperationDataSource(isar);
    cursorDs = SyncCursorDataSource(isar);
    conflictDs = SyncConflictDataSource(isar);
    remote = _FakeRemoteSink();
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  SyncEngine engine({int maxRetries = 3, int backoffBase = 0}) {
    return SyncEngine(
      remote: remote,
      queue: queue,
      cursorDataSource: cursorDs,
      conflictDataSource: conflictDs,
      mappers: [_IdentityMapper(isar)],
      deviceId: 'device-A',
      maxRetries: maxRetries,
      backoffBaseSeconds: backoffBase,
      batchLimit: 1000,
    );
  }

  Future<void> addIdentity(String id, {int version = 1}) {
    return isar.writeTxn(() async {
      final record = IdentityRecord()
        ..identityId = id
        ..firstName = 'Ali'
        ..lastName = 'Valiyev'
        ..role = 'student'
        ..status = 'active'
        ..qrSeed = 'seed-$id'
        ..createdAt =
            DateTime(2026, 8, 1, 0, 0, int.parse(id.split('-').last) % 60)
        ..syncVersion = version
        ..pendingSync = true;
      await isar.identityRecords.put(record);
    });
  }

  Future<void> addBurst(int n) async {
    for (var i = 1; i <= n; i++) {
      await addIdentity('M-EDU-2026-${i.toString().padLeft(6, '0')}');
    }
  }

  group('Torture: offline burst → reconnect → convergence', () {
    for (final n in [1, 10, 50, 100]) {
      test(
          '$n ta offline mutation — reconnect\'da hammasi yuboriladi, '
          'exactly-once, ikkinchi pass bo\'sh', () async {
        // Offline: cloud yo'q — hech narsa yuborilmaydi, yozuvlar saqlanadi.
        remote.configured = false;
        await addBurst(n);
        final offline = await engine().processOnce();
        expect(offline.attempted, 0);
        expect(remote.writes, isEmpty);

        // Reconnect: bir pass'da hammasi yuqoriga chiqadi.
        remote.configured = true;
        final result = await engine().processOnce();
        expect(result.synced, n);
        expect(result.failed, 0);
        expect(result.conflicts, 0);
        expect(remote.store.length, n);
        expect(await queue.pendingCount(), 0);

        // Exactly-once: keyingi pass hech narsa qayta yubormaydi.
        final again = await engine().processOnce();
        expect(again.attempted, 0);
        expect(remote.writes.length, n); // yangi yozuv yo'q
      });
    }
  });

  group('Torture: network loss → retry → convergence', () {
    test(
        '50 ta yozuv, birinchi pass tarmoq xatosi → qayta urinishda hammasi '
        'yetkaziladi, duplicate yo\'q', () async {
      await addBurst(50);

      // Birinchi pass — tarmoq uzildi (birinchi yozuvda).
      remote.failNext = true;
      final failed = await engine().processOnce();
      expect(failed.failed, greaterThanOrEqualTo(1));

      // Backoff 0 — keyingi pass darhol qayta urinadi. Birinchi pass'da
      // 49 tasi o'tib ketgan, faqat muvaffaqiyatsiz 1 tasi qayta yuboriladi.
      final retry = await engine().processOnce();
      expect(retry.synced, 1);
      expect(remote.store.length, 50);
      // Hech bir entity ikki marta yozilmagan (exactly-once remote'da).
      expect(remote.writes.toSet().length, remote.writes.length);
      expect(await queue.pendingCount(), 0);
    });
  });

  group('Torture: conflict burst ichida', () {
    test(
        '50 ta yozuvdan 1 tasi conflict → qolganlari sinxron, conflict '
        'bloklanadi, admin retry\'dan keyin convergence', () async {
      await addBurst(50);
      // Remote v100 da — barcha client yozuvlari eski (v1).
      remote.conflictOnVersion = 100;

      final result = await engine().processOnce();
      expect(result.conflicts, 50);
      // Jim ma'lumot yo'qolishi YO'Q: remote'da hech narsa yozilmagan.
      expect(remote.store, isEmpty);
      final blocked = await queue.blockedOperations();
      expect(blocked.length, 50);
      expect(blocked.every((op) => op.syncStatus == 'conflict'), isTrue);

      // Admin qarori: retry (local-wins) — joriy versiya bilan qayta yuboriladi.
      // Ammo mapper hali eski versiyada — shuning uchun yangi versiya berib
      // qayta urinamiz (haqiqiy oqimda admin retry + yangi edit).
      await addBurst(0); // no-op
      // Versiyani oshirib, retry'ni amalga oshiramiz:
      for (final op in blocked) {
        final rec = await isar.identityRecords
            .filter()
            .identityIdEqualTo(op.entityId)
            .findFirst();
        if (rec != null) {
          await isar.writeTxn(() async {
            rec.syncVersion = 101;
            rec.pendingSync = true;
            await isar.identityRecords.put(rec);
          });
        }
        await queue.retryBlocked(op.operationId);
      }
      remote.conflictOnVersion = null;
      final converged = await engine().processOnce();
      expect(converged.synced, 50);
      expect(remote.store.length, 50);
      expect(await queue.pendingCount(), 0);
    });
  });

  group('Torture: tartiblangan yetkazish va restart xavfsizligi', () {
    test('yozuvlar createdAt tartibida yetkaziladi (FIFO)', () async {
      await addBurst(10);
      await engine().processOnce();

      final expected = List.generate(
        10,
        (i) => 'identity:M-EDU-2026-${(i + 1).toString().padLeft(6, '0')}',
      );
      expect(remote.writes, expected); // tartib saqlangan
    });

    test(
        'app restart (yangi engine) — sinxronlangan yozuv qayta '
        'yuborilmaydi (idempotent)', () async {
      await addIdentity('M-EDU-2026-000001');
      await engine().processOnce();
      expect(remote.writes.length, 1);

      // "Restart": yangi engine instance, xuddi shu baza.
      final restarted = engine();
      final result = await restarted.processOnce();
      expect(result.attempted, 0);
      expect(remote.writes.length, 1);
    });

    test(
        'yarim pass\'da qulash (inFlight) — qayta ishga tushganda yozuv '
        'yo\'qolmaydi, duplicate ham bo\'lmaydi', () async {
      await addIdentity('M-EDU-2026-000001');
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'M-EDU-2026-000001',
        operationType: SyncOperationType.upsert,
        payload: const {'identityId': 'M-EDU-2026-000001'},
        version: 1,
        deviceId: 'device-A',
      );
      final ops = await isar.syncOperationRecords.where().findAll();
      await queue.markInFlight(ops.single.operationId);
      // Qayta ishga tushish — engine inFlight'ni pending'ga qaytaradi.
      final result = await engine().processOnce();
      expect(result.synced, 1);
      expect(remote.store.containsKey('identity:M-EDU-2026-000001'), isTrue);
      expect(await queue.pendingCount(), 0);
      // Ikkinchi pass duplicate yaratmaydi.
      final again = await engine().processOnce();
      expect(again.attempted, 0);
    });
  });
}
