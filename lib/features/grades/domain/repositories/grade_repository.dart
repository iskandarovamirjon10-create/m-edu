import '../entities/grade.dart';

/// O'quvchilar baholari (o'zlashtirish) uchun repository interfeysi.
abstract class GradeRepository {
  /// Yangi bahoni saqlaydi.
  Future<Grade> save(Grade grade);

  /// Bahoni yangilaydi (mavjud id saqlanadi).
  Future<Grade> update(Grade grade);

  /// Bahoni o'chiradi.
  Future<void> delete(String gradeId);

  /// Baho ID bo'yicha topadi.
  Future<Grade?> fetchById(String gradeId);

  /// Barcha baholarni qaytaradi (sana bo'yicha kamayish tartibida).
  Future<List<Grade>> fetchAll();

  /// O'quvchi bo'yicha baholar.
  Future<List<Grade>> fetchByStudent(String studentIdentityId);

  /// Fan bo'yicha baholar.
  Future<List<Grade>> fetchBySubject(String subjectId);

  /// Guruh bo'yicha baholar.
  Future<List<Grade>> fetchByGroup(String groupId);

  /// Sana oralig'i bo'yicha baholar.
  Future<List<Grade>> fetchByDateRange(DateTime start, DateTime end);

  /// Bir o'quvchining o'rtacha bahosini qaytaradi (bahosi bo'lmasa null).
  Future<double?> averageForStudent(String studentIdentityId);

  /// O'quvchilar bo'yicha jamlanma (o'rtacha, eng yuqori/past baho).
  Future<List<StudentGradeSummary>> studentSummaries();
}
