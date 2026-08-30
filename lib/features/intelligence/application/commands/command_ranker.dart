import '../../domain/entities/command.dart';

/// Bitta reytinq natijasi.
class RankedCommand {
  final CommandAction command;
  final double score;

  /// Qaysi omil qancha ball bergani (transparency — UI "why" ko'rsatishi
  /// mumkin). Kalit: exact | prefix | keyword | context | recency | priority.
  final Map<String, double> breakdown;

  const RankedCommand({
    required this.command,
    required this.score,
    required this.breakdown,
  });
}

/// Deterministik buyruq reytinq dvigateli.
///
/// Reyting omillari (ustunlik tartibida):
/// 1. exact match (title == query)             → +100
/// 2. prefix match (title startsWith query)    → +60
/// 3. keyword match (keywords ichida)          → +45
/// 4. substring match (title contains query)   → +25
/// 5. contextual relevance (category ↔ joriy sahifa) → +10
/// 6. recency (yaqinda ishlatilgan)            → +8
/// 7. base priority (0..10)                    → +basePriority
///
/// Tasodifiylik YO'Q — bir xil kirish har doim bir xil natija.
class CommandRanker {
  const CommandRanker();

  /// Joriy sahifa (route) → kategoriya mosligi uchun.
  /// Masalan '/students' → students kategoriyasi ustunroq.
  static CommandCategory? categoryForRoute(String? route) {
    if (route == null) return null;
    if (route.startsWith('/students') ||
        route.startsWith('/identity') ||
        route.startsWith('/teachers')) {
      return CommandCategory.students;
    }
    if (route.startsWith('/attendance')) return CommandCategory.attendance;
    if (route.startsWith('/finance') || route.startsWith('/payments')) {
      return CommandCategory.payments;
    }
    if (route.startsWith('/reports')) return CommandCategory.reports;
    if (route.startsWith('/settings')) return CommandCategory.system;
    return null;
  }

  /// [query] bo'yicha buyruqlarni reytiplaydi (pasayish tartibida).
  ///
  /// [recentlyUsedIds] — yaqinda ishlatilgan buyruq ID'lari (recency bonus).
  /// [currentRoute] — joriy sahifa (contextual relevance).
  List<RankedCommand> rank({
    required String query,
    required List<CommandAction> commands,
    Set<String> recentlyUsedIds = const {},
    String? currentRoute,
  }) {
    final normalized = query.trim().toLowerCase();
    final currentCategory = categoryForRoute(currentRoute);

    final results = <RankedCommand>[];
    for (final command in commands) {
      final score = _score(
        command: command,
        query: normalized,
        currentCategory: currentCategory,
        recentlyUsed: recentlyUsedIds.contains(command.id),
      );
      if (score.score > 0) results.add(score);
    }

    // Deterministik tartiblash: score → basePriority → id (tie-break).
    results.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      if (byScore != 0) return byScore;
      final byPriority = b.command.basePriority.compareTo(a.command.basePriority);
      if (byPriority != 0) return byPriority;
      return a.command.id.compareTo(b.command.id);
    });
    return results;
  }

  RankedCommand _score({
    required CommandAction command,
    required String query,
    required CommandCategory? currentCategory,
    required bool recentlyUsed,
  }) {
    final breakdown = <String, double>{};
    if (query.isEmpty) {
      // Bo'sh so'rov — recency + priority asosida (barcha buyruqlar).
      if (recentlyUsed) breakdown['recency'] = 8;
      if (command.basePriority > 0) breakdown['priority'] = command.basePriority.toDouble();
      final total = breakdown.values.fold(0.0, (a, b) => a + b);
      return RankedCommand(
        command: command,
        score: total,
        breakdown: breakdown,
      );
    }

    final title = command.title.toLowerCase();
    final scoreParts = <String, double>{};

    if (title == query) {
      scoreParts['exact'] = 100;
    } else if (title.startsWith(query)) {
      scoreParts['prefix'] = 60;
    } else if (command.keywords.any((k) => k.toLowerCase() == query)) {
      scoreParts['keyword'] = 45;
    } else if (title.contains(query)) {
      scoreParts['substring'] = 25;
    } else if (command.keywords.any((k) => k.toLowerCase().contains(query))) {
      scoreParts['keyword'] = 20;
    } else {
      // Hech qanday moslik yo'q.
      return RankedCommand(
        command: command,
        score: 0,
        breakdown: const {},
      );
    }

    // Contextual relevance: buyruq kategoriyasi joriy sahifaga mos bo'lsa.
    if (currentCategory != null && command.category == currentCategory) {
      scoreParts['context'] = 10;
    }
    if (recentlyUsed) scoreParts['recency'] = 8;
    if (command.basePriority > 0) {
      scoreParts['priority'] = command.basePriority.toDouble();
    }

    final total = scoreParts.values.fold(0.0, (a, b) => a + b);
    return RankedCommand(
      command: command,
      score: total,
      breakdown: scoreParts,
    );
  }
}
