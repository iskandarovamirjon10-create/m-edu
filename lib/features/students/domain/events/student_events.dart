import '../../../../core/event_bus/event_bus.dart';
import '../entities/student.dart';

/// Yangi talaba ro'yxatdan o'tkazilganda.
class StudentRegisteredEvent extends DomainEvent {
  final Student student;
  @override
  final DateTime occurredAt;

  const StudentRegisteredEvent({
    required this.student,
    required this.occurredAt,
  });
}

/// Talaba ma'lumotlari o'zgarganda (ota-ona, izoh, akademik yil — §3).
class StudentUpdatedEvent extends DomainEvent {
  final Student student;
  @override
  final DateTime occurredAt;

  const StudentUpdatedEvent({
    required this.student,
    required this.occurredAt,
  });
}

/// Talaba holati o'zgarganda.
class StudentStatusChangedEvent extends DomainEvent {
  final Student student;
  final StudentStatus previousStatus;
  @override
  final DateTime occurredAt;

  const StudentStatusChangedEvent({
    required this.student,
    required this.previousStatus,
    required this.occurredAt,
  });
}

/// Talaba guruhga tayinlanganda.
class StudentAssignedToGroupEvent extends DomainEvent {
  final Student student;
  final String previousGroupId;
  @override
  final DateTime occurredAt;

  const StudentAssignedToGroupEvent({
    required this.student,
    required this.previousGroupId,
    required this.occurredAt,
  });
}

/// Talaba guruhdan o'tkazilganda.
class StudentTransferredEvent extends DomainEvent {
  final Student student;
  final String fromGroupId;
  final String toGroupId;
  @override
  final DateTime occurredAt;

  const StudentTransferredEvent({
    required this.student,
    required this.fromGroupId,
    required this.toGroupId,
    required this.occurredAt,
  });
}

/// Talaba to'lov qilganda.
class StudentPaymentReceivedEvent extends DomainEvent {
  final Student student;
  final int amount;
  @override
  final DateTime occurredAt;

  const StudentPaymentReceivedEvent({
    required this.student,
    required this.amount,
    required this.occurredAt,
  });
}

/// Talaba bitirganda.
class StudentGraduatedEvent extends DomainEvent {
  final Student student;
  @override
  final DateTime occurredAt;

  const StudentGraduatedEvent({
    required this.student,
    required this.occurredAt,
  });
}

/// Talaba butunlay o'chirilganda (hard delete).
class StudentDeletedEvent extends DomainEvent {
  final String identityId;
  @override
  final DateTime occurredAt;

  const StudentDeletedEvent({
    required this.identityId,
    required this.occurredAt,
  });
}
