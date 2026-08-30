import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/attendance_entry.dart';
import '../../domain/events/attendance_events.dart';
import '../../domain/repositories/attendance_repository.dart';

/// Davomat holatini belgilash so'rovi (spec §21-24).
class MarkAttendanceStatusRequest {
  final String identityId;
  final String fullName;

  /// IdentityRole.name: student | teacher | staff | parent.
  final String role;

  /// Qaysi kunga tegishli (kun ichidagi vaqt e'tiborsiz — normallashtiriladi).
  final DateTime attendanceDate;

  /// Dars instance ID (V3): berilsa holat dars darajasida belgilanadi
  /// (1 talaba + 1 dars = 1 yozuv). Null — legacy kundalik (V2).
  final String? lessonId;

  /// present | late | absent | excused.
  final AttendanceStatus status;

  const MarkAttendanceStatusRequest({
    required this.identityId,
    required this.fullName,
    required this.role,
    required this.attendanceDate,
    this.lessonId,
    required this.status,
  });
}

/// Davomat holatini belgilash natijasi.
class MarkAttendanceStatusResult {
  final AttendanceEntry entry;

  /// Mavjud yozuv yangilangani (true = edit, false = yangi yozuv).
  final bool wasUpdated;

  /// Edit bo'lsa oldingi holat (audit uchun).
  final String? previousStatus;

  const MarkAttendanceStatusResult({
    required this.entry,
    required this.wasUpdated,
    this.previousStatus,
  });
}

/// Davomat holatini belgilash/tahrirlash command'i (spec §21-24).
///
/// REAL oqim: request → RBAC → DB'da mavjud yozuvni tekshirish → yangi
/// yozuv yaratish yoki mavjudini yangilash (writeTxn upsert) → event →
/// audit (actor, vaqt, eski holat → yangi holat).
///
/// - Mavjud yozuv bo'lmasa ham belgilash mumkin (masalan ABSENT — check-in
///   bo'lmagan talaba uchun ham holat yoziladi).
/// - Yozuv [AttendanceRepository.record] orqali saqlanadi — bitta writeTxn,
///   parallel belgilashda ham dublikat yaratilmaydi.
class MarkAttendanceStatusCommand {
  final AttendanceRepository _repository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC: davomat belgilash — markAttendance/attendanceCreate ruxsati.
  final UserRole actorRole;

  /// Audit uchun kim (who).
  final String? actorUserId;
  final String? actorName;

  MarkAttendanceStatusCommand({
    required AttendanceRepository repository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
    this.actorUserId,
    this.actorName,
  })  : _repository = repository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<MarkAttendanceStatusResult> execute(
    MarkAttendanceStatusRequest request,
  ) async {
    Permissions.require(actorRole, AppPermission.attendanceCreate);

    if (request.identityId.isEmpty || request.fullName.isEmpty) {
      throw const ValidationFailure(
        'Davomat belgilash uchun shaxs ma\'lumotlari yetarli emas',
      );
    }

    final day = DateTime(
      request.attendanceDate.year,
      request.attendanceDate.month,
      request.attendanceDate.day,
    );
    final now = DateTime.now();

    // Mavjud primary yozuvni tekshiramiz (§14 idempotency). Dars
    // aniqlangan bo'lsa — o'sha dars bo'yicha (V3), aks holda kundalik.
    final existing = request.lessonId != null
        ? await _repository.fetchByStudentAndLesson(
            request.identityId,
            request.lessonId!,
          )
        : await _repository.fetchByStudentAndDate(request.identityId, day);

    final AttendanceEntry next;
    if (existing == null) {
      next = AttendanceEntry(
        identityId: request.identityId,
        fullName: request.fullName,
        role: request.role,
        attendanceDate: day,
        lessonId: request.lessonId,
        method: 'manual',
        status: request.status.name,
        // Present/Late — kirish vaqti sifatida hozirgi vaqt; absent/excused
        // — check-in yo'q (faqat holat).
        checkInAt: (request.status == AttendanceStatus.present ||
                request.status == AttendanceStatus.late)
            ? now
            : null,
      );
    } else {
      // V4: mavjud yozuv tahrirlangani — "Tahrirlangan" belgisi (tarix).
      next = existing.copyWith(
        status: request.status.name,
        editedAt: now,
      );
    }

    final saved = await _repository.record(next);

    _eventBus.publish(AttendanceStatusChangedEvent(
      identityId: saved.identityId,
      fullName: saved.fullName,
      status: saved.status,
      previousStatus: existing?.status,
      occurredAt: now,
    ));

    // Audit: actor + vaqt + eski holat → yangi holat (spec §24).
    await _audit?.record(
      action: AuditAction.attendanceEdited,
      targetType: 'attendance',
      targetId: saved.identityId,
      details:
          '${saved.fullName} — ${existing?.status ?? "yo'q"} → ${saved.status}',
    );

    return MarkAttendanceStatusResult(
      entry: saved,
      wasUpdated: existing != null,
      previousStatus: existing?.status,
    );
  }
}
