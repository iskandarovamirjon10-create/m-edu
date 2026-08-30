import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/group.dart';
import '../../domain/events/group_events.dart';
import '../../domain/repositories/group_repository.dart';

/// Yangi guruh yaratish uchun so'rov.
class CreateGroupRequest {
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
  final DateTime? startDate;
  final DateTime? endDate;
  final List<String> daysOfWeek;
  final String? startTime;
  final String? endTime;
  final String? notes;

  const CreateGroupRequest({
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
    this.startDate,
    this.endDate,
    this.daysOfWeek = const [],
    this.startTime,
    this.endTime,
    this.notes,
  });
}

/// `CreateGroup` command'i.
class CreateGroupCommand {
  final GroupRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): guruh boshqaruvi.
  final UserRole actorRole;

  CreateGroupCommand({
    required GroupRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Group> execute(CreateGroupRequest request) async {
    Permissions.require(actorRole, AppPermission.groupsCreate);
    _validate(request);

    final now = DateTime.now();
    final groupId = _generateGroupId();

    final group = Group(
      groupId: groupId,
      name: request.name.trim(),
      code: request.code?.trim().toUpperCase(),
      capacity: request.capacity,
      teacherId: request.teacherId,
      teacherName: request.teacherName,
      roomId: request.roomId,
      roomName: request.roomName,
      subject: request.subject,
      academicYear: request.academicYear ?? _currentAcademicYear(),
      monthlyFee: request.monthlyFee,
      startDate: request.startDate,
      endDate: request.endDate,
      daysOfWeek: request.daysOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
      notes: request.notes,
    );

    final saved = await _repository.save(group);

    _eventBus.publish(GroupCreatedEvent(
      group: saved,
      occurredAt: now,
    ));

    return saved;
  }

  void _validate(CreateGroupRequest request) {
    if (request.name.trim().isEmpty) {
      throw const ValidationFailure('Guruh nomi kiritilishi shart');
    }
    if (request.capacity <= 0) {
      throw const ValidationFailure('Sig\'im musbat son bo\'lishi shart');
    }
  }

  String _generateGroupId() {
    final random = Random();
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final randomPart = random.nextInt(9999).toString().padLeft(4, '0');
    return 'GRP-$datePart-$randomPart';
  }

  String _currentAcademicYear() {
    final now = DateTime.now();
    final year = now.month >= 9 ? now.year : now.year - 1;
    return '$year-${year + 1}';
  }
}
