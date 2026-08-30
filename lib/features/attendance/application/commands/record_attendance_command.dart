import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/attendance_entry.dart';
import '../../domain/events/attendance_events.dart';
import '../../domain/repositories/attendance_repository.dart';

/// Davomatni belgilash so'rovi.
class RecordAttendanceRequest {
  final String identityId;
  final String fullName;

  /// IdentityRole.name.
  final String role;

  /// face | qr | manual.
  final String method;

  /// Dars instance ID (V3): berilsa yozuv dars darajasida — bir talaba +
  /// bir dars = bitta primary yozuv (check-in/check-out shu dars uchun).
  /// Null bo'lsa legacy kundalik xatti-harakat (V2).
  final String? lessonId;

  final double? confidence;
  final String? source;

  const RecordAttendanceRequest({
    required this.identityId,
    required this.fullName,
    required this.role,
    required this.method,
    this.lessonId,
    this.confidence,
    this.source,
  });
}

/// Bajarilgan amal turi (spec §14: check-in / check-out / takroriy).
enum AttendanceAction { checkIn, checkOut, duplicate }

/// Davomat belgilash natijasi.
class RecordAttendanceResult {
  final bool recorded;

  /// [AttendanceAction.checkIn] | [AttendanceAction.checkOut] |
  /// [AttendanceAction.duplicate].
  final AttendanceAction action;
  final AttendanceEntry? entry;

  const RecordAttendanceResult({
    required this.recorded,
    required this.action,
    this.entry,
  });

  /// Qulaylik: qayta belgilash (check-out) ham muvaffaqiyatli amaldir.
  bool get isDuplicate => action == AttendanceAction.duplicate;
}

/// Davomat yozuvi uchun command (V2 — spec §14).
///
/// Auto-toggle invariant:
/// - Primary yozuv yo'q → **CHECK-IN** (yangi yozuv).
/// - Primary yozuv bor, check-out yo'q → **CHECK-OUT** (mavjud yozuv
///   yangilanadi — dublikat YARATILMAYDI).
/// - Primary yozuv bor, check-out ham bor → **TAKRORIY** (e'tiborsiz).
///
/// DB-level integrity: [AttendanceRepository.record] bitta writeTxn
/// ichida find+merge qiladi — parallel belgilashda ham dublikat chiqmaydi.
class RecordAttendanceCommand {
  final AttendanceRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): davomat belgilash — markAttendance ruxsati.
  /// Face/QR/manual barcha oqimlar shu command orqali o'tadi.
  final UserRole actorRole;

  RecordAttendanceCommand({
    required AttendanceRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<RecordAttendanceResult> execute(RecordAttendanceRequest request) async {
    Permissions.require(actorRole, AppPermission.attendanceCreate);

    if (request.identityId.isEmpty || request.fullName.isEmpty) {
      throw const ValidationFailure(
        'Davomat belgilash uchun shaxs ma\'lumotlari yetarli emas',
      );
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    // Mavjud primary yozuvni tekshiramiz (§14 idempotency). Dars
    // aniqlangan bo'lsa — o'sha dars bo'yicha (V3), aks holda kundalik.
    //
    // Eslatma: read→decide→write ikki bosqichli bo'lsa ham dublikat
    // chiqmaydi, chunki [AttendanceRepository.record] ichida `putUpsert`
    // bitta writeTxn'da qayta find+merge qiladi (Isar write tranzaksiyalari
    // serializatsiyalanadi). Bu ko'prikni "optimizatsiya" qilib buzmaslik
    // kerak — DB-level invariant shu yerda himoyalanadi.
    final existing = request.lessonId != null
        ? await _repository.fetchByStudentAndLesson(
            request.identityId,
            request.lessonId!,
          )
        : await _repository.fetchByStudentAndDate(
            request.identityId,
            today,
          );

    if (existing == null) {
      // ── CHECK-IN: yangi primary yozuv.
      final entry = AttendanceEntry(
        identityId: request.identityId,
        fullName: request.fullName,
        role: request.role,
        attendanceDate: today,
        lessonId: request.lessonId,
        checkInAt: now,
        method: request.method,
        confidence: request.confidence,
        source: request.source,
      );
      final saved = await _repository.record(entry);

      _eventBus.publish(AttendanceMarkedEvent(
        identityId: saved.identityId,
        fullName: saved.fullName,
        method: saved.method,
        timestamp: saved.timestamp,
      ));

      return RecordAttendanceResult(
        recorded: true,
        action: AttendanceAction.checkIn,
        entry: saved,
      );
    }

    if (!existing.isCheckedOut) {
      // ── CHECK-OUT: mavjud yozuv yangilanadi (dublikat emas).
      // Check-in usuli saqlanadi — check-out usuli yozuv usulini
      // almashtirmaydi (AttendanceMergePlan qoidasi bilan mos).
      final updated = existing.copyWith(
        checkOutAt: now,
        confidence: request.confidence,
        source: request.source,
      );
      final saved = await _repository.record(updated);

      _eventBus.publish(AttendanceMarkedEvent(
        identityId: saved.identityId,
        fullName: saved.fullName,
        method: saved.method,
        // Check-out hodisasi — audit vaqtini to'g'ri ko'rsatish uchun
        // check-in vaqtini emas, hozirgi vaqtni yuboramiz.
        timestamp: now,
      ));

      return RecordAttendanceResult(
        recorded: true,
        action: AttendanceAction.checkOut,
        entry: saved,
      );
    }

    // ── TAKRORIY: kun to'liq belgilangan (check-in + check-out mavjud).
    return const RecordAttendanceResult(
      recorded: false,
      action: AttendanceAction.duplicate,
      entry: null,
    );
  }
}
