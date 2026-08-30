// Yagona tanib olish natijasi (spec §3) — kuzatuv (observability, §35) va
// audit uchun xavfsiz meta-ma'lumot.
//
// MUHIM (spec §13, §35): bu yozuvda hech qachon xom biometrik ma'lumot yo'q —
// embedding vektor, kadr, yuz rasmi, imzo YO'Q. Faqat qaror meta-ma'lumoti:
// nomzod ID (yoki yo'qligi), ishonch, qaror sababi, vaqt, manba, model versiyasi.

/// Tanib olish qarorining yakuniy toifasi.
enum FaceRecognitionOutcome {
  /// Identity ishonchli tasdiqlandi (vaqtinchalik konsensus bilan).
  identified,

  /// Hech qanday nomzod thresholddan o'tmadi — "I don't know".
  unknown,

  /// Nomzodlar bir-biriga juda yaqin — chalkashlik, majburan biriktirilmaydi.
  ambiguous,

  /// Yuz topildi, lekin sifat gate'idan o'tmadi.
  qualityRejected,

  /// Kadrda 2+ yuz — bir shaxs tanlanmadi.
  multipleFaces,

  /// Liveness (jonlilik) tasdiqlanmadi — ehtimol foto/ekran replay.
  livenessFailed,

  /// Konsensus vaqt oynasida tugamadi / jarayon uzildi.
  timedOut,
}

/// Yuz tizimining xavfsiz natija yozuvi (xom biometrik ma'lumotsiz).
class FaceRecognitionResult {
  /// Qaror toifasi.
  final FaceRecognitionOutcome outcome;

  /// Tasdiqlangan/topilgan identity (identified bo'lsa; aks holda null).
  final String? identityId;

  /// O'xshashlik ishonchi (0..1; mavjud bo'lsa).
  final double? confidence;

  /// Qaror qabul qilishda o'tgan vaqt (ms; o'lchanganda).
  final int? durationMs;

  /// Liveness o'tdimi (o'lchanganda).
  final bool? livenessPassed;

  /// Sifat rad etish sabablari (kodlar; qualityRejected bo'lsa).
  final List<String> qualityIssueCodes;

  /// Kadr manbasi ('hikvision' | 'device' | 'test').
  final String cameraSource;

  /// Imzo/model manbasi (masalan 'mlkit-contour' — model versiyasi izi).
  final String signatureSource;

  /// Qaror vaqti.
  final DateTime timestamp;

  /// Qo'shimcha insoniy sabab (audit uchun, biometrik ma'lumotsiz).
  final String? reason;

  const FaceRecognitionResult({
    required this.outcome,
    this.identityId,
    this.confidence,
    this.durationMs,
    this.livenessPassed,
    this.qualityIssueCodes = const [],
    this.cameraSource = 'unknown',
    this.signatureSource = '',
    required this.timestamp,
    this.reason,
  });
}
