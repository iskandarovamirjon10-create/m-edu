import 'package:isar/isar.dart';

import '../models/recognition_attempt_record.dart';

/// [RecognitionAttemptRecord] uchun Isar datasource.
class IsarRecognitionAttemptDataSource {
  final Isar _db;

  IsarRecognitionAttemptDataSource(this._db);

  Future<void> put(RecognitionAttemptRecord record) {
    return _db.writeTxn(() => _db.recognitionAttemptRecords.put(record));
  }

  Future<List<RecognitionAttemptRecord>> findRecent({int limit = 100}) {
    return _db.recognitionAttemptRecords
        .where()
        .sortByTimestampDesc()
        .limit(limit)
        .findAll();
  }

  Future<int> countByOutcome(String outcome) {
    return _db.recognitionAttemptRecords
        .filter()
        .outcomeEqualTo(outcome)
        .count();
  }
}
