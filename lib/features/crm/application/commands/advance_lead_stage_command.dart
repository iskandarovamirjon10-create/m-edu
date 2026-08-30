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
import '../../domain/services/lead_score_calculator.dart';

/// Pipeline bosqichini o'zgartirish uchun so'rov.
class AdvanceLeadStageRequest {
  final String leadId;
  final LeadStage newStage;

  const AdvanceLeadStageRequest({
    required this.leadId,
    required this.newStage,
  });
}

/// `AdvanceLeadStage` command'i — pipeline bosqichini ilgari surish.
///
/// Oqim (spec §4): joriy stage FINAL emasligini tekshirish → yangi stage
/// → `lastContactedAt` yangilash (agar contacted'ga o'tsa) → scoring →
/// saqlash → activity → audit → event.
///
/// Qoidalar:
/// - `converted`/`lost` — FINAL holatlar, ulardan QAYTISH mumkin emas
///   (reopen — alohida audit-log'langan amal bo'ladi).
/// - `converted`/`lost` bosqichlariga bu command orqali o'tish MUMKIN EMAS
///   — ular alohida command'lar orqali (ConvertLeadCommand,
///   MarkLeadLostCommand) o'rnatiladi.
/// - Orqaga qaytish (masalan trialScheduled → contacted) final bo'lmagan
///   bosqichlar orasida ruxsat etiladi (xato tuzatish uchun).
class AdvanceLeadStageCommand {
  final LeadRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: default `unknown` — DENY (fail-closed).
  final UserRole actorRole;

  AdvanceLeadStageCommand({
    required LeadRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Lead> execute(AdvanceLeadStageRequest request) async {
    // RBAC: ruxsat application layer'da tekshiriladi (UI'dan mustaqil).
    Permissions.require(actorRole, AppPermission.crmLeadsEdit);

    final lead = await _repository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw NotFoundFailure("Lead topilmadi: ${request.leadId}");
    }

    _validateTransition(lead, request.newStage);

    final now = DateTime.now();
    final updated = lead.copyWith(
      stage: request.newStage,
      // contacted bosqichiga o'tsa — lastContactedAt yangilanadi (spec §4).
      lastContactedAt: request.newStage == LeadStage.contacted
          ? now
          : lead.lastContactedAt,
      updatedAt: now,
      syncVersion: lead.syncVersion + 1,
    );

    // Scoring — bosqich o'zgarishi "sovib qolish" qoidasiga ta'sir qiladi,
    // shuning uchun har safar qayta hisoblanadi (spec §3.3).
    final scored = updated.copyWith(
      score: LeadScoreCalculator.calculate(updated, now: now).score,
    );

    final saved = await _repository.update(scored);

    final activity = LeadActivity(
      leadId: saved.leadId,
      type: LeadActivityTypes.stageChanged,
      description:
          'Bosqich o\'zgardi: ${_stageLabel(lead.stage)} → '
          '${_stageLabel(saved.stage)}',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(LeadStageChangedEvent(
      lead: saved,
      fromStage: lead.stage,
      toStage: saved.stage,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.leadStageChanged,
      targetType: 'lead',
      targetId: saved.leadId,
      details: '${saved.fullName} — '
          '${_stageLabel(lead.stage)} → ${_stageLabel(saved.stage)}',
    );

    return saved;
  }

  void _validateTransition(Lead lead, LeadStage newStage) {
    // Final holatdan qaytish — taqiqlangan (reopen alohida amal).
    if (lead.isStageFinal) {
      throw ValidationFailure(
        'Lead final holatda (${_stageLabel(lead.stage)}). '
        'Final holatdan qaytish mumkin emas — qayta ochish alohida amal.',
      );
    }
    // converted/lost — alohida command'lar orqali o'rnatiladi.
    if (newStage == LeadStage.converted || newStage == LeadStage.lost) {
      throw ValidationFailure(
        '${_stageLabel(newStage)} bosqichi alohida amal orqali o\'rnatiladi.',
      );
    }
    // No-op: bir xil bosqichga o'tish keraksiz.
    if (newStage == lead.stage) {
      throw ValidationFailure(
        'Lead allaqachon ${_stageLabel(newStage)} bosqichida.',
      );
    }
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
