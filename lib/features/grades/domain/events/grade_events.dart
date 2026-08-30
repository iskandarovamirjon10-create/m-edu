import '../../../../core/event_bus/event_bus.dart';
import '../entities/grade.dart';

/// Yangi baho qo'shilganda e'lon qilinadigan hodisa.
class GradeAddedEvent extends DomainEvent {
  final Grade grade;
  @override
  final DateTime occurredAt;

  const GradeAddedEvent({required this.grade, required this.occurredAt});
}

/// Baho o'chirilganda e'lon qilinadigan hodisa.
class GradeDeletedEvent extends DomainEvent {
  final String gradeId;
  final String studentIdentityId;
  @override
  final DateTime occurredAt;

  const GradeDeletedEvent({
    required this.gradeId,
    required this.studentIdentityId,
    required this.occurredAt,
  });
}
