import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/schedule.dart';
import '../../domain/events/schedule_events.dart';
import '../../domain/repositories/schedule_repository.dart';

/// Yangi jadval yaratish uchun so'rov.
class CreateScheduleRequest {
  final String groupId;
  final String? groupName;
  final String teacherId;
  final String? teacherName;
  final String roomId;
  final String? roomName;
  final DayOfWeek dayOfWeek;
  final String startTime;
  final String endTime;
  final String? subject;
  final DateTime? specificDate;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? notes;

  const CreateScheduleRequest({
    required this.groupId,
    this.groupName,
    required this.teacherId,
    this.teacherName,
    required this.roomId,
    this.roomName,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.subject,
    this.specificDate,
    this.startDate,
    this.endDate,
    this.notes,
  });
}

/// `CreateSchedule` command'i.
class CreateScheduleCommand {
  final ScheduleRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): jadval boshqaruvi.
  final UserRole actorRole;

  CreateScheduleCommand({
    required ScheduleRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Schedule> execute(CreateScheduleRequest request) async {
    Permissions.require(actorRole, AppPermission.scheduleCreate);
    _validate(request);

    // Guruh to'qnashuvini tekshirish (spec §21): bir guruh bir vaqtda
    // ikkita darsga biriktirilmasligi kerak.
    final groupConflict = await _repository.hasGroupConflict(
      groupId: request.groupId,
      dayOfWeek: request.dayOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
    );
    if (groupConflict) {
      throw const ValidationFailure(
        "Bu vaqtda guruh allaqachon band",
      );
    }

    // Xona to'qnashuvini tekshirish.
    final roomConflict = await _repository.hasConflict(
      roomId: request.roomId,
      dayOfWeek: request.dayOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
    );
    if (roomConflict) {
      throw const ValidationFailure(
        'Bu vaqtda xona allaqachon band',
      );
    }

    // O'qituvchi to'qnashuvini tekshirish.
    final teacherConflict = await _repository.hasTeacherConflict(
      teacherId: request.teacherId,
      dayOfWeek: request.dayOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
    );
    if (teacherConflict) {
      throw const ValidationFailure(
        "Bu vaqtda o'qituvchi allaqachon band",
      );
    }

    final schedule = Schedule(
      scheduleId: _generateScheduleId(),
      groupId: request.groupId,
      groupName: request.groupName,
      teacherId: request.teacherId,
      teacherName: request.teacherName,
      roomId: request.roomId,
      roomName: request.roomName,
      dayOfWeek: request.dayOfWeek,
      startTime: request.startTime,
      endTime: request.endTime,
      subject: request.subject,
      specificDate: request.specificDate,
      startDate: request.startDate,
      endDate: request.endDate,
      notes: request.notes,
    );

    final saved = await _repository.save(schedule);

    _eventBus.publish(ScheduleCreatedEvent(
      schedule: saved,
      occurredAt: DateTime.now(),
    ));

    return saved;
  }

  void _validate(CreateScheduleRequest request) {
    if (request.groupId.trim().isEmpty) {
      throw const ValidationFailure('Guruh ID kiritilishi shart');
    }
    if (request.teacherId.trim().isEmpty) {
      throw const ValidationFailure("O'qituvchi ID kiritilishi shart");
    }
    if (request.roomId.trim().isEmpty) {
      throw const ValidationFailure('Xona ID kiritilishi shart');
    }
    if (!_isValidTime(request.startTime) || !_isValidTime(request.endTime)) {
      throw const ValidationFailure("Noto'g'ri vaqt formati (HH:mm)");
    }
    if (!_isTimeAfter(request.endTime, request.startTime)) {
      throw const ValidationFailure(
        "Tugash vaqti boshlanish vaqtdan keyin bo'lishi kerak",
      );
    }
  }

  bool _isValidTime(String time) {
    final pattern = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');
    return pattern.hasMatch(time);
  }

  bool _isTimeAfter(String end, String start) {
    return end.compareTo(start) > 0;
  }

  String _generateScheduleId() {
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final randomPart = Random().nextInt(99999).toString().padLeft(5, '0');
    return 'SCH-$datePart-$randomPart';
  }
}
