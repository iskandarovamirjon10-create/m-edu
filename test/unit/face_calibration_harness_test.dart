import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/calibration_corpus.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_calibration_harness.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_threshold_analyzer.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_vector_extractor.dart';

/// Deterministik fake ekstraktor.
///
/// Rasm tarkibidagi matn asosida barqaror vektor qaytaradi:
/// - bir xil matn → bir xil vektor (cosine = 1.0);
/// - 'corrupt' matni → null (ekstraksiya muvaffaqiyatsiz — failure testi).
class _FakeExtractor implements FaceVectorExtractor {
  int calls = 0;

  @override
  String get modelKey => 'fake-deterministic';

  @override
  bool get isAvailableOnPlatform => true;

  @override
  Future<List<double>?> extract(Uint8List jpegBytes) async {
    calls++;
    final text = String.fromCharCodes(jpegBytes);
    if (text == 'corrupt') return null;
    // Matnni barqaror 16-o'lchamli vektorga aylantiramiz.
    final vec = List<double>.filled(16, 0);
    for (var i = 0; i < text.length; i++) {
      vec[i % 16] += text.codeUnitAt(i) * 0.01;
    }
    return vec;
  }

  @override
  void dispose() {}
}

void main() {
  late Directory tempRoot;

  setUp(() {
    tempRoot = Directory.systemTemp.createTempSync('m_edu_harness_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  CalibrationCorpus makeCorpus({
    Map<String, List<String>> enroll = const {},
    Map<String, List<String>> genuine = const {},
    List<String> impostors = const [],
  }) {
    final root = tempRoot;
    final subjects = <CalibrationSubject>[];
    final subjectIds = <String>{...enroll.keys, ...genuine.keys};
    for (final id in subjectIds) {
      final enrollFiles = <File>[];
      for (final content in enroll[id] ?? const <String>[]) {
        final f = File('${root.path}/subjects/$id/enroll/e${enrollFiles.length}.jpg')
          ..createSync(recursive: true);
        f.writeAsStringSync(content);
        enrollFiles.add(f);
      }
      final genuineFiles = <File>[];
      for (final content in genuine[id] ?? const <String>[]) {
        final f = File('${root.path}/subjects/$id/genuine/g${genuineFiles.length}.jpg')
          ..createSync(recursive: true);
        f.writeAsStringSync(content);
        genuineFiles.add(f);
      }
      subjects.add(CalibrationSubject(
        id: id,
        enrollImages: enrollFiles,
        genuineImages: genuineFiles,
      ));
    }
    final impostorFiles = <File>[];
    for (var i = 0; i < impostors.length; i++) {
      final f = File('${root.path}/impostors/i$i.jpg')
        ..createSync(recursive: true);
      f.writeAsStringSync(impostors[i]);
      impostorFiles.add(f);
    }
    return CalibrationCorpus(
      root: root,
      subjects: subjects,
      impostorImages: impostorFiles,
    );
  }

  test('genuine ballar yuqori, impostor ballar past', () async {
    final corpus = makeCorpus(
      enroll: {'alisher': ['A', 'A', 'A', 'A'], 'gulnora': ['G', 'G', 'G', 'G']},
      genuine: {'alisher': ['A', 'A', 'A', 'A'], 'gulnora': ['G', 'G', 'G', 'G']},
      impostors: ['impostor1', 'impostor2', 'impostor3'],
    );
    final extractor = _FakeExtractor();
    final harness = FaceCalibrationHarness(
      extractor: extractor,
      analyzer: const FaceThresholdAnalyzer(minGenuineCount: 1, minImpostorCount: 1),
    );

    final run = await harness.run(corpus);

    expect(run.modelKey, 'fake-deterministic');
    expect(run.subjectResults.length, 2);
    // Bir xil matn → cosine 1.0 (yaxlitlash bilan tekshiramiz).
    expect(run.genuineScores, isNotEmpty);
    for (final s in run.genuineScores) {
      expect(s, greaterThan(0.999));
    }
    expect(run.impostorScores, isNotEmpty);
    for (final s in run.impostorScores) {
      expect(s, lessThan(0.95));
    }
    expect(run.failures, isEmpty);
    expect(run.isBenchmarked, isTrue);
    expect(run.meanExtractionLatencyMs, isNotNull);
  });

  test('har bir subject: template o\'rtacha vektor, genuine ballar soni '
      'genuine rasmlar soniga teng', () async {
    final corpus = makeCorpus(
      enroll: {'a': ['ABC']},
      genuine: {'a': ['XY', 'YZ']},
      impostors: ['impostor'],
    );
    final harness = FaceCalibrationHarness(
      extractor: _FakeExtractor(),
      analyzer: const FaceThresholdAnalyzer(minGenuineCount: 1, minImpostorCount: 1),
    );
    final run = await harness.run(corpus);
    final subject = run.subjectResults.first;
    expect(subject.template, isNotNull);
    expect(subject.genuineScores.length, 2);
    expect(subject.impostorScores.length, 1);
  });

  test('enroll muvaffaqiyatsiz bo\'lsa — template null, ballar bo\'sh, '
      'failure halol yoziladi', () async {
    final corpus = makeCorpus(
      enroll: {'a': ['corrupt']},
      genuine: {'a': ['XY']},
      impostors: ['impostor'],
    );
    final harness = FaceCalibrationHarness(
      extractor: _FakeExtractor(),
      analyzer: const FaceThresholdAnalyzer(minGenuineCount: 1, minImpostorCount: 1),
    );
    final run = await harness.run(corpus);
    final subject = run.subjectResults.first;
    expect(subject.template, isNull);
    expect(subject.genuineScores, isEmpty);
    expect(subject.enrollFailures, isNotEmpty);
    expect(run.failures, isNotEmpty);
    expect(run.isBenchmarked, isFalse);
  });

  test('genuine rasm ekstraksiyasi chiqmasa — ballga kirmaydi, failure '
      'yoziladi', () async {
    final corpus = makeCorpus(
      enroll: {'a': ['AAA']},
      genuine: {'a': ['corrupt']},
      impostors: ['imp'],
    );
    final harness = FaceCalibrationHarness(
      extractor: _FakeExtractor(),
      analyzer: const FaceThresholdAnalyzer(minGenuineCount: 1, minImpostorCount: 1),
    );
    final run = await harness.run(corpus);
    expect(run.genuineScores, isEmpty);
    expect(run.failures, isNotEmpty);
    expect(run.failures.first, contains('genuine'));
  });

  test('korpus yetarli bo\'lmasa — isBenchmarked false (NOT BENCHMARKED)',
      () async {
    final corpus = makeCorpus(
      enroll: {'a': ['A']},
      genuine: {'a': ['G']},
      impostors: ['i'],
    );
    // Default analyzer: 20+ genuine, 20+ impostor talab qiladi.
    final harness = FaceCalibrationHarness(extractor: _FakeExtractor());
    final run = await harness.run(corpus);
    expect(run.genuineScores, isNotEmpty);
    expect(run.isBenchmarked, isFalse);
    expect(run.analysis.state, BenchmarkState.insufficientData);
    expect(run.analysis.recommendation, isNull);
  });

  test('extractor eksepsiya tashlasa — failure sifatida qayd etiladi, '
      'harness buzilmaydi', () async {
    final corpus = makeCorpus(
      enroll: {'a': ['AAA']},
      genuine: {'a': ['GG', 'GG']},
      impostors: ['ii'],
    );
    final throwing = _ThrowingExtractor();
    final harness = FaceCalibrationHarness(
      extractor: throwing,
      analyzer: const FaceThresholdAnalyzer(minGenuineCount: 1, minImpostorCount: 1),
    );
    final run = await harness.run(corpus);
    expect(run.failures, isNotEmpty);
    expect(run.genuineScores, isEmpty);
    expect(run.isBenchmarked, isFalse);
  });
}

class _ThrowingExtractor implements FaceVectorExtractor {
  @override
  String get modelKey => 'fake-throwing';

  @override
  bool get isAvailableOnPlatform => true;

  @override
  Future<List<double>?> extract(Uint8List jpegBytes) async {
    throw StateError('boom');
  }

  @override
  void dispose() {}
}
