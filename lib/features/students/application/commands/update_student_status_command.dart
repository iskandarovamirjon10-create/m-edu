import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../groups/domain/events/group_events.dart';
import '../../../groups/domain/repositories/group_repository.dart';
import '../../domain/entities/student.dart';
import '../../domain/events/student_events.dart';
import '../../domain/repositories/student_repository.dart';

/// Talaba holatini o'zgartirish uchun command.
///
/// Status workflow (spec §6 #11) + Archive/Restore siyosati:
/// faol → muzlatilgan → bitirgan → arxiv
///
/// Qoidalar:
/// - Faol → Muzlatilgan: mumkin
/// - Faol → Bitirgan: mumkin
/// - Faol → Arxiv (markazni tark etdi): mumkin
/// - Muzlatilgan → Faol (qayta faollashtirish): mumkin
/// - Muzlatilgan → Bitirgan: mumkin
/// - Muzlatilgan → Arxiv: mumkin
/// - Bitirgan → Arxiv: mumkin
/// - Arxiv → Faol (QAYTA TIKLASH): mumkin — arxiv terminal holat EMAS
///   (audit talabi: Archive/Restore professional siyosati)
///
/// Arxivlash yaxlitligi: talaba arxivlanganda guruhdan ham chiqariladi
/// (groupId/groupName/assignedAt tozalanadi, guruh `currentSize--`).
/// Aks holda arxivlangan talaba guruh sig'imida qolib, yangi o'quvchilar
/// qo'shilishiga to'sqinlik qilardi va guruh a'zolar ro'yxatida
/// ko'rinishda davom etardi. Qayta tiklanganda talaba guruhsiz bo'ladi
/// — admin qayta tayinlaydi.
class UpdateStudentStatusCommand {
  final StudentRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// Arxivlashda guruh `currentSize`ni kamaytirish uchun (ixtiyoriy —
  /// faqat arxivlash oqimida ishlatiladi).
  final GroupRepository? _groupRepository;

  /// RBAC (AUDIT P2-02): talaba holatini o'zgartirish.
  final UserRole actorRole;

  UpdateStudentStatusCommand({
    required StudentRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    GroupRepository? groupRepository,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService,
        _groupRepository = groupRepository;

  Future<Student> execute(String identityId, StudentStatus newStatus) async {
    Permissions.require(actorRole, AppPermission.studentsArchive);

    final student = await _repository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure('Talaba topilmadi: $identityId');
    }

    final previousStatus = student.studentStatus;

    // Status o'zgarishini tekshirish.
    if (!_isValidTransition(previousStatus, newStatus)) {
      throw ValidationFailure(
        'Holat o\'zgarishi mumkin emas: '
        '${_statusLabel(previousStatus)} → ${_statusLabel(newStatus)}',
      );
    }

    final updated = await _repository.updateStatus(identityId, newStatus);

    // Archive/Restore yaxlitligi: arxivlanganda talaba guruhdan chiqariladi
    // (guruh sig'imi, a'zolar ro'yxati va davomatda qolib ketmaydi).
    Student finalStudent = updated;
    if (newStatus == StudentStatus.archived && updated.hasGroup) {
      final groupRepo = _groupRepository;
      if (groupRepo != null) {
        final group = await groupRepo.fetchById(updated.groupId!);
        if (group != null) {
          finalStudent = await _repository.update(updated.copyWith(
            groupId: null,
            groupName: null,
            assignedAt: null,
          ));
          final updatedGroup = await groupRepo.removeMember(group.groupId);
          _eventBus.publish(GroupMemberRemovedEvent(
            group: updatedGroup,
            studentIdentityId: identityId,
            occurredAt: DateTime.now(),
          ));
        }
      }
    }

    _eventBus.publish(StudentStatusChangedEvent(
      student: finalStudent,
      previousStatus: previousStatus,
      occurredAt: DateTime.now(),
    ));

    await _audit?.record(
      action: _auditActionFor(newStatus),
      targetType: 'student',
      targetId: identityId,
      details: '${_statusLabel(previousStatus)} → ${_statusLabel(newStatus)}',
    );

    return finalStudent;
  }

  AuditAction _auditActionFor(StudentStatus status) {
    return switch (status) {
      StudentStatus.archived => AuditAction.studentArchived,
      StudentStatus.graduated => AuditAction.studentGraduated,
      StudentStatus.active => AuditAction.studentRestored,
      StudentStatus.frozen => AuditAction.studentUpdated,
    };
  }

  bool _isValidTransition(StudentStatus from, StudentStatus to) {
    return switch ((from, to)) {
      (StudentStatus.active, StudentStatus.frozen) => true,
      (StudentStatus.active, StudentStatus.graduated) => true,
      (StudentStatus.active, StudentStatus.archived) => true,
      (StudentStatus.frozen, StudentStatus.active) => true,
      (StudentStatus.frozen, StudentStatus.graduated) => true,
      (StudentStatus.frozen, StudentStatus.archived) => true,
      (StudentStatus.graduated, StudentStatus.archived) => true,
      // Qayta tiklash: arxiv → faol (Archive/Restore siyosati).
      (StudentStatus.archived, StudentStatus.active) => true,
      _ => false,
    };
  }

  static String _statusLabel(StudentStatus status) {
    return switch (status) {
      StudentStatus.active => 'Faol',
      StudentStatus.frozen => 'Muzlatilgan',
      StudentStatus.graduated => 'Bitirgan',
      StudentStatus.archived => 'Arxivlangan',
    };
  }
}
