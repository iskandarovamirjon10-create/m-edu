import '../entities/attendance_entry.dart';

/// Davomat yozuvlari uchun repository interfeysi.
///
/// V3 invariant (spec §14, P0-02): 1 talaba + 1 dars = 1 primary yozuv
/// (dars aniqlanganda); legacy V2 yozuvlar 1 talaba + 1 kun bo'lib qoladi.
/// [record] upsert semantikaga ega — mavjud primary yozuv yangilanadi
/// (check-in/check-out birlashtiriladi), dublikat yaratilmaydi.
abstract class AttendanceRepository {
  /// Davomat yozuvini saqlaydi (upsert).
  ///
  /// - `(identityId, attendanceDate)` uchun primary yozuv mavjud bo'lmasa
  ///   — yangi yozuv yaratiladi (check-in).
  /// - Mavjud bo'lsa — yangi vaqt birlashtiriladi: check-in = eng erta,
  ///   check-out = eng kech. (write transaction ichida — race xavfsiz.)
  Future<AttendanceEntry> record(AttendanceEntry entry);

  /// Bugungi primary yozuvlar (vaqt bo'yicha kamayuvchi).
  Future<List<AttendanceEntry>> fetchToday();

  /// Berilgan sana primary yozuvlari.
  Future<List<AttendanceEntry>> fetchForDate(DateTime date);

  /// Identity'ning barcha primary yozuvlari.
  Future<List<AttendanceEntry>> fetchForIdentity(String identityId);

  /// Identity'ning (kun) primary yozuvi — §14 idempotency uchun.
  Future<AttendanceEntry?> fetchByStudentAndDate(
    String identityId,
    DateTime attendanceDate,
  );

  /// Identity'ning (dars) primary yozuvi — V3 idempotency uchun.
  ///
  /// Bir talaba + bir dars = bitta yozuv: check-in/check-out/duplicate
  /// qarori shu yozuv ustidan beriladi.
  Future<AttendanceEntry?> fetchByStudentAndLesson(
    String identityId,
    String lessonId,
  );

  /// Dars (lesson instance) bo'yicha primary yozuvlar — V3.
  ///
  /// Bitta dars uchun barcha student yozuvlari (vaqt bo'yicha kamayuvchi).
  /// Dars darajasidagi ro'yxat [AttendancePage] va lesson-aware statistika
  /// uchun ishlatiladi (P1: attendance faol darsga bog'langan).
  Future<List<AttendanceEntry>> fetchByLesson(String lessonId);

  /// Identity bugun belgilanganmi? (usul endi rol o'ynamaydi — §14).
  Future<bool> hasRecordedToday(String identityId);

  /// Sana oralig'idagi primary yozuvlar (oylik hisobot uchun).
  Future<List<AttendanceEntry>> fetchBetween(DateTime from, DateTime to);

  /// Bugungi primary belgilashlar soni.
  Future<int> countToday();

  /// Identity merge (P0-01): `fromIdentityId` ga bog'langan davomat
  /// yozuvlarini `toIdentityId` ga ko'chiradi. O'sha kunga survivor'da
  /// yozuv bo'lsa — vaqtlar birlashtiriladi, duplicate legacy deb
  /// belgilanadi (§14, §23 invariantlar saqlanadi).
  /// Qaytarilgan qiymat: ishlov berilgan yozuvlar soni.
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  );
}
