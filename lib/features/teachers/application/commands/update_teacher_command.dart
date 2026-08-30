import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/teacher.dart';
import '../../domain/events/teacher_events.dart';
import '../../domain/repositories/teacher_repository.dart';

/// O'qituvchi profilini tahrirlash so'rovi (spec §15).
class UpdateTeacherRequest {
  final String identityId;
  final String? specialization;
  final String? notes;
  final int? maxWeeklyHours;
  final int? salary;

  const UpdateTeacherRequest({
    required this.identityId,
    this.specialization,
    this.notes,
    this.maxWeeklyHours,
    this.salary,
  });
}

/// O'qituvchi ma'lumotlarini yangilash command'i.
///
/// Faqat berilgan maydonlar yangilanadi; qolganlari avvalgi qiymatda
/// qoladi. RBAC: [AppPermission.teachersCreate] (o'qituvchi boshqaruvi).
class UpdateTeacherCommand {
  final TeacherRepository _repository;
  final EventBus _eventBus;
  final UserRole _actorRole;

  UpdateTeacherCommand({
    required TeacherRepository repository,
    required EventBus eventBus,
    required UserRole actorRole,
  })  : _repository = repository,
        _eventBus = eventBus,
        _actorRole = actorRole;

  Future<Teacher> execute(UpdateTeacherRequest request) async {
    Permissions.require(_actorRole, AppPermission.teachersCreate);

    final existing =
        await _repository.fetchByIdentityId(request.identityId);
    if (existing == null) {
      throw const NotFoundFailure('O\'qituvchi topilmadi');
    }

    // Faqat berilgan maydonlar yangilanadi — null bo'lganlar avvalgi
    // qiymatda qoladi (copyWith sentinel qoidasi bilan mos).
    var updated = existing;
    if (request.specialization != null) {
      updated = updated.copyWith(specialization: request.specialization);
    }
    if (request.notes != null) {
      updated = updated.copyWith(notes: request.notes);
    }
    if (request.maxWeeklyHours != null) {
      updated = updated.copyWith(maxWeeklyHours: request.maxWeeklyHours);
    }
    if (request.salary != null) {
      updated = updated.copyWith(salary: request.salary);
    }

    final saved = await _repository.update(updated);

    _eventBus.publish(TeacherUpdatedEvent(
      teacher: saved,
      occurredAt: DateTime.now(),
    ));

    return saved;
  }
}
