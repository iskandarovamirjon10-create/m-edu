import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../groups/domain/repositories/group_repository.dart';
import '../../domain/entities/student.dart';
import '../../domain/events/student_events.dart';
import '../../domain/repositories/student_repository.dart';

/// Talabani bir guruhdan boshqasiga o'tkazish uchun command.
///
/// Oqim:
/// 1. startTransfer — o'tkazish jarayonini boshlaydi (pending holat)
/// 2. confirmTransfer — o'tkazishni tasdiqlaydi (final holat)
/// 3. cancelTransfer — o'tkazishni bekor qiladi
///
/// Yaxlitlik (integrity): `confirmTransfer` guruh o'lchamlarini ham
/// yangilaydi — eski guruh `currentSize--`, yangi guruh `currentSize++`,
/// talabaning denormalizatsiya qilingan `groupName`i yangi guruh nomi
/// bilan sinxronlanadi (avval bu qilinmasdi — guruh sig'imi va nomi
/// noto'g'ri qolardi).
class TransferStudentCommand {
  final StudentRepository _repository;
  final GroupRepository _groupRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): o'quvchini boshqa guruhga o'tkazish.
  final UserRole actorRole;

  TransferStudentCommand({
    required StudentRepository repository,
    required GroupRepository groupRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _groupRepository = groupRepository,
        _eventBus = eventBus;

  /// O'tkazish jarayonini boshlaydi.
  Future<Student> startTransfer(String identityId, String targetGroupId) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final student = await _repository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure('Talaba topilmadi: $identityId');
    }
    if (!student.canTransfer) {
      throw const ValidationFailure(
        'Talabani o\'tkazib bo\'lmaydi: '
        'faqat faol va o\'tkazish jarayonida bo\'lmagan talabalar o\'tkazilishi mumkin',
      );
    }
    if (student.groupId == targetGroupId) {
      throw const ValidationFailure(
        'Talaba allaqachon shu guruhda',
      );
    }

    // Maqsadli guruh mavjudligi, faolligi va sig'imini tekshiramiz.
    final targetGroup = await _groupRepository.fetchById(targetGroupId);
    if (targetGroup == null) {
      throw NotFoundFailure('Maqsadli guruh topilmadi: $targetGroupId');
    }
    if (!targetGroup.isActive) {
      throw const ValidationFailure(
        'Faol bo\'lmagan guruhga o\'tkazib bo\'lmaydi',
      );
    }
    if (!targetGroup.hasAvailableSlots) {
      throw ValidationFailure(
        'Guruh to\'lgan (${targetGroup.currentSize}/${targetGroup.capacity}) — '
        'avval o\'rin bo\'shating',
      );
    }

    return _repository.startTransfer(identityId, targetGroupId);
  }

  /// O'tkazishni tasdiqlaydi.
  Future<Student> confirmTransfer(String identityId) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final student = await _repository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure('Talaba topilmadi: $identityId');
    }
    if (student.transferStatus != TransferStatus.pending) {
      throw const ValidationFailure(
        'O\'tkazish jarayoni mavjud emas',
      );
    }

    final targetGroupId = student.transferToGroupId;
    if (targetGroupId == null) {
      throw const ValidationFailure(
        'O\'tkazish maqsadi (guruh) ko\'rsatilmagan',
      );
    }

    final targetGroup = await _groupRepository.fetchById(targetGroupId);
    if (targetGroup == null) {
      throw NotFoundFailure('Maqsadli guruh topilmadi: $targetGroupId');
    }

    // TOCTOU himoyasi: `startTransfer` vaqtida joy bo'lgan bo'lishi mumkin,
    // lekin `confirmTransfer` kechikib chaqirilsa guruh to'lib qolgan
    // bo'lishi ehtimoli bor — hech qanday yozuvdan oldin qayta tekshiramiz.
    if (!targetGroup.hasAvailableSlots) {
      throw ValidationFailure(
        'Guruh to\'lgan (${targetGroup.currentSize}/${targetGroup.capacity}) — '
        'avval o\'rin bo\'shating',
      );
    }

    final confirmed = await _repository.confirmTransfer(identityId);

    // Denormalizatsiya: `groupName` repository faqat groupId ni biladi,
    // nomni bilmaydi — shu yerda yangi guruh nomi bilan sinxronlaymiz.
    final withName = await _repository
        .update(confirmed.copyWith(groupName: targetGroup.name));

    // Guruh o'lchamlari yaxlitligi: eski guruhdan chiqarish (--),
    // yangi guruhga qo'shish (++). A'zolar ro'yxati `groupId` bo'yicha
    // hosil qilingani uchun ular avtomatik to'g'ri yangilanadi.
    final oldGroupId = student.groupId;
    if (oldGroupId != null && oldGroupId != targetGroupId) {
      await _groupRepository.removeMember(oldGroupId);
    }
    await _groupRepository.addMember(targetGroupId);

    _eventBus.publish(StudentTransferredEvent(
      student: withName,
      fromGroupId: oldGroupId ?? '',
      toGroupId: targetGroupId,
      occurredAt: DateTime.now(),
    ));

    return withName;
  }

  /// O'tkazishni bekor qiladi.
  Future<Student> cancelTransfer(String identityId) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final student = await _repository.fetchByIdentityId(identityId);
    if (student == null) {
      throw NotFoundFailure('Talaba topilmadi: $identityId');
    }
    if (student.transferStatus != TransferStatus.pending) {
      throw const ValidationFailure(
        'O\'tkazish jarayoni mavjud emas',
      );
    }

    return _repository.cancelTransfer(identityId);
  }
}
