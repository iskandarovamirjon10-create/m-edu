import '../../../../core/event_bus/event_bus.dart';
import '../entities/identity.dart';
import '../entities/identity_activity.dart';

/// Yangi identity ro'yxatdan o'tkazilganda.
class IdentityRegisteredEvent extends DomainEvent {
  final Identity identity;
  @override
  final DateTime occurredAt;

  const IdentityRegisteredEvent(
      {required this.identity, required this.occurredAt});
}

/// Identity holati o'zgarganda (faol → muzlatilgan → bitirgan → arxiv).
class IdentityStatusChangedEvent extends DomainEvent {
  final Identity identity;
  final String previousStatus;
  @override
  final DateTime occurredAt;

  const IdentityStatusChangedEvent({
    required this.identity,
    required this.previousStatus,
    required this.occurredAt,
  });
}

/// Audit-log hodisasi — barcha muhim harakatlar uchun yagona kanal.
class ActivityRecordedEvent extends DomainEvent {
  final IdentityActivity activity;
  @override
  final DateTime occurredAt;

  const ActivityRecordedEvent(
      {required this.activity, required this.occurredAt});
}

/// Ikki identity birlashtirilganda (spec §6 #5 Identity merge/dedup).
class IdentityMergedEvent extends DomainEvent {
  /// Asosiy saqlanadigan identity (survivor).
  final Identity primary;

  /// Birlashtirilgan identity (arxivlangan).
  final Identity duplicate;

  @override
  final DateTime occurredAt;

  const IdentityMergedEvent({
    required this.primary,
    required this.duplicate,
    required this.occurredAt,
  });
}
