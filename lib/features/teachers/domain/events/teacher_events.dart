import '../../../../core/event_bus/event_bus.dart';
import '../entities/teacher.dart';

/// Yangi o'qituvchi ro'yxatdan o'tkazilganda.
class TeacherRegisteredEvent extends DomainEvent {
  final Teacher teacher;
  @override
  final DateTime occurredAt;

  const TeacherRegisteredEvent({
    required this.teacher,
    required this.occurredAt,
  });
}

/// O'qituvchi ma'lumotlari yangilanganda (profil tahriri).
class TeacherUpdatedEvent extends DomainEvent {
  final Teacher teacher;
  @override
  final DateTime occurredAt;

  const TeacherUpdatedEvent({
    required this.teacher,
    required this.occurredAt,
  });
}

/// O'qituvchi guruhga tayinlanganda.
class TeacherAssignedToGroupEvent extends DomainEvent {
  final Teacher teacher;
  final String groupId;
  @override
  final DateTime occurredAt;

  const TeacherAssignedToGroupEvent({
    required this.teacher,
    required this.groupId,
    required this.occurredAt,
  });
}

/// O'qituvchi guruhdan chiqarilganda.
class TeacherRemovedFromGroupEvent extends DomainEvent {
  final Teacher teacher;
  final String groupId;
  @override
  final DateTime occurredAt;

  const TeacherRemovedFromGroupEvent({
    required this.teacher,
    required this.groupId,
    required this.occurredAt,
  });
}

/// O'qituvchi holati o'zgarganda.
class TeacherStatusChangedEvent extends DomainEvent {
  final Teacher teacher;
  final TeacherStatus previousStatus;
  @override
  final DateTime occurredAt;

  const TeacherStatusChangedEvent({
    required this.teacher,
    required this.previousStatus,
    required this.occurredAt,
  });
}

/// O'qituvchi butunlay o'chirilganda (hard delete).
class TeacherDeletedEvent extends DomainEvent {
  final String identityId;
  @override
  final DateTime occurredAt;

  const TeacherDeletedEvent({
    required this.identityId,
    required this.occurredAt,
  });
}
