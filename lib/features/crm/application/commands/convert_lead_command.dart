import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../identity/application/commands/register_identity_command.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/events/lead_events.dart';
import '../../domain/repositories/lead_repository.dart';

/// Lead'ni o'quvchi sifatida konvertatsiya qilish uchun so'rov.
///
/// Konvertatsiya → Identity (role: student) yaratiladi, lead `converted`
/// FINAL holatiga o'tadi va `convertedToIdentityId` bog'lanadi.
/// Identity yaratilishi StudentEnrollmentProjector orqali student
/// yozuvini ham avtomatik yaratadi (Identity → Student oqimi).
class ConvertLeadRequest {
  final String leadId;

  /// O'quvchining familiyasi (lead fullName'dan ajratiladi).
  final String lastName;

  const ConvertLeadRequest({required this.leadId, required this.lastName});
}

/// `ConvertLead` command'i — pipeline yakuni: lead → Identity+Student.
///
/// Oqim: mavjudligi → final emasligi → Identity registratsiyasi →
/// lead'ni `converted` ga o'tkazish + `convertedToIdentityId` → activity
/// (CONVERTED) → audit → event (LeadConvertedEvent).
class ConvertLeadCommand {
  final LeadRepository _repository;
  final RegisterIdentityCommand _registerIdentity;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: default `unknown` — DENY (fail-closed).
  final UserRole actorRole;

  ConvertLeadCommand({
    required LeadRepository repository,
    required RegisterIdentityCommand registerIdentity,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _registerIdentity = registerIdentity,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Lead> execute(ConvertLeadRequest request) async {
    // RBAC: lead tahrirlash + identity yaratish uchun ruxsat.
    Permissions.require(actorRole, AppPermission.crmLeadsEdit);
    Permissions.require(actorRole, AppPermission.studentsCreate);

    final lead = await _repository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw NotFoundFailure('Lead topilmadi: ${request.leadId}');
    }
    if (lead.isStageFinal) {
      throw ValidationFailure(
        'Lead final holatda (${_stageLabel(lead.stage)}) — '
        'konvertatsiya qilib bo\'lmaydi.',
      );
    }

    final names = _splitName(lead.fullName, request.lastName);
    final now = DateTime.now();

    // Identity — o'quvchi sifatida ro'yxatdan o'tkaziladi.
    final identity = await _registerIdentity.execute(
      RegisterIdentityRequest(
        firstName: names.$1,
        lastName: names.$2,
        role: IdentityRole.student,
        phone: lead.phone,
        email: lead.email,
      ),
    );

    final updated = lead.copyWith(
      stage: LeadStage.converted,
      convertedToIdentityId: identity.identityId,
      updatedAt: now,
      syncVersion: lead.syncVersion + 1,
    );
    final saved = await _repository.update(updated);

    final activity = LeadActivity(
      leadId: saved.leadId,
      type: LeadActivityTypes.converted,
      description: 'Lead o\'quvchi sifatida konvertatsiya qilindi — '
          'ID: ${identity.identityId}',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(LeadConvertedEvent(
      lead: saved,
      identityId: identity.identityId,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.leadConverted,
      targetType: 'lead',
      targetId: saved.leadId,
      details: '${saved.fullName} → Identity ${identity.identityId}',
    );

    return saved;
  }

  /// `fullName`'dan ism/familiyani ajratadi. `lastName` alohida berilmagan
  /// bo'lsa fullName'ning oxirgi so'zi familiya sifatida olinadi.
  (String, String) _splitName(String fullName, String lastName) {
    final trimmed = lastName.trim();
    if (trimmed.isNotEmpty) {
      final firstName = fullName.trim().replaceFirst(RegExp('\\s+.*'), '');
      return (firstName.isEmpty ? fullName.trim() : firstName, trimmed);
    }
    final parts = fullName.trim().split(RegExp('\\s+'));
    if (parts.length >= 2) {
      return (parts.sublist(0, parts.length - 1).join(' '), parts.last);
    }
    return (fullName.trim(), '');
  }

  static String _stageLabel(LeadStage stage) {
    return switch (stage) {
      LeadStage.newLead => 'Yangi',
      LeadStage.contacted => 'Bog\'lanildi',
      LeadStage.trialScheduled => 'Sinov darsiga yozilgan',
      LeadStage.converted => 'Konvertatsiya qilingan',
      LeadStage.lost => 'Yo\'qotilgan',
    };
  }
}
