import '../../domain/entities/audit_log_entry.dart';
import '../../domain/repositories/audit_repository.dart';

/// Audit log so'rovlari (read model).
class AuditQueries {
  final AuditRepository _repository;

  AuditQueries({required AuditRepository repository})
      : _repository = repository;

  Future<List<AuditLogEntry>> fetchRecent({int limit = 50}) {
    return _repository.fetchRecent(limit: limit);
  }

  Future<List<AuditLogEntry>> fetchByTarget(
    String targetType,
    String targetId,
  ) {
    return _repository.fetchByTarget(targetType, targetId);
  }

  Future<int> count() => _repository.count();
}
