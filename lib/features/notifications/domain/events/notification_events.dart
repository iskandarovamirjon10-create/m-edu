import '../../../../core/event_bus/event_bus.dart';
import '../entities/notification.dart';

/// Yangi bildirishnoma yaratilganda.
class NotificationCreatedEvent extends DomainEvent {
  final AppNotification notification;
  @override
  final DateTime occurredAt;

  const NotificationCreatedEvent({
    required this.notification,
    required this.occurredAt,
  });
}

/// Bildirishnoma o'qilganda.
class NotificationReadEvent extends DomainEvent {
  final AppNotification notification;
  @override
  final DateTime occurredAt;

  const NotificationReadEvent({
    required this.notification,
    required this.occurredAt,
  });
}

/// To'lov eslatmasi yuborilganda.
class PaymentReminderSentEvent extends DomainEvent {
  final String studentIdentityId;
  final int amount;
  @override
  final DateTime occurredAt;

  const PaymentReminderSentEvent({
    required this.studentIdentityId,
    required this.amount,
    required this.occurredAt,
  });
}
