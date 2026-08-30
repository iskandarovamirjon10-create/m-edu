import 'package:equatable/equatable.dart';

/// Ustuvorlik darajasi (display uchun).
enum PriorityLevel {
  low,
  medium,
  high,
  critical;

  /// [score] (0..1) dan daraja aniqlanadi. Deterministik.
  static PriorityLevel fromScore(double score) {
    if (score >= 0.8) return PriorityLevel.critical;
    if (score >= 0.6) return PriorityLevel.high;
    if (score >= 0.35) return PriorityLevel.medium;
    return PriorityLevel.low;
  }
}

/// Deterministik ustuvorlik hisobi natijasi.
///
/// Formula (hujjatlashtirilgan):
/// ```
/// score = 0.40 * urgency + 0.30 * importance + 0.20 * recency + 0.10 * context
/// ```
/// Har bir komponent 0..1 oralig'ida. [breakdown] har bir komponentning
/// hissasini ko'rsatadi — UI "Why am I seeing this?" uchun ishlatadi.
class ActionPriority extends Equatable {
  /// Yakuniy ball 0..1.
  final double score;

  /// urgency (0..1) — muddat yaqinligi / kechikish.
  final double urgency;

  /// importance (0..1) — summa, talabalar soni, tizim ta'siri.
  final double importance;

  /// recency (0..1) — qanchalik yaqinda yaratilgan/o'zgargan.
  final double recency;

  /// context (0..1) — joriy kontekstga moslik (rol, sahifa).
  final double context;

  const ActionPriority({
    required this.score,
    required this.urgency,
    required this.importance,
    required this.recency,
    required this.context,
  });

  PriorityLevel get level => PriorityLevel.fromScore(score);

  /// Har bir komponent hissasi (0..1) — deterministik va testlanadigan.
  Map<String, double> get breakdown => {
        'urgency': urgency,
        'importance': importance,
        'recency': recency,
        'context': context,
      };

  @override
  List<Object?> get props =>
      [score, urgency, importance, recency, context];
}

/// Bitta tavsiyaning manba havolasi — "Nega buni ko'ryapman?" savoliga
/// javob berish uchun real ma'lumotga bog'lanadi.
///
/// [kind] — manba turi (debt, student, attendance, sync, ...).
/// [reference] — real yozuv ID'si (masalan debtId, identityId).
/// [detail] — inson o'qiydigan izoh (masalan "12 000 so'm qoldiq").
class RecommendationSource extends Equatable {
  final String kind;
  final String? reference;
  final String detail;

  const RecommendationSource({
    required this.kind,
    this.reference,
    required this.detail,
  });

  @override
  List<Object?> get props => [kind, reference, detail];
}

/// Bitta tavsiya (recommendation).
///
/// Tavsiyalar FAQAT real ma'lumotdan keladi — [sources] har doim to'ldiriladi.
/// Hech qachon taxminiy/fake insight yaratilmaydi.
class Recommendation extends Equatable {
  /// Yagona ID (deterministik: manba turi + reference).
  final String id;

  /// Tavsiya sarlavhasi — amal (masalan "To'lovni qayd etish").
  final String title;

  /// Amal tavsifi — nima va nima uchun.
  final String description;

  /// Ikonka kaliti (presentation moslashtiradi).
  final String iconKey;

  /// Amal bajariladigan marshrut.
  final String route;

  /// Shell branch'iga go() kerakmi.
  final bool isBranchGo;

  /// Deterministik ustuvorlik.
  final ActionPriority priority;

  /// Real ma'lumot manbalari — "Nega?" uchun.
  final List<RecommendationSource> sources;

  const Recommendation({
    required this.id,
    required this.title,
    required this.description,
    required this.iconKey,
    required this.route,
    required this.priority,
    required this.sources,
    this.isBranchGo = false,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        description,
        iconKey,
        route,
        isBranchGo,
        priority,
        sources,
      ];
}
