import '../entities/lead.dart';
import '../value_objects/lead_score.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// LEAD SCORE CALCULATOR (spec CRM §3.3)
///
/// SOF FUNKSIYA — hech qanday IO, tashqi holat yo'q; test qilish oson.
/// Har bir ball nimadan kelib chiqqani [LeadScore.breakdown] orqali
/// tushuntiriladi ("nega bu lead Hot?" — shaffoflik, spec §1).
///
/// Qoidalar:
///   +2  fullName va phone ikkalasi ham to'liq
///   +1  email mavjud
///   +2  source == referral
///   +1  source == telegram yoki instagram (faol raqamli kanal)
///   +1  lastContactedAt < 48 soat oldin (yaqinda aloqa bo'lgan)
///   -2  createdAt'dan 3+ kun o'tgan-u, hali "contacted" bosqichiga
///       o'tmagan (sovib qolyapti)
///
/// Yakuniy score 0 dan pastga tushmaydi (salbiy ball Cold'da ham Cold —
/// lekin toza ko'rinish uchun 0 ga klamp qilinadi).
/// ═══════════════════════════════════════════════════════════════════════
class LeadScoreCalculator {
  const LeadScoreCalculator._();

  static const int _fullNameAndPhone = 2;
  static const int _email = 1;
  static const int _referral = 2;
  static const int _digitalChannel = 1;
  static const int _recentContact = 1;
  static const int _staling = -2;

  static const Duration _recentContactWindow = Duration(hours: 48);
  static const Duration _staleAfter = Duration(days: 3);

  /// Lead → score (0 dan boshlanadi, 0 dan pastga tushmaydi).
  static LeadScore calculate(Lead lead, {DateTime? now}) {
    final currentTime = now ?? DateTime.now();
    final breakdown = <String, int>{};

    // +2: fullName va phone ikkalasi ham to'liq.
    final hasFullName = lead.fullName.trim().isNotEmpty;
    final hasPhone =
        lead.phone != null && lead.phone!.trim().isNotEmpty;
    if (hasFullName && hasPhone) {
      breakdown['Ism va telefon'] = _fullNameAndPhone;
    }

    // +1: email mavjud.
    if (lead.email != null && lead.email!.trim().isNotEmpty) {
      breakdown['Email'] = _email;
    }

    // +2: referral manba (tavsiya eng qimmat kanal).
    if (lead.source == LeadSource.referral) {
      breakdown['Referral'] = _referral;
    }

    // +1: faol raqamli kanal (telegram/instagram).
    if (lead.source == LeadSource.telegram ||
        lead.source == LeadSource.instagram) {
      breakdown['Faol raqamli kanal'] = _digitalChannel;
    }

    // +1: yaqinda aloqa bo'lgan (< 48 soat). Kelajakdagi sana (rejalashtirilgan
    // follow-up) "yaqinda aloqa" deb hisoblanmaydi — faqat o'tmishdagi aloqa.
    final lastContacted = lead.lastContactedAt;
    if (lastContacted != null &&
        !lastContacted.isAfter(currentTime) &&
        currentTime.difference(lastContacted) < _recentContactWindow) {
      breakdown['Yaqinda aloqa'] = _recentContact;
    }

    // -2: sovib qolyapti — 3+ kun oldin yaratilgan, hali contacted emas.
    final contactedTooLate =
        lead.stage == LeadStage.newLead &&
            currentTime.difference(lead.createdAt) >= _staleAfter;
    if (contactedTooLate) {
      breakdown['Sovib qolyapti'] = _staling;
    }

    final rawScore = breakdown.values.fold(0, (sum, value) => sum + value);
    final score = rawScore < 0 ? 0 : rawScore;

    return LeadScore(score: score, breakdown: Map.unmodifiable(breakdown));
  }
}
