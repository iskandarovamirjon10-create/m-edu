import 'package:isar/isar.dart';

import '../models/homework_submission_record.dart';

/// Isar bilan ishlaydigan topshiriq datasource'i.
///
/// `putSubmission` upsert semantikaga ega: (homeworkId, studentId) juftligi
/// bo'yicha bitta primary yozuv — takroriy belgilash dublikat yaratmaydi
/// (spec §23: ✓ / ○ ikkita holat, bitta qator).
class IsarHomeworkSubmissionDataSource {
  final Isar _db;

  IsarHomeworkSubmissionDataSource(this._db);

  Future<HomeworkSubmissionRecord> putSubmission(
    HomeworkSubmissionRecord record,
  ) {
    return _db.writeTxn(() async {
      final existing = await _db.homeworkSubmissionRecords
          .filter()
          .homeworkIdEqualTo(record.homeworkId)
          .studentIdEqualTo(record.studentId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      record.syncVersion += 1;
      await _db.homeworkSubmissionRecords.put(record);
      return record;
    });
  }

  Future<List<HomeworkSubmissionRecord>> findByHomework(String homeworkId) {
    return _db.homeworkSubmissionRecords
        .filter()
        .homeworkIdEqualTo(homeworkId)
        .findAll();
  }

  Future<void> deleteByHomework(String homeworkId) {
    return _db.writeTxn(() async {
      await _db.homeworkSubmissionRecords
          .filter()
          .homeworkIdEqualTo(homeworkId)
          .deleteAll();
    });
  }
}
