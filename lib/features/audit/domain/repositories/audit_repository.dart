import '../entities/audit_log_entry.dart';

/// Audit log repository interfeysi.
abstract class AuditRepository {
  /// Yangi audit yozuvini saqlaydi.
  Future<void> record(AuditLogEntry entry);

  /// So'nggi [limit] ta yozuv (yangi birinchi).
  Future<List<AuditLogEntry>> fetchRecent({int limit = 50});

  /// Maqsad (target) bo'yicha yozuvlar.
  Future<List<AuditLogEntry>> fetchByTarget(String targetType, String targetId);

  /// Umumiy yozuvlar soni.
  Future<int> count();
}
