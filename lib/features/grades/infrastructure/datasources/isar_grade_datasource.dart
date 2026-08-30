import 'package:isar/isar.dart';

import '../models/grade_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarGradeDataSource {
  final Isar _db;

  IsarGradeDataSource(this._db);

  Future<GradeRecord> insert(GradeRecord record) async {
    return _db.writeTxn(() async {
      await _db.gradeRecords.put(record);
      return record;
    });
  }

  /// Bahoni yangilaydi: mavjud yozuvning id'sini saqlab REPLACE qiladi
  /// (`gradeId` unique indeksi buzilmasligi uchun).
  Future<GradeRecord> update(GradeRecord record) {
    return _db.writeTxn(() async {
      final existing = await _db.gradeRecords
          .filter()
          .gradeIdEqualTo(record.gradeId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.gradeRecords.put(record);
      return record;
    });
  }

  Future<void> delete(String gradeId) async {
    await _db.writeTxn(() async {
      final existing = await _db.gradeRecords
          .filter()
          .gradeIdEqualTo(gradeId)
          .findFirst();
      if (existing != null) {
        await _db.gradeRecords.delete(existing.id);
      }
    });
  }

  Future<GradeRecord?> findById(String gradeId) {
    return _db.gradeRecords
        .filter()
        .gradeIdEqualTo(gradeId)
        .findFirst();
  }

  Future<List<GradeRecord>> findAll() {
    return _db.gradeRecords.where().sortByDateDesc().findAll();
  }

  Future<List<GradeRecord>> findByStudent(String studentIdentityId) {
    return _db.gradeRecords
        .filter()
        .studentIdentityIdEqualTo(studentIdentityId)
        .sortByDateDesc()
        .findAll();
  }

  Future<List<GradeRecord>> findBySubject(String subjectId) {
    return _db.gradeRecords
        .filter()
        .subjectIdEqualTo(subjectId)
        .sortByDateDesc()
        .findAll();
  }

  Future<List<GradeRecord>> findByGroup(String groupId) {
    return _db.gradeRecords
        .filter()
        .groupIdEqualTo(groupId)
        .sortByDateDesc()
        .findAll();
  }

  Future<List<GradeRecord>> findByDateRange(DateTime start, DateTime end) {
    // `dateBetween` inklusiv (start ≤ date ≤ end) — sanalar quyi/qat'iy
    // chegaralarni o'z ichiga oladi.
    return _db.gradeRecords
        .filter()
        .dateBetween(start, end)
        .sortByDateDesc()
        .findAll();
  }

  Future<List<GradeRecord>> findByStudentAndSubject(
    String studentIdentityId,
    String subjectId,
  ) {
    return _db.gradeRecords
        .filter()
        .studentIdentityIdEqualTo(studentIdentityId)
        .subjectIdEqualTo(subjectId)
        .sortByDateDesc()
        .findAll();
  }
}
