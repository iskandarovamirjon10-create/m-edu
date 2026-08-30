import '../../../../core/event_bus/event_bus.dart';
import '../entities/schedule.dart';
import '../entities/room.dart';

/// Yangi jadval yaratilganda.
class ScheduleCreatedEvent extends DomainEvent {
  final Schedule schedule;
  @override
  final DateTime occurredAt;

  const ScheduleCreatedEvent({
    required this.schedule,
    required this.occurredAt,
  });
}

/// Yangi xona yaratilganda.
class RoomCreatedEvent extends DomainEvent {
  final Room room;
  @override
  final DateTime occurredAt;

  const RoomCreatedEvent({required this.room, required this.occurredAt});
}

/// Jadval bekor qilinganda.
class ScheduleCancelledEvent extends DomainEvent {
  final Schedule schedule;
  @override
  final DateTime occurredAt;

  const ScheduleCancelledEvent({
    required this.schedule,
    required this.occurredAt,
  });
}

/// Vaqt to'qnashuvi aniqlanganda.
class ScheduleConflictDetectedEvent extends DomainEvent {
  final Schedule conflictingSchedule;
  final String message;
  @override
  final DateTime occurredAt;

  const ScheduleConflictDetectedEvent({
    required this.conflictingSchedule,
    required this.message,
    required this.occurredAt,
  });
}

/// Xona holati o'zgarganda.
class RoomStatusChangedEvent extends DomainEvent {
  final Room room;
  final RoomStatus previousStatus;
  @override
  final DateTime occurredAt;

  const RoomStatusChangedEvent({
    required this.room,
    required this.previousStatus,
    required this.occurredAt,
  });
}
