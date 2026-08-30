import 'face_calibration_harness.dart';
import 'face_threshold_analyzer.dart';

/// Kalibrlash hisobotini matn ko'rinishida chiqaradi (CLI va testlar uchun).
///
/// Halollik qoidalari (spec §29):
/// - korpus yetarli bo'lmasa — NOT BENCHMARKED va tavsiya chiqmaydi;
/// - ballar statistikasi faqat REAL ekstraksiyadan olingan ballardan;
/// - muvaffaqiyatsiz rasmlar ro'yxati yashirilmaydi.
String formatCalibrationReport(CalibrationRunResult run) {
  final sb = StringBuffer();
  sb.writeln('══════════════════════════════════════════════════════');
  sb.writeln('  FACE RECOGNITION THRESHOLD CALIBRATION (spec §29)');
  sb.writeln('══════════════════════════════════════════════════════');
  sb.writeln('Model:            ${run.modelKey}');

  final a = run.analysis;
  sb.writeln('Genuine ballar:   ${a.genuineCount}');
  sb.writeln('Impostor ballar:  ${a.impostorCount}');
  sb.writeln('Subyektlar:       ${run.subjectResults.length}');

  if (run.failures.isNotEmpty) {
    sb.writeln('Ekstraksiya xatolari: ${run.failures.length} (quyida)');
  }

  sb.writeln();
  switch (a.state) {
    case BenchmarkState.notRun:
      sb.writeln('HOLAT: NOT BENCHMARKED (korpus ishga tushirilmagan)');
    case BenchmarkState.insufficientData:
      sb.writeln(
          'HOLAT: NOT BENCHMARKED — korpus yetarli emas '
          '(kamida ${a.minGenuineCount} genuine + '
          '${a.minImpostorCount} impostor ball kerak, '
          'hammasi REAL ekstraksiyadan)');
      sb.writeln('  Hech qanday threshold tavsiya qilinmaydi (spec §7/§14).');
    case BenchmarkState.complete:
      sb.writeln('HOLAT: BENCHMARKED (real ballar bilan)');
  }

  if (a.isBenchmarked) {
    final g = FaceThresholdAnalyzer.stats(run.genuineScores);
    final i = FaceThresholdAnalyzer.stats(run.impostorScores);
    sb.writeln();
    sb.writeln('─ Ballar statistikasi ─');
    sb.writeln(
        '  Genuine:  n=${g.count}  mean=${_p3(g.mean)}  '
        'min=${_p3(g.min)}  max=${_p3(g.max)}  sd=${_p3(g.stdDev)}');
    sb.writeln(
        '  Impostor: n=${i.count}  mean=${_p3(i.mean)}  '
        'min=${_p3(i.min)}  max=${_p3(i.max)}  sd=${_p3(i.stdDev)}');

    sb.writeln();
    sb.writeln('─ Equal Error Rate ─');
    sb.writeln(
        '  EER = ${_p3(a.eer!)} @ threshold ${_p3(a.eerThreshold!)}');

    final rec = a.recommendation;
    if (rec != null) {
      sb.writeln();
      sb.writeln('─ Tavsiya (target FPR ≤ ${a.targetFpr}) ─');
      sb.writeln(
          '  matchThreshold = ${_p3(rec.threshold)}  '
          '(TPR=${_p3(rec.truePositiveRate)}, '
          'FPR=${_p3(rec.falsePositiveRate)}, '
          'FNR=${_p3(rec.falseNegativeRate)}, '
          'Unknown=${_p3(rec.unknownRate)})');
      sb.writeln(
          '  ⚠️ ambiguousThreshold = matchThreshold - ambiguousMargin '
          '(noaniq zona ${_p3(a.ambiguousMargin)}) — spec §15.');
    } else {
      sb.writeln('  Tavsiya yo\'q: target FPR hech qanday threshold bilan '
          'bajarmaydi (korpus sifati tekshirilsin).');
    }

    final lat = run.meanExtractionLatencyMs;
    if (lat != null) {
      sb.writeln();
      sb.writeln('─ Ekstraksiya vaqti ─');
      sb.writeln(
          '  O\'rtacha: ${_p3(lat)} ms  '
          '(n=${run.extractionLatencyMs.length} rasm)');
    }

    // spec §29: Memory/CPU GPU ushbu harness'da o'lchanmaydi — halol
    // yoziladi, yashirilmaydi.
    sb.writeln();
    sb.writeln('─ Resurslar ─');
    sb.writeln('  Memory / CPU / GPU: o\'lchanmagan (harness sof Dart — '
        'real qurilma profiling talab qiladi).');
  }

  if (run.failures.isNotEmpty) {
    sb.writeln();
    sb.writeln('─ Muvaffaqiyatsiz rasmlar (${run.failures.length}) ─');
    for (final f in run.failures.take(10)) {
      sb.writeln('  ✗ $f');
    }
    if (run.failures.length > 10) {
      sb.writeln('  … va yana ${run.failures.length - 10} ta');
    }
  }

  sb.writeln('══════════════════════════════════════════════════════');
  return sb.toString();
}

String _p3(double v) => v.toStringAsFixed(3);
