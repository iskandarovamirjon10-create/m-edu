import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:m_edu/features/face_recognition/infrastructure/services/face_quality_gate.dart';

/// Solid kulrang tasvir → JPEG.
Uint8List _solidJpeg(int w, int h, int gray) {
  final image = img.Image(width: w, height: h, numChannels: 3);
  img.fill(image, color: img.ColorRgb8(gray, gray, gray));
  return Uint8List.fromList(img.encodeJpg(image));
}

/// Yuqori kontrastli shaxmat taxtasi (xiralik testi uchun).
img.Image _checkerboard(int w, int h) {
  final image = img.Image(width: w, height: h, numChannels: 3);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final v = ((x ~/ 4) + (y ~/ 4)) % 2 == 0 ? 220 : 40;
      image.setPixelRgb(x, y, v, v, v);
    }
  }
  return image;
}

void main() {
  // Maydoni 0.16 — yetarlicha katta.
  const bigBox = Rect.fromLTWH(0.3, 0.3, 0.4, 0.4);
  // Maydoni 0.0025 — juda kichik.
  const smallBox = Rect.fromLTWH(0.4, 0.4, 0.05, 0.05);

  group('o\'lcham gate (spec §4: FACE_TOO_SMALL)', () {
    test('kichik yuz → faceTooSmall', () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(minFaceAreaFraction: 0.01),
      );
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 128),
        normalizedBox: smallBox,
      );
      expect(result.pass, isFalse);
      expect(result.issues, contains(FaceQualityIssue.faceTooSmall));
    });

    test('yetarlicha katta yuz → o\'lcham o\'tadi', () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(minFaceAreaFraction: 0.01),
      );
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 128),
        normalizedBox: bigBox,
      );
      expect(
        result.issues,
        isNot(contains(FaceQualityIssue.faceTooSmall)),
      );
    });
  });

  group('yorqinlik gate (spec §4: LOW_LIGHT)', () {
    test('juda qorong\'i yuz → lowLight', () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(
          minFaceAreaFraction: 0,
          minBrightness: 100,
          maxBrightness: 255,
          minLaplacianVariance: 0,
        ),
      );
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 30),
        normalizedBox: bigBox,
      );
      expect(result.pass, isFalse);
      expect(result.issues, contains(FaceQualityIssue.lowLight));
    });

    test('yorug\' yuz → lowLight yo\'q', () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(
          minFaceAreaFraction: 0,
          minBrightness: 100,
          maxBrightness: 255,
          minLaplacianVariance: 0,
        ),
      );
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 180),
        normalizedBox: bigBox,
      );
      expect(result.pass, isTrue);
    });

    test('had dan tashqari yorug\' (overexposed)', () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(
          minFaceAreaFraction: 0,
          minBrightness: 0,
          maxBrightness: 200,
          minLaplacianVariance: 0,
        ),
      );
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 255),
        normalizedBox: bigBox,
      );
      expect(result.pass, isFalse);
      expect(result.issues, contains(FaceQualityIssue.overexposed));
    });
  });

  group('xiralik gate (spec §4: LOW_SHARPNESS)', () {
    test('aniq tasvirga nisbatan xira tasvir lowSharpness beradi', () async {
      final sharp = _checkerboard(320, 240);
      final blurred = img.gaussianBlur(_checkerboard(320, 240), radius: 8);

      final sharpVar = FaceQualityGate.laplacianVariance(sharp);
      final blurredVar = FaceQualityGate.laplacianVariance(blurred);
      expect(blurredVar, lessThan(sharpVar * 0.2),
          reason: "Blur Laplacian variance'ni keskin kamaytirishi kerak");

      // Threshold ikki qiymat o'rtasida — sharp o'tadi, blur rad etiladi.
      final threshold = (sharpVar + blurredVar) / 2;
      final gate = FaceQualityGate(
        config: FaceQualityConfig(
          minFaceAreaFraction: 0,
          minBrightness: 0,
          maxBrightness: 255,
          minLaplacianVariance: threshold,
        ),
      );

      final sharpResult = await gate.evaluate(
        jpegBytes: Uint8List.fromList(img.encodeJpg(sharp)),
        normalizedBox: bigBox,
      );
      expect(sharpResult.pass, isTrue);

      final blurredResult = await gate.evaluate(
        jpegBytes: Uint8List.fromList(img.encodeJpg(blurred)),
        normalizedBox: bigBox,
      );
      expect(blurredResult.pass, isFalse);
      expect(blurredResult.issues, contains(FaceQualityIssue.lowSharpness));
    });
  });

  group('umumiy', () {
    test('enabled=false → doim pass', () async {
      const gate = FaceQualityGate(config: FaceQualityConfig(enabled: false));
      final result = await gate.evaluate(
        jpegBytes: _solidJpeg(320, 240, 5),
        normalizedBox: smallBox,
      );
      expect(result.pass, isTrue);
    });

    test('dekodlanmaydigan baytlar → o\'lcham gate\'i natijasi qoladi',
        () async {
      const gate = FaceQualityGate(
        config: FaceQualityConfig(minFaceAreaFraction: 0.01),
      );
      final result = await gate.evaluate(
        jpegBytes: Uint8List.fromList([1, 2, 3, 4, 5]),
        normalizedBox: smallBox,
      );
      expect(result.pass, isFalse);
      expect(result.issues, contains(FaceQualityIssue.faceTooSmall));
    });
  });
}
