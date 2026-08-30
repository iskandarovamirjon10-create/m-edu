import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/entities/group.dart';
import '../../domain/events/group_events.dart';
import '../../domain/repositories/group_repository.dart';

/// Guruhni tahrirlash uchun so'rov.
class UpdateGroupRequest {
  final String groupId;
  final String name;
  final String? code;
  final int capacity;
  final String? teacherId;
  final String? teacherName;
  final String? roomId;
  final String? roomName;
  final String? subject;
  final String? academicYear;
  final int monthlyFee;
  final GroupStatus status;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<String> daysOfWeek;
  final String? startTime;
  final String? endTime;
  final String? notes;

  const UpdateGroupRequest({
    required this.groupId,
    required this.name,
    this.code,
    required this.capacity,
    this.teacherId,
    this.teacherName,
    this.roomId,
    this.roomName,
    this.subject,
    this.academicYear,
    this.monthlyFee = 0,
    this.status = GroupStatus.active,
    this.startDate,
    this.endDate,
    this.daysOfWeek = const [],
    this.startTime,
    this.endTime,
    this.notes,
  });
}

/// `UpdateGroup` command'i — mavjud guruhni tahrirlash.
///
/// Guruh maydonlarini yangilaydi, guruh nomi o'zgarsa guruh a'zolarining
/// denormalized `groupName` maydonini ham sinxronlaydi va
/// [GroupUpdatedEvent] tarqatadi (UI ro'yxatlar avtomatik yangilanadi).
class UpdateGroupCommand {
  final GroupRepository _groupRepository;
  final StudentRepository _studentRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): guruh tahrirlash.
  final UserRole actorRole;

  UpdateGroupCommand({
    required GroupRepository groupRepository,
    required StudentRepository studentRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _groupRepository = groupRepository,
        _studentRepository = studentRepository,
        _eventBus = eventBus;

  Future<Group> execute(UpdateGroupRequest request) async {
    Permissions.require(actorRole, AppPermission.groupsEdit);
    _validate(request);

    final existing = await _groupRepository.fetchById(request.groupId);
    if (existing == null) {
      throw NotFoundFailure('Guruh topilmadi: ${request.groupId}');
    }

    final now = DateTime.now();
    final updated = await _groupRepository.update(Group(
      groupId: existing.groupId,
      name: request.name.trim(),
      code: request.code?.trim().toUpperCase(),
      capacity: request.capacity,
      currentSize: existing.currentSize,
      teacherId: request.teacherId,
      teacherName: request.teacherName,
      roomId: request.roomId,
      roomName: request.roomName,
      subject: request.subject,
      academicYear: request.academicYear ?? existing.academicYear,
      monthlyFee: request.monthlyFee,
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
      daysOfWeek: request.daysOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
      notes: request.notes,
      syncVersion: existing.syncVersion,
      pendingSync: existing.pendingSync,
    ));

    // Guruh nomi o'zgargan bo'lsa — a'zolarning denormalized groupName
    // maydonini sinxronlaymiz (talabalar ro'yxati eski nom ko'rsatmasin).
    if (existing.name != updated.name) {
      final members = await _studentRepository.fetchByGroupId(existing.groupId);
      for (final student in members) {
        await _studentRepository.update(
          student.copyWith(groupName: updated.name),
        );
      }
    }

    _eventBus.publish(GroupUpdatedEvent(
      group: updated,
      previousGroup: existing,
      occurredAt: now,
    ));

    return updated;
  }

  void _validate(UpdateGroupRequest request) {
    if (request.name.trim().isEmpty) {
      throw const ValidationFailure('Guruh nomi kiritilishi shart');
    }
    if (request.capacity <= 0) {
      throw const ValidationFailure('Sig\'im musbat son bo\'lishi shart');
    }
  }
}
