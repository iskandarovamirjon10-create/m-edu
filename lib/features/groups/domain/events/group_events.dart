import '../../../../core/event_bus/event_bus.dart';
import '../entities/group.dart';

/// Yangi guruh yaratilganda.
class GroupCreatedEvent extends DomainEvent {
  final Group group;
  @override
  final DateTime occurredAt;

  const GroupCreatedEvent({required this.group, required this.occurredAt});
}

/// Guruhga yangi a'zo qo'shilganda.
class GroupMemberAddedEvent extends DomainEvent {
  final Group group;
  final String studentIdentityId;
  @override
  final DateTime occurredAt;

  const GroupMemberAddedEvent({
    required this.group,
    required this.studentIdentityId,
    required this.occurredAt,
  });
}

/// Guruhdan a'zo chiqarilganda.
class GroupMemberRemovedEvent extends DomainEvent {
  final Group group;
  final String studentIdentityId;
  @override
  final DateTime occurredAt;

  const GroupMemberRemovedEvent({
    required this.group,
    required this.studentIdentityId,
    required this.occurredAt,
  });
}

/// Guruh ma'lumotlari tahrirlanganda.
class GroupUpdatedEvent extends DomainEvent {
  final Group group;
  final Group previousGroup;
  @override
  final DateTime occurredAt;

  const GroupUpdatedEvent({
    required this.group,
    required this.previousGroup,
    required this.occurredAt,
  });
}

/// Guruh holati o'zgarganda.
class GroupStatusChangedEvent extends DomainEvent {
  final Group group;
  final GroupStatus previousStatus;
  @override
  final DateTime occurredAt;

  const GroupStatusChangedEvent({
    required this.group,
    required this.previousStatus,
    required this.occurredAt,
  });
}
