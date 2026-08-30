import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/face_signature_builder.dart';

void main() {
  group('FaceSignatureBuilder', () {
    /// Oddiy, frontal yuz: ko'zlar (0.4,0.4)/(0.6,0.4), burun (0.5,0.52)
    /// va h.k. — ko'zlar orasidagi masofa 0.2.
    List<double> buildFrontalFace() {
      return FaceSignatureBuilder.build(
        leftEye: const math.Point(0.4, 0.4),
        rightEye: const math.Point(0.6, 0.4),
        nose: const math.Point(0.5, 0.52),
        mouthL: const math.Point(0.45, 0.62),
        mouthR: const math.Point(0.55, 0.62),
        chin: const math.Point(0.5, 0.75),
        faceTop: const math.Point(0.5, 0.2),
        leftCheek: const math.Point(0.3, 0.5),
        rightCheek: const math.Point(0.7, 0.5),
        rollRadians: 0,
      );
    }

    test('imzo 21 o\'lchamda va deterministik', () {
      final v1 = buildFrontalFace();
      final v2 = buildFrontalFace();
      expect(v1.length, FaceSignatureBuilder.signatureDimension);
      expect(v1, v2);
    });

    test('ko\'zlar juda yaqin bo\'lsa bo\'sh imzo qaytaradi', () {
      final v = FaceSignatureBuilder.build(
        leftEye: const math.Point(0.4, 0.4),
        rightEye: const math.Point(0.4, 0.4), // dEye = 0
        nose: const math.Point(0.4, 0.5),
        mouthL: const math.Point(0.38, 0.6),
        mouthR: const math.Point(0.42, 0.6),
        chin: const math.Point(0.4, 0.7),
        faceTop: const math.Point(0.4, 0.3),
        leftCheek: const math.Point(0.3, 0.5),
        rightCheek: const math.Point(0.5, 0.5),
        rollRadians: 0,
      );
      expect(v, isEmpty);
    });

    test('bir xil yuz (faqat siljigan) — yuqori o\'xshashlik', () {
      // Yuz siljiganda ham normalizatsiya tufayli imzo o'zgarmasligi kerak.
      final base = buildFrontalFace();
      final shifted = FaceSignatureBuilder.build(
        leftEye: const math.Point(0.5, 0.5),
        rightEye: const math.Point(0.7, 0.5),
        nose: const math.Point(0.6, 0.62),
        mouthL: const math.Point(0.55, 0.72),
        mouthR: const math.Point(0.65, 0.72),
        chin: const math.Point(0.6, 0.85),
        faceTop: const math.Point(0.6, 0.3),
        leftCheek: const math.Point(0.4, 0.6),
        rightCheek: const math.Point(0.8, 0.6),
        rollRadians: 0,
      );
      final cosine = FaceSignatureBuilder.distance(
        const math.Point(0, 0),
        const math.Point(1, 0),
      );
      expect(cosine, 1.0);

      // Vektorlarni o'xshashligini hisoblaymiz.
      final dot = _cosine(base, shifted);
      expect(dot, greaterThan(0.999));
    });

    test('boshqacha yuz — pastroq o\'xshashlik', () {
      final faceA = buildFrontalFace();
      // Proportsiyalari boshqacha yuz: ko'zlar yaqin, burun past,
      // og'iz juda keng, iyak yuqori — nisbatlar o'zgargan.
      final faceB = FaceSignatureBuilder.build(
        leftEye: const math.Point(0.44, 0.40),
        rightEye: const math.Point(0.62, 0.40),
        nose: const math.Point(0.53, 0.60),
        mouthL: const math.Point(0.40, 0.66),
        mouthR: const math.Point(0.62, 0.66),
        chin: const math.Point(0.53, 0.72),
        faceTop: const math.Point(0.5, 0.28),
        leftCheek: const math.Point(0.30, 0.50),
        rightCheek: const math.Point(0.72, 0.50),
        rollRadians: 0,
      );
      final cosine = _cosine(faceA, faceB);
      expect(cosine, lessThan(0.98));
    });
  });
}

double _cosine(List<double> a, List<double> b) {
  var dot = 0.0, na = 0.0, nb = 0.0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (math.sqrt(na) * math.sqrt(nb));
}
