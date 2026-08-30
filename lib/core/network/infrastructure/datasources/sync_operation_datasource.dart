import 'dart:convert';
import 'dart:math';

import 'package:isar/isar.dart';

import '../models/sync_operation_record.dart';
import '../../domain/sync_operation.dart';

/// Sync navbati operatsiyalari uchun Isar datasource.
class SyncOperationDataSource {
  final Isar _db;

  SyncOperationDataSource(this._db);

  /// Enqueue: deterministik [operationId] orqali UPSERT.
  ///
  /// Xuddi shu (entityType, entityId) uchun mavjud yozuv YANGILANADI —
  /// retryCount va holat saqlanib, payload/versiya yangilanadi. Bu
  /// duplicate sync event'ni oldini oladi.
  Future<void> enqueue({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
    DateTime? now,
  }) async {
    final timestamp = now ?? DateTime.now();
    final operationId = '$entityType:$entityId';
    await _db.writeTxn(() async {
      final existing = await _db.syncOperationRecords
          .filter()
          .operationIdEqualTo(operationId)
          .findFirst();
      if (existing == null) {
        final record = SyncOperationRecord()
          ..operationId = operationId
          ..entityType = entityType
          ..entityId = entityId
          ..operationType = operationType.name
          ..payload = _encodePayload(payload)
          ..version = version
          ..deviceId = deviceId
          ..syncStatus = SyncStatus.pending.name
          ..retryCount = 0
          ..createdAt = timestamp
          ..updatedAt = timestamp;
        await _db.syncOperationRecords.put(record);
      } else {
        // Mavjud operatsiya yangilanadi (payload eng so'nggi holat).
        final previousVersion = existing.version;
        existing
          ..operationType = operationType.name
          ..payload = _encodePayload(payload)
          ..version = version
          ..updatedAt = timestamp;
        // Permanent/conflict holatidagi yozuv FAQAT VERSION OSHGANDA qayta
        // pending bo'ladi (yangilangan ma'lumot yuborilishi kerak). Xuddi shu
        // versiyadagi mapper qayta-enqueue'si holatni buzmaydi — aks holda
        // permanent xato har pass'da qayta urinilar edi (DO NOT RETRY
        // FOREVER buzilishi).
        final isBlocked = existing.syncStatus == SyncStatus.permanent.name ||
            existing.syncStatus == SyncStatus.conflict.name;
        if (isBlocked && version > previousVersion) {
          existing.syncStatus = SyncStatus.pending.name;
          existing.retryCount = 0;
          existing.nextRetryAt = null;
          existing.lastError = null;
          existing.remoteVersion = null;
        }
        await _db.syncOperationRecords.put(existing);
      }
    });
  }

  /// Yuborishga tayyor operatsiyalar: pending yoki (vaqtinchalik) failed,
  /// nextRetryAt yetgan, createdAt bo'yicha tartiblangan.
  Future<List<SyncOperationRecord>> dueOperations({DateTime? now}) async {
    final timestamp = now ?? DateTime.now();
    final all = await _db.syncOperationRecords
        .filter()
        .syncStatusEqualTo(SyncStatus.pending.name)
        .or()
        .syncStatusEqualTo(SyncStatus.failed.name)
        .findAll();
    all.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return all
        .where((op) =>
            op.nextRetryAt == null || !op.nextRetryAt!.isAfter(timestamp))
        .toList();
  }

  /// Sync paytida qolib ketgan `inFlight` yozuvlarni `pending`'ga qaytaradi.
  ///
  /// NEGA KERAK: `markInFlight` → push → `markSynced` oralig'ida app
  /// o'ldirilsa/qulasa yozuv `inFlight` holatida qolib ketadi. Bu holatdagi
  /// yozuvlarni qaytarmasak, ular hech qachon yuborilmaydi — mutation faqat
  /// lokal qoladi, cloud'ga yetmaydi (boshqa qurilmalar ko'rmaydi).
  ///
  /// Har bir yangi pass boshida chaqiriladi: jonli jarayonda har bir yozuv
  /// shu pass ichida hal qilinadi (markInFlight → push → synced/failed/
  /// permanent/conflict), shuning uchun pass boshida qolgan har qanday
  /// `inFlight` yozuv avvalgi (to'xtatilgan) passdan qolgan. Qayta yuborish
  /// idempotent put (versiya tekshiruvi) — duplicate xavfsiz.
  Future<void> resetInFlightToPending() async {
    await _db.writeTxn(() async {
      final stuck = await _db.syncOperationRecords
          .filter()
          .syncStatusEqualTo(SyncStatus.inFlight.name)
          .findAll();
      for (final op in stuck) {
        op.syncStatus = SyncStatus.pending.name;
        op.nextRetryAt = null;
        op.updatedAt = DateTime.now();
        await _db.syncOperationRecords.put(op);
      }
    });
  }

  /// Permanent/conflict holatidagi operatsiyalar (admin ko'rib chiqishi
  /// uchun) — ular avtomatik yuborilmaydi.
  Future<List<SyncOperationRecord>> blockedOperations() async {
    final ops = await _db.syncOperationRecords
        .filter()
        .syncStatusEqualTo(SyncStatus.permanent.name)
        .or()
        .syncStatusEqualTo(SyncStatus.conflict.name)
        .findAll();
    ops.sort((a, b) => a.updatedAt.compareTo(b.updatedAt));
    return ops;
  }

  Future<void> markInFlight(String operationId) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      op.syncStatus = SyncStatus.inFlight.name;
      op.updatedAt = DateTime.now();
      await _db.syncOperationRecords.put(op);
    });
  }

  /// Muvaffaqiyatli sinxronlash — yozuv navbatdan olib tashlanadi.
  Future<void> markSynced(String operationId) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      await _db.syncOperationRecords.delete(op.id);
    });
  }

  /// Vaqtinchalik xato (network) — backoff bilan qayta uriniladi.
  ///
  /// [backoffBaseSeconds] — exponential backoff asosi (engine konfiguratsiyasi
  /// uzatiladi): retry N uchun kutish = base * 2^N soniya (maks 10 daqiqa).
  Future<void> markFailed(
    String operationId,
    String error, {
    int backoffBaseSeconds = 2,
  }) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      op.syncStatus = SyncStatus.failed.name;
      op.retryCount += 1;
      op.lastError = error;
      op.nextRetryAt =
          _nextRetryAt(op.retryCount, backoffBaseSeconds: backoffBaseSeconds);
      op.updatedAt = DateTime.now();
      await _db.syncOperationRecords.put(op);
    });
  }

  /// Doimiy xato (validation) — avtomatik qayta urinilmaydi.
  Future<void> markPermanent(String operationId, String error) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      op.syncStatus = SyncStatus.permanent.name;
      op.lastError = error;
      op.updatedAt = DateTime.now();
      await _db.syncOperationRecords.put(op);
    });
  }

  /// Versiya ziddiyati — yozuv saqlanadi, flag qo'yiladi.
  Future<void> markConflict(String operationId, int remoteVersion) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      op.syncStatus = SyncStatus.conflict.name;
      op.remoteVersion = remoteVersion;
      op.lastError = 'Versiya ziddiyati: remote v$remoteVersion';
      op.updatedAt = DateTime.now();
      await _db.syncOperationRecords.put(op);
    });
  }

  /// Bloklangan (conflict/permanent) operatsiyani qayta navbatga qo'yadi.
  ///
  /// GAPS-G4 / DECISIONS-D13: conflict'lar jimgina hal qilinmaydi — bu
  /// ADMINNING ANIQ QARORI: "bu qurilma g'olib" (local-wins). Operatsiya
  /// `pending`'ga qaytariladi, retry hisoblagichi va remoteVersion tozalanadi;
  /// keyingi pass'da joriy versiya bilan qayta yuboriladi. Eslatma: baza
  /// entity'sining o'zi yangilanmagan bo'lsa, mapper hali ham eski versiya
  /// bilan qayta push qiladi — shuning uchun UI'da bu "qayta urinish" deb
  /// emas, "cheklangan qayta yuborish" sifatida ko'rsatiladi.
  Future<void> retryBlocked(String operationId) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      if (op.syncStatus != SyncStatus.permanent.name &&
          op.syncStatus != SyncStatus.conflict.name) {
        return;
      }
      op.syncStatus = SyncStatus.pending.name;
      op.retryCount = 0;
      op.remoteVersion = null;
      op.lastError = null;
      op.nextRetryAt = null;
      op.updatedAt = DateTime.now();
      await _db.syncOperationRecords.put(op);
    });
  }

  /// Bloklangan operatsiyani navbatdan o'chiradi.
  ///
  /// GAPS-G4 / DECISIONS-D13: ADMINNING ANIQ QARORI — "remote g'olib":
  /// lokal navbatdagi yozuv tashlab yuboriladi, remote holat haqiqat deb
  /// qabul qilinadi. Bu hech qachon avtomatik bajarilmaydi.
  Future<void> discardBlocked(String operationId) async {
    await _db.writeTxn(() async {
      final op = await _byOperationId(operationId);
      if (op == null) return;
      if (op.syncStatus != SyncStatus.permanent.name &&
          op.syncStatus != SyncStatus.conflict.name) {
        return;
      }
      await _db.syncOperationRecords.delete(op.id);
    });
  }

  Future<int> pendingCount() async {
    return _db.syncOperationRecords
        .filter()
        .syncStatusEqualTo(SyncStatus.pending.name)
        .count();
  }

  Future<SyncOperationRecord?> _byOperationId(String operationId) {
    return _db.syncOperationRecords
        .filter()
        .operationIdEqualTo(operationId)
        .findFirst();
  }

  static String _encodePayload(Map<String, dynamic> payload) =>
      jsonEncode(payload);

  /// Exponential backoff: base * 2^retryCount soniya, maks 10 daqiqa.
  /// (base=2: retry 1 → 4s, retry 2 → 8s, ..., retry 9+ → 10 daqiqa)
  static DateTime? _nextRetryAt(
    int retryCount, {
    int backoffBaseSeconds = 2,
  }) {
    final capSeconds = 600; // 10 daqiqa
    final seconds = min(backoffBaseSeconds * (1 << retryCount), capSeconds);
    return DateTime.now().add(Duration(seconds: seconds));
  }
}
