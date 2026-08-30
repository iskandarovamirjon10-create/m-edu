import '../entities/attendance_session.dart';

/// Davomat sessiyalari uchun repository interfeysi (P1.5).
///
/// Sessiya `lessonId` bo'yicha yagona — bitta dars uchun bitta session.
/// [upsert] writeTxn ichida find+merge qiladi (parallel ochilishda ham
/// duplicate session yaratilmaydi).
abstract class AttendanceSessionRepository {
  /// Sessiyani saqlaydi (upsert, lessonId bo'yicha yagona).
  Future<AttendanceSession> upsert(AttendanceSession session);

  /// Dars bo'yicha sessiya (bo'lmasa null).
  Future<AttendanceSession?> fetchByLesson(String lessonId);

  /// Sessiyani faqat YO'Q bo'lsa yaratadi — atomic (race-xavfsiz).
  ///
  /// Yaratilgan bo'lsa sessiyani, aks holda `null` qaytaradi. Bu
  /// `AttendanceSessionOpenedEvent` faqat haqiqiy yaratilishda chiqishini
  /// ta'minlaydi (parallel ochilishda duplicate event bo'lmaydi).
  Future<AttendanceSession?> createIfAbsent(AttendanceSession session);

  /// Barcha faol (active/notStarted) sessiyalar.
  Future<List<AttendanceSession>> fetchActive();

  /// Dars sessiyasini yopadi (completed + closedAt). Mavjud bo'lmasa null.
  Future<AttendanceSession?> closeByLesson(
    String lessonId,
    DateTime closedAt,
  );
}
