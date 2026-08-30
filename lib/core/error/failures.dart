/// Domain/application qatlamlarida qaytariladigan xatoliklar.
///
/// Infrastruktura darajasidagi xom exception'lar ushbu turlarga o'raladi
/// (wrapped), shunda presentation qatlam faqat `Failure`'lar bilan ishlaydi.
sealed class Failure implements Exception {
  final String message;
  const Failure(this.message);

  @override
  String toString() => '$runtimeType: $message';
}

/// Lokal bazada (Isar) ma'lumot yozish/o'qish xatosi.
class DatabaseFailure extends Failure {
  const DatabaseFailure(super.message);
}

/// Kiritilgan ma'lumotlar domain qoidalariga mos emas.
class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

/// Bir xil shaxs ikki marta ro'yxatdan o'tkazilishining oldini olish
/// (identity dedup, spec §3 "Identity merge/dedup").
class DuplicateIdentityFailure extends Failure {
  const DuplicateIdentityFailure(super.message);
}

/// D7 (biometric audit): bir xil yuz allaqachon BOSHQA identity'ga
/// ro'yxatga olingan — dublikat enroll aniq override'siz taqiqlanadi.
class DuplicateEnrollmentFailure extends Failure {
  const DuplicateEnrollmentFailure(super.message);
}

/// Topilmagan yozuv (masalan, noaniq identityId bilan so'rov).
class NotFoundFailure extends Failure {
  const NotFoundFailure(super.message);
}

/// Identifikatsiya vositalari (Face/QR/RFID) bilan bog'liq xatolik.
class IdentificationFailure extends Failure {
  const IdentificationFailure(super.message);
}

/// Aktor (foydalanuvchi) bajarishga ruxsati yo'q operatsiya.
///
/// RBAC (§32): permission tekshiruvi faqat UI'da emas — command'lar
/// ichida (application layer) ham bajariladi. UI tugmani yashirgani
/// yetarli emas; bu xato command darajasida tashlanadi.
class PermissionDeniedFailure extends Failure {
  const PermissionDeniedFailure(super.message);
}

/// Tarmoq (Internet/API) bilan bog'liq xatolik.
class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

/// Kamera (Hikvision/RTSP/ISAPI) bilan bog'liq xatolik.
class CameraFailure extends Failure {
  const CameraFailure(super.message);
}

/// Yuz tanish (Face recognition) bilan bog'liq xatolik.
class FaceRecognitionFailure extends Failure {
  const FaceRecognitionFailure(super.message);
}

/// Telegram Bot API bilan bog'liq xatolik.
class TelegramFailure extends Failure {
  const TelegramFailure(super.message);
}

/// Printer bilan bog'liq xatolik.
class PrinterFailure extends Failure {
  const PrinterFailure(super.message);
}

/// Zaxira nusxalash / tiklash bilan bog'liq xatolik.
class BackupFailure extends Failure {
  const BackupFailure(super.message);
}

/// Sinxronlash (sync) bilan bog'liq xatolik.
class SyncFailure extends Failure {
  const SyncFailure(super.message);
}

/// [Failure]'ni foydalanuvchiga ko'rsatiladigan, tushunarli xabarga
/// aylantiradi. Xom exception'lar (raw) UI'ga chiqarilmaydi (§40).
String userFriendlyMessage(Object error) {
  if (error is Failure) {
    return switch (error) {
      ValidationFailure() => error.message,
      DuplicateIdentityFailure() => error.message,
      DuplicateEnrollmentFailure() => error.message,
      NotFoundFailure() => error.message,
      DatabaseFailure() =>
        'Ma\'lumotlar bazasida xatolik yuz berdi. Iltimos qayta urinib ko\'ring.',
      PermissionDeniedFailure() => error.message,
      NetworkFailure() =>
        'Tarmoqqa ulanishda xatolik. Internet aloqasini tekshiring.',
      CameraFailure() => error.message,
      FaceRecognitionFailure() => error.message,
      TelegramFailure() => error.message,
      PrinterFailure() => error.message,
      BackupFailure() => error.message,
      SyncFailure() => error.message,
      IdentificationFailure() => error.message,
    };
  }
  // Noma'lum/raw exception — user-friendly umumiy xabar.
  return 'Kutilmagan xatolik yuz berdi. Iltimos qayta urinib ko\'ring.';
}
