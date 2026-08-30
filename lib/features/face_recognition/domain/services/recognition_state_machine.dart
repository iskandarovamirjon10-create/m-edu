// Vaqtinchalik konsensus (spec §16) — yagona kadrdan identifikatsiya qarori
// qabul qilinmaydi.
//
// Muammo: kadr A → Student A, kadr B → Student B, kadr A → Student A.
// Bunday chayqalish (flapping) real kamera oqimida uchraydi (yorug'lik,
// harakat, shovqin). Bir kadrga ishonib davomat yozilsa — false accept.
//
// Yechim: bir xil, noaniq bo'lmagan nomzod KETMA-KET [requiredStableFrames]
// marta tasdiqlanganda (vaqt [temporalWindow] ichida) — identity ishonchli.
// Har qanday boshqa nomzod / noaniq / noma'lum / yuz yo'q — zanjirni tozalaydi
// va "I don't know" deyish mumkin bo'ladi (spec §58: bu — xususiyat).

import '../value_objects/biometric_policy.dart';

/// Barqarorlik zanjirining holati.
enum ConfirmationStatus {
  /// Hali yetarli barqaror kadrlar yig'ilmagan.
  confirming,

  /// [requiredStableFrames] ketma-ket bir xil nomzod — identity tasdiqlandi.
  confirmed,

  /// Nomzod noaniq (margin/ambiguous) — zanjir qayta boshlanadi.
  ambiguous,

  /// Nomzod ma'lum emas (thresholddan past) — zanjir tozalanadi.
  unknown,

  /// Kadrda yuz yo'q / 2+ yuz / sifat rad etildi — zanjir tozalanadi.
  interrupted,

  /// Konsensus [temporalWindow] ichida tugamadi — zanjir tozalanadi.
  timedOut,
}

/// Har bir kadr uchun konsensus natijasi.
class ConfirmationUpdate {
  final ConfirmationStatus status;

  /// Joriy barqaror nomzod (confirmed/confirming bo'lsa).
  final String? candidateIdentityId;

  /// Joriy nomzodning so'nggi o'xshashligi.
  final double? candidateConfidence;

  /// Yig'ilgan barqaror kadrlar soni (0..requiredStableFrames).
  final int confirmedFrames;

  /// Talab qilinadigan kadrlar soni (UI progress uchun).
  final int requiredFrames;

  const ConfirmationUpdate({
    required this.status,
    this.candidateIdentityId,
    this.candidateConfidence,
    this.confirmedFrames = 0,
    this.requiredFrames = 0,
  });

  bool get isConfirmed => status == ConfirmationStatus.confirmed;
}

/// Ketma-ket kadrlar bo'yicha nomzod barqarorligini kuzatuvchi izlagich.
///
/// Sof Dart, vaqt in'ektsiyasi bilan (test determinizmi uchun `now()`
/// uzatiladi). UI/Flutter dan mustaqil — unit test qilish oson.
class TemporalConsensusTracker {
  final BiometricPolicy policy;

  /// Vaqt manbai (real ishda `DateTime.now`).
  final DateTime Function() now;

  TemporalConsensusTracker({required this.policy, DateTime Function()? now})
      : now = now ?? DateTime.now;

  String? _candidate;
  double _confidence = 0;
  int _frames = 0;
  DateTime? _chainStartedAt;

  /// Har bir yuz-kadri natijasini beradi.
  ///
  /// [identityId] — matcher eng yaxshi nomzod sifatida qaytarganga TENG
  /// bo'lgan identity (null = UNKNOWN, [ambiguous] = margin buzilgan).
  ConfirmationUpdate feed({
    required String? identityId,
    required bool ambiguous,
    required double confidence,
    DateTime? at,
  }) {
    final t = at ?? now();

    // Konsensusni buzadigan kadrlar — zanjir tozalanadi. Bular: UNKNOWN
    // (nomzod yo'q) va AMBIGUOUS (nomzod noaniq/margin buzilgan).
    if (identityId == null || ambiguous) {
      _reset();
      return ConfirmationUpdate(
        status: ambiguous
            ? ConfirmationStatus.ambiguous
            : ConfirmationStatus.unknown,
      );
    }

    // Nomzod almashdi (A → B) — chayqalish, zanjir boshqasiga o'tadi.
    if (_candidate != identityId) {
      _candidate = identityId;
      _confidence = confidence;
      _frames = 1;
      _chainStartedAt = t;
    } else {
      // Xuddi shu nomzod davom etmoqda — vaqt oynasi ichidami?
      final elapsed = t.difference(_chainStartedAt!);
      if (elapsed > policy.temporalWindow) {
        _reset();
        _candidate = identityId;
        _confidence = confidence;
        _frames = 1;
        _chainStartedAt = t;
      } else {
        _confidence = confidence;
        _frames++;
      }
    }

    if (_frames >= policy.requiredStableFrames) {
      return ConfirmationUpdate(
        status: ConfirmationStatus.confirmed,
        candidateIdentityId: _candidate,
        candidateConfidence: _confidence,
        confirmedFrames: _frames,
        requiredFrames: policy.requiredStableFrames,
      );
    }
    return ConfirmationUpdate(
      status: ConfirmationStatus.confirming,
      candidateIdentityId: _candidate,
      candidateConfidence: _confidence,
      confirmedFrames: _frames,
      requiredFrames: policy.requiredStableFrames,
    );
  }

  /// Joriy barqaror nomzod (mavjud bo'lsa).
  String? get candidateIdentityId => _candidate;

  /// Yig'ilgan barqaror kadrlar soni.
  int get confirmedFrames => _frames;

  /// Yangi skan sessiyasi boshlanganda chaqiriladi.
  void reset() => _reset();

  void _reset() {
    _candidate = null;
    _confidence = 0;
    _frames = 0;
    _chainStartedAt = null;
  }
}
