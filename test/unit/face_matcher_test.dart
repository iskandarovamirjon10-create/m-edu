import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/application/face_matcher.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';

void main() {
  group('FaceSignature', () {
    test('bir xil vektorlar cosine=1.0 qaytaradi', () {
      final a = FaceSignature(vector: [1, 2, 3, 4]);
      expect(a.cosineSimilarity(a), closeTo(1.0, 1e-9));
    });

    test('proportsional vektorlar cosine=1.0 qaytaradi', () {
      final a = FaceSignature(vector: [1, 2, 3]);
      final b = FaceSignature(vector: [2, 4, 6]);
      expect(a.cosineSimilarity(b), closeTo(1.0, 1e-9));
    });

    test('perpendikulyar vektorlar cosine=0 qaytaradi', () {
      final a = FaceSignature(vector: [1, 0]);
      final b = FaceSignature(vector: [0, 1]);
      expect(a.cosineSimilarity(b), closeTo(0.0, 1e-9));
    });

    test('turli o\'lchamlar 0 qaytaradi', () {
      final a = FaceSignature(vector: [1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('NaN in vector → cosine returns 0 (not NaN)', () {
      final a = FaceSignature(vector: [double.nan, 1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      final result = a.cosineSimilarity(b);
      expect(result, 0);
      expect(result.isFinite, isTrue);
    });

    test('Infinity in vector → cosine returns 0 (not Infinity)', () {
      final a = FaceSignature(vector: [double.infinity, 1, 2]);
      final b = FaceSignature(vector: [1, 2, 3]);
      final result = a.cosineSimilarity(b);
      expect(result, 0);
      expect(result.isFinite, isTrue);
    });

    test('zero vector → cosine returns 0', () {
      final a = FaceSignature(vector: [0, 0, 0]);
      final b = FaceSignature(vector: [1, 2, 3]);
      expect(a.cosineSimilarity(b), 0);
    });

    test('mean — o\'rtacha vektorni hisoblaydi', () {
      final a = FaceSignature(vector: [1, 2]);
      final b = FaceSignature(vector: [3, 4]);
      final mean = FaceSignature.mean([a, b]);
      expect(mean.vector, [2, 3]);
      expect(mean.source, contains('mean'));
    });

    test('mean bo\'sh ro\'yxatda bo\'sh vektor qaytaradi', () {
      final mean = FaceSignature.mean(const []);
      expect(mean.isEmpty, isTrue);
    });
  });

  group('FaceMatcher', () {
    const matcher = FaceMatcher(
      matchThreshold: 0.92,
      ambiguousThreshold: 0.85,
    );

    EnrolledFace enrolled(List<double> v) => EnrolledFace(
          identityId: 'M-EDU-2026-000001',
          signature: FaceSignature(vector: v),
        );

    test('bo\'sh bazada null qaytaradi', () {
      final result = matcher.findBestMatch(
        const FaceSignature(vector: [1, 0, 0]),
        const [],
      );
      expect(result, isNull);
    });

    test('bo\'sh probe null qaytaradi', () {
      final result = matcher.findBestMatch(
        const FaceSignature(vector: []),
        [enrolled(const [1, 0, 0])],
      );
      expect(result, isNull);
    });

    test('yuqori o\'xshashlikda ishonchli match qaytaradi', () {
      final probe = FaceSignature(vector: [0.95, 0.1, 0.2, 0.3]);
      final result = matcher.findBestMatch(probe, [
        EnrolledFace(
          identityId: 'other',
          signature: FaceSignature(vector: [0.1, 0.9, 0.8, 0.7]),
        ),
        enrolled([0.95, 0.1, 0.2, 0.3]),
      ]);
      expect(result, isNotNull);
      expect(result!.identityId, 'M-EDU-2026-000001');
      expect(result.confidence, greaterThan(0.92));
      expect(result.ambiguous, isFalse);
    });

    test('juda past o\'xshashlikda null qaytaradi', () {
      final probe = FaceSignature(vector: [1, 0, 0, 0]);
      final result = matcher.findBestMatch(probe, [
        enrolled(const [0, 1, 0, 0]),
      ]);
      expect(result, isNull);
    });

    test('noaniq zona (threshold oralig\'i) ambiguous=true qaytaradi', () {
      // Kosinus o'xshashlik taxminan 0.90 — noaniq zona (0.85..0.92) ichida.
      final probe = FaceSignature(vector: [0.89, 0.4, 0.1, 0.1]);
      final other = FaceSignature(vector: [1, 0, 0, 0]);
      final score = probe.cosineSimilarity(other);
      expect(score, greaterThan(0.85));
      expect(score, lessThan(0.92));

      final result = matcher.findBestMatch(probe, [enrolled(other.vector)]);
      expect(result, isNotNull);
      expect(result!.ambiguous, isTrue);
    });

    test('margin buzilganda (ikki o\'xshash yuz) ambiguous=true qaytaradi', () {
      // Ikkala enrolled yuz ham probe'ga juda yaqin (farq < 0.05) —
      // qaysi biri ekanini ishonch bilan ayta olmaymiz → noaniq.
      final probe = FaceSignature(vector: [1, 0, 0, 0]);
      final a = FaceSignature(vector: [0.93, 0.1, 0.1, 0.1]);
      final b = FaceSignature(vector: [0.90, 0.1, 0.1, 0.1]);

      final result = matcher.findBestMatch(probe, [
        EnrolledFace(identityId: 'face-a', signature: a),
        EnrolledFace(identityId: 'face-b', signature: b),
      ]);
      expect(result, isNotNull);
      expect(result!.ambiguous, isTrue);
    });

    test('margin katta bo\'lsa (aniq farq) ambiguous=false qaytaradi', () {
      // Birinchi yuz ancha yaqin, ikkinchisi ancha uzoq — margin katta,
      // aniq match.
      final probe = FaceSignature(vector: [1, 0, 0, 0]);
      final a = FaceSignature(vector: [0.95, 0.1, 0.1, 0.1]);
      final b = FaceSignature(vector: [0.3, 0.9, 0.8, 0.7]);

      final result = matcher.findBestMatch(probe, [
        EnrolledFace(identityId: 'face-a', signature: a),
        EnrolledFace(identityId: 'face-b', signature: b),
      ]);
      expect(result, isNotNull);
      expect(result!.identityId, 'face-a');
      expect(result.ambiguous, isFalse);
    });
  });
}
