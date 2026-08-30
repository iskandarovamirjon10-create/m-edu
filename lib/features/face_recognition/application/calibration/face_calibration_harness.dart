import 'dart:io';

import '../../domain/value_objects/face_signature.dart';
import 'calibration_corpus.dart';
import 'face_threshold_analyzer.dart';
import 'face_vector_extractor.dart';

/// Bitta yuz rasmida ekstraksiya natijasi.
class ExtractionOutcome {
  /// Vektor chiqdi — ushbu ball keyingi tahlilga kiradi.
  final List<double>? vector;

  /// Nega vektor chiqmadi (yuz topilmadi / sifat / model) — null bo'lsa
  /// muvaffaqiyatli.
  final String? failureReason;

  /// Shu rasmni ekstraksiya qilish uchun ketgan vaqt (ms).
  final Duration latency;

  const ExtractionOutcome({
    required this.vector,
    required this.failureReason,
    required this.latency,
  });
}

/// Bitta subyekt uchun kalibrlash natijasi.
class SubjectCalibrationResult {
  final String subjectId;

  /// Enroll namunalaridan olingan template vektor (o'rtachalashtirilgan).
  final List<double>? template;

  /// Enroll namunasi chiqmagan rasmlar (halol hisobot).
  final List<String> enrollFailures;

  /// Shu subyektning genuine ballari (template ↔ bir xil shaxs).
  final List<double> genuineScores;

  /// Shu subyektning impostor ballari (template ↔ boshqa shaxslar).
  final List<double> impostorScores;

  const SubjectCalibrationResult({
    required this.subjectId,
    required this.template,
    required this.enrollFailures,
    required this.genuineScores,
    required this.impostorScores,
  });
}

/// Kalibrlash ishga tushirish natijasi.
class CalibrationRunResult {
  final String modelKey;

  /// Har bir subyekt uchun natija.
  final List<SubjectCalibrationResult> subjectResults;

  /// Barcha genuine ballar (birlashtirilgan).
  final List<double> genuineScores;

  /// Barcha impostor ballar (birlashtirilgan).
  final List<double> impostorScores;

  /// Muvaffaqiyatsiz bo'lgan rasmlar (yashirilmaydi — halol hisobot).
  final List<String> failures;

  /// Ekstraksiya vaqti (ms) — barcha rasm uchun.
  final List<double> extractionLatencyMs;

  /// To'liq threshold tahlili.
  final ThresholdAnalysis analysis;

  const CalibrationRunResult({
    required this.modelKey,
    required this.subjectResults,
    required this.genuineScores,
    required this.impostorScores,
    required this.failures,
    required this.extractionLatencyMs,
    required this.analysis,
  });

  /// Korpus yetarli bo'lib, real ballar bilan hisoblanganmi.
  bool get isBenchmarked => analysis.isBenchmarked;

  /// O'rtacha ekstraksiya vaqti (ms) — ballar bo'lmasa null.
  double? get meanExtractionLatencyMs =>
      extractionLatencyMs.isEmpty
          ? null
          : extractionLatencyMs.reduce((a, b) => a + b) /
                extractionLatencyMs.length;
}

/// Kalibrlash harness'i (spec §29).
///
/// Korpus + ekstraktor oladi, har bir subyekt uchun:
///   enroll → template (o'rtacha vektor)
///   template ↔ genuine → genuine ballar (bir xil shaxs)
///   template ↔ impostor → impostor ballar (boshqa shaxslar)
///
/// So'ng [FaceThresholdAnalyzer] bilan EER/threshold tavsiyasi hisoblanadi.
/// Hech qanday modelga bog'liq emas — [FaceVectorExtractor] port orqali
/// (bugun geometrik imzo, kelajakda embedding).
class FaceCalibrationHarness {
  final FaceVectorExtractor extractor;
  final FaceThresholdAnalyzer analyzer;

  const FaceCalibrationHarness({
    required this.extractor,
    this.analyzer = const FaceThresholdAnalyzer(),
  });

  /// Korpusni to'liq kalibrlaydi.
  Future<CalibrationRunResult> run(CalibrationCorpus corpus) async {
    final failures = <String>[];
    final latencies = <double>[];
    final subjectResults = <SubjectCalibrationResult>[];
    final allGenuine = <double>[];
    final allImpostor = <double>[];

    for (final subject in corpus.subjects) {
      // 1) Enroll namunalaridan template qurish.
      final enrollVectors = <List<double>>[];
      final enrollFailures = <String>[];
      for (final img in subject.enrollImages) {
        final outcome = await _extractWithTiming(img);
        latencies.add(_ms(outcome.latency));
        if (outcome.vector == null) {
          final reason =
              outcome.failureReason ?? 'ekstraksiya chiqmadi';
          enrollFailures.add('${img.path}: $reason');
          failures.add('${img.path}: $reason');
        } else {
          enrollVectors.add(outcome.vector!);
        }
      }

      // O'lchamlar mos kelmasa template qurilmaydi (halol — chalkash
      // ball berilmaydi).
      final template = _meanVector(enrollVectors);
      final genuine = <double>[];
      final impostor = <double>[];

      if (template != null) {
        // 2) Genuine: template ↔ shu shaxsning boshqa suratlari.
        for (final img in subject.genuineImages) {
          final outcome = await _extractWithTiming(img);
          latencies.add(_ms(outcome.latency));
          final vec = outcome.vector;
          if (vec == null) {
            failures.add(
                '${img.path}: ${outcome.failureReason ?? 'ekstraksiya chiqmadi'}');
            continue;
          }
          genuine.add(FaceSignature.cosineSimilarityBetween(template, vec));
        }

        // 3) Impostor: template ↔ boshqa shaxslar.
        for (final img in corpus.impostorImages) {
          final outcome = await _extractWithTiming(img);
          latencies.add(_ms(outcome.latency));
          final vec = outcome.vector;
          if (vec == null) {
            failures.add(
                '${img.path}: ${outcome.failureReason ?? 'ekstraksiya chiqmadi'}');
            continue;
          }
          impostor.add(FaceSignature.cosineSimilarityBetween(template, vec));
        }
      }

      subjectResults.add(SubjectCalibrationResult(
        subjectId: subject.id,
        template: template,
        enrollFailures: enrollFailures,
        genuineScores: genuine,
        impostorScores: impostor,
      ));
      allGenuine.addAll(genuine);
      allImpostor.addAll(impostor);
    }

    final analysis = analyzer.analyze(
      genuineScores: allGenuine,
      impostorScores: allImpostor,
    );

    return CalibrationRunResult(
      modelKey: extractor.modelKey,
      subjectResults: subjectResults,
      genuineScores: allGenuine,
      impostorScores: allImpostor,
      failures: failures,
      extractionLatencyMs: latencies,
      analysis: analysis,
    );
  }

  Future<ExtractionOutcome> _extractWithTiming(File image) async {
    final sw = Stopwatch()..start();
    try {
      final bytes = await image.readAsBytes();
      final vec = await extractor.extract(bytes);
      sw.stop();
      return ExtractionOutcome(
        vector: vec,
        failureReason: vec == null ? 'ekstraksiya chiqmadi' : null,
        latency: sw.elapsed,
      );
    } catch (e) {
      sw.stop();
      return ExtractionOutcome(
        vector: null,
        failureReason: 'fayl o\'qish/xato: $e',
        latency: sw.elapsed,
      );
    }
  }

  /// O'rtacha vektor (template). Enroll namunalari bir xil o'lchamda
  /// bo'lishi shart; aks holda — null (halol).
  List<double>? _meanVector(List<List<double>> vectors) {
    if (vectors.isEmpty) return null;
    final dim = vectors.first.length;
    if (vectors.any((v) => v.length != dim)) return null;
    final acc = List<double>.filled(dim, 0);
    for (final v in vectors) {
      for (var i = 0; i < dim; i++) {
        acc[i] += v[i];
      }
    }
    return acc.map((x) => x / vectors.length).toList();
  }

  double _ms(Duration d) => d.inMicroseconds / 1000;
}
