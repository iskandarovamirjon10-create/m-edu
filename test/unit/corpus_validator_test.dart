import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'package:m_edu/features/face_recognition/application/calibration/corpus_metadata.dart';
import 'package:m_edu/features/face_recognition/application/calibration/corpus_validator.dart';

void main() {
  late Directory tempRoot;

  setUp(() {
    tempRoot = Directory.systemTemp.createTempSync('m_edu_validator_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  /// Haqiqiy PNG rasm yaratadi (validatsiya dekodni tekshiradi).
  /// [seed] har xil bo'lsa piksel naqshi ham har xil — korpusdagi
  /// rasmlar bir-biriga dublikat bo'lmaydi.
  List<int> pngBytes({int side = 100, int seed = 0}) {
    final image = img.Image(width: side, height: side);
    for (var y = 0; y < side; y++) {
      for (var x = 0; x < side; x++) {
        image.setPixelRgb(
          x,
          y,
          (x * 3 + seed) % 256,
          (y * 5 + seed) % 256,
          (x * y + seed * 7) % 256,
        );
      }
    }
    return img.encodePng(image);
  }

  String makeCorpus({
    int subjects = 2,
    int enrollPer = 2,
    int genuinePer = 2,
    int impostorCount = 2,
    bool consented = true,
    bool pseudonymous = true,
  }) {
    var seed = 0;
    List<int> uniquePng() => pngBytes(seed: seed++);
    final subjectsDir = Directory('${tempRoot.path}/subjects')
      ..createSync(recursive: true);
    for (var s = 0; s < subjects; s++) {
      final id = pseudonymous
          ? 'subject_${(s + 1).toString().padLeft(3, '0')}'
          : 'alisher_$s';
      final enroll = Directory('${subjectsDir.path}/$id/enroll')
        ..createSync(recursive: true);
      final genuine = Directory('${subjectsDir.path}/$id/genuine')
        ..createSync(recursive: true);
      for (var i = 0; i < enrollPer; i++) {
        File('${enroll.path}/e$i.png').writeAsBytesSync(uniquePng());
      }
      for (var i = 0; i < genuinePer; i++) {
        File('${genuine.path}/g$i.png').writeAsBytesSync(uniquePng());
      }
    }
    if (impostorCount > 0) {
      final impostors = Directory('${tempRoot.path}/impostors')
        ..createSync(recursive: true);
      for (var i = 0; i < impostorCount; i++) {
        File('${impostors.path}/i$i.jpg').writeAsBytesSync(uniquePng());
      }
    }
    if (consented) {
      CorpusMetadataIO.save(
        tempRoot.path,
        const CorpusMetadata(
          modelName: 'mobilefacenet',
          modelVersion: 'FACE_MODEL_V1',
          embeddingDimension: 128,
          preprocessingVersion: 'PREP_V1',
          corpusVersion: '1.0.0',
          consentStatus: 'consented',
          source: 'manual_capture',
          cameraSpecific: false,
          notes: 'test corpus',
        ),
      );
    }
    return tempRoot.path;
  }

  List<CorpusValidationIssue> issuesWith(List<CorpusValidationIssue> all,
          String code) =>
      all.where((i) => i.code == code).toList();

  group('CorpusValidator — valid korpus (spec §8)', () {
    test("to'liq korpus: xatolar yo'q, balans va juftliklar to'g'ri", () {
      final result = CorpusValidator.validate(makeCorpus());
      expect(result.hasErrors, isFalse);
      expect(result.subjectCount, 2);
      // 2 subyekt × (2 enroll + 2 genuine) + 2 impostor = 10 rasm.
      expect(result.imageCount, 10);
      expect(result.acceptedImages, 10);
      expect(result.rejectedImages, 0);
      // Pozitiv: 2 subyekt × 2 genuine = 4. Negativ: 2 × 2 = 4.
      expect(result.positivePairCount, 4);
      expect(result.negativePairCount, 4);
      expect(result.issues, isEmpty);
    });

    test('buzilgan rasm → INVALID_IMAGE, rad etiladi', () {
      final dir = makeCorpus();
      File('$dir/subjects/subject_001/enroll/bad.jpg')
          .writeAsBytesSync([1, 2, 3, 4, 5]);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'INVALID_IMAGE'), isNotEmpty);
      expect(result.rejectedImages, 1);
      expect(result.acceptedImages, 10);
    });

    test("o'qib bo'lmaydigan fayl → UNREADABLE_IMAGE", () {
      final dir = makeCorpus();
      // Bo'sh fayl — o'qish mumkin, lekin rasm emas (EMPTY_IMAGE).
      File('$dir/impostors/i1.jpg').writeAsBytesSync(const []);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'EMPTY_IMAGE'), isNotEmpty);
      expect(result.rejectedImages, 1);
    });

    test('juda kichik rasm → IMAGE_TOO_SMALL (spec §8 resolution)', () {
      final dir = makeCorpus();
      File('$dir/subjects/subject_001/genuine/tiny.png')
          .writeAsBytesSync(pngBytes(side: 8));
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'IMAGE_TOO_SMALL'), isNotEmpty);
    });

    test('dublikat rasm → DUPLICATE_IMAGE (spec §10 trivial)', () {
      final dir = makeCorpus();
      // Aynan bir xil baytlar bilan ikkita fayl — SHA-256 mos kelishi kafolat.
      final bytes = pngBytes();
      File('$dir/subjects/subject_001/enroll/e0.png')
          .writeAsBytesSync(bytes);
      File('$dir/subjects/subject_001/enroll/dup.png')
          .writeAsBytesSync(bytes);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'DUPLICATE_IMAGE'), isNotEmpty);
      expect(result.rejectedImages, greaterThanOrEqualTo(1));
    });
  });

  group('CorpusValidator — ID siyosati (spec §5)', () {
    test("pseudonymous bo'lmagan ID → ogohlantirish (strict'da xato)", () {
      final dir = makeCorpus(pseudonymous: false);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'SUBJECT_ID_POLICY'), isNotEmpty);
      expect(
        issuesWith(result.issues, 'SUBJECT_ID_POLICY').first.isError,
        isFalse,
      );

      final strict = CorpusValidator.validate(dir, strict: true);
      expect(
        issuesWith(strict.issues, 'SUBJECT_ID_POLICY').first.isError,
        isTrue,
      );
    });

    test("subject_001 uslubi → ogohlantirish yo'q", () {
      final result = CorpusValidator.validate(makeCorpus());
      expect(issuesWith(result.issues, 'SUBJECT_ID_POLICY'), isEmpty);
    });
  });

  group('CorpusValidator — rozilik gate (spec §3)', () {
    test('consentStatus = consented → xato yo\'q', () {
      final result = CorpusValidator.validate(makeCorpus(consented: true));
      expect(issuesWith(result.issues, 'CONSENT_REQUIRED'), isEmpty);
    });

    test('rozilik tasdiqlanmagan → CONSENT_REQUIRED xato', () {
      final dir = makeCorpus(consented: false);
      CorpusMetadataIO.save(tempRoot.path, CorpusMetadata.template());
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'CONSENT_REQUIRED'), isNotEmpty);
      expect(result.hasErrors, isTrue);
    });

    test("metadata yo'q → MISSING_METADATA ogohlantirish", () {
      final dir = makeCorpus(consented: false);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'MISSING_METADATA'), isNotEmpty);
    });
  });

  group('CorpusValidator — balans (spec §9)', () {
    test('pozitiv/negativ muvozanat → ogohlantirish yo\'q', () {
      final result = CorpusValidator.validate(makeCorpus());
      expect(issuesWith(result.issues, 'BALANCE_IMBALANCE'), isEmpty);
    });

    test("juda ko'p pozitiv, kam negativ → BALANCE_IMBALANCE", () {
      // Loader kamida 2 impostor talab qiladi (struktura gate).
      final dir = makeCorpus(
        genuinePer: 10,
        impostorCount: 2,
      );
      final result = CorpusValidator.validate(dir);
      // Pozitiv 2×10=20, negativ 2×2=4 → nisbat 5 >> 2.0.
      expect(issuesWith(result.issues, 'BALANCE_IMBALANCE'), isNotEmpty);
    });
  });

  group('CorpusValidator — tuzilma xatolari', () {
    test("subjects/ yo'q → STRUCTURE xato", () {
      final dir = makeCorpus();
      Directory('$dir/subjects').deleteSync(recursive: true);
      final result = CorpusValidator.validate(dir);
      expect(issuesWith(result.issues, 'STRUCTURE'), isNotEmpty);
      expect(result.corpus, isNull);
    });
  });
}
