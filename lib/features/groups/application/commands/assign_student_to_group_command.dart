import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../students/domain/events/student_events.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/events/group_events.dart';
import '../../domain/repositories/group_repository.dart';

/// O'quvchini guruhga qo'shish command'i.
///
/// Oqim: guruh va talabani topish → validatsiya (faollik, bandlik,
/// sig'im) → talabani guruhga tayinlash (groupId/groupName/assignedAt) →
/// guruh `currentSize` oshirish → event'lar tarqatish (UI avtomatik
/// yangilanadi, qo'lda refresh shart emas).
class AssignStudentToGroupCommand {
  final GroupRepository _groupRepository;
  final StudentRepository _studentRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): guruh tarkibi boshqaruvi.
  final UserRole actorRole;

  AssignStudentToGroupCommand({
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
    if (!student.isActive) {
      throw const ValidationFailure(
        'Faqat faol o\'quvchilarni guruhga qo\'shish mumkin',
      );
    }
    if (student.groupId == groupId) {
      throw const ValidationFailure(
        'O\'quvchi allaqachon shu guruhda',
      );
    }
    if (student.groupId != null) {
      throw ValidationFailure(
        'O\'quvchi boshqa guruhga tayinlangan '
        '(${student.groupName ?? student.groupId}) — avval o\'sha '
        'guruhdan chiqaring',
      );
    }
    if (!group.hasAvailableSlots) {
      throw ValidationFailure(
        'Guruh to\'lgan (${group.currentSize}/${group.capacity}) — '
        'avval o\'rin bo\'shating',
      );
    }

    final updatedStudent = await _studentRepository.update(
      student.copyWith(
        groupId: groupId,
        groupName: group.name,
        assignedAt: now,
      ),
    );
    final updatedGroup = await _groupRepository.addMember(groupId);

    _eventBus.publish(StudentAssignedToGroupEvent(
      student: updatedStudent,
      previousGroupId: student.groupId ?? '',
      occurredAt: now,
    ));
    _eventBus.publish(GroupMemberAddedEvent(
      group: updatedGroup,
      studentIdentityId: studentIdentityId,
      occurredAt: now,
    ));
  }
}
