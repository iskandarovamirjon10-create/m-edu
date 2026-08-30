// Biometric policy — yuz tizimi uchun YAGONA konfiguratsiya nuqtasi (spec §9).
//
// Qoida (§55): biometrik thresholdlar hech qachon kod bo'ylab sochilmaydi.
// `0.42`, `0.67`, `0.81` kabi sehrli sonlar faqat shu faylda yashaydi va
// har birining: nomi, o'lchami (birligi), maqsadi, default qiymati,
// validatsiyasi bor. Qiymatlar empirik kalibrlash natijasida o'zgartiriladi
// (`tool/calibrate_face_thresholds.dart`), tasodifiy emas (spec §14-15).
//
// Policy versiyalanadi ([version]) — qiymatlar o'zgarsa versiya ko'tariladi,
// shunda eski va yangi konfiguratsiya bilan olingan natijalar chalkashmaydi.

/// Yuz tizimining versiyalangan biometrik siyosati.
class BiometricPolicy {
  /// Policy versiyasi — konfiguratsiya o'zgarganda ko'tariladi.
  final String version;

  // ── Moslik (matching) ───────────────────────────────────────────────
  // Birlik: kosinus o'xshashlik (0..1). Maqsad: `FaceMatcher` qarorlari.

  /// Ishonchli match chegarasi — undan yuqori o'xshashlik "tanildi".
  final double matchThreshold;

  /// Noaniq zona chegarasi — [matchThreshold] bilan orasidagi o'xshashlik
  /// noaniq (spec §14: "I don't know" — majburan biriktirilmaydi).
  final double ambiguousThreshold;

  /// Eng yaxshi va ikkinchi eng yaxshi nomzod orasidagi minimal farq
  /// (margin). Farq kichik bo'lsa — false accept xavfi, natija noaniq.
  final double marginThreshold;

  // ── Yuz detektsiyasi / sifat (spec §3-4) ────────────────────────────

  /// Yuz maydoni (kadrga nisbatan 0..1) minimal ulushi — FACE_TOO_SMALL.
  final double minimumFaceAreaFraction;

  /// Maksimal bosh burilish burchagi (gradus) — frontal yuz talabi.
  final double maxYawDegrees;

  /// Maksimal yuqori/past egilish burchagi (gradus).
  final double maxPitchDegrees;

  // ── Vaqtinchalik konsensus (spec §16) ───────────────────────────────

  /// Tanib olishdan OLDIN talab qilinadigan ketma-ket barqaror (bir xil,
  /// noaniq bo'lmagan) tasdiqlangan kadrlar soni. Bir kadrdan davomat
  /// yozilmaydi (spec §16).
  final int requiredStableFrames;

  /// Barqaror kadrlar zanjiri tugashi kerak bo'lgan vaqt oynasi.
  final Duration temporalWindow;

  /// Identity tasdiqlangandan keyin o'sha shaxs uchun qayta tasdiqlash
  /// bloklanadigan muddat (dublikat davomatni oldini oladi — spec §19).
  final Duration recognitionCooldown;

  // ── Liveness / anti-spoofing (spec §11) ─────────────────────────────

  /// Jonli deb topish uchun kerakli blinklar soni (foto/ekran replay
  /// hech qachon ko'z ochib-yummaydi).
  final int livenessRequiredBlinks;

  /// Blinklar hisoblanadigan oyna.
  final Duration livenessWindow;

  // ── Enroll (spec §4-6) ──────────────────────────────────────────────

  /// Enroll uchun kerakli valid namunalar soni (bitta surat yetarli emas).
  final int enrollmentTargetSamples;

  /// Enroll vaqtida namunalar bir xil shaxsga tegishli ekanini tekshirish
  /// uchun minimal kosinus o'xshashlik (H-05).
  final double enrollmentMinSampleSimilarity;

  // ── Kamera oqimi (spec §24) ─────────────────────────────────────────

  /// Kadrlar orasidagi kutish (ms) — skan tezligi.
  final int scanIntervalMs;

  const BiometricPolicy({
    this.version = 'BIOMETRIC_POLICY_V1',
    this.matchThreshold = 0.92,
    this.ambiguousThreshold = 0.88,
    this.marginThreshold = 0.05,
    this.minimumFaceAreaFraction = 0.01,
    this.maxYawDegrees = 22,
    this.maxPitchDegrees = 20,
    this.requiredStableFrames = 3,
    this.temporalWindow = const Duration(seconds: 10),
    this.recognitionCooldown = const Duration(seconds: 15),
    this.livenessRequiredBlinks = 2,
    this.livenessWindow = const Duration(seconds: 8),
    this.enrollmentTargetSamples = 5,
    this.enrollmentMinSampleSimilarity = 0.80,
    this.scanIntervalMs = 1200,
  });

  /// Validatsiya bilan quruvchi — nomuvofiq qiymatlar qurilishda
  /// rad etiladi (xato konfiguratsiya ishlab chiqishda emas, yuklashda
  /// ko'rinadi).
  ///
  /// Qoidalar (spec §55):
  /// - noaniq zona: `0 <= ambiguousThreshold < matchThreshold <= 1`
  /// - margin musbat va shu zona bilan mantiqiy
  /// - stable frames >= 2 (yagona kadr konsensus bo'lmaydi)
  /// - oynalar/cooldown musbat
  /// - enroll: >= 2 namuna, o'xshashlik (0..1)
  factory BiometricPolicy.validated(BiometricPolicy p) {
    if (p.ambiguousThreshold < 0 ||
        p.matchThreshold > 1 ||
        p.ambiguousThreshold >= p.matchThreshold) {
      throw ArgumentError(
        'BiometricPolicy: noaniq zona noto\'g\'ri '
        '(ambiguous=${p.ambiguousThreshold} match=${p.matchThreshold}) — '
        '0 <= ambiguous < match <= 1 bo\'lishi shart',
      );
    }
    if (p.marginThreshold <= 0) {
      throw ArgumentError(
        'BiometricPolicy: marginThreshold musbat bo\'lishi shart '
        '(margin=${p.marginThreshold})',
      );
    }
    if (p.requiredStableFrames < 2) {
      throw ArgumentError(
        'BiometricPolicy: requiredStableFrames >= 2 bo\'lishi shart '
        '(bir kadrdan konsensus bo\'lmaydi, spec §16)',
      );
    }
    if (p.temporalWindow <= Duration.zero ||
        p.recognitionCooldown <= Duration.zero ||
        p.livenessWindow <= Duration.zero) {
      throw ArgumentError(
        'BiometricPolicy: barcha vaqt oynalari musbat bo\'lishi shart',
      );
    }
    if (p.enrollmentTargetSamples < 2) {
      throw ArgumentError(
        'BiometricPolicy: enrollment kamida 2 namuna talab qiladi '
        '(spec §4 — yagona surat enroll emas)',
      );
    }
    if (p.enrollmentMinSampleSimilarity <= 0 ||
        p.enrollmentMinSampleSimilarity > 1) {
      throw ArgumentError(
        'BiometricPolicy: enrollmentMinSampleSimilarity (0..1] bo\'lishi '
        'shart',
      );
    }
    if (p.livenessRequiredBlinks < 1) {
      throw ArgumentError(
        'BiometricPolicy: livenessRequiredBlinks >= 1 bo\'lishi shart',
      );
    }
    if (p.scanIntervalMs <= 0) {
      throw ArgumentError('BiometricPolicy: scanIntervalMs musbat bo\'lishi shart');
    }
    return p;
  }

  /// Sozlamalardan kelgan moslik chegaralari bilan qurish — versiya
  /// `match`/`ambiguous` o'zgarganda ko'tariladi (kalibrlash natijasi).
  BiometricPolicy withMatchThresholds({
    required double matchThreshold,
    required double ambiguousThreshold,
  }) {
    return BiometricPolicy.validated(BiometricPolicy(
      version: '$version+MATCH',
      matchThreshold: matchThreshold,
      ambiguousThreshold: ambiguousThreshold,
      marginThreshold: marginThreshold,
      minimumFaceAreaFraction: minimumFaceAreaFraction,
      maxYawDegrees: maxYawDegrees,
      maxPitchDegrees: maxPitchDegrees,
      requiredStableFrames: requiredStableFrames,
      temporalWindow: temporalWindow,
      recognitionCooldown: recognitionCooldown,
      livenessRequiredBlinks: livenessRequiredBlinks,
      livenessWindow: livenessWindow,
      enrollmentTargetSamples: enrollmentTargetSamples,
      enrollmentMinSampleSimilarity: enrollmentMinSampleSimilarity,
      scanIntervalMs: scanIntervalMs,
    ));
  }

  @override
  String toString() => 'BiometricPolicy($version, '
      'match=$matchThreshold, ambiguous=$ambiguousThreshold, '
      'margin=$marginThreshold, stableFrames=$requiredStableFrames)';
}
