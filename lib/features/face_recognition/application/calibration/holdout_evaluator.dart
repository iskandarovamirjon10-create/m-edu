import 'calibration_corpus.dart';
import 'face_calibration_harness.dart';
import 'face_threshold_analyzer.dart';
import 'face_vector_extractor.dart';

/// Holdout baholash natijasi (spec §11, §14).
///
/// Kalibrlash setidan olingan threshold HOLDOUT (ko'rilmagan) ballariga
/// qo'llanadi — natija haddan tashqari optimistik bo'lmasligi uchun.
class HoldoutEvaluation {
  /// Qo'llangan threshold (kalibrlashdan kelgan).
  final double threshold;

  /// True Accept Rate: holdout genuine ballarning ≥ threshold ulushi.
  final double trueAcceptRate;

  /// False Accept Rate: holdout impostor ballarning ≥ threshold ulushi.
  final double falseAcceptRate;

  /// False Reject Rate: 1 - TAR.
  final double falseRejectRate;

  /// Holdout genuine ballar soni.
  final int genuineCount;

  /// Holdout impostor ballar soni.
  final int impostorCount;

  /// Holdout seti yetarlicha katta emasmi (kam ball → ishonch past).
  final bool insufficientData;

  /// Holdout'ning mustaqil EER tahlili (yangi rasmlarda) — [evaluateCorpus]
  /// orqali to'ldiriladi. Kalibrlash EER'idan farq qilishi mumkin — bu halol
  /// signal (spec §11).
  final ThresholdAnalysis? eerAnalysis;

  const HoldoutEvaluation({
    required this.threshold,
    required this.trueAcceptRate,
    required this.falseAcceptRate,
    required this.falseRejectRate,
    required this.genuineCount,
    required this.impostorCount,
    required this.insufficientData,
    this.eerAnalysis,
  });

  /// Holdout'ning mustaqil EER qiymati (mavjud bo'lsa).
  double? get eer => eerAnalysis?.eer;

  /// Holdout'ning mustaqil EER threshold'i (mavjud bo'lsa).
  double? get eerThreshold => eerAnalysis?.eerThreshold;
}

/// Holdout baholovchi (spec §11).
class HoldoutEvaluator {
  HoldoutEvaluator._();

  /// Holdout genuine/impostor ballariga kalibrlangan threshold qo'llaydi.
  static HoldoutEvaluation evaluateScores({
    required List<double> genuineScores,
    required List<double> impostorScores,
    required double threshold,
    int minGenuineCount = 20,
    int minImpostorCount = 20,
  }) {
    final point = FaceThresholdAnalyzer.pointAt(
      genuineScores: genuineScores,
      impostorScores: impostorScores,
      threshold: threshold,
    );
    return HoldoutEvaluation(
      threshold: threshold,
      trueAcceptRate: point.truePositiveRate,
      falseAcceptRate: point.falsePositiveRate,
      falseRejectRate: point.falseNegativeRate,
      genuineCount: genuineScores.length,
      impostorCount: impostorScores.length,
      insufficientData:
          genuineScores.length < minGenuineCount ||
              impostorScores.length < minImpostorCount,
    );
  }

  /// Holdout korpusini to'liq ekstraksiya qilib baholaydi (live stack).
  ///
  /// Harness'ni holdout korpusida ishga tushiradi va kalibrlangan
  /// threshold'ni holdout ballariga qo'llaydi. Holdout EER ham mustaqil
  /// hisoblanadi (spec §11: final report holdout setida tekshiriladi).
  static Future<HoldoutEvaluation> evaluateCorpus({
    required CalibrationCorpus corpus,
    required FaceVectorExtractor extractor,
    required double threshold,
    int minGenuineCount = 20,
    int minImpostorCount = 20,
  }) async {
    final harness = FaceCalibrationHarness(extractor: extractor);
    final run = await harness.run(corpus);

    final point = FaceThresholdAnalyzer.pointAt(
      genuineScores: run.genuineScores,
      impostorScores: run.impostorScores,
      threshold: threshold,
    );

    // Holdout'ning mustaqil EER'i (spec §11).
    final eer = FaceThresholdAnalyzer(
      minGenuineCount: minGenuineCount,
      minImpostorCount: minImpostorCount,
    ).analyze(
      genuineScores: run.genuineScores,
      impostorScores: run.impostorScores,
    );

    return HoldoutEvaluation(
      threshold: threshold,
      trueAcceptRate: point.truePositiveRate,
      falseAcceptRate: point.falsePositiveRate,
      falseRejectRate: point.falseNegativeRate,
      genuineCount: run.genuineScores.length,
      impostorCount: run.impostorScores.length,
      insufficientData:
          run.genuineScores.length < minGenuineCount ||
              run.impostorScores.length < minImpostorCount,
      eerAnalysis: eer,
    );
  }
}
