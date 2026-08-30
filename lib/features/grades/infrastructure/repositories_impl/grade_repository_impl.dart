import '../../domain/entities/grade.dart';
import '../../domain/repositories/grade_repository.dart';
import '../datasources/isar_grade_datasource.dart';
import '../models/grade_record.dart';

/// `GradeRepository` interfeysining Isar asosidagi implementatsiyasi.
class GradeRepositoryImpl implements GradeRepository {
  final IsarGradeDataSource _datasource;

  GradeRepositoryImpl(this._datasource);

  @override
  Future<Grade> save(Grade grade) async {
    final record = _toRecord(grade);
    final saved = await _datasource.insert(record);
    return _toEntity(saved);
  }

  @override
  Future<Grade> update(Grade grade) async {
    final record = _toRecord(grade);
    record.syncVersion += 1;
    // `update` — mavjud id saqlanadi (unique index buzilmaydi).
    final updated = await _datasource.update(record);
    return _toEntity(updated);
  }

  @override
  Future<void> delete(String gradeId) => _datasource.delete(gradeId);

  @override
  Future<Grade?> fetchById(String gradeId) async {
    final record = await _datasource.findById(gradeId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Grade>> fetchAll() async {
    final records = await _datasource.findAll();
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Grade>> fetchByStudent(String studentIdentityId) async {
    final records = await _datasource.findByStudent(studentIdentityId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Grade>> fetchBySubject(String subjectId) async {
    final records = await _datasource.findBySubject(subjectId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Grade>> fetchByGroup(String groupId) async {
    final records = await _datasource.findByGroup(groupId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<Grade>> fetchByDateRange(DateTime start, DateTime end) async {
    final records = await _datasource.findByDateRange(start, end);
    return records.map(_toEntity).toList();
  }

  @override
  Future<double?> averageForStudent(String studentIdentityId) async {
    final records = await _datasource.findByStudent(studentIdentityId);
    if (records.isEmpty) return null;
    final sum = records.fold<int>(0, (acc, r) => acc + r.value);
    return sum / records.length;
  }

  @override
  Future<List<StudentGradeSummary>> studentSummaries() async {
    final records = await _datasource.findAll();
    final byStudent = <String, List<GradeRecord>>{};
    for (final record in records) {
      byStudent.putIfAbsent(record.studentIdentityId, () => []).add(record);
    }

    return byStudent.entries.map((entry) {
      final grades = entry.value;
      final values = grades.map((g) => g.value);
      final count = values.length;
      return StudentGradeSummary(
        studentIdentityId: entry.key,
        studentName: grades.first.studentName,
        groupName: grades.first.groupName,
        gradeCount: count,
        average: values.reduce((a, b) => a + b) / count,
        bestGrade: values.reduce((a, b) => a > b ? a : b),
        lowestGrade: values.reduce((a, b) => a < b ? a : b),
      );
    }).toList()
      ..sort((a, b) => b.average.compareTo(a.average));
  }

  // ==================== Mapping ====================

  GradeRecord _toRecord(Grade grade) {
    return GradeRecord()
      ..gradeId = grade.gradeId
      ..studentIdentityId = grade.studentIdentityId
      ..studentName = grade.studentName
      ..groupId = grade.groupId
      ..groupName = grade.groupName
      ..subjectId = grade.subjectId
      ..subjectName = grade.subjectName
      ..value = grade.value
      ..comment = grade.comment
      ..date = grade.date
      ..syncVersion = grade.syncVersion;
  }

  Grade _toEntity(GradeRecord record) {
    return Grade(
      gradeId: record.gradeId,
      studentIdentityId: record.studentIdentityId,
      studentName: record.studentName,
      groupId: record.groupId,
      groupName: record.groupName,
      subjectId: record.subjectId,
      subjectName: record.subjectName,
      value: record.value,
      comment: record.comment,
      date: record.date,
      syncVersion: record.syncVersion,
    );
  }
}
