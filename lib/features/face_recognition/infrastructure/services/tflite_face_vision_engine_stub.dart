import 'camera_source.dart';
import 'face_quality_gate.dart';
import 'face_vision_engine.dart';

/// Web platformasi uchun stub — TFLite FaceMesh dvigatelining web
/// implementatsiyasi.
///
/// `tflite_flutter` paketi `dart:ffi`'ga bog'lanadi va `dart:ffi` web'da
/// mavjud emas — bu faylni import qilish web build'ni buzardi. Shuning
/// uchun shim (`tflite_face_vision_engine.dart`) web'da aynan shu stub'ni
/// yuklaydi: klass API siyohi bir xil, lekin `analyze` hech qachon real
/// ishlamaydi (NoFaceOutcome — kadrda yuz yo'q kabi).
///
/// Web'da yuz tanish texnologik jihatdan qo'llab-quvvatlanmaydi:
/// [isSupportedOnPlatform] false qaytaradi, UI esa foydalanuvchiga
/// tushunarli holat ko'rsatadi (face_scan_page'dagi `unsupported` holat).
/// App compile bo'ladi va qolgan barcha feature'lar ishlashda davom etadi.
class TFLiteFaceVisionEngine implements FaceVisionEngine {
  final FaceQualityGate qualityGate;

  TFLiteFaceVisionEngine({this.qualityGate = const FaceQualityGate()});

  static bool get isSupportedOnPlatform => false;

  @override
  Future<FaceAnalysisOutcome> analyze(CameraFrame frame) async {
    return const EngineUnavailableOutcome(
      'Yuz tanish web platformada qo\'llab-quvvatlanmaydi',
    );
  }

  @override
  void dispose() {
    // Stub'da yopiladigan resurs yo'q.
  }
}
