// Yuz tizimi xatolik taksonomiyasi (spec §34).
//
// Qoida: hech qachon `Exception("Face failed")` kabi umumiy xato
// tashlanmaydi — har bir nosozlik toifalangan va foydalanuvchi tilida
// tushunarli xabarga ega. Ichki stack trace UI'ga chiqarilmaydi.
//
// Ushbu turlar application qatlamidagi qarorlardan (recognition) ham,
// presentation qatlamidagi UI xabarlaridan ham foydalanadi.

import '../../../../core/error/failures.dart';

/// Yuz tizimi xatoligi — toifalangan, foydalanuvchi tilida xabar bilan.
sealed class FaceRecognitionError {
  /// Foydalanuvchiga ko'rsatiladigan xabar (hech qachon stack trace emas).
  String get userMessage;

  const FaceRecognitionError();

  /// Core `Failure` turlariga moslash (audit/uyg'unlik uchun).
  Failure toFailure() => FaceRecognitionFailure(userMessage);
}

/// Kamera ruxsati berilmagan yoki qaytarib olingan.
class CameraPermissionDeniedError extends FaceRecognitionError {
  @override
  final String userMessage;

  const CameraPermissionDeniedError([
    this.userMessage =
        'Kamera ruxsati yo\'q — sozlamalardan kameraga ruxsat bering',
  ]);

  @override
  Failure toFailure() => CameraFailure(userMessage);
}

/// Kamera mavjud emas / o'chirilgan / yetib bo'lmayapti.
class CameraUnavailableError extends FaceRecognitionError {
  @override
  final String userMessage;

  const CameraUnavailableError([
    this.userMessage =
        'Kameraga ulanish mumkin emas — oqimni va sozlamalarni tekshiring',
  ]);

  @override
  Failure toFailure() => CameraFailure(userMessage);
}

/// Kadrda yuz topilmadi (aniq xato konteksti kerak bo'lganda).
class NoFaceDetectedError extends FaceRecognitionError {
  @override
  final String userMessage;

  const NoFaceDetectedError([
    this.userMessage = 'Kadrda yuz aniqlanmadi — yuzni kameraga qarating',
  ]);
}

/// Kadrda 2+ yuz — avtomatik tanlov qilinmaydi.
class MultipleFacesDetectedError extends FaceRecognitionError {
  @override
  final String userMessage;

  const MultipleFacesDetectedError([
    this.userMessage =
        'Kadrda bir nechta yuz aniqlandi — faqat bitta shaxs ko\'rinsin',
  ]);
}

/// Yuz sifat gate'idan o'tmadi (o'lcham/yorug'lik/xiralik/pose).
class FaceQualityInsufficientError extends FaceRecognitionError {
  @override
  final String userMessage;

  const FaceQualityInsufficientError([
    this.userMessage =
        'Yuz sifati yetarli emas — yuzni yaxshiroq ko\'rsatib qayta urinib ko\'ring',
  ]);
}

/// Yuz burchagi qabul qilinmaydi (frontal talab).
class FacePoseInvalidError extends FaceRecognitionError {
  @override
  final String userMessage;

  const FacePoseInvalidError([
    this.userMessage = 'Yuzni kamera oldida frontal ushlab turing',
  ]);
}

/// Jonlilik (liveness) tasdiqlanmadi — foto/ekran replay ehtimoli.
class LivenessFailedError extends FaceRecognitionError {
  @override
  final String userMessage;

  const LivenessFailedError([
    this.userMessage =
        'Jonli yuz tasdiqlanmadi — ko\'z ochib-yuming va qaytadan turing',
  ]);
}

/// Embedding/imzo yaratish muvaffaqiyatsiz.
class EmbeddingGenerationFailedError extends FaceRecognitionError {
  @override
  final String userMessage;

  const EmbeddingGenerationFailedError([
    this.userMessage = 'Yuz imzosini yaratib bo\'lmadi — qayta urinib ko\'ring',
  ]);
}

/// Ro'yxatga olingan yuzlar bazasiga kirish muvaffaqiyatsiz.
class GalleryUnavailableError extends FaceRecognitionError {
  @override
  final String userMessage;

  const GalleryUnavailableError([
    this.userMessage = 'Yuzlar bazasiga kirish imkoni yo\'q',
  ]);
}

/// Nomzodlar bir-biriga juda yaqin — majburan biriktirilmaydi.
class IdentityAmbiguousError extends FaceRecognitionError {
  @override
  final String userMessage;

  const IdentityAmbiguousError([
    this.userMessage =
        'Yuz bir nechta shaxsga o\'xshaydi — noaniq, qayta urinib ko\'ring',
  ]);
}

/// Hech qanday nomzod thresholddan o'tmadi.
class IdentityUnknownError extends FaceRecognitionError {
  @override
  final String userMessage;

  const IdentityUnknownError([
    this.userMessage = 'Bu yuz ro\'yxatga olingan shaxslarga mos kelmadi',
  ]);
}

/// Tanib olish vaqt oynasida tugamadi.
class RecognitionTimeoutError extends FaceRecognitionError {
  @override
  final String userMessage;

  const RecognitionTimeoutError([
    this.userMessage = 'Tanib olish vaqti tugadi — qayta urinib ko\'ring',
  ]);
}

/// Biometrik ma'lumot ombori (shifrlangan imzolar) mavjud emas/buzilgan.
class BiometricStorageUnavailableError extends FaceRecognitionError {
  @override
  final String userMessage;

  const BiometricStorageUnavailableError([
    this.userMessage =
        'Biometrik ma\'lumotlar ombori mavjud emas — yuzlarni qayta ro\'yxatdan o\'tkazing',
  ]);
}

/// Yuz modeli yuklanmagan/buzilgan.
class ModelUnavailableError extends FaceRecognitionError {
  @override
  final String userMessage;

  const ModelUnavailableError([
    this.userMessage = 'Yuz modeli yuklanmadi — model fayllarini tekshiring',
  ]);
}

/// Platforma yuz tanishni qo'llab-quvvatlamaydi.
class UnsupportedPlatformError extends FaceRecognitionError {
  @override
  final String userMessage;

  const UnsupportedPlatformError([
    this.userMessage = 'Yuz tanish bu platformada qo\'llab-quvvatlanmaydi',
  ]);
}

/// [FaceRecognitionError] ni foydalanuvchiga ko'rsatiladigan xabarga
/// aylantiradi (qulaylik funksiyasi).
String faceRecognitionErrorMessage(FaceRecognitionError error) =>
    error.userMessage;
