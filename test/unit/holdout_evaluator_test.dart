import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/calibration_corpus.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_splitter.dart';
import 'package:m_edu/features/face_recognition/application/calibration/face_vector_extractor.dart';
import 'package:m_edu/features/face_recognition/application/calibration/holdout_evaluator.dart';

/// Deterministik fake ekstraktor (harness testidagidek uslub).
class _FakeExtractor implements FaceVectorExtractor {
  @override
  String get modelKey => 'fake-deterministic';

  @override
  bool get isAvailableOnPlatform => true;

  @override
  Future<List<double>?> extract(Uint8List jpegBytes) async {
    final text = String.fromCharCodes(jpegBytes);
    if (text == 'corrupt') return null;
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
    tempRoot = Directory.systemTemp.createTempSync('m_edu_holdout_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  CalibrationCorpus makeCorpus(
    List<String> subjectIds, {
    int genuinePer = 5,
    int impostorCount = 4,
  }) {
    final subjects = <CalibrationSubject>[];
    for (var s = 0; s < subjectIds.length; s++) {
      final id = subjectIds[s];
      // Har subyekt uchun marker: subject_001 → 'A', subject_002 → 'B'.
      final marker = String.fromCharCode(65 + s);
      final enroll = <File>[];
      final gen = <File>[];
      for (var i = 0; i < 3; i++) {
        final f = File('${tempRoot.path}/subjects/$id/enroll/e$i.jpg')
          ..createSync(recursive: true);
        f.writeAsStringSync(marker);
        enroll.add(f);
      }
      for (var i = 0; i < genuinePer; i++) {
        final f = File('${tempRoot.path}/subjects/$id/genuine/g$i.jpg')
          ..createSync(recursive: true);
        f.writeAsStringSync(marker);
        gen.add(f);
      }
      subjects.add(CalibrationSubject(
        id: id,
        enrollImages: enroll,
        genuineImages: gen,
      ));
    }
    final impostorFiles = <File>[];
    for (var i = 0; i < impostorCount; i++) {
      final f = File('${tempRoot.path}/impostors/i$i.jpg')
        ..createSync(recursive: true);
      // Ko'p belgili kontent — bir o'lchamli vektor bermaydi (single-char
      // kontent template bilan kollinear bo'lib cosine=1.0 berardi).
      f.writeAsStringSync('XYZ$i');
      impostorFiles.add(f);
    }
    return CalibrationCorpus(
      root: tempRoot,
      subjects: subjects,
      impostorImages: impostorFiles,
    );
  }

  group('HoldoutEvaluator.evaluateScores (spec §11)', () {
    test("threshold qo'llanilganda TAR/FAR/FRR to'g'ri", () {
      // genuine: 0.9, 0.8, 0.6 → threshold 0.65 dan yuqori: 0.9, 0.8 → 2/3
      // impostor: 0.7, 0.5 → 0.65 dan yuqori: 0.7 → 1/2
      final eval = HoldoutEvaluator.evaluateScores(
        genuineScores: [0.9, 0.8, 0.6],
        impostorScores: [0.7, 0.5],
        threshold: 0.65,
        minGenuineCount: 1,
        minImpostorCount: 1,
      );
      expect(eval.threshold, 0.65);
      expect(eval.trueAcceptRate, closeTo(2 / 3, 0.0001));
      expect(eval.falseAcceptRate, closeTo(0.5, 0.0001));
      expect(eval.falseRejectRate, closeTo(1 / 3, 0.0001));
      expect(eval.genuineCount, 3);
      expect(eval.impostorCount, 2);
      expect(eval.insufficientData, isFalse);
    });

    test("bo'sh ballar → 0 rate, insufficientData", () {
      final eval = HoldoutEvaluator.evaluateScores(
        genuineScores: const [],
        impostorScores: const [],
        threshold: 0.7,
      );
      expect(eval.trueAcceptRate, 0);
      expect(eval.falseAcceptRate, 0);
      expect(eval.insufficientData, isTrue);
    });

    test('kam ballar → insufficientData (ishonch past)', () {
      final eval = HoldoutEvaluator.evaluateScores(
        genuineScores: [0.9, 0.8],
        impostorScores: [0.4],
        threshold: 0.7,
      );
      expect(eval.insufficientData, isTrue);
    });

    test('chegara qiymatlar: score == threshold → qabul', () {
      final eval = HoldoutEvaluator.evaluateScores(
        genuineScores: [0.7],
        impostorScores: [0.7],
        threshold: 0.7,
        minGenuineCount: 1,
        minImpostorCount: 1,
      );
      expect(eval.trueAcceptRate, 1.0);
      expect(eval.falseAcceptRate, 1.0);
    });
  });

  group('HoldoutEvaluator.evaluateCorpus (live stack)', () {
    test('split korpusida: holdout ballar + holdout EER hisoblanadi', () async {
      final corpus =
          makeCorpus(['subject_001', 'subject_002'], impostorCount: 4);
      final split = CorpusSplitter.split(corpus, seed: 42, holdoutFraction: 0.5);

      final extractor = _FakeExtractor();
      final eval = await HoldoutEvaluator.evaluateCorpus(
        corpus: split.holdout,
        extractor: extractor,
        threshold: 0.99,
      );
      // Bir xil matn → cosine 1.0 → TAR 1.0; boshqa matn → past → FAR 0.
      expect(eval.trueAcceptRate, 1.0);
      expect(eval.falseAcceptRate, 0.0);
      expect(eval.falseRejectRate, 0.0);
      expect(eval.eerAnalysis, isNotNull);
    });

    test('holdout korpusi bilan kalibrlashda ishlatilmagan rasmlar '
        'baholanadi', () async {
      final corpus =
          makeCorpus(['subject_001', 'subject_002'], impostorCount: 5);
      final split = CorpusSplitter.split(corpus, seed: 7, holdoutFraction: 0.4);

      final calPaths = {
        for (final s in split.calibration.subjects)
          ...[...s.enrollImages, ...s.genuineImages].map((f) => f.path),
        ...split.calibration.impostorImages.map((f) => f.path),
      };
      final holdPaths = {
        for (final s in split.holdout.subjects)
          ...[...s.enrollImages, ...s.genuineImages].map((f) => f.path),
        ...split.holdout.impostorImages.map((f) => f.path),
      };
      expect(calPaths.intersection(holdPaths), isEmpty,
          reason: 'holdout baholashda kalibrlash rasmlari ishlatilmasligi '
              'shart (spec §11)');

      final eval = await HoldoutEvaluator.evaluateCorpus(
        corpus: split.holdout,
        extractor: _FakeExtractor(),
        threshold: 0.99,
      );
      expect(eval.genuineCount, greaterThan(0));
      expect(eval.impostorCount, greaterThan(0));
    });
  });
}
