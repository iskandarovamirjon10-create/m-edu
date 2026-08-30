import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/audit_log_entry.dart';
import '../../domain/repositories/audit_repository.dart';

/// Audit yozuvini bajaruvchi shaxs (who).
class AuditActor {
  final String userId;
  final String name;
  final UserRole role;

  const AuditActor({
    required this.userId,
    required this.name,
    required this.role,
  });

  /// Joriy foydalanuvchi haqida ma'lumot bo'lmasa (masalan, background
  /// ish paytida) ishlatiladigan standart aktor.
  static const system = AuditActor(
    userId: 'system',
    name: 'Tizim',
    role: UserRole.superAdmin,
  );
}

/// Audit log xizmati — muhim mutatsiyalarni "who/what/when/target/result"
/// shaklida qayd etadi (§33).
///
/// Maxfiy qiymatlar yozilmaydi: [details] faqat biznes-kontekstni o'z
/// ichiga oladi (ID, nom, summa) — parol, token, yuz vektori YO'Q.
class AuditService {
  final AuditRepository _repository;
  final Future<AuditActor> Function() _actorLoader;

  AuditService({
    required AuditRepository repository,
    required Future<AuditActor> Function() actorLoader,
  })  : _repository = repository,
        _actorLoader = actorLoader;

  Future<void> record({
    required AuditAction action,
    required String targetType,
    required String targetId,
    AuditResult result = AuditResult.success,
    String? details,
  }) async {
    final actor = await _actorLoader();
    final now = DateTime.now();
    final entry = AuditLogEntry(
      auditId: 'AUD-${now.millisecondsSinceEpoch}-'
          '${targetId.hashCode.abs().toString().padLeft(6, '0')}',
      actorUserId: actor.userId,
      actorName: actor.name,
      action: action,
      occurredAt: now,
      targetType: targetType,
      targetId: targetId,
      result: result,
      details: details,
    );
    await _repository.record(entry);
  }

  /// Muvaffaqiyatsiz amalni ham qayd etish (result=failed).
  Future<void> recordFailure({
    required AuditAction action,
    required String targetType,
    required String targetId,
    String? details,
  }) {
    return record(
      action: action,
      targetType: targetType,
      targetId: targetId,
      result: AuditResult.failed,
      details: details,
    );
  }
}
