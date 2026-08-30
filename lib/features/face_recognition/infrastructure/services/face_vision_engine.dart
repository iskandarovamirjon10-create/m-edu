import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import '../../domain/value_objects/face_signature.dart';
import 'camera_source.dart';
import 'face_quality_gate.dart';
import 'face_signature_builder.dart';
import 'tflite_face_vision_engine.dart';

/// Yuz kuzatuvi natijasi.
class FaceObservation {
  /// Yuz ramkasi (kadrga nisbatan 0..1).
  final Rect normalizedBox;

  /// Boshning yon burilish burchagi (gradus).
  final double yawDegrees;

  /// Yuzning geometrik imzosi.
  final FaceSignature signature;

  /// Detektor ishonch darajasi (0..1).
  final double confidence;

  /// Ko'z ochiqlik (0..1; 1 = ochiq). Liveness (GAPS-G5) uchun.
  ///
  /// Manbalar: ML Kit `eyeOpenProbability` (enableClassification=true) yoki
  /// TFLite FaceMesh EAR'idan normalizatsiya. O'lchab bo'lmaganda 0.5
  /// (neytral).
  final double eyeOpenness;

  /// Asl kadr o'lchamlari (piksellarda) — overlay坐标 xaritasi uchun.
  /// 0 bo'lsa, o'lchamlar noma'lum.
  final int sourceWidth;
  final int sourceHeight;

  const FaceObservation({
    required this.normalizedBox,
    required this.yawDegrees,
    required this.signature,
    required this.confidence,
    this.eyeOpenness = 0.5,
    this.sourceWidth = 0,
    this.sourceHeight = 0,
  });
}

/// Yuz tahlili natijasi — spec §3 holatlari farqlanadi:
///
/// - [NoFaceOutcome] — 0 yuz (NO_FACE_DETECTED).
/// - [MultipleFacesOutcome] — 2+ yuz (MULTIPLE_FACES_DETECTED) — avtomatik
///   davomat QILINMAYDI.
/// - [FaceRejectedOutcome] — yuz topildi, lekin sifat gate'idan o'tmadi
///   (spec §4) — imzo/embedding yaratilmaydi.
/// - [FaceDetectedOutcome] — 1 yuz, sifat o'tdi — imzo tayyor.
/// - [EngineUnavailableOutcome] — dvigatel modeli yuklanmagan yoki
///   platforma qo'llab-quvvatlamaydi. "No face detected" emas, aniq xato.
sealed class FaceAnalysisOutcome {
  const FaceAnalysisOutcome();
}

/// Kadrda yuz topilmadi.
class NoFaceOutcome extends FaceAnalysisOutcome {
  const NoFaceOutcome();
}

/// Dvigatel modeli yuklanmagan yoki platformada ishlamaydi.
///
/// TFLite DLL yo'qolgan, model fayli buzilgan, yoki platforma
/// qo'llab-quvvatlanmaydi — bu holat "No face detected" emas.
/// UI foydalanuvchiga aniq xato ko'rsatishi kerak.
class EngineUnavailableOutcome extends FaceAnalysisOutcome {
  /// Foydalanuvchiga ko'rsatiladigan xabar.
  final String reason;

  const EngineUnavailableOutcome(this.reason);
}

/// Kadrda 2+ yuz — davomat qilinmaydi, UI: "faqat bitta shaxs ko'rinsin".
class MultipleFacesOutcome extends FaceAnalysisOutcome {
  const MultipleFacesOutcome();
}

/// Yuz topildi, lekin sifat gate'idan o'tmadi (spec §4).
class FaceRejectedOutcome extends FaceAnalysisOutcome {
  final List<FaceQualityIssue> issues;

  const FaceRejectedOutcome(this.issues);
}

/// Yuz topildi va sifat tekshiruvidan o'tdi.
class FaceDetectedOutcome extends FaceAnalysisOutcome {
  final FaceObservation observation;

  const FaceDetectedOutcome(this.observation);
}

/// Yuzni tanish dvigateli interfeysi.
///
/// Android/iOS/macOS'da [MLKitFaceVisionEngine] ishlaydi; boshqa
/// platformalarda (Windows/Linux) [isSupportedOnPlatform] false qaytaradi.
abstract class FaceVisionEngine {
  /// Platformada yuz tanish dvigateli mavjudmi?
  /// Android/iOS/macOS — ML Kit; Windows/Linux — TFLite FaceMesh.
  static bool get isSupportedOnPlatform {
    if (kIsWeb) return false;
    return Platform.isAndroid ||
        Platform.isIOS ||
        Platform.isMacOS ||
        TFLiteFaceVisionEngine.isSupportedOnPlatform;
  }

  /// Kadrni tahlil qiladi: yuz detektsiyasi (spec §3), sifat
  /// tekshiruvi (spec §4), keyin imzo quriladi.
  ///
  /// [frame] — platform-neutral kadr (JPEG baytlar + metadata).
  Future<FaceAnalysisOutcome> analyze(CameraFrame frame);

  void dispose();
}

/// Google ML Kit Face Detection asosidagi yuz dvigateli.
///
/// Yuz detektsiyasi + kontur/landmark geometriyasidan "imzo" yasaladi
/// (embedding model talab qilinmaydi — to'liq oflayn).
class MLKitFaceVisionEngine implements FaceVisionEngine {
  final FaceDetector _detector;

  /// Qayta ishlatiladigan yagona vaqtinchalik fayl — har kadrda yangi
  /// fayl yaratish o'rniga bitta faylni ustiga yozamiz (disk to'lib
  /// qolishining oldini oladi).
  final File _scratchFile =
      File('${Directory.systemTemp.path}/m_edu_face_probe.jpg');

  /// Yuz juda burilgan bo'lsa rad etiladigan burchak (gradus).
  final double maxYawDegrees;

  /// Yuz yuqoriga/pastga juda egilgan bo'lsa rad etiladigan burchak.
  final double maxPitchDegrees;

  /// Sifat gate'i — imzo qurilishidan oldin tekshiradi (spec §4).
  final FaceQualityGate qualityGate;

  MLKitFaceVisionEngine({
    this.maxYawDegrees = 22,
    this.maxPitchDegrees = 20,
    this.qualityGate = const FaceQualityGate(),
  }) : _detector = FaceDetector(
          options: FaceDetectorOptions(
            // `accurate` — headEulerAngleY (yaw) kafolatlangan bo'lishi
            // uchun kerak (fast rejimda yaw berilmasligi mumkin).
            performanceMode: FaceDetectorMode.accurate,
            enableContours: true,
            enableLandmarks: true,
            // GAPS-G5 (liveness): ko'z ochiqlik ehtimolliklari faqat
            // classification yoqilganda beriladi (eyeOpenProbability).
            enableClassification: true,
            minFaceSize: 0.12,
          ),
        );

  @override
  Future<FaceAnalysisOutcome> analyze(CameraFrame frame) async {
    if (!FaceVisionEngine.isSupportedOnPlatform) {
      return const NoFaceOutcome();
    }
    final jpegBytes = frame.jpegBytes;
    try {
      final input = await _bytesToInputImage(jpegBytes);
      final faces = await _detector.processImage(input);

      // spec §3: 0 yuz → NO_FACE_DETECTED.
      if (faces.isEmpty) return const NoFaceOutcome();

      // spec §3: 2+ yuz → MULTIPLE_FACES_DETECTED — eng kattasini jimgina
      // tanlamaymiz, davomat qilinmaydi.
      if (faces.length > 1) return const MultipleFacesOutcome();

      final face = faces.single;

      // spec §4 (BAD_POSE): yuz juda burilgan bo'lsa — rad etamiz
      // (frontal yuz kerak).
      final yaw = face.headEulerAngleY ?? 0;
      final pitch = face.headEulerAngleX ?? 0;
      if (yaw.abs() > maxYawDegrees || pitch.abs() > maxPitchDegrees) {
        return const FaceRejectedOutcome([FaceQualityIssue.badPose]);
      }

      // M-10 (P0): ML Kit boundingBox **piksellarda** beradi (masalan
      // 1920x1080 kadrda box.left=1000). `_clamp01` bu qiymatni 1.0'ga
      // siqib, normalizedBox'ni buzardi — overlay ramka noto'g'ri
      // joylashardi. Kadr o'lchamiga bo'lamiz.
      //
      // CameraFrame metadata'dan foydalanamiz (agar mavjud bo'lsa),
      // aks holda JPEG header'dan o'qiydi.
      final frameW = frame.width > 0 ? frame.width : _readFrameWidth(jpegBytes);
      final frameH = frame.height > 0 ? frame.height : _readFrameHeight(jpegBytes);
      if (frameW <= 0 || frameH <= 0) return const NoFaceOutcome();

      final box = face.boundingBox;
      final normalizedBox = Rect.fromLTWH(
        _clamp01(box.left / frameW),
        _clamp01(box.top / frameH),
        _clamp01(box.width / frameW),
        _clamp01(box.height / frameH),
      );

      // spec §4: yomon frame'dan imzo (embedding) yaratilmaydi —
      // o'lcham/yorug'lik/xiralik tekshiruvi.
      final quality = await qualityGate.evaluate(
        jpegBytes: jpegBytes,
        normalizedBox: normalizedBox,
      );
      if (!quality.pass) return FaceRejectedOutcome(quality.issues);

      final signature = FaceSignature(vector: _buildSignature(face));
      if (signature.isEmpty) return const NoFaceOutcome();

      // GAPS-G5: ko'z ochiqlik — ML Kit classification natijasi (0..1).
      // Biri noma'lum bo'lsa ikkinchisini ishlatamiz; ikkalasi ham null
      // bo'lsa neytral 0.5 (liveness bu holda ochiq/yopiq qaror qilmaydi).
      final leftOpen = face.leftEyeOpenProbability;
      final rightOpen = face.rightEyeOpenProbability;
      final eyeOpenness = switch ((leftOpen, rightOpen)) {
        (final double l, final double r) => (l + r) / 2,
        (final double l, null) => l,
        (null, final double r) => r,
        (null, null) => 0.5,
      };

      return FaceDetectedOutcome(
        FaceObservation(
          normalizedBox: normalizedBox,
          yawDegrees: yaw,
          signature: signature,
          confidence: _estimateConfidence(box, frameW, frameH),
          eyeOpenness: eyeOpenness,
          sourceWidth: frameW,
          sourceHeight: frameH,
        ),
      );
    } catch (_) {
      return const NoFaceOutcome();
    }
  }

  @override
  void dispose() {
    _detector.close();
  }

  // ─────────────────────────── Yordamchilar ───────────────────────────

  Future<InputImage> _bytesToInputImage(Uint8List bytes) async {
    // ML Kit JPEG baytlarini to'g'ridan-to'g'ri qabul qilmaydi —
    // vaqtinchalik fayl orqali beramiz (bitta fayl, qayta ishlatiladi).
    await _scratchFile.writeAsBytes(bytes, flush: true);
    return InputImage.fromFilePath(_scratchFile.path);
  }

  /// Yuz geometriyasidan normalizatsiya qilingan imzo vektori.
  List<double> _buildSignature(Face face) {
    math.Point<int>? landmark(FaceLandmarkType type) =>
        face.landmarks[type]?.position;

    final leftEye = landmark(FaceLandmarkType.leftEye);
    final rightEye = landmark(FaceLandmarkType.rightEye);
    final nose = landmark(FaceLandmarkType.noseBase);
    final mouthL = landmark(FaceLandmarkType.leftMouth);
    final mouthR = landmark(FaceLandmarkType.rightMouth);
    if (leftEye == null ||
        rightEye == null ||
        nose == null ||
        mouthL == null ||
        mouthR == null) {
      return const [];
    }

    final oval = _contour(face, FaceContourType.face);
    if (oval.length < 4) return const [];
    final chin = _extremePoint(oval, axis: 1, max: true)!;
    final faceTop = _extremePoint(oval, axis: 1, max: false)!;
    final leftCheek = _extremePoint(oval, axis: 0, max: false)!;
    final rightCheek = _extremePoint(oval, axis: 0, max: true)!;

    // Umumiy imzo quruvchi (Windows TFLite dvigateli bilan bir xil).
    return FaceSignatureBuilder.build(
      leftEye: _toPoint(leftEye),
      rightEye: _toPoint(rightEye),
      nose: _toPoint(nose),
      mouthL: _toPoint(mouthL),
      mouthR: _toPoint(mouthR),
      chin: _toPoint(chin),
      faceTop: _toPoint(faceTop),
      leftCheek: _toPoint(leftCheek),
      rightCheek: _toPoint(rightCheek),
      rollRadians: (face.headEulerAngleZ ?? 0) * math.pi / 180,
    );
  }

  static math.Point<double> _toPoint(math.Point<int> p) =>
      math.Point<double>(p.x.toDouble(), p.y.toDouble());

  List<math.Point<int>> _contour(Face face, FaceContourType type) =>
      face.contours[type]?.points ?? const [];

  math.Point<int>? _extremePoint(
    List<math.Point<int>> points, {
    required int axis,
    required bool max,
  }) {
    if (points.isEmpty) return null;
    math.Point<int>? result;
    for (final p in points) {
      final v = axis == 0 ? p.x : p.y;
      if (result == null) {
        result = p;
      } else {
        final rv = axis == 0 ? result.x : result.y;
        if (max ? v > rv : v < rv) result = p;
      }
    }
    return result;
  }

  /// Detektor ishonchi: yuz maydoni (kadrga nisbatan normalizatsiya
  /// qilingan) asosida (0..1). **Heuristik** — ML Kit FaceDetector
  /// ochiq detection-confidence API beramaydi (hujjatlashtirilgan cheklov).
  double _estimateConfidence(Rect box, int frameW, int frameH) {
    final normalizedArea = (box.width / frameW) * (box.height / frameH);
    return (normalizedArea / 0.25).clamp(0.3, 1.0).toDouble();
  }

  /// JPEG'ning faqat sarlavhasidan (header) kenglik/balandlikni o'qiydi.
  ///
  /// To'liq [img.decodeImage] har kadrda butun kadrni dekodlaydi — bu
  /// keraksiz CPU sarfi (ML Kit o'zi ham xuddi shu baytlarni dekodlaydi).
  /// `startDecode` esa faqat meta-ma'lumotni (w/h) o'qiydi, piksellarni
  /// ochmaydi. Muvaffaqiyatsiz bo'lsa null qaytaradi.
  (int, int)? _readFrameDimensions(Uint8List jpegBytes) {
    try {
      final decoder = img.findDecoderForData(jpegBytes);
      if (decoder == null) return null;
      final info = decoder.startDecode(jpegBytes);
      if (info == null || info.width <= 0 || info.height <= 0) return null;
      return (info.width, info.height);
    } catch (_) {
      return null;
    }
  }

  int _readFrameWidth(Uint8List jpegBytes) => _readFrameDimensions(jpegBytes)?.$1 ?? 0;
  int _readFrameHeight(Uint8List jpegBytes) => _readFrameDimensions(jpegBytes)?.$2 ?? 0;

  double _clamp01(double v) => v.clamp(0.0, 1.0).toDouble();
}
