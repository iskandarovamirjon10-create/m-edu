import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_recognition_result.dart';
import 'package:m_edu/features/face_recognition/infrastructure/datasources/isar_recognition_attempt_datasource.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/recognition_attempt_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/repositories_impl/recognition_attempt_repository_impl.dart';

/// Tanib olish urinishlari kuzatuv yozuvi (spec §35) — Isar round-trip va
/// korruptsiya barqarorligi. Faqat xavfsiz meta-ma'lumot: hech qanday xom
/// biometrik ma'lumot saqlanmaydi.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  var testCounter = 0;
  String uniqueDbName() => 'm_edu_attempts_${testCounter++}';

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_attempts_test');
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<Isar> openDb() async {
    final db = await AppDatabase.open(
      schemas: [RecognitionAttemptRecordSchema],
      name: uniqueDbName(),
      directory: tempDir.path,
    );
    return db.instance;
  }

  FaceRecognitionResult result({
    FaceRecognitionOutcome outcome = FaceRecognitionOutcome.identified,
    String? identityId,
    double? confidence,
    bool? livenessPassed,
    List<String> issues = const [],
  }) {
    return FaceRecognitionResult(
      outcome: outcome,
      identityId: identityId,
      confidence: confidence,
      livenessPassed: livenessPassed,
      qualityIssueCodes: issues,
      cameraSource: 'test',
      timestamp: DateTime(2026, 8, 17, 10, 30),
    );
  }

  test('round-trip: record → fetchRecent xuddi shu meta-ma\'lumotni qaytaradi',
      () async {
    final isar = await openDb();
    final repo = RecognitionAttemptRepositoryImpl(
      IsarRecognitionAttemptDataSource(isar),
    );

    await repo.record(result(
      outcome: FaceRecognitionOutcome.identified,
      identityId: 'M-EDU-2026-000001',
      confidence: 0.97,
      livenessPassed: true,
    ));
    // Vaqt indeksi bo'yicha tartiblash deterministik bo'lishi uchun
    // yozuvlar turli vaqtlarda saqlanadi.
    final unknown = result(
      outcome: FaceRecognitionOutcome.unknown,
      livenessPassed: true,
    );
    final rejected = result(
      outcome: FaceRecognitionOutcome.qualityRejected,
      issues: const ['faceTooSmall', 'lowLight'],
    );
    await repo.record(
      FaceRecognitionResult(
        outcome: unknown.outcome,
        livenessPassed: unknown.livenessPassed,
        cameraSource: unknown.cameraSource,
        timestamp: DateTime(2026, 8, 17, 10, 31),
      ),
    );
    await repo.record(
      FaceRecognitionResult(
        outcome: rejected.outcome,
        qualityIssueCodes: rejected.qualityIssueCodes,
        cameraSource: rejected.cameraSource,
        timestamp: DateTime(2026, 8, 17, 10, 32),
      ),
    );

    final recent = await repo.fetchRecent();
    expect(recent.length, 3);
    // Eng yangisi birinchi (timestamp bo'yicha teskari).
    expect(recent.first.outcome, FaceRecognitionOutcome.qualityRejected);
    expect(recent.first.qualityIssueCodes, ['faceTooSmall', 'lowLight']);

    final identified =
        recent.firstWhere((r) => r.outcome == FaceRecognitionOutcome.identified);
    expect(identified.identityId, 'M-EDU-2026-000001');
    expect(identified.confidence, 0.97);
    expect(identified.livenessPassed, isTrue);
    expect(identified.cameraSource, 'test');
    await isar.close();
  });

  test('korrupt outcome (noto\'g\'ri nom) xato tashlamaydi', () async {
    final isar = await openDb();
    await isar.writeTxn(() => isar.recognitionAttemptRecords.putAll([
          RecognitionAttemptRecord()
            ..outcome = 'identified'
            ..timestamp = DateTime(2026, 8, 17, 10),
          RecognitionAttemptRecord()
            ..outcome = 'hacked-outcome'
            ..timestamp = DateTime(2026, 8, 17, 11),
        ]));

    final repo = RecognitionAttemptRepositoryImpl(
      IsarRecognitionAttemptDataSource(isar),
    );
    final recent = await repo.fetchRecent();

    // Valid yozuv keladi, korrupt o'tkazib yuborilmaydi — xavfsiz fallback.
    expect(recent.length, 2);
    expect(recent.first.outcome, isNot(FaceRecognitionOutcome.identified));
    await isar.close();
  });

  test('record xatosi asosiy oqimni buzmaydi (best-effort)', () async {
    final isar = await openDb();
    final repo = RecognitionAttemptRepositoryImpl(
      IsarRecognitionAttemptDataSource(isar),
    );
    // Yopilgan bazaga yozish xato beradi — lekin repository yutadi.
    await isar.close();
    await repo.record(result()); // exception tashlanmasligi kerak
  });

  test('sana indeksi: timestampIndex to\'ldiriladi', () async {
    final isar = await openDb();
    final repo = RecognitionAttemptRepositoryImpl(
      IsarRecognitionAttemptDataSource(isar),
    );
    await repo.record(result());
    final all = await isar.recognitionAttemptRecords.where().findAll();
    expect(all.single.timestampIndex, isNotNull);
    expect(all.single.timestampIndex, all.single.timestamp);
    await isar.close();
  });
}
