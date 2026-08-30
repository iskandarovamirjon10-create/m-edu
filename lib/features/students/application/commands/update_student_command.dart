import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/student.dart';
import '../../domain/events/student_events.dart';
import '../../domain/repositories/student_repository.dart';

/// O'quvchi ma'lumotlarini yangilash uchun so'rov (§3).
class UpdateStudentRequest {
  final String identityId;
  final String? parentName;
  final String? parentPhone;
  final String? parentTelegramId;
  final String? academicYear;
  final String? notes;

  const UpdateStudentRequest({
    required this.identityId,
    this.parentName,
    this.parentPhone,
    this.parentTelegramId,
    this.academicYear,
    this.notes,
  });
}

/// `UpdateStudent` command'i — CQRS bo'yicha yozish operatsiyasi (§3).
///
/// Oqim: request → validatsiya → mavjud talabani topish → diff (copyWith)
/// → database → `StudentUpdatedEvent` → audit log.
/// UI state'ga qo'shimcha, DATABASE ham o'zgaradi — persistence real.
class UpdateStudentCommand {
  final StudentRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC (AUDIT P2-02): o'quvchi ma'lumotlarini tahrirlash.
  final UserRole actorRole;

  UpdateStudentCommand({
    required StudentRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Student> execute(UpdateStudentRequest request) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final identityId = request.identityId.trim();
    if (identityId.isEmpty) {
      throw const ValidationFailure('Talaba ID kiritilishi shart');
    }

    final student = await _repository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure('Talaba topilmadi: $identityId');
    }

    final updated = student.copyWith(
      parentName: request.parentName,
      parentPhone: request.parentPhone,
      parentTelegramId: request.parentTelegramId,
      academicYear: request.academicYear,
      notes: request.notes,
    );

    final saved = await _repository.update(updated);

    _eventBus.publish(StudentUpdatedEvent(
      student: saved,
      occurredAt: DateTime.now(),
    ));

    await _audit?.record(
      action: AuditAction.studentUpdated,
      targetType: 'student',
      targetId: identityId,
      details: 'Ota-ona/izoh/akademik yil yangilandi',
    );

    return saved;
  }
}
