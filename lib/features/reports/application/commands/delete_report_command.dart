import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/repositories/report_repository.dart';

/// Saqlangan hisobotni o'chirish uchun command.
///
/// AUDIT P2-02 (F2): Ilgari `ReportQueries.deleteReport` — QUERY klass
/// ichida RBACsiz DELETE bajarilardi (har qanday autentifikatsiyalangan
/// foydalanuvchi hisobotlarni o'chira olardi). Endi authorization
/// application layer'da majburiy tekshiriladi (spec §32).
class DeleteReportCommand {
  final ReportRepository _repository;
  final AuditService? _audit;

  /// RBAC: hisobot o'chirish ruxsati.
  final UserRole actorRole;

  DeleteReportCommand({
    required ReportRepository repository,
    AuditService? auditService,
    // FAIL CLOSED: actor berilmasa — DENY.
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _audit = auditService;

  Future<void> execute(String reportId) async {
    Permissions.require(actorRole, AppPermission.reportsDelete);

    if (reportId.trim().isEmpty) {
      throw const ValidationFailure("Hisobot ID bo'sh bo'lishi mumkin emas");
    }

    await _repository.deleteReport(reportId);

    await _audit?.record(
      action: AuditAction.reportDeleted,
      targetType: 'report',
      targetId: reportId,
    );
  }
}
