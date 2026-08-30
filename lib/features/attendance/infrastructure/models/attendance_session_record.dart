import 'package:isar/isar.dart';

part 'attendance_session_record.g.dart';

/// Davomat sessiyasi — bitta dars uchun yagona yozuv (P1.5).
///
/// `lessonId` bo'yicha indekslanadi; `sessionId = SESSION-{lessonId}`
/// deterministik. Sessiya restartdan keyin ham saqlanadi va offline
/// ishlaydi (Isar lokal bazasi).
@collection
class AttendanceSessionRecord {
  Id id = Isar.autoIncrement;

  /// Deterministik sessiya ID: `SESSION-{lessonId}`.
  @Index()
  late String sessionId;

  /// Dars instance ID: `LESSON-{scheduleId}-{yyyyMMdd}`.
  @Index()
  late String lessonId;

  /// Dars o'tilayotgan guruh.
  late String groupId;

  /// Sessiya ochilgan vaqt.
  late DateTime openedAt;

  /// Sessiya yopilgan vaqt (completed/cancelled).
  DateTime? closedAt;

  /// AttendanceSessionStatus.name: notStarted | active | completed | cancelled.
  late String status;
}
