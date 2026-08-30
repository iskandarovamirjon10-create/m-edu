// Face liveness (anti-spoofing) — GAPS-G5.
import 'dart:math' as math;

// Pure Dart, Flutter/UI dan mustaqil (test uchun qulay). Maqsad: fotosurat /
// ekran replay'ini jonli yuzdan farqlash. Yondashuv: **blink (ko'z ochib-yumish)
// detektsiyasi** — foto/ekran hech qachon ko'z ochib-yummaydi.
//
// Har bir kadr uchun dvigatel [LivenessService.feed]'ga `eyeOpenness` (0..1)
// beradi (ML Kit `eyeOpenProbability`, TFLite EAR'dan normalizatsiya). Service
// histerezis bilan OPEN/CLOSED holatlarni kuzatadi va `requiredBlinks` sonida
// blink aniqlasa `live` deydi; `window` ichida yetmasa `timedOut`.
//
// Known limitation (hujjatlashtirilgan): bu challenge-response (tasodifiy
// buyruq) emas — yuqori sifatli video replay'ga qarshi himoya cheklangan
// (DECISIONS-D6). Eshik kameralari uchun asosiy maqsad — statik foto/ekran
// replay'ini rad etish.

/// Ko'z ochiqlik holati (histerezis bilan).
enum EyeState { unknown, open, closed }

/// Liveness baholash holati.
enum LivenessStatus {
  /// Hali yetarli blink kuzatilmagan (kuzatuv davom etmoqda).
  observing,

  /// `requiredBlinks` sonida blink tasdiqlandi — yuz jonli.
  live,

  /// `window` muddati tugadi, yetarli blink aniqlanmadi — jonli emas.
  timedOut,
}

/// Liveness natijasi (UI status chipi uchun).
class LivenessSnapshot {
  final LivenessStatus status;
  final int blinksObserved;
  final int requiredBlinks;
  final bool eyesClosedNow;

  const LivenessSnapshot({
    required this.status,
    required this.blinksObserved,
    required this.requiredBlinks,
    required this.eyesClosedNow,
  });

  /// Foydalanuvchi tilidagi qisqa holat matni.
  String get message {
    if (status == LivenessStatus.live) return 'Jonlilik tasdiqlandi ✓';
    if (status == LivenessStatus.timedOut) {
      return 'Jonli yuz tasdiqlanmadi — ko\'z ochib-yuming va qaytadan turing';
    }
    return 'Jonlilik: $blinksObserved/$requiredBlinks blink — '
        'ko\'z ochib-yuming';
  }
}

/// Liveness parametrlari.
///
/// ⚠️ Default qiymatlar muhandislik baholari (spec §29 — real korpus bilan
/// kalibrlanmagan). Ular settings'ga ko'chirilishi va real kamera
/// ma'lumotlari bilan sozlanishi kerak.
class LivenessConfig {
  /// Umumiy o'chirish tugmasi (false → darhol live, eski xatti-harakat).
  final bool enabled;

  /// Jonli deb topish uchun kerakli blinklar soni.
  final int requiredBlinks;

  /// Blinklar hisoblanadigan oyna.
  final Duration window;

  /// `eyeOpenness` shu qiymatdan past bo'lsa ko'z yumilgan (CLOSED).
  final double closedThreshold;

  /// `eyeOpenness` shu qiymatdan yuqori bo'lsa ko'z ochiq (OPEN).
  final double openThreshold;

  /// Shovqin hisobga olinmasligi uchun minimal yopiq vaqt (blink deb
  /// hisoblash uchun).
  final Duration minBlinkDuration;

  /// Yopiq vaqt shundan uzun bo'lsa — blink emas (ko'z yumib turish).
  final Duration maxBlinkDuration;

  const LivenessConfig({
    this.enabled = true,
    this.requiredBlinks = 2,
    this.window = const Duration(seconds: 8),
    this.closedThreshold = 0.35,
    this.openThreshold = 0.55,
    this.minBlinkDuration = const Duration(milliseconds: 80),
    this.maxBlinkDuration = const Duration(milliseconds: 1200),
  });
}

/// Ko'z ochiqlik kuzatuvi — histerezisli holat mashinasi.
///
/// Har bir [feed] chaqiruvida `eyeOpenness` (0..1) beriladi. Blink:
/// OPEN → CLOSED → OPEN ketma-ketligi, yopiq vaqt [LivenessConfig]
/// chegaralarida bo'lsa sanaladi.
class LivenessService {
  final LivenessConfig config;

  LivenessService({this.config = const LivenessConfig()});

  EyeState _state = EyeState.unknown;
  DateTime? _closedSince;
  DateTime? _startedAt;
  final List<DateTime> _blinkEnds = [];

  /// Sessiyani tozalaydi (yangi skan boshlanganda chaqiriladi).
  void reset() {
    _state = EyeState.unknown;
    _closedSince = null;
    _startedAt = null;
    _blinkEnds.clear();
  }

  /// Ko'z ochiqlik qiymatini beradi va yangi holatni qaytaradi.
  ///
  /// `now` — test determinizmi uchun ixtiyoriy (real ishda DateTime.now()).
  LivenessSnapshot feed(double eyeOpenness, {DateTime? now}) {
    if (!config.enabled) {
      return LivenessSnapshot(
        status: LivenessStatus.live,
        blinksObserved: config.requiredBlinks,
        requiredBlinks: config.requiredBlinks,
        eyesClosedNow: false,
      );
    }

    final t = now ?? DateTime.now();
    _startedAt ??= t;

    // Histerezis: ochiq/yopiq qarorlari orasida buffer.
    if (eyeOpenness <= config.closedThreshold) {
      if (_state != EyeState.closed) {
        // OPEN (yoki unknown) → CLOSED.
        if (_state == EyeState.open) _closedSince = t;
        _state = EyeState.closed;
      }
    } else if (eyeOpenness >= config.openThreshold) {
      if (_state == EyeState.closed) {
        // CLOSED → OPEN: yopiq vaqt blink mezoniga mos bo'lsa — blink.
        final closedDuration = _closedSince == null
            ? Duration.zero
            : t.difference(_closedSince!);
        if (closedDuration >= config.minBlinkDuration &&
            closedDuration <= config.maxBlinkDuration) {
          _blinkEnds.add(t);
        }
      }
      _state = EyeState.open;
    }
    // Oraliq qiymat (threshold'lar orasida) — holat o'zgarmaydi.

    // Blink oynasi: eski blinklarni o'chirib tashlaymiz.
    _blinkEnds.removeWhere((end) => t.difference(end) > config.window);

    // Status.
    LivenessStatus status;
    if (_blinkEnds.length >= config.requiredBlinks) {
      status = LivenessStatus.live;
    } else if (t.difference(_startedAt!) > config.window) {
      status = LivenessStatus.timedOut;
    } else {
      status = LivenessStatus.observing;
    }

    return LivenessSnapshot(
      status: status,
      blinksObserved: _blinkEnds.length,
      requiredBlinks: config.requiredBlinks,
      eyesClosedNow: _state == EyeState.closed,
    );
  }

  // ─────────────────────────── EAR yordamchilari ───────────────────────────
  //
  // TFLite (FaceMesh) dvigateli uchun: ML Kit `eyeOpenProbability` bermaydi,
  // ko'z ochiqlikni landmark geometriyasidan (EAR) hisoblaymiz. Sof funksiyalar
  // — birlik testlarda tekshiriladi.

  /// 6 nuqta [outer, upper1, upper2, inner, lower1, lower2] (x, y) uchun
  /// Eye Aspect Ratio (Soukupova & Cech, 2016).
  static double eyeAspectRatio(List<(double, double)> points) {
    if (points.length != 6) return 0;
    final d1 = _dist(points[1], points[5]);
    final d2 = _dist(points[2], points[4]);
    final d3 = _dist(points[0], points[3]);
    if (d3 == 0) return 0;
    return (d1 + d2) / (2 * d3);
  }

  /// EAR → normalizatsiya qilingan ochiqlik (0..1).
  ///
  /// Ochiq ko'z uchun EAR ≈ 0.25–0.35; yumilgan uchun ≈ 0.05–0.12.
  /// `typicalOpenEar` (0.30) ga nisbatan o'lchaymiz va 0..1 ga siqamiz.
  static double opennessFromEar(double ear,
      {double typicalOpenEar = 0.30}) {
    return (ear / typicalOpenEar).clamp(0.0, 1.0).toDouble();
  }

  static double _dist((double, double) a, (double, double) b) {
    final dx = a.$1 - b.$1;
    final dy = a.$2 - b.$2;
    return math.sqrt(dx * dx + dy * dy);
  }
}

