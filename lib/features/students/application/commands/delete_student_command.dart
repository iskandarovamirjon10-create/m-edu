import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../face_recognition/domain/repositories/face_recognition_repository.dart';
import '../../../groups/domain/repositories/group_repository.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../domain/events/student_events.dart';
import '../../domain/repositories/student_repository.dart';

/// Talabani butunlay o'chirish command'i (hard delete).
///
/// Oqim: RBAC → talabani topish → guruhdan chiqarish (currentSize--) →
/// yuz bazasini tozalash → talaba yozuvini o'chirish → Identity profilini
/// o'chirish → event'lar tarqatish.
///
/// To'lov/davomat tarixi (identityId orqali) saqlanib qoladi — moliyaviy
/// hisobotlar va audit yaxlitligi buzilmaydi. Identity activity timeline'i
/// identity bilan birga tozalanadi.
class DeleteStudentCommand {
  final StudentRepository _studentRepository;
  final IdentityRepository _identityRepository;
  final GroupRepository _groupRepository;
  final FaceRecognitionRepository _faceRepository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: talaba boshqaruvi (edit darajasi).
  final UserRole actorRole;

  DeleteStudentCommand({
    required StudentRepository studentRepository,
    required IdentityRepository identityRepository,
    required GroupRepository groupRepository,
    required FaceRecognitionRepository faceRepository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _studentRepository = studentRepository,
        _identityRepository = identityRepository,
        _groupRepository = groupRepository,
        _faceRepository = faceRepository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<void> execute(String identityId) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final now = DateTime.now();

    final student = await _studentRepository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure("O'quvchi topilmadi: $identityId");
    }

    // 1) Guruh a'zoligini tozalash (currentSize--).
    if (student.groupId != null) {
      try {
        await _groupRepository.removeMember(student.groupId!);
      } catch (_) {
        // Guruh topilmasa ham o'chirish davom etadi — a'zolik allakachon
        // guruhsiz bo'lishi mumkin.
      }
    }

    // 2) Yuz bazasini tozalash (biometrik ma'lumot qoldirilmaydi).
    try {
      await _faceRepository.deleteFace(identityId);
    } catch (_) {
      // Face yo'q bo'lsa — indamay o'tamiz.
    }

    // 3) Talaba + Identity yozuvlarini o'chirish.
    await _studentRepository.deleteByIdentityId(identityId);
    await _identityRepository.deleteByIdentityId(identityId);

    _eventBus.publish(StudentDeletedEvent(
      identityId: identityId,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.studentDeleted,
      targetType: 'student',
      targetId: identityId,
      details: 'Talaba butunlay o\'chirildi (raqam: #${student.studentNumber})',
    );
  }
}
