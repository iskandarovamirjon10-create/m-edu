import 'package:isar/isar.dart';

part 'student_record.g.dart';

/// `Student` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class StudentRecord {
  Id id = Isar.autoIncrement;

  /// Identity ID orqali bog'lanadi (M-EDU-2026-000482).
  @Index(unique: true, replace: false)
  late String identityId;

  /// Talaba raqami (ichki, guruh ichida).
  late int studentNumber;

  /// Tayinlangan guruh ID'si.
  @Index()
  String? groupId;

  /// Guruh nomi (query uchun denormalized).
  String? groupName;

  /// Ota-ona/vasiy identity ID'si.
  String? parentId;

  /// Ota-ona/vasiy ismi.
  String? parentName;

  /// Ota-ona/vasiy telefon raqami.
  String? parentPhone;

  /// Ota-ona/vasiy Telegram chat ID'si.
  String? parentTelegramId;

  /// Talaba holati (StudentStatus.name).
  @Index()
  late String studentStatus;

  /// O'tkazish holati (TransferStatus.name).
  late String transferStatus;

  /// O'tkazilgan guruh ID'si.
  String? transferToGroupId;

  /// O'quv yili.
  String? academicYear;

  /// To'lov holati.
  late bool paymentStatus;

  /// Oxirgi to'lov sanasi.
  DateTime? lastPaymentDate;

  /// Jami to'langan summa (UZS).
  late int totalPaid;

  /// Davomat foizi (0-100) — LEGACY maydon (Phase 5).
  ///
  /// Endi hech qayerda o'qilmaydi/ishlatilmaydi: davomat foizi
  /// `AttendanceStatisticsService` orqali DERIVED hisoblanadi (§8).
  /// Isar 3 maydon o'chirishni qo'llamaydi — field sxemada qoladi,
  /// lekin default bilan (serializer LateInitializationError tashlamasligi
  /// uchun — faqat `_toRecord` da yozilmaydi).
  double attendancePercentage = 0.0;

  /// Ro'yxatga olingan sana.
  late DateTime enrolledAt;

  /// Guruhga tayinlangan sana.
  DateTime? assignedAt;

  /// Bitirgan/Arxivlangan sana.
  DateTime? completedAt;

  /// Izoh.
  String? notes;

  /// Sinxronlash versiyasi.
  int syncVersion = 1;

  /// Hali serverga sinxronlanmagan.
  bool pendingSync = true;
}
