import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/app_settings.dart';
import '../../domain/repositories/settings_repository.dart';

/// Zaxira faylidan barcha ma'lumotlarni tiklash uchun command.
///
/// Bu DESTRUCTIVE amal — butun baza tanlangan zaxira bilan almashtiriladi.
/// RBAC (AUDIT P2-02): `manageBackup` ruxsatisiz bajarilmaydi. Ruxsat
/// application layer'da tekshiriladi — UI'dan mustaqil (spec §32).
class RestoreBackupCommand {
  final SettingsRepository _repository;
  final AuditService? _audit;

  /// RBAC (§32): zaxira boshqaruvi ruxsati.
  final UserRole actorRole;

  RestoreBackupCommand({
    required SettingsRepository repository,
    AuditService? auditService,
    // AUDIT P2-02 (FAIL CLOSED): actor berilmasa — DENY (admin emas!).
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _audit = auditService;

  Future<void> execute(String backupPath) async {
    // RBAC: ruxsat application layer'da tekshiriladi.
    Permissions.require(actorRole, AppPermission.backupRestore);

    await _repository.restoreBackup(backupPath);

    // §33: tiklash amali audit log'ga yoziladi.
    await _audit?.record(
      action: AuditAction.backupRestored,
      targetType: 'backup',
      targetId: backupPath.split('/').last,
    );
  }
}
