import 'dart:typed_data';

import '../../application/calibration/face_vector_extractor.dart';
import '../services/camera_source.dart';
import '../services/face_vision_engine.dart';

/// Geometrik imzo asosidagi kalibrlash ekstraktori.
///
/// Mavjud REAL [FaceVisionEngine]'ni o'rab ishlaydi: JPEG yuz rasmida
/// detektsiya (spec §3) + sifat gate'i (spec §4) + 21-o'lchamli imzo.
/// Shu tariqa kalibrlash real production pipeline bilan bir xil
/// dvigateldan o'tadi — imzo qurilishi o'zgartirilmaydi.
///
/// Kelajakda embedding modelga o'tilganda `FaceEmbeddingService`
/// asosidagi yangi ekstraktor shu interfeysni implement qiladi —
/// harness o'zgarmaydi (spec §6).
class SignatureCalibrationExtractor implements FaceVectorExtractor {
  final FaceVisionEngine _engine;

  SignatureCalibrationExtractor(this._engine);

  @override
  String get modelKey => 'geometric-signature-v1';

  @override
  bool get isAvailableOnPlatform => FaceVisionEngine.isSupportedOnPlatform;

  @override
  Future<List<double>?> extract(Uint8List jpegBytes) async {
    final (w, h) = CameraFrame.readDimensions(jpegBytes);
    final frame = CameraFrame(
      jpegBytes: jpegBytes,
      width: w,
      height: h,
      sourceId: 'calibration',
    );
    final outcome = await _engine.analyze(frame);
    return switch (outcome) {
      FaceDetectedOutcome(:final observation) => observation.signature.vector,
      _ => null, // NoFace / MultipleFaces / Rejected — vektor yo'q.
    };
  }

  @override
  void dispose() => _engine.dispose();
}
