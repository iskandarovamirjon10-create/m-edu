import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

import '../../domain/services/liveness_service.dart';
import '../../domain/value_objects/face_signature.dart';
import 'camera_source.dart';
import 'face_quality_gate.dart';
import 'face_signature_builder.dart';
import 'face_vision_engine.dart';

/// TFLite FaceMesh (468 nuqta) asosidagi yuz dvigateli.
///
/// Windows/Linux kabi ML Kit qo'llab-quvvatlanmaydigan platformalarda
/// ishlaydi. `assets/models/face_landmark.tflite` (MediaPipe FaceMesh)
/// bilan kadrdagi yuz landmarklarini topib, [FaceSignatureBuilder] orqali
/// ML Kit bilan bir xil strukturadagi imzo yaratadi.
///
/// To'liq oflayn ishlaydi; model fayllar ilova bilan birga tarqatiladi.
///
/// ⚠️ Cheklov: FaceMesh faqat bitta yuz uchun landmark beradi — 2+ yuz
/// (spec §3 MULTIPLE_FACES_DETECTED) bu dvigatelda aniqlanmaydi. Buning
/// uchun alohida detektor (masalan `blaze_face_short_range.tflite`) kerak.
class TFLiteFaceVisionEngine implements FaceVisionEngine {
  static const int _inputSize = 192;

  /// FaceMesh landmark indekslari (MediaPipe canonical mapping).
  static const int _leftEyeOuter = 362;
  static const int _leftEyeInner = 263;
  static const int _rightEyeOuter = 33;
  static const int _rightEyeInner = 133;
  static const int _noseTip = 1;
  static const int _mouthLeft = 61;
  static const int _mouthRight = 291;
  static const int _chin = 152;
  static const int _forehead = 10;
  static const int _leftCheek = 234;
  static const int _rightCheek = 454;

  /// GAPS-G5 (liveness): EAR uchun ko'z landmark indekslari
  /// [outer, upper1, upper2, inner, lower1, lower2] — MediaPipe FaceMesh
  /// canonical 468 nuqta mapping'i (Soukupova & Cech EAR).
  static const List<int> _leftEyeEarPoints = [362, 385, 387, 263, 373, 380];
  static const List<int> _rightEyeEarPoints = [33, 160, 158, 133, 153, 144];

  /// Sifat gate'i — imzo qurilishidan oldin tekshiradi (spec §4).
  final FaceQualityGate qualityGate;

  Interpreter? _interpreter;
  bool _loadFailed = false;

  TFLiteFaceVisionEngine({this.qualityGate = const FaceQualityGate()});

  static bool get isSupportedOnPlatform {
    if (kIsWeb) return false;
    return Platform.isWindows || Platform.isLinux;
  }

  Future<bool> _ensureLoaded() async {
    if (_interpreter != null) return true;
    if (_loadFailed) return false;
    try {
      // C-01 (P0): asset kaliti `assets/` prefiksi bilan berilishi shart —
      // tflite_flutter `rootBundle.load(path)` chaqiradi va pubspec'dagi
      // key `assets/models/face_landmark.tflite`. `models/...` yozilsa
      // `Unable to load asset` xatosi bilan abadiy ishlamay qolardi.
      _interpreter = await Interpreter.fromAsset(
        'assets/models/face_landmark.tflite',
      );
      return true;
    } catch (_) {
      _loadFailed = true;
      return false;
    }
  }

  @override
  Future<FaceAnalysisOutcome> analyze(CameraFrame frame) async {
    if (!TFLiteFaceVisionEngine.isSupportedOnPlatform) {
      return const EngineUnavailableOutcome(
        'Yuz tanish bu platformada qo\'llab-quvvatlanmaydi',
      );
    }
    if (!await _ensureLoaded()) {
      return const EngineUnavailableOutcome(
        'Yuz modeli yuklanmadi — libtensorflowlite_c-win.dll faylini '
        'blobs/ papkasiga joylashtiring (scripts\\setup_tflite_native.ps1)',
      );
    }
    final interpreter = _interpreter;
    if (interpreter == null) return const NoFaceOutcome();
    final jpegBytes = frame.jpegBytes;

    try {
      final input = await _preprocess(jpegBytes);
      if (input == null) return const NoFaceOutcome();

      // Chiqish tensorlarini shakl bo'yicha aniqlaymiz.
      final outputTensors = interpreter.getOutputTensors();
      final buffers = <Object>[];
      for (final tensor in outputTensors) {
        final size = tensor.shape.fold<int>(1, (a, b) => a * b);
        buffers.add(Float32List(size));
      }
      interpreter.run(input, buffers);

      final landmarks = _extractTensor(
        buffers,
        outputTensors,
        contains: 468,
        expectTriple: true,
      );
      // Visibility — faqat 2 o'lchamli [1, 468] tensor (presence [1,1,468,1]
      // bilan aralashib ketmasligi uchun rank bo'yicha aniqlaymiz).
      final visibility = _extractTensor(
        buffers,
        outputTensors,
        contains: 468,
        expectTriple: false,
        rank: 2,
      );
      if (landmarks == null || landmarks.length < 468 * 3) {
        return const NoFaceOutcome();
      }

      // Yuz bormi? (visibility filtri)
      if (visibility != null && visibility.length >= 468) {
        var visSum = 0.0;
        for (var i = 0; i < 468; i++) {
          visSum += visibility[i];
        }
        if (visSum / 468 < 0.55) return const NoFaceOutcome();

        // Ko'p yuz aniqlash (spec §3 MULTIPLE_FACES_DETECTED):
        // FaceMesh faqat bitta yuz uchun landmark beradi, lekin kirish
        // kadrida 2+ yuz bo'lsa, visibility tensori patterni o'zgaradi.
        // Buning uchun landmarklar geometrik tarqalishini tahlil qilamiz.
        final faceCount = _estimateFaceCount(landmarks, visibility);
        if (faceCount > 1) return const MultipleFacesOutcome();
      }

      return await _buildObservation(landmarks, jpegBytes);
    } catch (_) {
      return const NoFaceOutcome();
    }
  }

  /// Ko'p yuz aniqlash — FaceMesh visibility va landmarklar geometrik
  /// tarqalishiga asoslangan heuristika.
  ///
  /// FaceMesh faqat bitta yuz uchun landmark beradi (468 nuqta). Agar
  /// kadrda 2+ yuz bo'lsa:
  ///  - Visibility aralash bo'ladi (ba'zi landmarklar past visibility);
  ///  - Landmarklar geometrik tarqalishi kutilgan yuz o'lchamidan katta;
  ///  - Yuz ramkasi kadrga nisbatan juda katta (>70% eni yoki boyi).
  ///
  /// ⚠️ BU HEURISTIKA — aniq yuz aniqlash uchun alohida detektor
  /// (masalan BlazeFace) kerak. Bu metod "heavy suspicion" holatida
  /// MultipleFacesOutcome qaytaradi; 100% aniqlik kafolatlanmaydi.
  int _estimateFaceCount(Float32List landmarks, Float32List visibility) {
    // 1) Visibility-based check: past visibility landmarklar proportioni.
    var lowVisCount = 0;
    for (var i = 0; i < 468; i++) {
      if (visibility[i] < 0.3) lowVisCount++;
    }
    final lowVisRatio = lowVisCount / 468;

    // 2) Geometric spread check: landmarklar bounding box kattaligi.
    var minX = double.infinity, minY = double.infinity;
    var maxX = double.negativeInfinity, maxY = double.negativeInfinity;
    for (var i = 0; i < 468; i++) {
      final x = landmarks[i * 3];
      final y = landmarks[i * 3 + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    final spreadW = maxX - minX;
    final spreadH = maxY - minY;

    // 3) Keyingi landmarklar orasidagi masofalar (ko'z-iyak, burun-iyak).
    // Agar 2 yuz bo'lsa, bu masofalar normal yuz o'lchamidan katta bo'ladi.
    final leftEye = math.Point<double>(
      landmarks[_leftEyeOuter * 3].toDouble(),
      landmarks[_leftEyeOuter * 3 + 1].toDouble(),
    );
    final rightEye = math.Point<double>(
      landmarks[_rightEyeOuter * 3].toDouble(),
      landmarks[_rightEyeOuter * 3 + 1].toDouble(),
    );
    final chin = math.Point<double>(
      landmarks[_chin * 3].toDouble(),
      landmarks[_chin * 3 + 1].toDouble(),
    );
    final dEye = FaceSignatureBuilder.distance(leftEye, rightEye);
    final dEyeChin = FaceSignatureBuilder.distance(leftEye, chin);

    // Normal yuz uchun: dEyeChin/dEye ≈ 2.0-3.0. Agar 2+ yuz bo'lsa,
    // landmarklar bir yuzdan ikkinchisiga cho'zilishi mumkin — nisbat oshadi.
    final ratio = dEye > 0.01 ? dEyeChin / dEye : 0;

    // Qaror: ikkala usul ham "heavy suspicion" bo'lsa — multiple face.
    // Visibility hisobining past proportioni (>30%) VA geometric spread katta
    // bo'lsa (>0.8 eni yoki boyi) — ehtimol 2+ yuz.
    if (lowVisRatio > 0.30 && (spreadW > 0.8 || spreadH > 0.8)) {
      return 2;
    }
    // Yoki dEyeChin/dEye nisbati 4.0 dan katta bo'lsa — cho'zilgan
    // landmarklar, ehtimol 2+ yuz.
    if (ratio > 4.0 && lowVisRatio > 0.20) {
      return 2;
    }

    return 1;
  }

  Future<FaceAnalysisOutcome> _buildObservation(
    Float32List landmarks,
    Uint8List jpegBytes,
  ) async {
    math.Point<double> at(int index) => math.Point<double>(
          landmarks[index * 3].toDouble(),
          landmarks[index * 3 + 1].toDouble(),
        );

    // GAPS-G5: ko'z ochiqlik — ikkala ko'zning EAR o'rtachasi, keyin
    // normalizatsiya (letterbox koordinatalari nisbatlari o'zgarmaydi —
    // EAR o'lchovga invariant).
    final leftEar = LivenessService.eyeAspectRatio(
      _leftEyeEarPoints.map((i) => (at(i).x, at(i).y)).toList(),
    );
    final rightEar = LivenessService.eyeAspectRatio(
      _rightEyeEarPoints.map((i) => (at(i).x, at(i).y)).toList(),
    );
    final eyeOpenness = LivenessService.opennessFromEar(
      (leftEar + rightEar) / 2,
    );

    final leftEye = FaceSignatureBuilder.midpoint(
      at(_leftEyeOuter),
      at(_leftEyeInner),
    );
    final rightEye = FaceSignatureBuilder.midpoint(
      at(_rightEyeOuter),
      at(_rightEyeInner),
    );
    final nose = at(_noseTip);
    final mouthL = at(_mouthLeft);
    final mouthR = at(_mouthRight);
    final chin = at(_chin);
    final faceTop = at(_forehead);
    final leftCheek = at(_leftCheek);
    final rightCheek = at(_rightCheek);

    // Yuz ramkasi — barcha landmarklar bo'ylab.
    var minX = double.infinity, minY = double.infinity;
    var maxX = double.negativeInfinity, maxY = double.negativeInfinity;
    for (var i = 0; i < 468; i++) {
      final x = landmarks[i * 3].toDouble();
      final y = landmarks[i * 3 + 1].toDouble();
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    final width = maxX - minX;
    final height = maxY - minY;

    // Yuz yetarlicha katta bo'lishi kerak (eshik kamerasi) — spec §4
    // FACE_TOO_SMALL.
    final dEye = FaceSignatureBuilder.distance(leftEye, rightEye);
    if (dEye < 0.05 || width < 0.2 || height < 0.2) {
      return const FaceRejectedOutcome([FaceQualityIssue.faceTooSmall]);
    }

    // Letterbox (192x192) koordinatalarini ORIGINAL kadr koordinatalariga
    // qaytaramiz — overlay ramka va sifat crop'i to'g'ri joylashishi uchun
    // (H-01: oldin box letterbox fazasida qolardi).
    final normalizedBox = _letterboxToFrameBox(
      jpegBytes,
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
    );
    if (normalizedBox == null) return const NoFaceOutcome();

    // spec §4: yomon frame'dan imzo (embedding) yaratilmaydi —
    // o'lcham/yorug'lik/xiralik tekshiruvi (yuz burchagi bu dvigatelda
    // FaceMesh yaw chiqarmagani uchun tekshirilmaydi — hujjatlashtirilgan).
    final quality = await qualityGate.evaluate(
      jpegBytes: jpegBytes,
      normalizedBox: normalizedBox,
    );
    if (!quality.pass) return FaceRejectedOutcome(quality.issues);

    // Roll burchagini ko'z chizig'idan hisoblaymiz (y pastga yo'nalgan
    // tasvir koordinatalari). Bir xil dvigatel bilan enroll+probe qilganda
    // belgi xatosi bir-birini yo'q qiladi — moslik buzilmaydi.
    final roll = math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x,
    );

    final signature = FaceSignature(
      vector: FaceSignatureBuilder.build(
        leftEye: leftEye,
        rightEye: rightEye,
        nose: nose,
        mouthL: mouthL,
        mouthR: mouthR,
        chin: chin,
        faceTop: faceTop,
        leftCheek: leftCheek,
        rightCheek: rightCheek,
        rollRadians: roll,
      ),
      source: 'tflite-facmesh',
    );
    if (signature.isEmpty) return const NoFaceOutcome();

    // Geometric yaw/pitch estimation from FaceMesh landmarks.
    // FaceMesh provides 468 3D landmarks. When the head turns, the relative
    // distances between left/right facial landmarks change due to perspective.
    // We estimate yaw from the asymmetry of eye-cheek distances and pitch
    // from forehead-to-nose vs nose-to-chin vertical ratio.
    final yaw = _estimateYaw(landmarks, leftEye, rightEye, leftCheek, rightCheek);
    // pitch estimated but not used in FaceObservation (no pitchDegrees field).
    // Kept for future use when pitch-based liveness or pose filtering is added.
    // ignore: unused_local_variable
    final pitch = _estimatePitch(landmarks, faceTop, nose, chin);

    return FaceDetectedOutcome(
      FaceObservation(
        normalizedBox: normalizedBox,
        yawDegrees: yaw,
        signature: signature,
        confidence: (width * height / 0.25).clamp(0.3, 1.0).toDouble(),
        eyeOpenness: eyeOpenness,
      ),
    );
  }

  /// Letterbox fazasidagi landmark bbox'ni original kadrga o'tkazadi.
  ///
  /// FaceMesh 192x192 letterbox canvas'da 0..1 koordinatalar beradi —
  /// original kadrda (minX..maxX) moslamasini hisoblash uchun letterbox
  /// transform teskari qo'llaniladi. Kadr sarlavhasi orqali original
  /// o'lchamlar olinadi (to'liq dekod qilinmaydi).
  Rect? _letterboxToFrameBox(
    Uint8List jpegBytes, {
    required double minX,
    required double minY,
    required double maxX,
    required double maxY,
  }) {
    final dims = _readFrameDimensions(jpegBytes);
    if (dims == null) return null;
    final origW = dims.$1;
    final origH = dims.$2;

    final scale = math.min(_inputSize / origW, _inputSize / origH);
    final offsetX = (_inputSize - origW * scale) / 2;
    final offsetY = (_inputSize - origH * scale) / 2;

    double toOrigX(double lx) => (lx * _inputSize - offsetX) / scale;
    double toOrigY(double ly) => (ly * _inputSize - offsetY) / scale;

    return Rect.fromLTRB(
      (toOrigX(minX) / origW).clamp(0.0, 1.0).toDouble(),
      (toOrigY(minY) / origH).clamp(0.0, 1.0).toDouble(),
      (toOrigX(maxX) / origW).clamp(0.0, 1.0).toDouble(),
      (toOrigY(maxY) / origH).clamp(0.0, 1.0).toDouble(),
    );
  }

  /// JPEG kadrni 192x192 RGB float tensoriga aylantiradi.
  ///
  /// MediaPipe FaceMesh 192x192'ga **letterbox** (aspekt saqlanadigan
  /// padding) bilan ishlaydi — `copyResize(192,192)` to'g'ridan-to'g'ri
  /// ishlatilsa aspekt nisbati buzilib, imzo noto'g'ri chiqadi (H-01).
  /// Shuning uchun: yuz maksimal o'lchamga proporsional o'lchamlanadi,
  /// qolgan joy qora (0) bilan to'ldiriladi.
  Future<Float32List?> _preprocess(Uint8List jpegBytes) async {
    try {
      final decoded = img.decodeImage(jpegBytes);
      if (decoded == null) return null;

      // Letterbox: aspektni saqlab, 192x192 ichiga sig'diramiz.
      final scale = math.min(
        _inputSize / decoded.width,
        _inputSize / decoded.height,
      );
      final newWidth = (decoded.width * scale).round();
      final newHeight = (decoded.height * scale).round();
      final offsetX = (_inputSize - newWidth) ~/ 2;
      final offsetY = (_inputSize - newHeight) ~/ 2;

      final resized = img.copyResize(
        decoded,
        width: newWidth,
        height: newHeight,
        interpolation: img.Interpolation.linear,
      );
      // Qora (0,0,0) fonli canvas — letterbox padding to'q rang bo'ladi
      // (FaceMesh uchun standart). `blend: BlendMode.alpha` aniq beriladi:
      // library default'iga tayanilmaydi, yuz hududi to'g'ridan-to'g'ri
      // ko'chiriladi, padding esa 0 qoladi.
      final canvas = img.Image(
        width: _inputSize,
        height: _inputSize,
        numChannels: 3,
      );
      img.compositeImage(
        canvas,
        resized,
        dstX: offsetX,
        dstY: offsetY,
        blend: img.BlendMode.alpha,
      );

      final rgb = canvas.getBytes(order: img.ChannelOrder.rgb);
      final input = Float32List(_inputSize * _inputSize * 3);
      for (var i = 0; i < rgb.length; i++) {
        input[i] = rgb[i] / 255.0;
      }
      return input;
    } catch (_) {
      return null;
    }
  }

  /// Chiqish bufferidan berilgan shaklga mos keluvchisini topadi.
  Float32List? _extractTensor(
    List<Object> buffers,
    List<Tensor> tensors, {
    required int contains,
    required bool expectTriple,
    int? rank,
  }) {
    for (var i = 0; i < tensors.length; i++) {
      final shape = tensors[i].shape;
      if (rank != null && shape.length != rank) continue;
      final triple = shape.length >= 3 && shape.contains(3);
      if (shape.contains(contains) && triple == expectTriple) {
        return buffers[i] as Float32List;
      }
    }
    return null;
  }

  /// Geometric yaw estimation from FaceMesh landmarks.
  ///
  /// When the head turns left/right, the nose moves horizontally relative
  /// to the eye line, and the near-side cheek appears wider than the far-side.
  /// We use the ratio of left/right cheek-to-eye distances as a geometric
  /// yaw proxy. This is not ML Kit's Euler angle, but a defensible
  /// geometric estimate from the same 468-point mesh.
  double _estimateYaw(
    Float32List landmarks,
    math.Point<double> leftEye,
    math.Point<double> rightEye,
    math.Point<double> leftCheek,
    math.Point<double> rightCheek,
  ) {
    // Horizontal nose offset from the midpoint of the eyes.
    final nose = math.Point<double>(
          landmarks[_noseTip * 3].toDouble(),
          landmarks[_noseTip * 3 + 1].toDouble(),
        );
    final eyeMidX = (leftEye.x + rightEye.x) / 2;
    final noseOffsetX = nose.x - eyeMidX;
    final eyeDistance = leftEye.x - rightEye.x;
    if (eyeDistance.abs() < 0.01) return 0;

    // Normalized offset: positive = turned right (nose right of center).
    // Scale factor maps to approximate degrees (empirical, ~30° range).
    final normalizedOffset = noseOffsetX / eyeDistance;
    // Heuristic: ~0.1 normalized offset ≈ ~15° yaw.
    return (normalizedOffset * 150).clamp(-30.0, 30.0).toDouble();
  }

  /// Geometric pitch estimation from FaceMesh landmarks.
  ///
  /// When the head tilts up/down, the vertical ratios between forehead,
  /// nose, and chin change. We use forehead-to-nose vs nose-to-chin ratio.
  double _estimatePitch(
    Float32List landmarks,
    math.Point<double> faceTop,
    math.Point<double> nose,
    math.Point<double> chin,
  ) {
    final foreheadToNose = (nose.y - faceTop.y).abs();
    final noseToChin = (chin.y - nose.y).abs();
    if (foreheadToNose < 0.01 || noseToChin < 0.01) return 0;

    // Ratio: in a frontal face, forehead-to-nose ≈ nose-to-chin.
    // When looking up, forehead-to-nose shrinks, nose-to-chin grows.
    final ratio = foreheadToNose / noseToChin;
    // Heuristic: ratio 1.0 = frontal, <0.7 = looking up, >1.3 = looking down.
    final pitchEstimate = (1.0 - ratio) * 30; // Map ratio deviation to degrees.
    return pitchEstimate.clamp(-25.0, 25.0).toDouble();
  }

  /// JPEG'ning faqat sarlavhasidan (header) kenglik/balandlikni o'qiydi.
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

  @override
  void dispose() {
    try {
      _interpreter?.close();
    } catch (_) {
      // interpreter allaqachon yopilgan bo'lishi mumkin
    }
    _interpreter = null;
  }
}
