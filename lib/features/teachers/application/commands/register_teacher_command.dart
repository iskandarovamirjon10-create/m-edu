import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../domain/entities/teacher.dart';
import '../../domain/events/teacher_events.dart';
import '../../domain/repositories/teacher_repository.dart';

/// Yangi o'qituvchini ro'yxatdan o'tkazish uchun so'rov.
class RegisterTeacherRequest {
  final String identityId;
  final String? specialization;
  final int? maxWeeklyHours;
  final int salary;
  final String? notes;

  const RegisterTeacherRequest({
    required this.identityId,
    this.specialization,
    this.maxWeeklyHours,
    this.salary = 0,
    this.notes,
  });
}

/// `RegisterTeacher` command'i.
class RegisterTeacherCommand {
  final TeacherRepository _repository;
  final IdentityRepository _identityRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): o'qituvchi yaratish — odamlar boshqaruvi.
  final UserRole actorRole;

  RegisterTeacherCommand({
    required TeacherRepository repository,
    required IdentityRepository identityRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _identityRepository = identityRepository,
        _eventBus = eventBus;

  Future<Teacher> execute(RegisterTeacherRequest request) async {
    Permissions.require(actorRole, AppPermission.teachersCreate);
    _validate(request);

    final identity = await _identityRepository.fetchByIdentityId(
      request.identityId,
    );
    if (identity == null) {
      throw NotFoundFailure(
        'Identity topilmadi: ${request.identityId}',
      );
    }
    if (identity.role != IdentityRole.teacher) {
      throw const ValidationFailure(
        'Bu identity o\'qituvchi roliga ega emas',
      );
    }

    final existing = await _repository.fetchByIdentityId(request.identityId);
    if (existing != null) {
      throw const ValidationFailure(
        'Bu o\'qituvchi allaqachon ro\'yxatdan o\'tkazilgan',
      );
    }

    final teacherNumber = await _repository.nextTeacherNumber();

    final now = DateTime.now();
    final teacher = Teacher(
      identityId: request.identityId,
      teacherNumber: teacherNumber,
      specialization: request.specialization,
      maxWeeklyHours: request.maxWeeklyHours ?? 40,
      salary: request.salary,
      notes: request.notes,
      startDate: now,
    );

    final saved = await _repository.save(teacher);

    _eventBus.publish(TeacherRegisteredEvent(
      teacher: saved,
      occurredAt: now,
    ));

    return saved;
  }

  void _validate(RegisterTeacherRequest request) {
    if (request.identityId.trim().isEmpty) {
      throw const ValidationFailure('Identity ID kiritilishi shart');
    }
  }
}
