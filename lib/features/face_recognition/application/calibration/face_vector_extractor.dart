import 'dart:typed_data';

/// Kalibrlash uchun yuz vektori ekstraktori (port — modelga bog'lanmagan).
///
/// Bugun geometrik imzo (`SignatureCalibrationExtractor` — mavjud
/// [FaceVisionEngine] orqali), kelajakda neural embedding
/// (`FaceEmbeddingService` asosidagi implementatsiya) — ikkalasi ham
/// shu interfeys orqali ulanadi. Shu tariqa kalibrlash harness'ini
/// model o'zgarganda qayta yozish shart emas (spec §6 arxitektura).
abstract class FaceVectorExtractor {
  /// Vektor identifikatori — hisobotda qaysi model kalibrlanganini
  /// ko'rsatadi (masalan 'geometric-21' yoki 'mobilefacenet-128').
  String get modelKey;

  /// Platformada ushbu ekstraktor ishlay oladimi (masalan ML Kit faqat
  /// Android/iOS/macOS'da). Yaroqsiz bo'lsa — kalibrlash o'tkazilmaydi
  /// (NOT BENCHMARKED).
  bool get isAvailableOnPlatform;

  /// JPEG yuz crop'idan vektor chiqaradi.
  ///
  /// Muvaffaqiyatsiz (yuz topilmadi / sifat gate'idan o'tmadi / model
  /// yuklanmadi) — null. Hech qachon uydirma vektor qaytarmaydi.
  Future<List<double>?> extract(Uint8List jpegBytes);

  void dispose();
}
