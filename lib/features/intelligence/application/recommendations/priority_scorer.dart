import '../../domain/entities/action_priority.dart';

/// Deterministik ustuvorlik hisoblagichi.
///
/// Formula (hujjatlashtirilgan, spec §2):
/// ```
/// score = 0.40 * urgency + 0.30 * importance + 0.20 * recency + 0.10 * context
/// ```
///
/// Har bir komponent 0..1 oralig'ida. Hech qanday tasodifiy son yo'q —
/// bir xil kirish har doim bir xil natija beradi (testlanadigan).
class PriorityScorer {
  const PriorityScorer();

  static const double urgencyWeight = 0.40;
  static const double importanceWeight = 0.30;
  static const double recencyWeight = 0.20;
  static const double contextWeight = 0.10;

  /// Kiritilgan komponentlardan ustuvorlikni hisoblaydi.
  ///
  /// [urgency] — muddat yaqinligi/kechikish (0..1).
  /// [importance] — summa/son/tizim ta'siri (0..1).
  /// [recency] — yaqinlik (0..1).
  /// [context] — kontekst mosligi (0..1).
  ActionPriority score({
    required double urgency,
    required double importance,
    required double recency,
    required double context,
  }) {
    final clamped = (
      urgency: urgency.clamp(0.0, 1.0),
      importance: importance.clamp(0.0, 1.0),
      recency: recency.clamp(0.0, 1.0),
      context: context.clamp(0.0, 1.0),
    );
    final score = (urgencyWeight * clamped.urgency) +
        (importanceWeight * clamped.importance) +
        (recencyWeight * clamped.recency) +
        (contextWeight * clamped.context);

    return ActionPriority(
      score: score.clamp(0.0, 1.0),
      urgency: clamped.urgency,
      importance: clamped.importance,
      recency: clamped.recency,
      context: clamped.context,
    );
  }

  /// Muddat o'tganlik asosidagi urgency (0..1).
  ///
  /// - kechikish <= 0 kun → 0.2 (yaqinlashmoqda)
  /// - kechikish 1..3 kun → 0.6
  /// - kechikish 4+ kun → 1.0
  static double urgencyFromDaysOverdue(int daysOverdue) {
    if (daysOverdue <= 0) return 0.2;
    if (daysOverdue <= 3) return 0.6;
    return 1.0;
  }

  /// Yaqinlik asosidagi recency (0..1) — eksponensial pasayish.
  ///
  /// 0 kun → 1.0, 7 kun → ~0.5, 30 kun → ~0.1
  static double recencyFromAgeDays(double ageDays) {
    if (ageDays < 0) return 1.0;
    return (1.0 / (1.0 + ageDays / 7.0)).clamp(0.0, 1.0);
  }
}
