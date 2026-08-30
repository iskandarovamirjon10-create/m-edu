import '../../domain/repositories/recognition_attempt_repository.dart';
import '../../domain/value_objects/face_recognition_result.dart';
import '../datasources/isar_recognition_attempt_datasource.dart';
import '../models/recognition_attempt_record.dart';

/// [RecognitionAttemptRepository] ning Isar asosidagi implementatsiyasi.
///
/// Kuzatuv yozuvi best-effort: saqlash xatosi asosiy tanib olish oqimini
/// buzmaydi (xato yutiladi — kuzatuv yordamchi kanal).
class RecognitionAttemptRepositoryImpl
    implements RecognitionAttemptRepository {
  final IsarRecognitionAttemptDataSource _datasource;

  RecognitionAttemptRepositoryImpl(this._datasource);

  @override
  Future<void> record(FaceRecognitionResult result) async {
    try {
      await _datasource.put(RecognitionAttemptRecord()
        ..outcome = result.outcome.name
        ..identityId = result.identityId
        ..confidence = result.confidence
        ..livenessPassed = result.livenessPassed
        ..durationMs = result.durationMs
        ..qualityIssueCodes = result.qualityIssueCodes
        ..cameraSource = result.cameraSource
        ..timestamp = result.timestamp
        ..timestampIndex = result.timestamp
        ..reason = result.reason);
    } on Object {
      // Kuzatuv yozuvi muhim emas — asosiy oqim buzilmaydi (spec §35).
    }
  }

  @override
  Future<List<FaceRecognitionResult>> fetchRecent({int limit = 100}) async {
    final records = await _datasource.findRecent(limit: limit);
    return records.map(_toResult).toList();
  }

  FaceRecognitionResult _toResult(RecognitionAttemptRecord record) {
    final outcome = FaceRecognitionOutcome.values
        .where((o) => o.name == record.outcome)
        .firstOrNull;
    return FaceRecognitionResult(
      outcome: outcome ?? FaceRecognitionOutcome.timedOut,
      identityId: record.identityId,
      confidence: record.confidence,
      durationMs: record.durationMs,
      livenessPassed: record.livenessPassed,
      qualityIssueCodes: List.unmodifiable(record.qualityIssueCodes),
      cameraSource: record.cameraSource,
      timestamp: record.timestamp,
      reason: record.reason,
    );
  }
}
