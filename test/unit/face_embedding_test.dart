import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_embedding.dart';

void main() {
  const modelV1 = EmbeddingModelInfo(
    modelName: 'mobilefacenet',
    modelVersion: 'FACE_MODEL_V1',
    embeddingDimension: 128,
    preprocessingVersion: 'PREP_V1',
  );
  const modelV2 = EmbeddingModelInfo(
    modelName: 'mobilefacenet',
    modelVersion: 'FACE_MODEL_V2',
    embeddingDimension: 128,
    preprocessingVersion: 'PREP_V1',
  );

  group('EmbeddingModelInfo (spec §10 — versioning)', () {
    test('versionKey model+versiya+preprocessing dan iborat', () {
      expect(modelV1.versionKey, 'mobilefacenet-FACE_MODEL_V1-PREP_V1');
      expect(modelV1.versionKey, isNot(modelV2.versionKey));
    });
  });

  group('FaceEmbedding.l2Normalized (spec §7)', () {
    test('L2 normalizatsiya — norm 1.0 ga teng', () {
      final raw = [3.0, 4.0];
      final embedding = FaceEmbedding.l2Normalized(raw, modelV1);
      final norm = math.sqrt(
        embedding.vector.fold<double>(0, (a, b) => a + b * b),
      );
      expect(norm, closeTo(1.0, 1e-9));
    });

    test('nol vektor → bo\'sh embedding (empty)', () {
      final embedding = FaceEmbedding.l2Normalized([0, 0, 0], modelV1);
      expect(embedding.isEmpty, isTrue);
    });

    test('bo\'sh ro\'yxat → bo\'sh embedding', () {
      final embedding = FaceEmbedding.l2Normalized(const [], modelV1);
      expect(embedding.isEmpty, isTrue);
    });

    test('isDimensionValid model o\'lchamiga moslikni tekshiradi', () {
      final valid = FaceEmbedding.l2Normalized(
        List.filled(128, 1.0),
        modelV1,
      );
      expect(valid.isDimensionValid, isTrue);

      final invalid = FaceEmbedding(
        vector: [1.0, 2.0],
        model: modelV1,
      );
      expect(invalid.isDimensionValid, isFalse);
    });
  });

  group('FaceEmbedding.cosineSimilarity', () {
    test('bir xil vektorlar → 1.0', () {
      final a = FaceEmbedding.l2Normalized([1, 2, 3], modelV1);
      expect(a.cosineSimilarity(a), closeTo(1.0, 1e-9));
    });

    test('proportsional vektorlar → 1.0', () {
      final a = FaceEmbedding.l2Normalized([1, 2, 3], modelV1);
      final b = FaceEmbedding.l2Normalized([2, 4, 6], modelV1);
      expect(a.cosineSimilarity(b), closeTo(1.0, 1e-9));
    });

    test('ortogonal vektorlar → 0', () {
      final a = FaceEmbedding.l2Normalized([1, 0], modelV1);
      final b = FaceEmbedding.l2Normalized([0, 1], modelV1);
      expect(a.cosineSimilarity(b), closeTo(0.0, 1e-9));
    });

    test('TURLI model versiyasi → 0 (spec §10: eski/new aralashmaydi)', () {
      final a = FaceEmbedding.l2Normalized([1, 2, 3], modelV1);
      final b = FaceEmbedding.l2Normalized([1, 2, 3], modelV2);
      expect(a.cosineSimilarity(b), 0);
    });

    test('o\'lcham mos kelmasa → 0', () {
      final a = FaceEmbedding.l2Normalized([1, 2, 3], modelV1);
      const b = FaceEmbedding(
        vector: [1, 2],
        model: EmbeddingModelInfo(
          modelName: 'mobilefacenet',
          modelVersion: 'FACE_MODEL_V1',
          embeddingDimension: 128,
          preprocessingVersion: 'PREP_V1',
        ),
      );
      expect(a.cosineSimilarity(b), 0);
    });
  });
}
