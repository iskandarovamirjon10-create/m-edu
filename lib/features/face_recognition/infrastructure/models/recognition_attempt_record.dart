import 'package:isar/isar.dart';

part 'recognition_attempt_record.g.dart';

/// Tanib olish urinishining kuzatuv yozuvi (spec §35 — observability).
///
/// MUHIM PRIVACY QOIDASI (§13, §35): bu yozuvda HECH QACHON xom biometrik
/// ma'lumot saqlanmaydi — embedding vektor, imzo, kadr, yuz rasmi YO'Q.
/// Faqat xavfsiz meta-ma'lumot: qaror toifasi, identity ID (yoki yo'qligi),
/// ishonch, vaqt, manba. Audit tahlili (nechta UNKNOWN, o'rtacha kechikish,
/// liveness rad etishlar) shu yozuvlar ustidan qilinadi.
@collection
class RecognitionAttemptRecord {
  Id id = Isar.autoIncrement;

  /// Qaror toifasi (identified | unknown | ambiguous | qualityRejected |
  /// multipleFaces | livenessFailed | timedOut).
  late String outcome;

  /// Tasdiqlangan/topilgan identity (identified bo'lsa; aks holda null).
  /// Sensitive emas — faqat shaxs identifikatori, biometrik vektor emas.
  String? identityId;

  /// O'xshashlik ishonchi (0..1; mavjud bo'lsa).
  double? confidence;

  /// Liveness o'tdimi (o'lchanganda).
  bool? livenessPassed;

  /// Qaror qabul qilishda o'tgan vaqt (ms; o'lchanganda).
  int? durationMs;

  /// Sifat rad etish sabablari (kodlar; qualityRejected bo'lsa).
  List<String> qualityIssueCodes = [];

  /// Kadr manbasi ('hikvision' | 'device' | 'test').
  String cameraSource = 'unknown';

  /// Qaror vaqti.
  late DateTime timestamp;

  /// Qo'shimcha insoniy sabab (audit uchun).
  String? reason;

  /// Qulay indeks: sana bo'yicha tahlil.
  @Index()
  DateTime? timestampIndex;
}
