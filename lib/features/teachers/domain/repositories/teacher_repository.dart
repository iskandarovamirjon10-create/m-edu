import '../entities/teacher.dart';

/// O'qituvchi ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class TeacherRepository {
  /// Yangi o'qituvchini saqlaydi.
  Future<Teacher> save(Teacher teacher);

  /// O'qituvchi ma'lumotlarini yangilaydi.
  Future<Teacher> update(Teacher teacher);

  /// Identity ID bo'yicha o'qituvchini topadi.
  Future<Teacher?> fetchByIdentityId(String identityId);

  /// Barcha o'qituvchilarni qaytaradi.
  Future<List<Teacher>> fetchAll();

  /// Faol o'qituvchilarni qaytaradi.
  Future<List<Teacher>> fetchActive();

  /// Guruh ID bo'yicha o'qituvchilarni topadi.
  Future<List<Teacher>> fetchByGroupId(String groupId);

  /// Mutaxassislik bo'yicha o'qituvchilarni topadi.
  Future<List<Teacher>> fetchBySpecialization(String specialization);

  /// O'qituvchini guruhga tayinlaydi.
  Future<Teacher> assignToGroup(String identityId, String groupId);

  /// O'qituvchini guruhdan chiqaradi.
  Future<Teacher> removeFromGroup(String identityId, String groupId);

  /// O'qituvchi raqamini keyingi mavjud qiladi.
  Future<int> nextTeacherNumber();

  /// O'qituvchi holatini yangilaydi.
  Future<Teacher> updateStatus(String identityId, TeacherStatus newStatus);

  /// Haftalik soatni yangilaydi.
  Future<Teacher> updateWeeklyHours(String identityId, int hours);

  /// O'qituvchini butunlay o'chiradi (hard delete).
  ///
  /// Eslatma: guruhlardagi `teacherId` havolalari command qatlamida
  /// tozalanadi ([DeleteTeacherCommand]).
  Future<void> deleteByIdentityId(String identityId);
}
