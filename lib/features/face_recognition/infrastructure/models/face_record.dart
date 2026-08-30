import 'package:isar/isar.dart';

part 'face_record.g.dart';

/// Ro'yxatga olingan yuz namunasi (Face ID bazasi).
///
/// Har bir identity uchun yuzning geometrik "imzosi" (normalizatsiya
/// qilingan vektor) saqlanadi. Signature oflayn yuzni tanish uchun
/// ishlatiladi — tashqi server yoki model fayl talab qilinmaydi.
///
/// H-03: Yuz imzosi sensitive biometric data — [encryptedSignature]
/// AES-256-GCM bilan shifrlangan holda saqlanadi (encryption key
/// flutter_secure_storage'da, source code'da emas).
@collection
class FaceRecord {
  Id id = Isar.autoIncrement;

  /// Identity ID (M-EDU-2026-000482) — bitta identity bitta yuz bazasi.
  @Index(unique: true, replace: true)
  late String identityId;

  /// Yuz imzosi vektori (bir nechta namunadan o'rtachalashtirilgan).
  ///
  /// LEGACY: H-03 dan avval plaintext saqlanardi. Yangi yozuvlarda
  /// bo'sh qoldiriladi; eski yozuvlar [encryptedSignature] ga bir
  /// marta ko'chirilgach tozalanadi (migration, `FaceRecognitionRepositoryImpl`).
  late List<double> signature;

  /// Shifrlangan yuz imzosi (AES-256-GCM, nonce+cipertext).
  /// H-03 dan keyingi barcha yozuvlarda to'ldiriladi.
  ///
  /// Isar `Uint8List` tipini bevosita qo'llab-quvvatlamaydi — blob
  /// `List<int>` sifatida saqlanadi (Isar `List<int>` -> blob mapping).
  List<int>? encryptedSignature;

  /// O'rtachalashtirishda ishlatilgan namunalar soni.
  late int sampleCount;

  /// Imzo manbasi (mlkit-contour | tflite-facmesh) — kalibrlash uchun ma'lumot.
  String source = 'mlkit-contour';

  /// Yuz qayd etilgan sana.
  late DateTime createdAt;

  /// Yuz yangilangan sana.
  DateTime? updatedAt;
}
