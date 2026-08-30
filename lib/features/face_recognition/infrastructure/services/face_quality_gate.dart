import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:image/image.dart' as img;

/// Yuz sifati muammolari (spec §4).
///
/// Imzo (embedding) yaratishdan OLDIN tekshiriladi — yomon frame'dan
/// imzo qurilmaydi.
enum FaceQualityIssue {
  /// Yuz kadrga nisbatan juda kichik (FACE_TOO_SMALL).
  faceTooSmall,

  /// Yuz hududi juda qorong'i (LOW_LIGHT).
  lowLight,

  /// Yuz hududi haddan tashqari yorug' (overexposed).
  overexposed,

  /// Tasvir xira — fokus yetarli emas (LOW_SHARPNESS).
  lowSharpness,

  /// Bosh juda qiya — frontal emas (BAD_POSE; dvigatel darajasida
  /// tekshiriladi).
  badPose,
}

/// Sifat muammosi uchun qisqa foydalanuvchi tili labeli.
String faceQualityIssueLabel(FaceQualityIssue issue) => switch (issue) {
      FaceQualityIssue.faceTooSmall => 'Yuz juda kichik — yaqinroq turing',
      FaceQualityIssue.lowLight => 'Yorug\'lik yetarli emas',
      FaceQualityIssue.overexposed => 'Yuz hududi haddan tashqari yorug\'',
      FaceQualityIssue.lowSharpness => 'Tasvir xira — kamerani tekshiring',
      FaceQualityIssue.badPose => 'Yuzni frontal ushlab turing',
    };

/// Yuz sifat tekshiruvi natijasi.
class FaceQualityResult {
  final bool pass;
  final List<FaceQualityIssue> issues;

  const FaceQualityResult({required this.pass, required this.issues});
}

/// Sifat parametrlari.
///
/// ⚠️ Default qiymatlar REAL korpus bilan kalibrlanmagan (spec §29 —
/// NOT BENCHMARKED). Ular boshlang'ich muhandislik baholari; kalibrlash
/// fazasida settings'ga ko'chiriladi va real kamera ma'lumotlari bilan
/// sozlanadi (spec §14: tasodifiy threshold qo'ymaslik).
class FaceQualityConfig {
  /// Umumiy o'chirish tugmasi.
  final bool enabled;

  /// Yuz maydoni (kadrga nisbatan, 0..1) minimal ulushi.
  final double minFaceAreaFraction;

  /// Yuz crop'ining o'rtacha yorqinligi (0..255) pastki chegarasi.
  final double minBrightness;

  /// Yuz crop'ining o'rtacha yorqinligi (0..255) yuqori chegarasi.
  final double maxBrightness;

  /// Laplacian variance — xiralik o'lchovi minimal qiymati.
  final double minLaplacianVariance;

  const FaceQualityConfig({
    this.enabled = true,
    this.minFaceAreaFraction = 0.01,
    this.minBrightness = 30,
    this.maxBrightness = 250,
    this.minLaplacianVariance = 45,
  });
}

/// Yuz sifat gate'i.
///
/// [evaluate] JPEG kadr + normalizatsiya qilingan yuz ramkasi oladi va
/// quyidagilarni tekshiradi (spec §4):
/// - yuz o'lchami ([FaceQualityConfig.minFaceAreaFraction]) → FACE_TOO_SMALL
/// - yorqinlik (yuz crop'ining o'rtacha luminance'i) → LOW_LIGHT / overexposed
/// - xiralik (Laplacian variance) → LOW_SHARPNESS
/// - bosh burchagi — dvigatel darajasida ([FaceQualityIssue.badPose])
///
/// Okklyuziya tekshiruvi ML Kit'da ochiq API yo'qligi sababli hozircha
/// kiritilmagan (hujjatlashtirilgan cheklov — spec §4 qisman).
class FaceQualityGate {
  final FaceQualityConfig config;

  const FaceQualityGate({this.config = const FaceQualityConfig()});

  /// Yuz sifatini baholaydi. O'tmagan bo'lsa imzo qurilmasligi kerak.
  Future<FaceQualityResult> evaluate({
    required Uint8List jpegBytes,
    required Rect normalizedBox,
  }) async {
    if (!config.enabled) {
      return const FaceQualityResult(pass: true, issues: []);
    }

    final issues = <FaceQualityIssue>[];

    // 1) Yuz o'lchami (kadrga nisbatan maydon ulushi).
    final area = normalizedBox.width * normalizedBox.height;
    if (area < config.minFaceAreaFraction) {
      issues.add(FaceQualityIssue.faceTooSmall);
    }

    // 2) Yorqinlik + 3) xiralik — yuz crop'i ustidan.
    // `decodeImage` bekorchi baytlarda ayrim decoderlarda exception
    // tashlashi mumkin (masalan PSD probe) — o'sha holatda ham o'lcham
    // gate'i natijasi ustida qolamiz.
    img.Image? decoded;
    try {
      decoded = img.decodeImage(jpegBytes);
    } catch (_) {
      decoded = null;
    }
    if (decoded == null) {
      // Kadr dekodlanmasa yorqinlik/xiralik baholanmaydi. Dvigatel xuddi
      // shu baytlarni allaqachon dekodlab yuz topgan — amalda yuz
      // bermaydi.
      return FaceQualityResult(pass: issues.isEmpty, issues: issues);
    }

    final crop = _faceCrop(decoded, normalizedBox);
    if (crop == null) {
      issues.add(FaceQualityIssue.faceTooSmall);
      return FaceQualityResult(pass: false, issues: issues);
    }

    final meanBrightness = FaceQualityGate.meanLuminance(crop);
    if (meanBrightness < config.minBrightness) {
      issues.add(FaceQualityIssue.lowLight);
    } else if (meanBrightness > config.maxBrightness) {
      issues.add(FaceQualityIssue.overexposed);
    }

    final sharpness = FaceQualityGate.laplacianVariance(crop);
    if (sharpness < config.minLaplacianVariance) {
      issues.add(FaceQualityIssue.lowSharpness);
    }

    return FaceQualityResult(pass: issues.isEmpty, issues: issues);
  }

  /// Normalizatsiya qilingan ramkani asl piksel koordinatalariga o'tkazib
  /// yuz crop'ini ajratadi. Degenerativ ramka bo'lsa — null.
  static img.Image? _faceCrop(img.Image decoded, Rect normalizedBox) {
    final w = decoded.width;
    final h = decoded.height;
    final left = (normalizedBox.left * w).floor().clamp(0, w - 1).toInt();
    final top = (normalizedBox.top * h).floor().clamp(0, h - 1).toInt();
    final right = (normalizedBox.right * w).ceil().clamp(left + 1, w).toInt();
    final bottom =
        (normalizedBox.bottom * h).ceil().clamp(top + 1, h).toInt();
    return img.copyCrop(
      decoded,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    );
  }

  /// Yuz crop'ining o'rtacha yorqinligi (0..255).
  static double meanLuminance(img.Image image) {
    final scale = _channelScale(image);
    var sum = 0.0;
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        sum += _luminance(image.getPixel(x, y), scale);
      }
    }
    return sum / (image.width * image.height);
  }

  /// Laplacian variance — xiralik o'lchovi (spec §4). Kichik qiymat =
  /// xira tasvir.
  static double laplacianVariance(img.Image image) {
    final w = image.width;
    final h = image.height;
    if (w < 3 || h < 3) return 0;
    final scale = _channelScale(image);
    final values = <double>[];
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        final c = _luminance(image.getPixel(x, y), scale);
        final u = _luminance(image.getPixel(x, y - 1), scale);
        final d = _luminance(image.getPixel(x, y + 1), scale);
        final l = _luminance(image.getPixel(x - 1, y), scale);
        final r = _luminance(image.getPixel(x + 1, y), scale);
        values.add(4 * c - u - d - l - r);
      }
    }
    final mean = values.reduce((a, b) => a + b) / values.length;
    var variance = 0.0;
    for (final v in values) {
      final diff = v - mean;
      variance += diff * diff;
    }
    return variance / values.length;
  }

  /// Tasvir formatiga qarab kanal masshtabi: uint8 kanallari allaqachon
  /// 0..255, float kanallari 0..1 — natijani 0..255 ga keltiramiz.
  ///
  /// `image` 4.x `Pixel` qiymatlari formatga qarab 0..255 yoki 0..1
  /// bo'ladi. Format bo'yicha aniqlash per-pixel taxmindan ishonchliroq
  /// (uint8'dagi 1 qiymati 0..1 float bilan aralashib ketmaydi).
  static double _channelScale(img.Image image) =>
      image.format == img.Format.uint8 ? 1.0 : 255.0;

  /// Pikselning yorqinligi (0..255 masshtabda).
  static double _luminance(img.Pixel pixel, double scale) {
    final r = pixel.r.toDouble();
    final g = pixel.g.toDouble();
    final b = pixel.b.toDouble();
    return (0.299 * r + 0.587 * g + 0.114 * b) * scale;
  }
}
