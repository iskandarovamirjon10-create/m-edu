import 'package:equatable/equatable.dart';

/// Dars (lesson) bo'yicha davomat sessiyasi holati (P1.5).
enum AttendanceSessionStatus {
  /// Dars hali boshlanmagan (hozingi vaqt < startTime).
  notStarted,

  /// Dars davom etmoqda (startTime <= hozir < endTime).
  active,

  /// Dars tugagan / yopilgan.
  completed,

  /// Sessiya bekor qilingan.
  cancelled,
}

/// ATTENDANCE SESSION — bitta dars (LessonInstance) uchun davomat oynasi.
///
/// ```text
/// lessonId ──▶ AttendanceSession (openedAt, closedAt, status)
/// ```
///
/// Sessiya `lessonId` bo'yicha yagona: bitta dars uchun bir nechta session
/// ochilmaydi (duplicate himoyasi). Isar'da saqlanadi — restartdan keyin
/// tiklanishadi, offline ishlaydi (P1.5 #4, #12, #13).
///
/// `sessionId` deterministik: `SESSION-{lessonId}`.
class AttendanceSession extends Equatable {
  final String sessionId;

  /// Dars instance ID — `LESSON-{scheduleId}-{yyyyMMdd}`.
  final String lessonId;

  /// Dars o'tilayotgan guruh.
  final String groupId;

  /// Sessiya ochilgan vaqt.
  final DateTime openedAt;

  /// Sessiya yopilgan vaqt (completed/cancelled bo'lganda).
  final DateTime? closedAt;

  final AttendanceSessionStatus status;

  const AttendanceSession({
    required this.sessionId,
    required this.lessonId,
    required this.groupId,
    required this.openedAt,
    this.closedAt,
    required this.status,
  });

  bool get isActive => status == AttendanceSessionStatus.active;

  AttendanceSession copyWith({
    DateTime? openedAt,
    Object? closedAt = _unset,
    AttendanceSessionStatus? status,
  }) {
    return AttendanceSession(
      sessionId: sessionId,
      lessonId: lessonId,
      groupId: groupId,
      openedAt: openedAt ?? this.openedAt,
      closedAt: identical(closedAt, _unset)
          ? this.closedAt
          : closedAt as DateTime?,
      status: status ?? this.status,
    );
  }

  static const Object _unset = _CopyWithUnset();

  @override
  List<Object?> get props => [
        sessionId,
        lessonId,
        groupId,
        openedAt,
        closedAt,
        status,
      ];
}

class _CopyWithUnset {
  const _CopyWithUnset();
}
