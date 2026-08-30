import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../face_recognition/domain/repositories/face_recognition_repository.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/domain/repositories/group_repository.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../domain/events/teacher_events.dart';
import '../../domain/repositories/teacher_repository.dart';

/// O'qituvchini butunlay o'chirish command'i (hard delete).
///
/// Oqim: RBAC → o'qituvchini topish → tayinlangan guruhlardagi teacherId
/// havolalarini tozalash → yuz bazasini tozalash → o'qituvchi yozuvini
/// o'chirish → Identity profilini o'chirish → event'lar tarqatish.
class DeleteTeacherCommand {
  final TeacherRepository _teacherRepository;
  final IdentityRepository _identityRepository;
  final GroupRepository _groupRepository;
  final FaceRecognitionRepository _faceRepository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: o'qituvchi boshqaruvi (create darajasi — admin).
  final UserRole actorRole;

  DeleteTeacherCommand({
    required TeacherRepository teacherRepository,
    required IdentityRepository identityRepository,
    required GroupRepository groupRepository,
    required FaceRecognitionRepository faceRepository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _teacherRepository = teacherRepository,
        _identityRepository = identityRepository,
        _groupRepository = groupRepository,
        _faceRepository = faceRepository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<void> execute(String identityId) async {
    Permissions.require(actorRole, AppPermission.teachersCreate);

    final now = DateTime.now();

    final teacher = await _teacherRepository.fetchByIdentityId(identityId);
    if (teacher == null) {
      throw NotFoundFailure("O'qituvchi topilmadi: $identityId");
    }

    // 1) O'qituvchi tayinlangan guruhlarni topib, havolani tozalaymiz.
    try {
      final groups = await _groupRepository.fetchByTeacherId(identityId);
      for (final group in groups) {
        await _groupRepository.update(
          Group(
            groupId: group.groupId,
            name: group.name,
            code: group.code,
            capacity: group.capacity,
            currentSize: group.currentSize,
            // O'qituvchi havolasi tozalanadi.
            roomId: group.roomId,
            roomName: group.roomName,
            subject: group.subject,
            academicYear: group.academicYear,
            monthlyFee: group.monthlyFee,
            status: group.status,
            startDate: group.startDate,
            endDate: group.endDate,
            daysOfWeek: group.daysOfWeek,
            startTime: group.startTime,
            endTime: group.endTime,
            notes: group.notes,
            syncVersion: group.syncVersion + 1,
            pendingSync: true,
          ),
        );
      }
    } catch (_) {
      // Guruhlar bo'lmasa — davom etamiz.
    }

    // 2) Yuz bazasini tozalash (biometrik ma'lumot qoldirilmaydi).
    try {
      await _faceRepository.deleteFace(identityId);
    } catch (_) {
      // Face yo'q bo'lsa — indamay o'tamiz.
    }

    // 3) O'qituvchi + Identity yozuvlarini o'chirish.
    await _teacherRepository.deleteByIdentityId(identityId);
    await _identityRepository.deleteByIdentityId(identityId);

    _eventBus.publish(TeacherDeletedEvent(
      identityId: identityId,
      occurredAt: now,
    ));

    await _audit?.record(
      action: AuditAction.teacherDeleted,
      targetType: 'teacher',
      targetId: identityId,
      details: "O'qituvchi butunlay o'chirildi",
    );
  }
}
