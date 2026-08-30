import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../domain/entities/student.dart';
import '../../domain/events/student_events.dart';
import '../../domain/repositories/student_repository.dart';

/// Yangi talabani ro'yxatdan o'tkazish uchun so'rov (Command input).
class RegisterStudentRequest {
  final String identityId;
  final String? parentId;
  final String? parentName;
  final String? parentPhone;
  final String? parentTelegramId;
  final String? academicYear;
  final String? notes;

  const RegisterStudentRequest({
    required this.identityId,
    this.parentId,
    this.parentName,
    this.parentPhone,
    this.parentTelegramId,
    this.academicYear,
    this.notes,
  });
}

/// `RegisterStudent` command'i — CQRS bo'yicha yozish operatsiyasi.
///
/// Oqim: request → validatsiya → Identity mavjudligini tekshirish →
/// Student yaratish → saqlash → event tarqatish.
class RegisterStudentCommand {
  final StudentRepository _repository;
  final IdentityRepository _identityRepository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC (AUDIT P2-02): talaba ro'yxatga olish — o'quvchilar boshqaruvi.
  final UserRole actorRole;

  RegisterStudentCommand({
    required StudentRepository repository,
    required IdentityRepository identityRepository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _identityRepository = identityRepository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Student> execute(RegisterStudentRequest request) async {
    Permissions.require(actorRole, AppPermission.studentsCreate);
    _validate(request);

    // Identity mavjudligini va rolini tekshirish.
    final identity = await _identityRepository.fetchByIdentityId(
      request.identityId,
    );
    if (identity == null) {
      throw NotFoundFailure(
        'Identity topilmadi: ${request.identityId}',
      );
    }
    if (identity.role != IdentityRole.student) {
      throw const ValidationFailure(
        'Bu identity talaba roliga ega emas',
      );
    }

    // Bu identity allaqachon talaba sifatida ro'yxatdan o'tganligini tekshirish.
    final existingStudent = await _repository.fetchByIdentityId(
      request.identityId,
    );
    if (existingStudent != null) {
      throw const ValidationFailure(
        'Bu talaba allaqachon ro\'yxatdan o\'tkazilgan',
      );
    }

    // Keyingi talaba raqamini olish.
    final studentNumber = await _repository.nextStudentNumber();

    final now = DateTime.now();
    final student = Student(
      identityId: request.identityId,
      studentNumber: studentNumber,
      studentStatus: StudentStatus.active,
      academicYear: request.academicYear ?? _currentAcademicYear(),
      enrolledAt: now,
      notes: request.notes,
      parentId: request.parentId,
      parentName: request.parentName,
      parentPhone: request.parentPhone,
      parentTelegramId: request.parentTelegramId,
    );

    final saved = await _repository.save(student);

    _eventBus.publish(StudentRegisteredEvent(
      student: saved,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.studentCreated,
      targetType: 'student',
      targetId: saved.identityId,
      details: 'Talaba raqami: #${saved.studentNumber}',
    );

    return saved;
  }

  void _validate(RegisterStudentRequest request) {
    if (request.identityId.trim().isEmpty) {
      throw const ValidationFailure('Identity ID kiritilishi shart');
    }
  }

  String _currentAcademicYear() {
    final now = DateTime.now();
    final year = now.month >= 9 ? now.year : now.year - 1;
    return '$year-${year + 1}';
  }
}
