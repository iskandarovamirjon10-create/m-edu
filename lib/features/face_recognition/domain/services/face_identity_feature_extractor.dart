import '../value_objects/face_embedding.dart';
import '../value_objects/face_signature.dart';

/// Yuz identity xususiyatlarini chiqarish abstraksiyasi.
///
/// Bu abstraksiya ikki xil yondashuvni qo'llab-quvvatlaydi:
///
/// **A) Geometrik imzo (hozirgi ishlatilayotgan):**
///    `FaceSignatureBuilder` orqali 21 o'lchamli vektor. Yuz nuqtalari
///    (ko'z, burun, og'iz, iyak, yonoqlar) ko'zlar orasidagi masofaga
///    nisbatan normalizatsiya qilinadi. Kamroq ajratuvchi qobiliyat,
///    lekin hech qanday model talab qilmaydi.
///
/// **B) Neyron embedding (kelajak):**
///    MobileFaceNet, ArcFace, FaceNet kabi model orqali yuqori
///    ajratuvchi qobiliyatga ega 128-512 o'lchamli vektor. Model
///    talab qiladi (TFLite), lekin identity aniqlash aniqroq.
///
/// Arxitektura modelga bog'lanmaydi — faqat [extract] orqali ishlaydi.
/// Model o'zgarganda boshqa implementatsiya yetkazib beriladi,
/// pipeline qolgan qismi o'zgarmaydi.
abstract class FaceIdentityFeatureExtractor {
  /// Extractor nomi (logging/u uchun).
  String get name;

  /// Extractor versiyasi (embedding versiya bilan aralashtirmaslik uchun).
  String get version;

  /// Feature type (geometric | neural).
  FaceFeatureType get featureType;

  /// Feature o'lchami (geometric: 21, neural: 128/512).
  int get dimension;

  /// Platformada ishlay oladimi?
  bool get isSupportedOnPlatform;

  /// Yuz landmarklaridan identity xususiyatlarini chiqaradi.
  ///
  /// [landmarks] — yuz nuqtalari (ko'z, burun, og'iz, iyak, yonoqlar).
  /// [imageWidth] / [imageHeight] — asl kadr o'lchamlari (normalizatsiya uchun).
  ///
  /// Muvaffaqiyatsiz bo'lsa null qaytaradi (hech qachon uydirma feature emas).
  FaceSignature? extract(FaceLandmarkSet landmarks, {
    required int imageWidth,
    required int imageHeight,
  });

  /// JPEG kadridan to'g'ridan-to'g'ri embedding chiqaradi (neural uchun).
  ///
  /// Geometrik extractor uchun null qaytaradi (landmarklar kerak).
  Future<FaceEmbedding?> extractEmbedding(List<int> faceCropJpeg);

  void dispose();
}

/// Feature type — geometric yoki neural.
enum FaceFeatureType {
  /// Geometrik imzo (hozirgi).
  geometric,

  /// Neyron embedding (kelajak).
  neural,
}

/// Yuz landmarklari to'plami — extractor uchun kirish.
///
/// Bu tip infrastruktura turlaridan (ML Kit Face, TFLite FaceMesh)
/// mustaqil — domain qatlamida yashaydi.
class FaceLandmarkSet {
  final LandmarkPoint leftEye;
  final LandmarkPoint rightEye;
  final LandmarkPoint nose;
  final LandmarkPoint mouthLeft;
  final LandmarkPoint mouthRight;
  final LandmarkPoint chin;
  final LandmarkPoint faceTop;
  final LandmarkPoint leftCheek;
  final LandmarkPoint rightCheek;

  /// Ko'z ochiqlik (0..1) — liveness uchun.
  final double eyeOpenness;

  /// Boshning yon burilish burchagi (gradus).
  final double yawDegrees;

  /// Boshning oldinga/ortga egilish burchagi (gradus).
  final double pitchDegrees;

  /// Boshning qiya burchagi (gradus, roll).
  final double rollDegrees;

  const FaceLandmarkSet({
    required this.leftEye,
    required this.rightEye,
    required this.nose,
    required this.mouthLeft,
    required this.mouthRight,
    required this.chin,
    required this.faceTop,
    required this.leftCheek,
    required this.rightCheek,
    this.eyeOpenness = 0.5,
    this.yawDegrees = 0,
    this.pitchDegrees = 0,
    this.rollDegrees = 0,
  });
}

/// Yuz landmark nuqtasi — 2D koordinata.
class LandmarkPoint {
  final double x;
  final double y;

  /// Z chuqurligi (3D landmark bo'lsa, 0 = yo'q).
  final double z;

  const LandmarkPoint(this.x, this.y, [this.z = 0]);
}

/// Geometrik imzo extractor — hozirgi ishlatilayotgan 21-dim vektor.
///
/// `FaceSignatureBuilder` ni wrapping qiladi, lekin `FaceIdentityFeatureExtractor`
/// interfeysini bajradi — kelajakda neural model bilan almashtirish oson.
class GeometricFeatureExtractor implements FaceIdentityFeatureExtractor {
  const GeometricFeatureExtractor();

  @override
  String get name => 'geometric-signature';

  @override
  String get version => 'GEO_V1';

  @override
  FaceFeatureType get featureType => FaceFeatureType.geometric;

  @override
  int get dimension => 21;

  @override
  bool get isSupportedOnPlatform => true;

  @override
  FaceSignature? extract(FaceLandmarkSet landmarks, {
    required int imageWidth,
    required int imageHeight,
  }) {
    if (imageWidth <= 0 || imageHeight <= 0) return null;

    // Geometrik extractor uchun landmarklar normalizatsiya qilinadi
    // (ko'zlar orasidagi masofaga nisbatan). Roll burchagini ham
    // uzatamiz — FaceSignatureBuilder roll kompensatsiya qiladi.
    final rollRadians = landmarks.rollDegrees * 3.141592653589793 / 180;

    final vector = _buildGeometricSignature(
      leftEye: landmarks.leftEye,
      rightEye: landmarks.rightEye,
      nose: landmarks.nose,
      mouthL: landmarks.mouthLeft,
      mouthR: landmarks.mouthRight,
      chin: landmarks.chin,
      faceTop: landmarks.faceTop,
      leftCheek: landmarks.leftCheek,
      rightCheek: landmarks.rightCheek,
      rollRadians: rollRadians,
    );

    if (vector.isEmpty) return null;
    return FaceSignature(vector: vector, source: 'geometric');
  }

  @override
  Future<FaceEmbedding?> extractEmbedding(List<int> faceCropJpeg) async {
    // Geometric extractor JPEG'dan embedding chiqara olmaydi.
    return null;
  }

  @override
  void dispose() {}

  /// Geometrik imzo vektorini hisoblaydi (FaceSignatureBuilder bilan bir xil).
  List<double> _buildGeometricSignature({
    required LandmarkPoint leftEye,
    required LandmarkPoint rightEye,
    required LandmarkPoint nose,
    required LandmarkPoint mouthL,
    required LandmarkPoint mouthR,
    required LandmarkPoint chin,
    required LandmarkPoint faceTop,
    required LandmarkPoint leftCheek,
    required LandmarkPoint rightCheek,
    required double rollRadians,
  }) {
    // FaceSignatureBuilder.build() ga o'tkazamiz
    return _GeometricSignatureHelper.build(
      leftEye: _toPoint(leftEye),
      rightEye: _toPoint(rightEye),
      nose: _toPoint(nose),
      mouthL: _toPoint(mouthL),
      mouthR: _toPoint(mouthR),
      chin: _toPoint(chin),
      faceTop: _toPoint(faceTop),
      leftCheek: _toPoint(leftCheek),
      rightCheek: _toPoint(rightCheek),
      rollRadians: rollRadians,
    );
  }

  static _Point _toPoint(LandmarkPoint p) => _Point(p.x, p.y);
}

/// Dart:math.Point ishlatmasdan oddiy nuqta (import minimallashtirish uchun).
class _Point {
  final double x;
  final double y;
  const _Point(this.x, this.y);
}

/// Geometrik imzo quruvchi — FaceSignatureBuilder bilan bir xil logika.
class _GeometricSignatureHelper {
  static List<double> build({
    required _Point leftEye,
    required _Point rightEye,
    required _Point nose,
    required _Point mouthL,
    required _Point mouthR,
    required _Point chin,
    required _Point faceTop,
    required _Point leftCheek,
    required _Point rightCheek,
    required double rollRadians,
  }) {
    final eyeMid = _midpoint(leftEye, rightEye);
    final dEye = _distance(leftEye, rightEye);
    if (!dEye.isFinite || dEye < 1e-4) return const [];

    final cos = _cos(-rollRadians);
    final sin = _sin(-rollRadians);

    _Point norm(_Point p) {
      final dx = p.x - eyeMid.x;
      final dy = p.y - eyeMid.y;
      return _Point(
        (dx * cos - dy * sin) / dEye,
        (dx * sin + dy * cos) / dEye,
      );
    }

    final mouthMid = _midpoint(mouthL, mouthR);
    final points = [
      norm(nose),
      norm(mouthL),
      norm(mouthR),
      norm(mouthMid),
      norm(chin),
      norm(faceTop),
      norm(leftCheek),
      norm(rightCheek),
    ];

    final vector = <double>[];
    for (final p in points) {
      vector.add(p.x);
      vector.add(p.y);
    }

    final nChin = norm(chin);
    final nTop = norm(faceTop);
    final nLeftCheek = norm(leftCheek);
    final nRightCheek = norm(rightCheek);
    final faceW = _distance(nLeftCheek, nRightCheek);
    final faceH = _distance(nTop, nChin);
    vector.add(faceH <= 1e-4 ? 0 : faceW / faceH);
    vector.add(_distance(norm(nose), norm(mouthMid)));
    vector.add(_distance(norm(mouthL), norm(mouthR)));
    vector.add(_distance(norm(leftEye), norm(nose)));
    vector.add(_distance(norm(leftEye), nChin));

    if (vector.length != 21) return const [];
    if (vector.any((v) => !v.isFinite)) return const [];
    return vector;
  }

  static _Point _midpoint(_Point a, _Point b) =>
      _Point((a.x + b.x) / 2, (a.y + b.y) / 2);

  static double _distance(_Point a, _Point b) {
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    return _sqrt(dx * dx + dy * dy);
  }

  static double _sqrt(double x) {
    // dart:math import qilmasdan approximate sqrt (yagona foydalanish).
    if (x <= 0) return 0;
    double guess = x / 2;
    for (var i = 0; i < 10; i++) {
      guess = (guess + x / guess) / 2;
    }
    return guess;
  }

  static double _cos(double x) {
    // dart:math import qilmasdan approximate cos (Taylor series).
    x = x % (2 * 3.141592653589793);
    double result = 1;
    double term = 1;
    for (var i = 1; i <= 10; i++) {
      term *= -x * x / ((2 * i - 1) * (2 * i));
      result += term;
    }
    return result;
  }

  static double _sin(double x) {
    return _cos(x - 3.141592653589793 / 2);
  }
}
