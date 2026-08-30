import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/face_threshold_analyzer.dart';

void main() {
  group('FaceThresholdAnalyzer — korpus yetarli bo\'lmasa (spec §29)', () {
    test('bo\'sh ballar → insufficientData, tavsiya yo\'q', () {
      const analyzer = FaceThresholdAnalyzer();
      final result = analyzer.analyze(genuineScores: [], impostorScores: []);
      expect(result.state, BenchmarkState.insufficientData);
      expect(result.isBenchmarked, isFalse);
      expect(result.eer, isNull);
      expect(result.recommendation, isNull);
      expect(result.sweep, isEmpty);
    });

    test('juda kam ballar → insufficientData (fake natija chiqmaydi)', () {
      const analyzer = FaceThresholdAnalyzer();
      final result = analyzer.analyze(
        genuineScores: [0.9, 0.91],
        impostorScores: [0.3, 0.31],
      );
      expect(result.state, BenchmarkState.insufficientData);
      expect(result.eer, isNull);
      expect(result.recommendation, isNull);
    });

    test('minGenuineCount yetarli, minImpostorCount yetarli emas → '
        'insufficientData', () {
      const analyzer = FaceThresholdAnalyzer();
      final result = analyzer.analyze(
        genuineScores: List.filled(25, 0.9),
        impostorScores: List.filled(5, 0.3),
      );
      expect(result.state, BenchmarkState.insufficientData);
    });
  });

  group('FaceThresholdAnalyzer — mukammal ajralgan ballar', () {
    test('genuine≈1.0, impostor≈0.0 → EER ~0, tavsiya aniq', () {
      const analyzer = FaceThresholdAnalyzer();
      final genuine = List.generate(40, (i) => 0.95 + (0.04 * (i % 5) / 5));
      final impostor = List.generate(40, (i) => 0.10 + (0.04 * (i % 5) / 5));
      final result = analyzer.analyze(
        genuineScores: genuine,
        impostorScores: impostor,
      );
      expect(result.state, BenchmarkState.complete);
      expect(result.isBenchmarked, isTrue);
      expect(result.eer, lessThan(0.02));
      final rec = result.recommendation!;
      expect(rec.falsePositiveRate, lessThanOrEqualTo(analyzer.targetFpr));
      expect(rec.truePositiveRate, greaterThan(0.95));
    });
  });

  group('FaceThresholdAnalyzer — qisman ustma-ust ballar', () {
    test('EER va sweep metrikalari mantiqiy', () {
      const analyzer = FaceThresholdAnalyzer();
      // Genuine 0.7..0.95, impostor 0.5..0.8 — qisman kesishgan.
      final genuine = List.generate(30, (i) => 0.70 + (0.25 * i / 29));
      final impostor = List.generate(30, (i) => 0.50 + (0.30 * i / 29));
      final result = analyzer.analyze(
        genuineScores: genuine,
        impostorScores: impostor,
      );

      expect(result.state, BenchmarkState.complete);
      expect(result.eer, isNotNull);
      expect(result.eer! >= 0, isTrue);
      expect(result.eer! <= 0.5, isTrue,
          reason: 'EER hech qachon 0.5 dan katta bo\'lmasligi kerak');
      expect(result.eerThreshold, isNotNull);
      expect(result.sweep.length, greaterThan(50));

      // Sweep monolit: threshold pasayganda TPR va FPR o'smasligi mumkin
      // emas (yuqoridan pastga — TPR/FPR kamaymasligi kerak emas, qat'iy
      // emas; ammo tugunlar soni va qamrov tekshiriladi).
      expect(result.sweep.first.threshold, 1.0);
      expect(result.sweep.last.threshold, 0.0);
      expect(result.sweep.first.truePositiveRate, 0.0);
      expect(result.sweep.last.truePositiveRate, 1.0);
    });
  });

  group('FaceThresholdAnalyzer — target FPR tavsiyasi', () {
    test('tavsiya FPR chegarasini buzmaydi', () {
      const analyzer = FaceThresholdAnalyzer(targetFpr: 0.02);
      final genuine = List.generate(50, (i) => 0.85 + (0.14 * i / 49));
      final impostor = List.generate(50, (i) => 0.20 + (0.40 * i / 49));
      final result = analyzer.analyze(
        genuineScores: genuine,
        impostorScores: impostor,
      );
      final rec = result.recommendation;
      expect(rec, isNotNull);
      expect(rec!.falsePositiveRate, lessThanOrEqualTo(0.02));
      expect(rec.unknownRate, inInclusiveRange(0.0, 1.0));
      // Tavsiya eng yuqori TPR beradigan threshold bo'lishi kerak.
      final higher = result.sweep.where(
          (p) => p.falsePositiveRate <= 0.02 && p.threshold > rec.threshold);
      expect(higher.every((p) => p.truePositiveRate <= rec.truePositiveRate),
          isTrue);
    });

    test('unknown rate: noaniq zonadagi genuine ballar ulushi (spec §29)',
        () {
      const analyzer = FaceThresholdAnalyzer(
        ambiguousMargin: 0.05,
        minGenuineCount: 5,
        minImpostorCount: 5,
      );
      // Genuine (5 ta, takrorlanmaydi): 0.97, 0.93, 0.91, 0.88, 0.85.
      final genuine = [0.97, 0.93, 0.91, 0.88, 0.85];
      // Impostorlar juda past — faqat unknown-rate o'lchanadi.
      final impostor = List.generate(20, (_) => 0.2);
      final result = analyzer.analyze(
        genuineScores: genuine,
        impostorScores: impostor,
      );
      expect(result.state, BenchmarkState.complete);
      // threshold 0.92: noaniq zona [0.87, 0.92) → 0.91 va 0.88;
      // 0.85 zonaga kirmaydi (0.85 < 0.87), 0.93/0.97 ≥ 0.92 (TPR).
      // 2/5 = 0.4.
      final point =
          result.sweep.firstWhere((p) => p.threshold == 0.92);
      expect(point.unknownRate, closeTo(0.4, 0.001));
      expect(point.truePositiveRate, closeTo(0.4, 0.001));
      // threshold 0.90: zona [0.85, 0.90) → 0.88, 0.85 → 2/5 = 0.4.
      final p90 = result.sweep.firstWhere((p) => p.threshold == 0.90);
      expect(p90.unknownRate, closeTo(0.4, 0.001));
    });

    test('target FPR erishib bo\'lmasa → tavsiya null', () {
      const analyzer = FaceThresholdAnalyzer(targetFpr: 0.0);
      final genuine = List.generate(30, (_) => 0.9);
      // Har bir impostor 1.0 — har qanday threshold'da FPR > 0,
      // shuning uchun FPR == 0 (target) hech qachon erishilmaydi.
      final impostor = List.filled(30, 1.0);
      final result = analyzer.analyze(
        genuineScores: genuine,
        impostorScores: impostor,
      );
      expect(result.recommendation, isNull);
    });
  });

  group('FaceThresholdAnalyzer.stats', () {
    test('statistika to\'g\'ri hisoblanadi', () {
      final s = FaceThresholdAnalyzer.stats([1, 2, 3, 4, 5]);
      expect(s.count, 5);
      expect(s.mean, 3.0);
      expect(s.min, 1.0);
      expect(s.max, 5.0);
      expect(s.stdDev, closeTo(1.414, 0.01));
    });

    test('bo\'sh ro\'yxat → nol statistikasi', () {
      final s = FaceThresholdAnalyzer.stats(const []);
      expect(s.count, 0);
      expect(s.mean, 0);
    });
  });
}
