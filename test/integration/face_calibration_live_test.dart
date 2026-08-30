import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/calibration_report.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_calibration_harness.dart';
import 'package:m_edu/features/face_recognition/infrastructure/calibration/calibration_corpus_loader.dart';
import 'package:m_edu/features/face_recognition/infrastructure/calibration/signature_calibration_extractor.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/face_vision_engine.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/tflite_face_vision_engine.dart';

// ────────────────────────────────────────────────────────────────────────────
// FACE ID THRESHOLD CALIBRATION — LIVE (spec §29)
//
// REAL stack: REAL FaceVisionEngine (ML Kit / TFLite) + REAL korpus
// fayllari. Hech qanday fake ball yo'q.
//
// Gate:
//   - Korpus (test_data/calibration/) bo'lmasa → NOT BENCHMARKED skip.
//   - Platformada dvigatel ishlamasa → NOT BENCHMARKED skip.
//
// Natija (BENCHMARKED bo'lsa): build/calibration/scores_<model>.json
// fayliga yoziladi → `dart run tool/calibrate_face_thresholds.dart
// scores --file <fayl>` bilan qayta tahlil qilish mumkin.
// ────────────────────────────────────────────────────────────────────────────

void main() {
  test('face recognition threshold calibration — live (gated)', () async {
    // Gate 1: korpus bormi?
    // `Platform.environment` — runtime o'zgaruvchisi (--dart-define EMAS,
    // oddiy shell env ishlaydi): M_EDU_CALIBRATION_DIR=... flutter test ...
    final corpusPath = Platform.environment['M_EDU_CALIBRATION_DIR'] ??
        'test_data/calibration';
    final explicit = Platform.environment.containsKey('M_EDU_CALIBRATION_DIR');
    final corpusDir = Directory(corpusPath);
    if (!corpusDir.existsSync()) {
      markTestSkipped(
          'NOT BENCHMARKED: kalibrlash korpusi topilmadi ($corpusPath). '
          '`dart run tool/calibrate_face_thresholds.dart plan` ga qarang.');
      return;
    }

    // Gate 2: korpus yuklana oladimi? Default yo'l bo'lsa bo'sh/to'liqsiz
    // korpus ham NOT BENCHMARKED skip (yig'ish jarayoni davom etmoqda).
    // M_EDU_CALIBRATION_DIR ANIQ berilgan bo'lsa — buzilgan korpus xato
    // sifatida qattiq ko'rsatiladi (jimgina o'tkazib yuborilmaydi).
    final load = CalibrationCorpusLoader.load(corpusDir.path);
    if (explicit) {
      expect(load.errors, isEmpty,
          reason: 'Korpus noto\'g\'ri: ${load.errors.join('; ')}');
    } else if (!load.isValid) {
      markTestSkipped(
          'NOT BENCHMARKED: korpus hali to\'liq emas '
          '(${load.errors.take(3).join('; ')}). Korpus yig\'ilgach '
          'M_EDU_CALIBRATION_DIR bilan aniq ishga tushiring.');
      return;
    }
    final corpus = load.corpus!;

    // Gate 3: platformada dvigatel bormi?
    if (!FaceVisionEngine.isSupportedOnPlatform) {
      markTestSkipped(
          'NOT BENCHMARKED: bu platformada FaceVisionEngine qo\'llab-'
          'quvvatlanmaydi (real qurilmada ishga tushiring).');
      return;
    }

    // REAL dvigatel (production provider bilan bir xil tanlov).
    final engine = Platform.isWindows || Platform.isLinux
        ? TFLiteFaceVisionEngine() as FaceVisionEngine
        : MLKitFaceVisionEngine() as FaceVisionEngine;
    final extractor = SignatureCalibrationExtractor(engine);
    addTearDown(extractor.dispose);

    final harness = FaceCalibrationHarness(extractor: extractor);
    final run = await harness.run(corpus);

    // Ballar chiqdi — har bir subyekt genuine/impostor ball berishi kerak
    // (korpus valid bo'lsa). Shart: hech qanday fake ball yo'q.
    expect(run.genuineScores, isNotEmpty,
        reason: 'Hech qanday genuine ball chiqmadi — '
            'korpus/dvigatelni tekshiring: ${run.failures.take(5).join('; ')}');
    expect(run.impostorScores, isNotEmpty,
        reason: 'Hech qanday impostor ball chiqmadi');

    // BENCHMARKED bo'lsa — EER majburiy; tavsiya esa data sifatiga bog'liq
    // (target FPR erishib bo'lmasa null — bu ham halol signal).
    if (run.isBenchmarked) {
      expect(run.analysis.eer, isNotNull);
      expect(run.analysis.eerThreshold, isNotNull);
    }

    // Natijani diskga saqlash — CLI bilan qayta tahlil uchun.
    // M_EDU_SCORES_SUFFIX=holdout → scores_<model>_holdout.json
    // (spec §11: kalibrlash va holdout natijalari alohida saqlanadi).
    final outDir = Directory('build/calibration')..createSync(recursive: true);
    final suffix = Platform.environment['M_EDU_SCORES_SUFFIX'] ?? '';
    // Suffix bo'lsa `_` bilan: scores_<model>_holdout.json (report ularni
    // holdout sifatida juftlaydi); bo'lmasa eski nom saqlanadi.
    final outFile = File(
        '${outDir.path}/scores_${run.modelKey}${suffix.isEmpty ? '' : '_$suffix'}.json');
    await outFile.writeAsString(jsonEncode({
      'modelKey': run.modelKey,
      'genuine': run.genuineScores,
      'impostor': run.impostorScores,
      'latencyMs': run.extractionLatencyMs,
      'failures': run.failures,
    }));

    // Halol hisobot — har doim konsolga chiqadi (BENCHMARKED ham, yo'q ham).
    // ignore: avoid_print
    print(formatCalibrationReport(run));
    // ignore: avoid_print
    print('Scores saqlangan: ${outFile.path}');
  });
}
