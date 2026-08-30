import 'package:isar/isar.dart';

part 'attendance_record.g.dart';

/// Davomat yozuvi — identity qaysi usulda va qachon qatnashgani.
///
/// V2 (spec §14): **1 talaba + 1 kun = 1 primary yozuv**. Yangi maydonlar
/// (`attendanceDate`, `checkInAt`, `checkOutAt`, `status`, `isLegacyMerged`,
/// `mergedIntoId`) additiv — eski qurilmalardagi yozuvlarda `null` bo'lishi
/// mumkin (Isar 3 additive migration). `timestamp` eski maydon sifatida
/// saqlanadi (check-in vaqti bilan sinxron) — Isar 3 maydon o'chirishni
/// qo'llamaydi.
///
/// Legacy (V1) duplicate yozuvlar fizik o'chirilmaydi — `isLegacyMerged`
/// bilan belgilanadi va barcha so'rovlardan chiqariladi (user talabi).
@collection
class AttendanceRecord {
  Id id = Isar.autoIncrement;

  @Index()
  late String identityId;

  /// Vaqt nuqtasi (V1). V2'da = check-in vaqti bilan sinxron saqlanadi.
  @Index()
  late DateTime timestamp;

  /// Denormalized: shaxsning to'liq ismi (query uchun).
  late String fullName;

  /// IdentityRole.name (student | teacher | staff | parent).
  late String role;

  /// Belgilash usuli: face | qr | manual (primary/check-in usuli).
  late String method;

  /// Tanib olish ishonch darajasi (face usuli uchun, 0..1).
  double? confidence;

  /// Yozuv manbai: hikvision-kamera, qurilma, admin va h.k.
  String? source;

  // ═══════════════ V2 (additiv — eski yozuvlarda null) ═══════════════

  /// Primary yozuv sanasi — 00:00 ga normallashtirilgan (§69:
  /// AttendanceDate != vaqt nuqtasi). Legacy yozuvda null bo'lishi mumkin;
  /// [AttendanceSchemaV2Migration] to'ldiradi.
  @Index()
  DateTime? attendanceDate;

  /// Dars instance ID (P0-02): `LESSON-{scheduleId}-{yyyyMMdd}`.
  ///
  /// V3 invariant: **1 talaba + 1 dars = 1 primary yozuv** — bir kunda
  /// bir nechta dars bo'lsa har biri alohida yozuvga ega. Eski (V2)
  /// kundalik yozuvlar null — ular sana darajasida merge qilinadi va
  /// dars aniqlanganda avtomatik `lessonId` bilan yangilanadi.
  @Index()
  String? lessonId;

  /// Kirish vaqti (birinchi belgilash).
  DateTime? checkInAt;

  /// Chiqish vaqti (kun ichidagi ikkinchi belgilash) — agar bo'lsa.
  DateTime? checkOutAt;

  /// §13 holat: present | late | absent | excused (V2: default present).
  String? status;

  /// Eski (V1) yozuv birlashtirilgan (superseded) — so'rovlardan chiqariladi.
  bool? isLegacyMerged;

  /// Qaysi primary yozuvga birlashtirilgani (audit izi).
  int? mergedIntoId;

  /// Yozuv qachon tahrirlangani (V4 additiv — eski yozuvlarda null).
  ///
  /// [MarkAttendanceStatusCommand] mavjud yozuvni yangilaganda o'rnatiladi
  /// — Attendance History'da "Tahrirlangan" belgisi shu maydonga asoslanadi.
  DateTime? editedAt;

  /// Onlayn/oflayn sync uchun versiya (additiv schema migratsiya).
  int syncVersion = 1;

  /// Hali bulutga sinxronlanmagan yozuvlar uchun belgi.
  bool pendingSync = true;
}
