import '../value_objects/face_recognition_result.dart';

/// Tanib olish urinishlari kuzatuv ombori interfeysi (spec §35).
///
/// Faqat xavfsiz meta-ma'lumot ([FaceRecognitionResult]) qabul qilinadi —
/// xom biometrik ma'lumot hech qachon bu ombor orqali o'tmaydi.
abstract class RecognitionAttemptRepository {
  /// Yakuniy tanib olish natijasini kuzatuv yozuvi sifatida saqlaydi.
  ///
  /// Best-effort: yozuv xatosi asosiy oqimni buzmasligi kerak (kuzatuv —
  /// yordamchi kanal, kritik emas).
  Future<void> record(FaceRecognitionResult result);

  /// Oxirgi [limit] ta yozuv (vaqt bo'yicha kamayish tartibida).
  Future<List<FaceRecognitionResult>> fetchRecent({int limit = 100});
}
