import '../entities/identity.dart';
import '../entities/identity_activity.dart';

/// Identity saqlash va o'qish uchun repository interfeysi.
///
/// Domain qatlami faqat shu interfeysni biladi; Isar/Firebase tafsilotlari
/// `infrastructure` qatlamida yashiringan (spec §1 Repository Pattern).
abstract class IdentityRepository {
  /// Yangi identity'ni saqlaydi. Bir xil `identityId` takrorlansa
  /// `DuplicateIdentityFailure` qaytariladi.
  Future<Identity> save(Identity identity);

  /// Identity uchun audit-log yozuvini qo'shadi (Activity Timeline).
  Future<void> recordActivity(IdentityActivity activity);

  /// Identity holatini yangilaydi (status workflow).
  Future<Identity> updateStatus(String identityId, IdentityStatus newStatus);

  /// Identity'ni to'liq yangilaydi (merge/dedup paytida maydonlarni
  /// to'ldirish uchun, spec §6 #5).
  Future<Identity> update(Identity identity);

  /// `fromIdentityId` ga tegishli barcha audit-log yozuvlarini
  /// `toIdentityId` ga ko'chiradi (merge paytida duplicate timeline'ni
  /// survivor'ga bog'lash). Ko'chirilgan yozuvlar sonini qaytaradi.
  Future<int> repointActivities(String fromIdentityId, String toIdentityId);

  Future<Identity?> fetchByIdentityId(String identityId);

  /// Telefon raqami bo'yicha qidirish (identity dedup uchun, §3).
  Future<Identity?> fetchByPhone(String normalizedPhone);

  Future<List<Identity>> fetchAll();

  /// Berilgan IDlar bo'yicha (Phase 16 — sahifalangan browse).
  Future<List<Identity>> fetchByIds(List<String> identityIds);

  Future<List<Identity>> fetchByRole(IdentityRole role);

  Future<List<Identity>> fetchByStatus(IdentityStatus status);

  /// Identity uchun audit-log yozuvlarini vaqt bo'yicha qaytaradi.
  Future<List<IdentityActivity>> fetchActivities(String identityId);

  /// Identity'ni butunlay o'chiradi (hard delete).
  ///
  /// Eslatma: bog'liq Student/Teacher/Face yozuvlari command qatlamida
  /// tozalanadi ([DeleteStudentCommand]/[DeleteTeacherCommand]).
  Future<void> deleteByIdentityId(String identityId);
}
