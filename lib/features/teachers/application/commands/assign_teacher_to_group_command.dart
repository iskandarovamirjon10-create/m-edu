import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/teacher.dart';
import '../../domain/events/teacher_events.dart';
import '../../domain/repositories/teacher_repository.dart';

/// O'qituvchini guruhga tayinlash uchun command.
class AssignTeacherToGroupCommand {
  final TeacherRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): guruh tarkibi boshqaruvi.
  final UserRole actorRole;

  AssignTeacherToGroupCommand({
    required TeacherRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Teacher> execute(String identityId, String groupId) async {
    Permissions.require(actorRole, AppPermission.groupsEdit);

    final teacher = await _repository.fetchByIdentityId(identityId);
    if (teacher == null) {
      throw NotFoundFailure('O\'qituvchi topilmadi: $identityId');
    }
    if (!teacher.isActive) {
      throw const ValidationFailure(
        'Faqat faol o\'qituvchilarni guruhga tayinlash mumkin',
      );
    }
    if (teacher.hasGroup(groupId)) {
      throw const ValidationFailure(
        'O\'qituvchi allaqachon shu guruhda',
      );
    }
    if (!teacher.isAvailable) {
      throw const ValidationFailure(
        'O\'qituvchining bandlik chegarasi yetdi',
      );
    }

    final updated = await _repository.assignToGroup(identityId, groupId);

    _eventBus.publish(TeacherAssignedToGroupEvent(
      teacher: updated,
      groupId: groupId,
      occurredAt: DateTime.now(),
    ));

    return updated;
  }
}
