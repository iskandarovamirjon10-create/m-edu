import 'dart:typed_data';

import '../value_objects/face_embedding.dart';

/// Yuz embedding xizmati interfeysi (spec §6).
///
/// ℹ️ HOZIRCHA ISHLATILMAYDI — bu interfeys kelajak uchun
/// neyron embedding modellari (MobileFaceNet, ArcFace, FaceNet) uchun
/// tayyorlangan. Joriy production recognition GEOMETRIK imzolarni
/// ([FaceSignatureBuilder]) ishlatadi — 21-dim vektor, neyron emas.
///
/// Identity-dvigateldan (ML Kit detektsiya / TFLite FaceMesh) AJRATILGAN:
/// bu xizmat faqat "bu yuz KIM?" degan savolni hal qiladi, "yuz kadrda
/// qayerda?" degan savolni emas (bu ML Kit / detektor vazifasi).
///
/// Model implementation alohida (TFLite MobileFaceNet / ArcFace / FaceNet
/// ...) — arxitektura modelga bog'lanmaydi, faqat [modelInfo] va
/// [generateEmbedding] orqali ishlaydi. Model o'zgarganida boshqa
/// implementatsiya yetkazib beriladi, pipeline qolgan qismi o'zgarmaydi.
abstract class FaceEmbeddingService {
  /// Joriy yuklangan model meta-ma'lumotlari (spec §10).
  EmbeddingModelInfo get modelInfo;

  /// Platformada model ishlay oladimi (Android/Windows/Linux — tflite_flutter).
  bool get isSupportedOnPlatform;

  /// Yuz crop'idan L2-normalizatsiya qilingan embedding yaratadi.
  ///
  /// [faceCropJpeg] — face-alignment qilingan yuz crop'i (spec §5).
  /// Implementatsiya model talab qilgan input o'lchamiga resize (masalan
  /// MobileFaceNet/ArcFace 112×112, FaceNet 160×160) va normalizatsiyani
  /// (RGB, (x-127.5)/127.5) O'ZI bajaradi — model spec bo'yicha.
  ///
  /// Sifat yetarli emas yoki model yuklanmagan bo'lsa — null (hech qachon
  /// uydirma embedding qaytarilmaydi).
  Future<FaceEmbedding?> generateEmbedding(Uint8List faceCropJpeg);

  void dispose();
}
