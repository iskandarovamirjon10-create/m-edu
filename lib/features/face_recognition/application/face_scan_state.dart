// Face skan oqimining holat iyerarxiyasi (spec §43).
//
// Qoida: 15 ta boolean (`isLoading`, `hasFace`, `isLive`, `isRecognized`...)
// bilan qarama-qarshi holatlar yaratilmaydi — holat aniq, o'zaro istisno
// sealed sinflar bilan ifodalanadi. UI har bir holatni alohida ko'rsatadi.

import '../domain/errors/face_recognition_error.dart';
import '../domain/services/liveness_service.dart';
import '../domain/value_objects/face_signature.dart';

/// Face skan oqimining hozirgi holati.
sealed class FaceScanUiState {
  const FaceScanUiState();
}

/// Boshlang'ich holat — kamera ochilmagan.
class FaceScanIdle extends FaceScanUiState {
  const FaceScanIdle();
}

/// Kamera ulanyapti.
class FaceScanStarting extends FaceScanUiState {
  const FaceScanStarting();
}

/// Oqim ishlamoqda, kadrda yuz yo'q (yoki kutish).
class FaceScanWatching extends FaceScanUiState {
  const FaceScanWatching();
}

/// Kadrda 2+ yuz — avtomatik tanlov qilinmaydi.
class FaceScanMultipleFaces extends FaceScanUiState {
  const FaceScanMultipleFaces();
}

/// Yuz topildi, lekin sifat gate'idan o'tmadi. Batafsil sabablar UI'da
/// kadr darajasida ko'rsatiladi (bu yerda faqat holat signali).
class FaceScanQualityRejected extends FaceScanUiState {
  const FaceScanQualityRejected();
}

/// Yuz topildi — liveness kuzatilmoqda (blink hisobi ko'rsatiladi).
class FaceScanFaceDetected extends FaceScanUiState {
  /// Liveness kuzatuvining joriy natijasi.
  final LivenessSnapshot liveness;

  /// Detektor ishonchi (0..1).
  final double confidence;

  const FaceScanFaceDetected({
    required this.liveness,
    required this.confidence,
  });
}

/// Liveness o'tdi, nomzod topildi — barqarorlik konsensusi davom etmoqda.
class FaceScanConfirming extends FaceScanUiState {
  final String identityId;
  final double confidence;

  /// Yig'ilgan ketma-ket barqaror kadrlar soni.
  final int confirmedFrames;

  /// Talab qilinadigan kadrlar soni.
  final int requiredFrames;

  const FaceScanConfirming({
    required this.identityId,
    required this.confidence,
    required this.confirmedFrames,
    required this.requiredFrames,
  });
}

/// Hech qanday nomzod thresholddan o'tmadi — "I don't know" (spec §58).
class FaceScanUnknown extends FaceScanUiState {
  const FaceScanUnknown();
}

/// Nomzodlar bir-biriga juda yaqin — majburan biriktirilmaydi.
class FaceScanAmbiguous extends FaceScanUiState {
  const FaceScanAmbiguous();
}

/// Identity tasdiqlandi (vaqtinchalik konsensus bilan) — attendance
/// oqimi natijasi UI'ga ko'rsatiladi.
class FaceScanIdentified extends FaceScanUiState {
  final String identityId;
  final double confidence;

  /// Attendance yozish natijasi (yozilgan/takroriy/bloklangan).
  final FaceAttendanceOutcome? attendance;

  /// Cooldown faol — o'sha identity yaqinda tasdiqlangan, qayta yozilmaydi.
  final bool cooldownActive;

  const FaceScanIdentified({
    required this.identityId,
    required this.confidence,
    this.attendance,
    this.cooldownActive = false,
  });

  /// Attendance natijasi kelgach yangilangan holat (immutable).
  FaceScanIdentified withAttendance(FaceAttendanceOutcome outcome) {
    return FaceScanIdentified(
      identityId: identityId,
      confidence: confidence,
      attendance: outcome,
      cooldownActive: cooldownActive,
    );
  }
}

/// Dvigatel modeli yuklanmagan yoki platforma qo'llab-quvvatlamaydi.
///
/// Bu holat "No face detected" emas — aniq xato: DLL yo'q, model
/// buzilgan, yoki platforma qo'llab-quvvatlanmaydi. UI foydalanuvchiga
/// tushunarli xabar ko'rsatishi kerak.
class FaceScanEngineUnavailable extends FaceScanUiState {
  /// Foydalanuvchiga ko'rsatiladigan xabar.
  final String reason;

  const FaceScanEngineUnavailable({required this.reason});
}

/// Oqim tuzatib bo'lmaydigan xatoga uchradi.
class FaceScanFailed extends FaceScanUiState {
  final FaceRecognitionError error;

  /// Qayta urinish mumkinmi (UI "Qayta urinish" tugmasini ko'rsatadi).
  final bool retryable;

  const FaceScanFailed({required this.error, this.retryable = false});
}

/// Attendance yozish natijasi (application qatlamida, attendance domenga
/// bog'lanmasdan — ko'prik: tanib olish "kim?" deydi, yozishni page hal qiladi).
class FaceAttendanceOutcome {
  final bool recorded;
  final bool duplicate;

  /// Bloklangan (faol dars yo'q / identity faol emas / guruh mos emas).
  final bool blocked;

  /// Bloklanish sababi (ko'rsatish uchun, o'qiladigan matn).
  final String? blockedReason;

  const FaceAttendanceOutcome({
    this.recorded = false,
    this.duplicate = false,
    this.blocked = false,
    this.blockedReason,
  });

  bool get isComplete => recorded || duplicate;
}

/// Dvigatel tahlil natijasini controller'ga uzatish uchun xavfsiz kadr
/// hodisasi (infrastruktura turlaridan mustaqil — Rect/ML Kit yo'q).
sealed class FaceScanFrameEvent {
  const FaceScanFrameEvent();
}

/// Kadrda yuz yo'q.
class NoFaceFrameEvent extends FaceScanFrameEvent {
  const NoFaceFrameEvent();
}

/// Kadrda 2+ yuz.
class MultipleFacesFrameEvent extends FaceScanFrameEvent {
  const MultipleFacesFrameEvent();
}

/// Yuz topildi, sifat gate'idan o'tmadi.
class FaceRejectedFrameEvent extends FaceScanFrameEvent {
  const FaceRejectedFrameEvent();
}

/// Yuz topildi va sifatdan o'tdi — liveness + moslik uchun.
class FaceDetectedFrameEvent extends FaceScanFrameEvent {
  /// Yuz imzosi (matcher uchun) — domain tipi, infrastruktura turlaridan
  /// mustaqil (Rect/ML Kit/Isar yo'q).
  final FaceSignature signature;

  /// Detektor ishonchi (0..1).
  final double confidence;

  /// Ko'z ochiqlik (0..1) — liveness (blink) uchun.
  final double eyeOpenness;

  const FaceDetectedFrameEvent({
    required this.signature,
    required this.confidence,
    required this.eyeOpenness,
  });
}

/// Dvigatel modeli yuklanmagan yoki platforma qo'llab-quvvatlamaydi.
///
/// Bu holat "No face detected" emas — aniq xato. UI foydalanuvchiga
/// tushunarli xabar ko'rsatishi kerak (masalan: DLL yuklanmadi).
/// Controller ushbu hodisani xato holatiga o'tkazadi.
class EngineUnavailableFrameEvent extends FaceScanFrameEvent {
  /// Foydalanuvchiga ko'rsatiladigan xabar.
  final String reason;

  const EngineUnavailableFrameEvent({required this.reason});
}
