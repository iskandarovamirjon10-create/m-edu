import 'package:isar/isar.dart';

import '../models/sync_cursor_record.dart';

/// Pull cursor (watermark) datasource — per entityType oxirgi qo'llangan
/// server vaqti. Sync contract §5, §10.
class SyncCursorDataSource {
  final Isar _db;

  SyncCursorDataSource(this._db);

  /// Joriy cursor — mavjud bo'lmasa null (bootstrap kerak).
  Future<SyncCursorRecord?> get(String entityType) {
    return _db.syncCursorRecords
        .filter()
        .entityTypeEqualTo(entityType)
        .findFirst();
  }

  /// Cursor'ni yangilaydi (upsert — unique entityType indeksi).
  Future<void> set(String entityType, DateTime lastPulledAt) async {
    await _db.writeTxn(() async {
      final existing = await _db.syncCursorRecords
          .filter()
          .entityTypeEqualTo(entityType)
          .findFirst();
      final record = existing ?? SyncCursorRecord();
      record
        ..entityType = entityType
        ..lastPulledAt = lastPulledAt
        ..updatedAt = DateTime.now();
      await _db.syncCursorRecords.put(record);
    });
  }
}
