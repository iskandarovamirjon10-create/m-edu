import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/events/grade_events.dart';
import '../../domain/repositories/grade_repository.dart';

/// `DeleteGrade` command'i — RBAC + event (CQS pattern).
class DeleteGradeCommand {
  final GradeRepository _repository;
  final EventBus _eventBus;
  final UserRole actorRole;

  DeleteGradeCommand({
    required GradeRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<void> execute(String gradeId) async {
    Permissions.require(actorRole, AppPermission.gradesCreate);

    final existing = await _repository.fetchById(gradeId);
    if (existing == null) return;

    await _repository.delete(gradeId);

    _eventBus.publish(GradeDeletedEvent(
      gradeId: existing.gradeId,
      studentIdentityId: existing.studentIdentityId,
      occurredAt: DateTime.now(),
    ));
  }
}
