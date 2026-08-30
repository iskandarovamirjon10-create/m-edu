import 'package:isar/isar.dart';

part 'lead_record.g.dart';

/// `Lead` entity'sining Isar'da saqlanadigan ko'rinishi.
///
/// Enum qiymatlari String (name) sifatida saqlanadi — migratsiya xavfsiz:
/// enum o'zgartirilsa ham eski yozuvlar o'qiladi (noma'lum qiymat
/// mapping'da safar default'ga tushadi).
@collection
class LeadRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String leadId;

  late String fullName;

  String? phone;

  String? email;

  /// `LeadSource.name` — instagram/telegram/referral/walkIn/website/other.
  late String source;

  /// `LeadStage.name` — newLead/contacted/trialScheduled/converted/lost.
  @Index()
  late String stage;

  /// LeadScoreCalculator natijasi (har doim joriy holatdan hisoblanadi).
  late int score;

  /// Mas'ul foydalanuvchi (Settings > Users hisob emaili bilan bog'liq).
  String? assignedToUserId;

  /// Mavjud talaba/ota-ona tavsiya qilgan bo'lsa (referral).
  String? referredByIdentityId;

  /// Faqat [lost] bosqichida — majburiy.
  String? lostReason;

  /// Faqat [converted] bosqichida — yaratilgan Identity Real ID.
  ///
  /// Student 360 aggregator'ning [LeadRepository.fetchByConvertedIdentityId]
  /// query uchun indekslangan — N+1 skan o'rniga indexed lookup.
  /// `null` qiymatlar ham indekslanadi (Isar 3.x).
  @Index()
  String? convertedToIdentityId;

  String? notes;

  DateTime? lastContactedAt;

  DateTime? nextFollowUpAt;

  @Index()
  late DateTime createdAt;

  DateTime? updatedAt;

  late int syncVersion;

  late bool pendingSync;
}
