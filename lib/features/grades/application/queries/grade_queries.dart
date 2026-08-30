import '../../domain/entities/grade.dart';
import '../../domain/repositories/grade_repository.dart';

/// Baholar ma'lumotlarini o'qish uchun query service (CQS).
class GradeQueries {
  final GradeRepository _repository;

  GradeQueries({required GradeRepository repository})
      : _repository = repository;

  Future<List<Grade>> fetchAll() => _repository.fetchAll();

  Future<List<Grade>> fetchByStudent(String studentIdentityId) =>
      _repository.fetchByStudent(studentIdentityId);

  Future<List<Grade>> fetchBySubject(String subjectId) =>
      _repository.fetchBySubject(subjectId);

  Future<List<Grade>> fetchByGroup(String groupId) =>
      _repository.fetchByGroup(groupId);

  Future<List<Grade>> fetchByDateRange(DateTime start, DateTime end) =>
      _repository.fetchByDateRange(start, end);

  Future<double?> averageForStudent(String studentIdentityId) =>
      _repository.averageForStudent(studentIdentityId);

  Future<List<StudentGradeSummary>> studentSummaries() =>
      _repository.studentSummaries();

  /// O'quvchining fanlar bo'yicha guruhlangan baholari (detail uchun).
  Future<List<SubjectGradeGroup>> subjectGroupsForStudent(
    String studentIdentityId,
  ) async {
    final grades = await _repository.fetchByStudent(studentIdentityId);
    final bySubject = <String, List<Grade>>{};
    for (final grade in grades) {
      bySubject.putIfAbsent(grade.subjectName, () => []).add(grade);
    }
    return bySubject.entries.map((entry) {
      final list = entry.value;
      final avg = list.fold<int>(0, (a, g) => a + g.value) / list.length;
      return SubjectGradeGroup(
        subjectName: entry.key,
        grades: list,
        average: avg,
      );
    }).toList();
  }
}
