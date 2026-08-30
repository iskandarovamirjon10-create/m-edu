import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/grade.dart';
import '../../domain/events/grade_events.dart';
import '../../domain/repositories/grade_repository.dart';

/// Yangi baho qo'shish uchun so'rov.
class AddGradeRequest {
  final String studentIdentityId;
  final String studentName;
  final String? groupId;
  final String? groupName;
  final String subjectId;
  final String subjectName;

  /// 5-ballik tizim: 2..5.
  final int value;
  final String? comment;
  final DateTime date;

  const AddGradeRequest({
    required this.studentIdentityId,
    required this.studentName,
    this.groupId,
    this.groupName,
    required this.subjectId,
    required this.subjectName,
    required this.value,
    this.comment,
    required this.date,
  });
}

/// `AddGrade` command'i — RBAC + audit + event (CQS pattern).
class AddGradeCommand {
  final GradeRepository _repository;
  final EventBus _eventBus;
  final UserRole actorRole;

  AddGradeCommand({
    required GradeRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Grade> execute(AddGradeRequest request) async {
    Permissions.require(actorRole, AppPermission.gradesCreate);
    _validate(request);

    final grade = Grade(
      gradeId: _generateGradeId(),
      studentIdentityId: request.studentIdentityId,
      studentName: request.studentName,
      groupId: request.groupId,
      groupName: request.groupName,
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      value: request.value,
      comment: request.comment?.trim().isEmpty == true
          ? null
          : request.comment?.trim(),
      date: request.date,
    );

    final saved = await _repository.save(grade);

    _eventBus.publish(GradeAddedEvent(
      grade: saved,
      occurredAt: DateTime.now(),
    ));

    return saved;
  }

  void _validate(AddGradeRequest request) {
    if (request.studentIdentityId.trim().isEmpty) {
      throw const ValidationFailure('O\'quvchi tanlanmagan');
    }
    if (request.subjectId.trim().isEmpty) {
      throw const ValidationFailure('Fan tanlanmagan');
    }
    if (request.value < 2 || request.value > 5) {
      throw const ValidationFailure('Baho 2 dan 5 gacha bo\'lishi shart');
    }
  }

  String _generateGradeId() {
    final random = Random();
    final ts = DateTime.now().millisecondsSinceEpoch;
    return 'GRD-$ts-${random.nextInt(9999).toString().padLeft(4, '0')}';
  }
}
