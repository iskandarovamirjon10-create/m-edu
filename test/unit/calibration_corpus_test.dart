import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/infrastructure/calibration/calibration_corpus_loader.dart';

void main() {
  late Directory tempRoot;

  setUp(() {
    tempRoot = Directory.systemTemp.createTempSync('m_edu_cal_corpus_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  Directory createCorpus({
    List<String> subjects = const [],
    int enrollPerSubject = 1,
    int genuinePerSubject = 1,
    int impostorCount = 0,
  }) {
    final subjectsDir = Directory('${tempRoot.path}/subjects')..createSync(recursive: true);
    for (final id in subjects) {
      final dir = Directory('${subjectsDir.path}/$id');
      final enroll = Directory('${dir.path}/enroll')..createSync(recursive: true);
      final genuine = Directory('${dir.path}/genuine')..createSync(recursive: true);
      for (var i = 0; i < enrollPerSubject; i++) {
        File('${enroll.path}/e$i.jpg').writeAsStringSync('fake');
      }
      for (var i = 0; i < genuinePerSubject; i++) {
        File('${genuine.path}/g$i.jpg').writeAsStringSync('fake');
      }
    }
    if (impostorCount > 0) {
      final impostors = Directory('${tempRoot.path}/impostors')
        ..createSync(recursive: true);
      for (var i = 0; i < impostorCount; i++) {
        File('${impostors.path}/i$i.png').writeAsStringSync('fake');
      }
    }
    return tempRoot;
  }

  group('CalibrationCorpusLoader — valid korpuslar', () {
    test('to\'liq korpus yuklanadi (2 subyekt + impostorlar)', () {
      createCorpus(
        subjects: ['alisher', 'gulnora'],
        enrollPerSubject: 2,
        genuinePerSubject: 2,
        impostorCount: 3,
      );
      final result = CalibrationCorpusLoader.load(tempRoot.path);
      expect(result.errors, isEmpty, reason: result.errors.join('; '));
      expect(result.isValid, isTrue);
      final corpus = result.corpus!;
      expect(corpus.subjects.length, 2);
      expect(corpus.subjects[0].enrollImages.length, 2);
      expect(corpus.subjects[0].genuineImages.length, 2);
      expect(corpus.impostorImages.length, 3);
      expect(corpus.isValid, isTrue);
    });

    test('faqat rasm kengaytmalari olinadi (jpg/jpeg/png)', () {
      final root = createCorpus(
        subjects: ['a', 'b'],
        enrollPerSubject: 1,
        genuinePerSubject: 1,
        impostorCount: 2,
      );
      // Chet fayllar qo'shamiz — ular e'tiborsiz bo'lishi kerak.
      File('${root.path}/subjects/a/enroll/notes.txt')
          .writeAsStringSync('not image');
      File('${root.path}/subjects/a/enroll/photo.jpeg')
          .writeAsStringSync('fake');
      final result = CalibrationCorpusLoader.load(root.path);
      expect(result.errors, isEmpty, reason: result.errors.join('; '));
      final a = result.corpus!.subjects.first;
      expect(a.enrollImages.any((f) => f.path.endsWith('.txt')), isFalse);
      expect(a.enrollImages.any((f) => f.path.endsWith('.jpeg')), isTrue);
    });
  });

  group('CalibrationCorpusLoader — no\'qoq korpuslar (halol xatolar)', () {
    test('katalog umuman yo\'q → xato', () {
      final result = CalibrationCorpusLoader.load('/nonexistent/path/x');
      expect(result.corpus, isNull);
      expect(result.errors, isNotEmpty);
      expect(result.errors.first, contains('topilmadi'));
    });

    test('subjects/ yo\'q → xato', () {
      Directory('${tempRoot.path}/impostors').createSync(recursive: true);
      final result = CalibrationCorpusLoader.load(tempRoot.path);
      expect(result.corpus, isNull);
      expect(result.errors.any((e) => e.contains('subjects/')), isTrue);
    });

    test('impostors/ yo\'q → xato', () {
      Directory('${tempRoot.path}/subjects/a/enroll').createSync(recursive: true);
      Directory('${tempRoot.path}/subjects/a/genuine').createSync(recursive: true);
      final result = CalibrationCorpusLoader.load(tempRoot.path);
      expect(result.corpus, isNull);
      expect(result.errors.any((e) => e.contains('impostors/')), isTrue);
    });

    test('bitta subyekt → EER uchun yetarli emas (kamida 2)', () {
      createCorpus(subjects: ['a'], impostorCount: 2);
      final result = CalibrationCorpusLoader.load(tempRoot.path);
      expect(result.corpus, isNull);
      expect(result.errors.any((e) => e.contains('2 subyekt')), isTrue);
    });

    test('subyektda enroll bo\'sh → xato', () {
      final root = createCorpus(subjects: ['a', 'b'], impostorCount: 2);
      Directory('${root.path}/subjects/a/enroll').deleteSync(recursive: true);
      Directory('${root.path}/subjects/a/enroll').createSync();
      final result = CalibrationCorpusLoader.load(root.path);
      expect(result.corpus, isNull);
      expect(result.errors.any((e) => e.contains('enroll')), isTrue);
    });

    test('impostors bo\'sh → xato', () {
      createCorpus(subjects: ['a', 'b']);
      final result = CalibrationCorpusLoader.load(tempRoot.path);
      expect(result.corpus, isNull);
      expect(result.errors.any((e) => e.contains('impostors/')), isTrue);
    });
  });
}
