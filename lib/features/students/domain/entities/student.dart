import 'package:equatable/equatable.dart';

/// Talaba holati workflow'i (spec §6 #11):
/// faol → muzlatilgan → bitirgan → arxiv.
enum StudentStatus { active, frozen, graduated, archived }

/// Guruhdan-guruhga o'tkazish uchun holat.
enum TransferStatus { none, pending, completed }

/// Talaba entity'si — Identity agregatiga bog'liq, lekin alohida
/// talaba ma'lumotlarini saqlaydi (spec §6 #6-11).
///
/// Identity'dan farqli o'laroq, Student qo'shimcha ma'lumotlarni:
/// - Guruh tayinlanganligini (groupId)
/// - Ota-ona/vasiy ma'lumotlarini
/// - To'lov holatini
/// - O'quv yilini
/// - Davomat foizini
/// saqlaydi.
class Student extends Equatable {
  /// Identity ID orqali bog'lanadi (M-EDU-2026-000482).
  final String identityId;

  /// Talaba raqami (ichki, guruh ichida).
  final int studentNumber;

  /// Tayinlangan guruh ID'si (null = hali guruhga tayinlanmagan).
  final String? groupId;

  /// Guruh nomi (query uchun denormalized).
  final String? groupName;

  /// Ota-ona/vasiy identity ID'si.
  final String? parentId;

  /// Ota-ona/vasiy ismi.
  final String? parentName;

  /// Ota-ona/vasiy telefon raqami.
  final String? parentPhone;

  /// Ota-ona/vasiy Telegram chat ID'si (bot orqali hisobot yuborish uchun).
  /// Admin profilga kiritadi yoki telefon raqam orqali avtomatik bog'lanadi.
  final String? parentTelegramId;

  /// Talaba holati (Identity holatidan alohida).
  final StudentStatus studentStatus;

  /// Guruhdan-guruhga o'tkazish holati.
  final TransferStatus transferStatus;

  /// O'tkazilgan guruh ID'si (agar transfer pending bo'lsa).
  final String? transferToGroupId;

  /// O'quv yili (masalan, 2025-2026).
  final String? academicYear;

  /// To'lov holati: true = to'lov amalga oshirilgan.
  final bool paymentStatus;

  /// Oxirgi to'lov sanasi.
  final DateTime? lastPaymentDate;

  /// Jami to'langan summa (UZS).
  final int totalPaid;

  /// Ro'yxatga olingan sana.
  final DateTime enrolledAt;

  /// Guruhga tayinlangan sana.
  final DateTime? assignedAt;

  /// Bitirgan/Arxivlangan sana.
  final DateTime? completedAt;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  /// Hali serverga sinxronlanmagan.
  final bool pendingSync;

  const Student({
    required this.identityId,
    required this.studentNumber,
    this.groupId,
    this.groupName,
    this.parentId,
    this.parentName,
    this.parentPhone,
    this.parentTelegramId,
    required this.studentStatus,
    this.transferStatus = TransferStatus.none,
    this.transferToGroupId,
    this.academicYear,
    this.paymentStatus = false,
    this.lastPaymentDate,
    this.totalPaid = 0,
    required this.enrolledAt,
    this.assignedAt,
    this.completedAt,
    this.notes,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  bool get isActive => studentStatus == StudentStatus.active;
  bool get hasGroup => groupId != null;
  bool get hasPaid => paymentStatus;

  /// O'tkazish mumkinmi? (faqat faol talaba)
  bool get canTransfer => isActive && transferStatus == TransferStatus.none;

  /// Muzlatish mumkinmi?
  bool get canFreeze => isActive;

  /// Bitirish mumkinmi?
  bool get canGraduate => isActive;

  /// Arxivlash mumkinmi? (har qanday arxivlanmagan holatdan)
  ///
  /// Archive/Restore siyosati (audit): arxiv — markazni tark etishni
  /// bildiradi va har qanday holatdan (faol/muzlatilgan/bitirgan) mumkin.
  /// Arxivdan qayta tiklash esa [StudentStatus.active] ga o'tkazadi.
  bool get canArchive => studentStatus != StudentStatus.archived;

  /// Immutable entity'ning yangilangan nusxasini yaratadi.
  ///
  /// Read-model proyeksiyalari (masalan to'lovdan keyin `paymentStatus`
  /// yangilash — [StudentPaymentProjector]) va boshqa yangilash oqimlari
  /// shu orqali yangi Student nusxasini quradi.
  ///
  /// Nullable maydonlarni `null` qilib tozalash mumkin (sentinellarga
  /// qarang) — `??` ishlatilsa null qiymat e'tiborsiz qolardi.
  Student copyWith({
    Object? groupId = _unset,
    Object? groupName = _unset,
    Object? parentId = _unset,
    Object? parentName = _unset,
    Object? parentPhone = _unset,
    Object? parentTelegramId = _unset,
    StudentStatus? studentStatus,
    TransferStatus? transferStatus,
    Object? transferToGroupId = _unset,
    String? academicYear,
    bool? paymentStatus,
    DateTime? lastPaymentDate,
    int? totalPaid,
    DateTime? enrolledAt,
    DateTime? assignedAt,
    DateTime? completedAt,
    Object? notes = _unset,
    int? syncVersion,
    bool? pendingSync,
  }) {
    return Student(
      identityId: identityId,
      studentNumber: studentNumber,
      groupId: identical(groupId, _unset) ? this.groupId : groupId as String?,
      groupName:
          identical(groupName, _unset) ? this.groupName : groupName as String?,
      parentId:
          identical(parentId, _unset) ? this.parentId : parentId as String?,
      parentName: identical(parentName, _unset)
          ? this.parentName
          : parentName as String?,
      parentPhone: identical(parentPhone, _unset)
          ? this.parentPhone
          : parentPhone as String?,
      parentTelegramId: identical(parentTelegramId, _unset)
          ? this.parentTelegramId
          : parentTelegramId as String?,
      studentStatus: studentStatus ?? this.studentStatus,
      transferStatus: transferStatus ?? this.transferStatus,
      transferToGroupId: identical(transferToGroupId, _unset)
          ? this.transferToGroupId
          : transferToGroupId as String?,
      academicYear: academicYear ?? this.academicYear,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      lastPaymentDate: lastPaymentDate ?? this.lastPaymentDate,
      totalPaid: totalPaid ?? this.totalPaid,
      enrolledAt: enrolledAt ?? this.enrolledAt,
      assignedAt: assignedAt ?? this.assignedAt,
      completedAt: completedAt ?? this.completedAt,
      notes: identical(notes, _unset) ? this.notes : notes as String?,
      syncVersion: syncVersion ?? this.syncVersion,
      pendingSync: pendingSync ?? this.pendingSync,
    );
  }

  /// [copyWith] uchun "o'zgartirilmagan" qiymat sentineli.
  static const Object _unset = _CopyWithUnset();

  @override
  List<Object?> get props => [
        identityId,
        studentNumber,
        groupId,
        groupName,
        parentId,
        parentName,
        parentPhone,
        parentTelegramId,
        studentStatus,
        transferStatus,
        transferToGroupId,
        academicYear,
        paymentStatus,
        lastPaymentDate,
        totalPaid,
        enrolledAt,
        assignedAt,
        completedAt,
        notes,
        syncVersion,
        pendingSync,
      ];
}

/// [Student.copyWith] sentinel'ini yaratish uchun shaxsiy tur —
/// `null` qiymatni "tozalash"dan farqlash uchun ishlatiladi.
class _CopyWithUnset {
  const _CopyWithUnset();
}
