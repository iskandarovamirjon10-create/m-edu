import 'package:isar/isar.dart';

part 'audit_log_record.g.dart';

/// `AuditLogEntry` entity'sining Isar'da saqlanadigan ko'rinishi (§33).
@collection
class AuditLogRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String auditId;

  late String actorUserId;

  late String actorName;

  late String action;

  @Index()
  late DateTime occurredAt;

  late String targetType;

  late String targetId;

  late String result;

  String? details;
}
