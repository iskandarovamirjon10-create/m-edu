import '../../../../core/event_bus/event_bus.dart';
import '../entities/lead.dart';

/// Yangi lead qo'lga kiritilganda (CaptureLeadCommand natijasi).
class LeadCapturedEvent extends DomainEvent {
  final Lead lead;
  @override
  final DateTime occurredAt;

  const LeadCapturedEvent({required this.lead, required this.occurredAt});
}

/// Pipeline bosqichi o'zgarganda (AdvanceLeadStageCommand).
class LeadStageChangedEvent extends DomainEvent {
  final Lead lead;
  final LeadStage fromStage;
  final LeadStage toStage;
  @override
  final DateTime occurredAt;

  const LeadStageChangedEvent({
    required this.lead,
    required this.fromStage,
    required this.toStage,
    required this.occurredAt,
  });
}

/// Lead yo'qotilgan deb belgilanganda (MarkLeadLostCommand — sabab bilan).
class LeadLostEvent extends DomainEvent {
  final Lead lead;
  final String reason;
  @override
  final DateTime occurredAt;

  const LeadLostEvent({
    required this.lead,
    required this.reason,
    required this.occurredAt,
  });
}

/// Lead Identity+Student sifatida konvertatsiya qilinganda
/// (ConvertLeadCommand). `identityId` — yaratilgan Identity Real ID.
class LeadConvertedEvent extends DomainEvent {
  final Lead lead;
  final String identityId;
  @override
  final DateTime occurredAt;

  const LeadConvertedEvent({
    required this.lead,
    required this.identityId,
    required this.occurredAt,
  });
}

/// Lead ma'lumotlari (mas'ul, izoh, telefon, email) tahrirlanganda
/// (UpdateLeadDetailsCommand). UI'ning stale qolmasligi uchun version
/// bump event_sync'da eshitiladi.
class LeadUpdatedEvent extends DomainEvent {
  final Lead lead;
  @override
  final DateTime occurredAt;

  const LeadUpdatedEvent({required this.lead, required this.occurredAt});
}

/// Keyingi aloqa sanasi belgilanganda (ScheduleFollowUpCommand).
/// Phase 2'da Notifications moduli shu event'ni eshitib eslatma yuboradi.
class LeadFollowUpScheduledEvent extends DomainEvent {
  final Lead lead;
  final DateTime followUpAt;
  @override
  final DateTime occurredAt;

  const LeadFollowUpScheduledEvent({
    required this.lead,
    required this.followUpAt,
    required this.occurredAt,
  });
}
