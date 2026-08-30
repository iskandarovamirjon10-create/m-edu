import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../students/domain/events/student_events.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/events/group_events.dart';
import '../../domain/repositories/group_repository.dart';

/// O'quvchini guruhdan chiqarish command'i.
///
/// Oqim: guruh va talabani topish → validatsiya (talaba shu guruhda) →
/// talabadan guruh ma'lumotlarini tozalash → guruh `currentSize`
/// kamaytirish → event'lar tarqatish.
class RemoveStudentFromGroupCommand {
  final GroupRepository _groupRepository;
  final StudentRepository _studentRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): guruh tarkibi boshqaruvi.
  final UserRole actorRole;

  RemoveStudentFromGroupCommand({
    required GroupRepository groupRepository,
    required StudentRepository studentRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _groupRepository = groupRepository,
        _studentRepository = studentRepository,
        _eventBus = eventBus;

  Future<void> execute({
    required String groupId,
    required String studentIdentityId,
  }) async {
    Permissions.require(actorRole, AppPermission.groupsEdit);

    final now = DateTime.now();

    final group = await _groupRepository.fetchById(groupId);
    if (group == null) {
      throw NotFoundFailure('Guruh topilmadi: $groupId');
    }

    final student = await _studentRepository.fetchByIdentityId(
      studentIdentityId,
    );
    if (student == null) {
      throw NotFoundFailure('O\'quvchi topilmadi: $studentIdentityId');
    }
    if (student.groupId != groupId) {
      throw const ValidationFailure(
        'O\'quvchi bu guruhda emas',
      );
    }

    final updatedStudent = await _studentRepository.update(
      student.copyWith(
        groupId: null,
        groupName: null,
        assignedAt: null,
      ),
    );
    final updatedGroup = await _groupRepository.removeMember(groupId);

    _eventBus.publish(StudentAssignedToGroupEvent(
      student: updatedStudent,
      previousGroupId: groupId,
      occurredAt: now,
    ));
    _eventBus.publish(GroupMemberRemovedEvent(
      group: updatedGroup,
      studentIdentityId: studentIdentityId,
      occurredAt: now,
    ));
  }
}
