/// ═══════════════════════════════════════════════════════════════════════
/// LEAD SCORE BUCKET (spec CRM §3.3)
///
/// Hot (score ≥ 5), Warm (2-4), Cold (< 2). Bucket score'dan hosil
/// qilinadi — DB'da saqlanmaydi, har doim joriy qiymatdan hisoblanadi.
/// ═══════════════════════════════════════════════════════════════════════
enum LeadScoreBucket {
  hot,
  warm,
  cold;

  /// Score → bucket. Chegaraviy holatlar: aynan 5 → Hot, aynan 2 → Warm.
  static LeadScoreBucket fromScore(int score) {
    if (score >= 5) return LeadScoreBucket.hot;
    if (score >= 2) return LeadScoreBucket.warm;
    return LeadScoreBucket.cold;
  }

  String get label => switch (this) {
        LeadScoreBucket.hot => 'Hot',
        LeadScoreBucket.warm => 'Warm',
        LeadScoreBucket.cold => 'Cold',
      };
}

/// Lead scoring natijasi — [score] + [bucket] juftligi.
///
/// UI'da \"nega bu lead Hot?\" savoliga shaffof javob berish uchun
/// [breakdown] ham olib yuriladi (har bir qoida qancha ball bergani).
class LeadScore {
  final int score;

  /// Qoida nomi → hissa (transparency uchun, spec §1).
  final Map<String, int> breakdown;

  const LeadScore({required this.score, required this.breakdown});

  LeadScoreBucket get bucket => LeadScoreBucket.fromScore(score);

  bool get isHot => bucket == LeadScoreBucket.hot;
  bool get isWarm => bucket == LeadScoreBucket.warm;
  bool get isCold => bucket == LeadScoreBucket.cold;

  /// Inson o'qiy oladigan izoh: \"Ism va telefon: +2, Referral: +2, ...\".
  String describe() {
    final parts = breakdown.entries
        .where((e) => e.value != 0)
        .map((e) => '${e.key}: ${e.value >= 0 ? '+' : ''}${e.value}')
        .toList();
    if (parts.isEmpty) return 'Ball yo\'q — Cold';
    return '${parts.join(', ')} → jami $score';
  }

  @override
  bool operator ==(Object other) =>
      other is LeadScore && other.score == score;

  @override
  int get hashCode => score.hashCode;
}
