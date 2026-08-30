import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/app_settings.dart';
import '../../domain/repositories/settings_repository.dart';

/// Zaxira nusxasini yaratish uchun command.
///
/// RBAC (AUDIT P2-02): zaxira barcha ma'lumotlarni o'z ichiga oladi —
/// `manageBackup` ruxsatisiz bajarilmaydi. Ruxsat UI darajasida ham,
/// application layer'da ham tekshiriladi (spec §32: "UI tugmani
/// yashirish security emas").
class CreateBackupCommand {
  final SettingsRepository _repository;
  final AuditService? _audit;

  /// RBAC (§32): zaxira boshqaruvi ruxsati.
  final UserRole actorRole;

  CreateBackupCommand({
    required SettingsRepository repository,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _audit = auditService;

  Future<String> execute() async {
    // RBAC: ruxsat application layer'da tekshiriladi.
    Permissions.require(actorRole, AppPermission.backupCreate);

    final path = await _repository.createBackup();

    // §33: zaxira yaratilishi audit log'ga yoziladi.
    await _audit?.record(
      action: AuditAction.backupCreated,
      targetType: 'backup',
      targetId: path.split('/').last,
    );

    return path;
  }
}
