import 'package:equatable/equatable.dart';

import '../value_objects/lead_score.dart';

/// Lead manbasi — lead qayerdan kelgan (spec CRM §3.1).
enum LeadSource { instagram, telegram, referral, walkIn, website, other }

/// Pipeline bosqichi (Phase 1'da FIXED enum — Phase 2'da Settings'dan
/// sozlanadigan bo'lishi mumkin).
///
/// Qoida: [converted] va [lost] — FINAL holatlar, ulardan qaytish mumkin
/// emas (xato bo'lsa — `reopen` alohida audit-log'langan amal).
enum LeadStage {
  newLead,
  contacted,
  trialScheduled,
  converted,
  lost;

  /// Final holatmi? (converted/lost — orqaga qaytish mumkin emas.)
  bool get isFinal =>
      this == LeadStage.converted || this == LeadStage.lost;

  /// Lead yo'qotilganmi?
  bool get isLost => this == LeadStage.lost;

  /// Lead konvertatsiya qilinganmi?
  bool get isConverted => this == LeadStage.converted;
}

/// CRM Lead agregati (spec CRM §3.1).
///
/// Pipeline'dagi potensial mijoz. [Identity] pattern'iga mos: immutable,
/// Equatable, `copyWith`, Real ID (`LEAD-2026-000123` — alohida counter).
///
/// `phone` — normalizatsiyalangan String (Identity.phone bilan bir xil
/// konventsiya: `PhoneNumber.validate().normalized` natijasi saqlanadi,
/// value object faqat validatsiya uchun).
///
/// `score` — [LeadScoreCalculator] natijasi. Spec §3.3 bo'yicha query
/// darajasida hisoblanadi; [scoreBucket] esa umuman saqlanmaydi — getter
/// orqali [score]'dan hosil qilinadi (har doim joriy holatni aks ettiradi).
class Lead extends Equatable {
  /// Real ID, masalan `LEAD-2026-000123`.
  final String leadId;

  final String fullName;
  final String? phone;
  final String? email;

  final LeadSource source;
  final LeadStage stage;

  /// Scoring natijasi (query/command darajasida hisoblanadi).
  final int score;

  /// Kim ishlayapti (Settings > Users bilan bog'liq).
  final String? assignedToUserId;

  /// Mavjud talaba/ota-ona tavsiya qilgan bo'lsa (referral).
  final String? referredByIdentityId;

  /// Faqat [LeadStage.lost] bo'lsa — majburiy.
  final String? lostReason;

  /// Faqat [LeadStage.converted] bo'lsa — yaratilgan Identity ID.
  final String? convertedToIdentityId;

  final String? notes;
  final DateTime? lastContactedAt;
  final DateTime? nextFollowUpAt;

  final DateTime createdAt;
  final DateTime? updatedAt;

  /// Sinxronlash (Identity pattern'i bilan bir xil).
  final int syncVersion;
  final bool pendingSync;

  const Lead({
    required this.leadId,
    required this.fullName,
    this.phone,
    this.email,
    required this.source,
    required this.stage,
    this.score = 0,
    this.assignedToUserId,
    this.referredByIdentityId,
    this.lostReason,
    this.convertedToIdentityId,
    this.notes,
    this.lastContactedAt,
    this.nextFollowUpAt,
    required this.createdAt,
    this.updatedAt,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  /// Score'dan hosil qilinadi — SAQLANMAYDI (spec §3.3).
  LeadScoreBucket get scoreBucket => LeadScoreBucket.fromScore(score);

  bool get isLost => stage.isLost;
  bool get isConverted => stage.isConverted;

  /// Final holatdan keyingi o'zgarish taqiqlanganmi? (bosqichni ilgari
  /// surish uchun — final bo'lsa ruxsat berilmaydi.)
  bool get isStageFinal => stage.isFinal;

  /// Maskalangan telefon (kanban kartasi uchun): bosh + oxirgi 2 raqam
  /// ko'rinadi, o'rtasi yashiringan, masalan "+99890******67".
  String get maskedPhone {
    if (phone == null) return '';
    final digits = phone!.replaceAll('+', '');
    if (digits.length < 9) return phone!;
    final start = digits.substring(0, 5);
    final end = digits.substring(digits.length - 2);
    return '+$start******$end';
  }

  Lead copyWith({
    String? fullName,
    Object? phone = _unset,
    Object? email = _unset,
    LeadSource? source,
    LeadStage? stage,
    int? score,
    Object? assignedToUserId = _unset,
    Object? referredByIdentityId = _unset,
    Object? lostReason = _unset,
    Object? convertedToIdentityId = _unset,
    Object? notes = _unset,
    Object? lastContactedAt = _unset,
    Object? nextFollowUpAt = _unset,
    DateTime? updatedAt,
    int? syncVersion,
    bool? pendingSync,
  }) {
    return Lead(
      leadId: leadId,
      fullName: fullName ?? this.fullName,
      phone: identical(phone, _unset) ? this.phone : phone as String?,
      email: identical(email, _unset) ? this.email : email as String?,
      source: source ?? this.source,
      stage: stage ?? this.stage,
      score: score ?? this.score,
      assignedToUserId: identical(assignedToUserId, _unset)
          ? this.assignedToUserId
          : assignedToUserId as String?,
      referredByIdentityId: identical(referredByIdentityId, _unset)
          ? this.referredByIdentityId
          : referredByIdentityId as String?,
      lostReason: identical(lostReason, _unset)
          ? this.lostReason
          : lostReason as String?,
      convertedToIdentityId: identical(convertedToIdentityId, _unset)
          ? this.convertedToIdentityId
          : convertedToIdentityId as String?,
      notes: identical(notes, _unset) ? this.notes : notes as String?,
      lastContactedAt: identical(lastContactedAt, _unset)
          ? this.lastContactedAt
          : lastContactedAt as DateTime?,
      nextFollowUpAt: identical(nextFollowUpAt, _unset)
          ? this.nextFollowUpAt
          : nextFollowUpAt as DateTime?,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      syncVersion: syncVersion ?? this.syncVersion,
      pendingSync: pendingSync ?? this.pendingSync,
    );
  }

  @override
  List<Object?> get props => [
        leadId,
        fullName,
        phone,
        email,
        source,
        stage,
        score,
        assignedToUserId,
        referredByIdentityId,
        lostReason,
        convertedToIdentityId,
        notes,
        lastContactedAt,
        nextFollowUpAt,
        createdAt,
        updatedAt,
        syncVersion,
        pendingSync,
      ];

  static const Object _unset = _CopyWithUnset();
}

class _CopyWithUnset {
  const _CopyWithUnset();
}
