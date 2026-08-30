import '../../domain/entities/student.dart';
import '../../domain/repositories/student_repository.dart';

/// Talaba o'qish operatsiyalari (CQRS queries).
class StudentQueries {
  final StudentRepository _repository;

  StudentQueries({required StudentRepository repository})
      : _repository = repository;

  /// Barcha talabalarni qaytaradi.
  Future<List<Student>> fetchAll() => _repository.fetchAll();

  /// Sahifalangan o'qish (Phase 16) — butun jadvalni xotiraga yuklamaydi.
  Future<List<Student>> fetchPage({
    required int offset,
    required int limit,
  }) =>
      _repository.fetchPage(offset: offset, limit: limit);

  /// Faol talabalarni qaytaradi.
  Future<List<Student>> fetchActive() => _repository.fetchActive();

  /// Identity ID bo'yicha talabani topadi.
  Future<Student?> fetchByIdentityId(String identityId) =>
      _repository.fetchByIdentityId(identityId);

  /// Guruh ID bo'yicha talabalarni topadi.
  Future<List<Student>> fetchByGroupId(String groupId) =>
      _repository.fetchByGroupId(groupId);

  /// To'lov qilmagan talabalarni qaytaradi.
  Future<List<Student>> fetchUnpaid() => _repository.fetchUnpaid();

  /// Guruhdagi talaba sonini hisoblaydi.
  Future<int> countByGroupId(String groupId) async {
    final students = await _repository.fetchByGroupId(groupId);
    return students.length;
  }

  /// Guruhdagi faol talaba sonini hisoblaydi.
  Future<int> countActiveByGroupId(String groupId) async {
    final students = await _repository.fetchByGroupId(groupId);
    return students.where((s) => s.isActive).length;
  }

  /// Jami talaba sonini qaytaradi (butun ro'yxatni yuklamasdan).
  Future<int> countAll() => _repository.countAll();

  /// Faol talaba sonini qaytaradi.
  Future<int> countActive() async {
    final students = await _repository.fetchActive();
    return students.length;
  }

  /// To'lov qilmagan talaba sonini qaytaradi.
  Future<int> countUnpaid() async {
    final students = await _repository.fetchUnpaid();
    return students.length;
  }
}
