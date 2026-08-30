import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/audit_log_entry.dart';
import '../../domain/repositories/audit_repository.dart';
import '../datasources/isar_audit_datasource.dart';
import '../models/audit_log_record.dart';

/// [AuditRepository] interfeysining Isar asosidagi implementatsiyasi.
class AuditRepositoryImpl implements AuditRepository {
  final IsarAuditDataSource _datasource;

  AuditRepositoryImpl(this._datasource);

  @override
  Future<void> record(AuditLogEntry entry) async {
    await _datasource.insert(_toRecord(entry));
  }

  @override
  Future<List<AuditLogEntry>> fetchRecent({int limit = 50}) async {
    final records = await _datasource.findRecent(limit: limit);
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7: audit log hech qachon
    // noto'g'ri amalni ko'rsatmaydi, app crash qilmaydi).
    return records.map(_toEntity).whereType<AuditLogEntry>().toList();
  }

  @override
  Future<List<AuditLogEntry>> fetchByTarget(
    String targetType,
    String targetId,
  ) async {
    final records = await _datasource.findByTarget(targetType, targetId);
    return records.map(_toEntity).whereType<AuditLogEntry>().toList();
  }

  @override
  Future<int> count() => _datasource.count();

  AuditLogRecord _toRecord(AuditLogEntry entry) {
    return AuditLogRecord()
      ..auditId = entry.auditId
      ..actorUserId = entry.actorUserId
      ..actorName = entry.actorName
      ..action = entry.action.name
      ..occurredAt = entry.occurredAt
      ..targetType = entry.targetType
      ..targetId = entry.targetId
      ..result = entry.result.name
      ..details = entry.details;
  }

  /// [AuditLogEntry]'ga xavfsiz o'giradi. Enum qiymatlari nomuvofiq
  /// (corrupt/legacy yozuv) bo'lsa `null` qaytaradi — ro'yxatda o'tkazib
  /// yuboriladi, crash YO'Q (spec §7, §17).
  AuditLogEntry? _toEntity(AuditLogRecord record) {
    final action = tryEnumByName(AuditAction.values, record.action);
    final result = tryEnumByName(AuditResult.values, record.result);
    if (action == null || result == null) return null;
    return AuditLogEntry(
      auditId: record.auditId,
      actorUserId: record.actorUserId,
      actorName: record.actorName,
      action: action,
      occurredAt: record.occurredAt,
      targetType: record.targetType,
      targetId: record.targetId,
      result: result,
      details: record.details,
    );
  }
}
