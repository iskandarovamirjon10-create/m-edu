import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/events/lead_events.dart';
import '../../domain/repositories/lead_repository.dart';

/// Keyingi aloqa (follow-up) sanasini belgilash uchun so'rov.
class ScheduleFollowUpRequest {
  final String leadId;

  /// Rejalashtirilgan aloqa vaqti.
  final DateTime followUpAt;

  const ScheduleFollowUpRequest({
    required this.leadId,
    required this.followUpAt,
  });
}

/// `ScheduleFollowUp` command'i — lead uchun keyingi aloqa sanasini
/// belgilaydi (Phase 2'da Notifications moduli eslatma yuboradi).
///
/// Oqim: mavjudligi → sana validatsiyasi → `nextFollowUpAt` → scoring →
/// saqlash → activity (FOLLOW_UP_SCHEDULED) → audit → event.
class ScheduleFollowUpCommand {
  final LeadRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: default `unknown` — DENY (fail-closed).
  final UserRole actorRole;

  ScheduleFollowUpCommand({
    required LeadRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Lead> execute(ScheduleFollowUpRequest request) async {
    Permissions.require(actorRole, AppPermission.crmLeadsEdit);

    final followUpAt = request.followUpAt;
    if (followUpAt.isBefore(DateTime.now())) {
      throw const ValidationFailure(
        'Follow-up vaqti kelajakda bo\'lishi kerak',
      );
    }

    final lead = await _repository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw NotFoundFailure('Lead topilmadi: ${request.leadId}');
    }
    if (lead.isStageFinal) {
      throw ValidationFailure(
        'Lead final holatda (${_stageLabel(lead.stage)}) — '
        'follow-up belgilab bo\'lmaydi.',
      );
    }

    final now = DateTime.now();
    final updated = lead.copyWith(
      nextFollowUpAt: followUpAt,
      updatedAt: now,
      syncVersion: lead.syncVersion + 1,
    );
    final saved = await _repository.update(updated);

    final activity = LeadActivity(
      leadId: saved.leadId,
      type: LeadActivityTypes.followUpScheduled,
      description: 'Keyingi aloqa: ${_format(followUpAt)}',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(LeadFollowUpScheduledEvent(
      lead: saved,
      followUpAt: followUpAt,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.leadFollowUpScheduled,
      targetType: 'lead',
      targetId: saved.leadId,
      details: '${saved.fullName} — ${_format(followUpAt)}',
    );

    return saved;
  }

  static String _format(DateTime date) {
    final hh = date.hour.toString().padLeft(2, '0');
    final mm = date.minute.toString().padLeft(2, '0');
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')} $hh:$mm';
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
