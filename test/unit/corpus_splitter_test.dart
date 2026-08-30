import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/calibration_corpus.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_splitter.dart';
import 'package:m_edu/features/face_recognition/infrastructure/calibration/calibration_corpus_loader.dart';

void main() {
  late Directory tempRoot;

  setUp(() {
    tempRoot = Directory.systemTemp.createTempSync('m_edu_splitter_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  CalibrationCorpus makeCorpus({
    int subjectCount = 2,
    int enrollPer = 4,
    int genuinePer = 4,
    int impostorCount = 4,
  }) {
    final subjects = <CalibrationSubject>[];
    for (var s = 0; s < subjectCount; s++) {
      final id = 'subject_${(s + 1).toString().padLeft(3, '0')}';
      final enroll = <File>[];
      final genuine = <File>[];
      for (var i = 0; i < enrollPer; i++) {
        final f = File('${tempRoot.path}/subjects/$id/enroll/e$i.jpg')
          ..createSync(recursive: true);
        f.writeAsBytesSync([s, i, 1]);
        enroll.add(f);
      }
      for (var i = 0; i < genuinePer; i++) {
        final f = File('${tempRoot.path}/subjects/$id/genuine/g$i.jpg')
          ..createSync(recursive: true);
        f.writeAsBytesSync([s, i, 2]);
        genuine.add(f);
      }
      subjects.add(CalibrationSubject(
        id: id,
        enrollImages: enroll,
        genuineImages: genuine,
      ));
    }
    final impostors = <File>[];
    for (var i = 0; i < impostorCount; i++) {
      final f = File('${tempRoot.path}/impostors/i$i.jpg')
        ..createSync(recursive: true);
      f.writeAsBytesSync([9, i, 3]);
      impostors.add(f);
    }
    return CalibrationCorpus(
      root: tempRoot,
      subjects: subjects,
      impostorImages: impostors,
    );
  }

  Set<String> allPaths(CalibrationCorpus c) => {
        for (final s in c.subjects)
          ...[...s.enrollImages, ...s.genuineImages].map((f) => f.path),
        ...c.impostorImages.map((f) => f.path),
      };

  group('CorpusSplitter (spec §11 — leakage prevention)', () {
    test("deterministik: bir xil seed → bir xil bo'limlar", () {
      final corpus = makeCorpus();
      final a = CorpusSplitter.split(corpus, seed: 42);
      final b = CorpusSplitter.split(corpus, seed: 42);
      expect(allPaths(a.calibration), allPaths(b.calibration));
      expect(allPaths(a.holdout), allPaths(b.holdout));
    });

    test("har qanday seed'da ham leak yo'q", () {
      final corpus = makeCorpus();
      for (var seed = 1; seed <= 5; seed++) {
        final split = CorpusSplitter.split(corpus, seed: seed);
        expect(
          allPaths(split.holdout).intersection(allPaths(split.calibration)),
          isEmpty,
          reason: 'seed=$seed: kalibrlash va holdout bir xil rasm '
              'ishlatmasligi shart',
        );
      }
    });

    test("leakage yo'q: birorta rasm ikkala bo'limda emas", () {
      final corpus = makeCorpus();
      final split = CorpusSplitter.split(corpus, seed: 42);
      final cal = allPaths(split.calibration);
      final hold = allPaths(split.holdout);
      expect(cal.intersection(hold), isEmpty,
          reason: 'Kalibrlash va holdout bir xil rasm ishlatmasligi shart');
    });

    test('barcha rasmlar saqlanadi: cal + holdout = original', () {
      final corpus = makeCorpus();
      final split = CorpusSplitter.split(corpus, seed: 42, holdoutFraction: 0.3);
      final cal = allPaths(split.calibration);
      final hold = allPaths(split.holdout);
      expect(cal.length + hold.length, allPaths(corpus).length);
    });

    test("holdout bo'limi bo'sh emas (yetarli rasm bo'lsa)", () {
      final corpus = makeCorpus();
      final split = CorpusSplitter.split(corpus, seed: 42, holdoutFraction: 0.3);
      expect(split.holdout.subjects, isNotEmpty);
      expect(split.holdout.impostorImages, isNotEmpty);
      expect(allPaths(split.holdout), isNotEmpty);
    });

    test("juda kam rasm → holdout bo'sh, izoh halol yoziladi", () {
      final corpus =
          makeCorpus(subjectCount: 2, enrollPer: 1, genuinePer: 1, impostorCount: 1);
      final split = CorpusSplitter.split(corpus, seed: 42);
      // Har bir ro'yxat uzunligi 1 → hammasi kalibrlashda qoladi.
      expect(allPaths(split.holdout), isEmpty);
      expect(split.notes.any((n) => n.contains('holdout')), isTrue);
    });

    test("writeToDisk: ikkala bo'lim ham loader bilan yuklanadi", () {
      final corpus = makeCorpus();
      final split = CorpusSplitter.split(corpus, seed: 42);
      final outRoot = '${tempRoot.path}/splits';
      CorpusSplitter.writeToDisk(split, outRoot);

      final cal = CalibrationCorpusLoader.load('$outRoot/calibration');
      expect(cal.errors, isEmpty, reason: cal.errors.join('; '));
      expect(cal.corpus, isNotNull);

      final hold = CalibrationCorpusLoader.load('$outRoot/holdout');
      // Holdout'da kamida bitta subyekt + impostor bo'lishi kerak.
      expect(hold.errors, isEmpty, reason: hold.errors.join('; '));
      expect(hold.corpus, isNotNull);
    });
  });
}
