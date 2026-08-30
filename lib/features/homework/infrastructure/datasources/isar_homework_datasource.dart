import 'package:isar/isar.dart';

import '../../../../core/utils/ulid.dart';
import '../models/homework_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarHomeworkDataSource {
  final Isar _db;

  IsarHomeworkDataSource(this._db);

  Future<HomeworkRecord> insert(HomeworkRecord record) async {
    if (record.homeworkId.isEmpty) {
      record.homeworkId = 'HW-${Ulid.generateShort()}';
    }
    await _db.writeTxn(() async {
      await _db.homeworkRecords.put(record);
    });
    return record;
  }

  Future<HomeworkRecord> update(HomeworkRecord record) async {
    await _db.writeTxn(() async {
      // unique homeworkId indeksini buzmasdan replace (kod bazasi konv.).
      final existing = await _db.homeworkRecords
          .filter()
          .homeworkIdEqualTo(record.homeworkId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      record.syncVersion += 1;
      await _db.homeworkRecords.put(record);
    });
    return record;
  }

  Future<void> delete(String homeworkId) async {
    await _db.writeTxn(() async {
      await _db.homeworkRecords
          .filter()
          .homeworkIdEqualTo(homeworkId)
          .deleteAll();
    });
  }

  Future<HomeworkRecord?> findById(String homeworkId) {
    return _db.homeworkRecords
        .filter()
        .homeworkIdEqualTo(homeworkId)
        .findFirst();
  }

  Future<List<HomeworkRecord>> findAll() {
    return _db.homeworkRecords.where().sortByDueDateDesc().findAll();
  }

  Future<List<HomeworkRecord>> findByGroup(String groupId) {
    return _db.homeworkRecords
        .filter()
        .groupIdEqualTo(groupId)
        .sortByDueDateDesc()
        .findAll();
  }

  Future<List<HomeworkRecord>> findByDueDateRange(
    DateTime start,
    DateTime end,
  ) {
    return _db.homeworkRecords
        .filter()
        .dueDateBetween(start, end)
        .sortByDueDateDesc()
        .findAll();
  }
}
