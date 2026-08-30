import 'package:isar/isar.dart';

import '../models/audit_log_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan audit datasource.
class IsarAuditDataSource {
  final Isar _db;

  IsarAuditDataSource(this._db);

  Future<void> insert(AuditLogRecord record) async {
    await _db.writeTxn(() async {
      await _db.auditLogRecords.put(record);
    });
  }

  Future<List<AuditLogRecord>> findRecent({int limit = 50}) {
    return _db.auditLogRecords
        .where()
        .sortByOccurredAtDesc()
        .limit(limit)
        .findAll();
  }

  Future<List<AuditLogRecord>> findByTarget(
    String targetType,
    String targetId,
  ) {
    return _db.auditLogRecords
        .filter()
        .targetTypeEqualTo(targetType)
        .targetIdEqualTo(targetId)
        .sortByOccurredAtDesc()
        .findAll();
  }

  Future<int> count() {
    return _db.auditLogRecords.count();
  }
}
