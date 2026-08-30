import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/face_recognition/application/calibration/corpus_metadata.dart';

void main() {
  late Directory tempRoot;

  setUp(() {
    tempRoot = Directory.systemTemp.createTempSync('m_edu_meta_');
  });

  tearDown(() {
    if (tempRoot.existsSync()) tempRoot.deleteSync(recursive: true);
  });

  group('CorpusMetadata — model versiyasi (spec §12)', () {
    test('toJson/fromJson round-trip', () {
      const meta = CorpusMetadata(
        modelName: 'mobilefacenet',
        modelVersion: 'FACE_MODEL_V1',
        embeddingDimension: 128,
        preprocessingVersion: 'PREP_V1',
        corpusVersion: '1.0.0',
        consentStatus: 'consented',
        source: 'hikvision',
        cameraSpecific: true,
        notes: 'test',
      );
      final restored = CorpusMetadata.fromJson(meta.toJson());
      expect(restored.modelName, 'mobilefacenet');
      expect(restored.modelVersion, 'FACE_MODEL_V1');
      expect(restored.embeddingDimension, 128);
      expect(restored.preprocessingVersion, 'PREP_V1');
      expect(restored.hasConsent, isTrue);
    });

    test("template rozilik tasdiqlanmagan bo'ladi (spec §3 gate)", () {
      final meta = CorpusMetadata.template();
      expect(meta.hasConsent, isFalse);
      expect(meta.modelName, 'mobilefacenet');
      expect(meta.embeddingDimension, 128);
    });

    test('consentStatus != consented → hasConsent false', () {
      const meta = CorpusMetadata(
        modelName: 'x',
        modelVersion: 'v1',
        embeddingDimension: 1,
        preprocessingVersion: 'p',
        corpusVersion: '1',
        consentStatus: 'not_specified',
        source: 'manual_capture',
        cameraSpecific: false,
        notes: '',
      );
      expect(meta.hasConsent, isFalse);
    });
  });

  group('CorpusMetadataIO', () {
    test('save + load round-trip', () {
      CorpusMetadataIO.save(tempRoot.path, CorpusMetadata.template());
      final result = CorpusMetadataIO.load(tempRoot.path);
      expect(result.isValid, isTrue);
      expect(result.error, isNull);
      expect(result.metadata!.modelVersion, 'FACE_MODEL_V1');
    });

    test("fayl yo'q → xato sababli (jimgina emas)", () {
      final result = CorpusMetadataIO.load(tempRoot.path);
      expect(result.isValid, isFalse);
      expect(result.metadata, isNull);
      expect(result.error, contains('topilmadi'));
    });

    test('buzilgan JSON → xato sababli', () {
      File('${tempRoot.path}/metadata/corpus_metadata.json')
        ..createSync(recursive: true)
        ..writeAsStringSync('{not json');
      final result = CorpusMetadataIO.load(tempRoot.path);
      expect(result.isValid, isFalse);
      expect(result.error, contains("o'qib bo'lmadi"));
    });

    test('save katalogni avtomatik yaratadi', () {
      final nested = Directory('${tempRoot.path}/a/b');
      CorpusMetadataIO.save(nested.path, CorpusMetadata.template());
      expect(
        File('${nested.path}/metadata/corpus_metadata.json').existsSync(),
        isTrue,
      );
    });
  });
}
