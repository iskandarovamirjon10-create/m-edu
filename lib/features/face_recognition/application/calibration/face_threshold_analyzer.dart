import 'dart:math' as math;

/// Kalibrlash korpusi yetarli emasligi holati (spec §29).
///
/// Korpus bo'lmasa yoki eng kam talab qilinadigan namunalar soniga
/// yetilmasa — analiz natijalari BERILMAYDI (NOT BENCHMARKED). Bu
/// ataylab qat'iy: fake percentage yoki taxminiy threshold chiqarish
/// taqiqlanadi (spec §7, §14, §29).
enum BenchmarkState {
  /// Korpus umuman tekshirilmagan (harness ishga tushmagan).
  notRun,

  /// Korpus yo'q yoki juda kichik — natijalar ishonchsiz.
  insufficientData,

  /// Real genuine/impostor ballari bilan hisoblangan.
  complete,
}

/// Bitta threshold nuqtasidagi metrikalar.
class ThresholdPoint {
  /// Tekshirilgan threshold qiymati (0..1).
  final double threshold;

  /// True Positive Rate: genuine ballar ≥ threshold ulushi.
  final double truePositiveRate;

  /// False Positive Rate: impostor ballar ≥ threshold ulushi.
  final double falsePositiveRate;

  /// False Negative Rate: 1 - TPR.
  final double falseNegativeRate;

  /// Unknown Rate (spec §29): genuine ballar noaniq zonada qolgan ulushi
  /// — [threshold] dan past, lekin [threshold] - [ambiguousMargin] dan
  /// yuqori („topildi, lekin ishonchli tanilmadi").
  final double unknownRate;

  const ThresholdPoint({
    required this.threshold,
    required this.truePositiveRate,
    required this.falsePositiveRate,
    required this.falseNegativeRate,
    required this.unknownRate,
  });
}

/// Threshold bo'yicha tavsiya (target FPR asosida).
class ThresholdRecommendation {
  final double threshold;

  /// Shu threshold'dagi True Positive Rate.
  final double truePositiveRate;

  /// Shu threshold'dagi False Positive Rate (target dan katta emas).
  final double falsePositiveRate;

  /// Shu threshold'dagi False Negative Rate.
  final double falseNegativeRate;

  /// Shu threshold'dagi Unknown Rate (spec §29).
  final double unknownRate;

  const ThresholdRecommendation({
    required this.threshold,
    required this.truePositiveRate,
    required this.falsePositiveRate,
    required this.falseNegativeRate,
    required this.unknownRate,
  });
}

/// Kalibrlash tahlili natijasi — to'liq, halol hisobot.
class ThresholdAnalysis {
  /// Korpus yetarli bo'lsa — complete, aks holda sababli holat.
  final BenchmarkState state;

  /// Threshold sweep (0..1 qadam bilan) — har bir nuqtadagi metrikalar.
  final List<ThresholdPoint> sweep;

  /// Equal Error Rate (FPR == FNR nuqtasi). Korpus yetarli bo'lsagina 0..1,
  /// aks holda null.
  final double? eer;

  /// EER nuqtasidagi threshold.
  final double? eerThreshold;

  /// Target FPR asosidagi tavsiya — korpus yetarli bo'lsagina beriladi.
  final ThresholdRecommendation? recommendation;

  /// Analiz uchun ishlatilgan genuine ballar soni.
  final int genuineCount;

  /// Analiz uchun ishlatilgan impostor ballar soni.
  final int impostorCount;

  /// Target FPR (default 0.01 — 1% false accept).
  final double targetFpr;

  /// Unknown Rate hisoblashda ishlatilgan noaniq zona kengligi.
  final double ambiguousMargin;

  /// Kalibrlash gate'ida ishlatilgan eng kam genuine ballar soni.
  final int minGenuineCount;

  /// Kalibrlash gate'ida ishlatilgan eng kam impostor ballar soni.
  final int minImpostorCount;

  /// Korpus yetarli ekanligi (spec §29 gate).
  bool get isBenchmarked => state == BenchmarkState.complete;

  const ThresholdAnalysis({
    required this.state,
    required this.sweep,
    required this.eer,
    required this.eerThreshold,
    required this.recommendation,
    required this.genuineCount,
    required this.impostorCount,
    required this.targetFpr,
    required this.ambiguousMargin,
    required this.minGenuineCount,
    required this.minImpostorCount,
  });
}

/// Ballar statistikasi (hisobot uchun).
class ScoreStats {
  final int count;
  final double mean;
  final double min;
  final double max;
  final double stdDev;

  const ScoreStats({
    required this.count,
    required this.mean,
    required this.min,
    required this.max,
    required this.stdDev,
  });
}

/// Sof statistika yadrosi (spec §29 metrikalari).
///
/// Hech qanday ML/Flutter bog'liqligi yo'q — faqat `dart:math`. Input:
/// genuine ballar (bir xil shaxs) va impostor ballar (boshqa shaxslar).
/// Output: threshold sweep, EER, target-FPR tavsiyasi.
///
/// Threshold'lar TAXMIN bilan tanlanmaydi — real korpus ballaridan
/// chiqariladi. Korpus yetarli bo'lmasa `BenchmarkState.insufficientData`
/// qaytadi va hech qanday raqam tavsiya qilinmaydi.
class FaceThresholdAnalyzer {
  /// Sweep qadami.
  final double step;

  /// Target false positive rate (tavsiya uchun).
  final double targetFpr;

  /// Eng kam genuine ballar soni (EER/tavsiya ishonchli bo'lishi uchun).
  final int minGenuineCount;

  /// Eng kam impostor ballar soni.
  final int minImpostorCount;

  /// Unknown Rate uchun noaniq zona kengligi (spec §29, §15 ga mos).
  final double ambiguousMargin;

  const FaceThresholdAnalyzer({
    this.step = 0.005,
    this.targetFpr = 0.01,
    this.minGenuineCount = 20,
    this.minImpostorCount = 20,
    this.ambiguousMargin = 0.05,
  });

  /// Ballarni tahlil qiladi.
  ThresholdAnalysis analyze({
    required List<double> genuineScores,
    required List<double> impostorScores,
  }) {
    if (genuineScores.length < minGenuineCount ||
        impostorScores.length < minImpostorCount) {
      return ThresholdAnalysis(
        state: BenchmarkState.insufficientData,
        sweep: const [],
        eer: null,
        eerThreshold: null,
        recommendation: null,
        genuineCount: genuineScores.length,
        impostorCount: impostorScores.length,
        targetFpr: targetFpr,
        ambiguousMargin: ambiguousMargin,
        minGenuineCount: minGenuineCount,
        minImpostorCount: minImpostorCount,
      );
    }

    final sweep = _sweep(genuineScores, impostorScores);
    final eerPoint = _findEerPoint(sweep);
    return ThresholdAnalysis(
      state: BenchmarkState.complete,
      sweep: sweep,
      eer: eerPoint?.falsePositiveRate,
      eerThreshold: eerPoint?.threshold,
      recommendation: _recommendForTargetFpr(sweep),
      genuineCount: genuineScores.length,
      impostorCount: impostorScores.length,
      targetFpr: targetFpr,
      ambiguousMargin: ambiguousMargin,
      minGenuineCount: minGenuineCount,
      minImpostorCount: minImpostorCount,
    );
  }

  /// 0..1 oralig'ida sweep qiladi (threshold yuqoridan pastga).
  ///
  /// Suzuqli nuqtali yig'ish xatosidan qochish uchun qadam soni bo'yicha
  /// indekslanadi; oxirgi nuqta qadam 1.0 ni bo'la olmasa ham aniq 0.0
  /// bo'lishi kafolatlanadi.
  List<ThresholdPoint> _sweep(
    List<double> genuine,
    List<double> impostor,
  ) {
    final points = <ThresholdPoint>[];
    final stepCount = (1.0 / step).round();
    for (var i = 0; i <= stepCount; i++) {
      final t = i == stepCount ? 0.0 : _round(1.0 - i * step);
      final tpr = _rateAtOrAbove(genuine, t);
      points.add(ThresholdPoint(
        threshold: t,
        truePositiveRate: tpr,
        falsePositiveRate: _rateAtOrAbove(impostor, t),
        falseNegativeRate: 1 - tpr,
        unknownRate: _unknownRate(genuine, t),
      ));
    }
    return points;
  }

  /// Noaniq zona ulushi: genuine ballar `[threshold - ambiguousMargin,
  /// threshold)` oralig'ida qolgan qismi (spec §29 Unknown Rate).
  double _unknownRate(List<double> genuine, double threshold) {
    if (genuine.isEmpty) return 0;
    final lower = threshold - ambiguousMargin;
    var hits = 0;
    for (final s in genuine) {
      if (s >= lower && s < threshold) hits++;
    }
    return hits / genuine.length;
  }

  /// FPR va FNR eng yaqin kesishgan nuqta (EER).
  ThresholdPoint? _findEerPoint(List<ThresholdPoint> sweep) {
    ThresholdPoint? best;
    var bestDiff = double.infinity;
    for (final p in sweep) {
      final diff = (p.falsePositiveRate - p.falseNegativeRate).abs();
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    return best;
  }

  /// Target FPR dan oshmagan holda eng yuqori TPR beradigan threshold.
  ThresholdRecommendation? _recommendForTargetFpr(
    List<ThresholdPoint> sweep,
  ) {
    ThresholdPoint? best;
    for (final p in sweep) {
      if (p.falsePositiveRate > targetFpr) continue;
      if (best == null || p.truePositiveRate > best.truePositiveRate) {
        best = p;
      }
    }
    if (best == null) return null;
    return ThresholdRecommendation(
      threshold: best.threshold,
      truePositiveRate: best.truePositiveRate,
      falsePositiveRate: best.falsePositiveRate,
      falseNegativeRate: best.falseNegativeRate,
      unknownRate: best.unknownRate,
    );
  }

  static double _rateAtOrAbove(List<double> scores, double threshold) {
    if (scores.isEmpty) return 0;
    var hits = 0;
    for (final s in scores) {
      if (s >= threshold) hits++;
    }
    return hits / scores.length;
  }

  /// Berilgan threshold'dagi metrikalarni hisoblaydi (spec §11 holdout
  /// tekshiruvi uchun). Kalibrlangan threshold'ni HOLDOUT ballariga
  /// qo'llaydi: TAR/FAR/FRR — yangi (ko'rilmagan) rasmlarda.
  ///
  /// Modelga bog'liq emas — faqat sof statistika.
  static ThresholdPoint pointAt({
    required List<double> genuineScores,
    required List<double> impostorScores,
    required double threshold,
  }) {
    final tpr = _rateAtOrAbove(genuineScores, threshold);
    return ThresholdPoint(
      threshold: threshold,
      truePositiveRate: tpr,
      falsePositiveRate: _rateAtOrAbove(impostorScores, threshold),
      falseNegativeRate: 1 - tpr,
      unknownRate: 0, // holdout'da noaniq zona hisoblanmaydi — faqat
      // kalibrlash setida (ambiguitiy kalibrlashda aniqlanadi).
    );
  }

  double _round(double v) => (v * 10000).round() / 10000;

  /// Ballar uchun oddiy statistika.
  static ScoreStats stats(List<double> scores) {
    if (scores.isEmpty) {
      return const ScoreStats(count: 0, mean: 0, min: 0, max: 0, stdDev: 0);
    }
    var sum = 0.0;
    var min = double.infinity;
    var max = double.negativeInfinity;
    for (final s in scores) {
      sum += s;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    final mean = sum / scores.length;
    var varSum = 0.0;
    for (final s in scores) {
      final d = s - mean;
      varSum += d * d;
    }
    final stdDev = math.sqrt(varSum / scores.length);
    return ScoreStats(
      count: scores.length,
      mean: mean,
      min: min,
      max: max,
      stdDev: stdDev,
    );
  }
}
