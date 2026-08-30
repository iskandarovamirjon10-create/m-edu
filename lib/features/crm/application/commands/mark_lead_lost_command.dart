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

/// Lead'ni yo'qotilgan deb belgilash uchun so'rov.
class MarkLeadLostRequest {
  final String leadId;

  /// Yo'qotish sababi — MAJBURIY (spec §4: sababsiz lost bo'lmaydi).
  final String reason;

  const MarkLeadLostRequest({required this.leadId, required this.reason});
}

/// `MarkLeadLost` command'i — lead'ni FINAL `lost` holatiga o'tkazadi.
///
/// Oqim: mavjudligi → final emasligi → `lost` + `lostReason` → scoring →
/// saqlash → activity (MARKED_LOST) → audit → event (LeadLostEvent).
class MarkLeadLostCommand {
  final LeadRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: default `unknown` — DENY (fail-closed).
  final UserRole actorRole;

  MarkLeadLostCommand({
    required LeadRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Lead> execute(MarkLeadLostRequest request) async {
    Permissions.require(actorRole, AppPermission.crmLeadsEdit);

    final reason = request.reason.trim();
    if (reason.isEmpty) {
      throw const ValidationFailure('Yo\'qotish sababi kiritilishi shart');
    }

    final lead = await _repository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw NotFoundFailure('Lead topilmadi: ${request.leadId}');
    }
    if (lead.isStageFinal) {
      throw ValidationFailure(
        'Lead final holatda (${_stageLabel(lead.stage)}) — '
        'yo\'qotilgan deb belgilab bo\'lmaydi.',
      );
    }

    final now = DateTime.now();
    final updated = lead.copyWith(
      stage: LeadStage.lost,
      lostReason: reason,
      updatedAt: now,
      syncVersion: lead.syncVersion + 1,
    );
    final saved = await _repository.update(updated);

    final activity = LeadActivity(
      leadId: saved.leadId,
      type: LeadActivityTypes.markedLost,
      description: 'Lead yo\'qotilgan deb belgilandi. Sabab: $reason',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(LeadLostEvent(
      lead: saved,
      reason: reason,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.leadMarkedLost,
      targetType: 'lead',
      targetId: saved.leadId,
      details: '${saved.fullName} — sabab: $reason',
    );

    return saved;
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
