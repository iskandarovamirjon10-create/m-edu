import '../entities/student.dart';

/// Talaba ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
///
/// Domain qatlami faqat shu interfeysni biladi; Isar tafsilotlari
/// `infrastructure` qatlamida yashiringan (spec §1 Repository Pattern).
abstract class StudentRepository {
  /// Yangi talabani saqlaydi.
  Future<Student> save(Student student);

  /// Talaba ma'lumotlarini yangilaydi.
  Future<Student> update(Student student);

  /// Talaba holatini yangilaydi (status workflow).
  Future<Student> updateStatus(String identityId, StudentStatus newStatus);

  /// Ota-ona/vasiy ma'lumotlarini yangilaydi (ism, telefon, Telegram ID).
  Future<Student> updateParentInfo(
    String identityId, {
    String? parentName,
    String? parentPhone,
    String? parentTelegramId,
  });

  /// Guruhdan-guruhga o'tkazishni boshlaydi.
  Future<Student> startTransfer(String identityId, String targetGroupId);

  /// O'tkazishni tasdiqlaydi.
  Future<Student> confirmTransfer(String identityId);

  /// O'tkazishni bekor qiladi.
  Future<Student> cancelTransfer(String identityId);

  /// Identity ID bo'yicha talabani topadi.
  Future<Student?> fetchByIdentityId(String identityId);

  /// Guruh ID bo'yicha talabalarni topadi.
  Future<List<Student>> fetchByGroupId(String groupId);

  /// Barcha talabalarni qaytaradi.
  Future<List<Student>> fetchAll();

  /// Sahifalangan o'qish (Phase 16) — butun jadvalni xotiraga yuklamaydi.
  /// Yozuvlar `enrolledAt` bo'yicha kamayish tartibida qaytadi.
  Future<List<Student>> fetchPage({
    required int offset,
    required int limit,
  });

  /// Talabalar soni (butun ro'yxatni yuklamasdan).
  Future<int> countAll();

  /// Faol talabalarni qaytaradi.
  Future<List<Student>> fetchActive();

  /// To'lov qilmagan talabalarni qaytaradi.
  Future<List<Student>> fetchUnpaid();

  /// Talaba raqamini keyingi mavjud qiladi.
  Future<int> nextStudentNumber();

  /// Talabani arxivlaydi.
  Future<Student> archive(String identityId);

  /// Talabani bitirgan deb belgilaydi.
  Future<Student> graduate(String identityId);

  /// Talabani muzlatadi.
  Future<Student> freeze(String identityId);

  /// Talabani qayta faollashtiradi.
  Future<Student> reactivate(String identityId);

  /// Talabani butunlay o'chiradi (hard delete).
  ///
  /// Eslatma: guruh a'zoligi va currentSize command qatlamida boshqariladi
  /// ([DeleteStudentCommand] — guruhdan chiqarish + o'chirish).
  Future<void> deleteByIdentityId(String identityId);

  /// Identity merge (P0-01): `fromIdentityId` ga bog'langan student
  /// yozuvlarini `toIdentityId` ga ko'chiradi (primary'da profil bo'lsa —
  /// duplicate'niki arxivlanadi). Qaytarilgan qiymat: ishlov berilgan
  /// yozuvlar soni.
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  );
}
