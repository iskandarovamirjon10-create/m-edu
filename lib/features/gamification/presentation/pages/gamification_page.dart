import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../domain/entities/gamification_profile.dart';
import '../providers/gamification_providers.dart';

/// O'yinlashtirish sahifasi — real faoliyatdan hisoblangan ball, daraja
/// va yutuqlar. Liquid glass dizayni (V2 design system).
class GamificationPage extends ConsumerWidget {
  const GamificationPage({super.key});

  static const Map<String, IconData> _achievementIcons = {
    'walk': Icons.directions_walk,
    'groups': Icons.groups,
    'school': Icons.school,
    'event': Icons.event_available,
    'face': Icons.face_retouching_natural,
    'savings': Icons.savings,
    'verified': Icons.verified,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(gamificationProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('O\'yinlashtirish'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      extendBodyBehindAppBar: true,
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Hisoblashda xatolik: $e',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
        data: (profile) => CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHeader(context, profile)),
            SliverToBoxAdapter(child: _buildStats(context, profile)),
            SliverToBoxAdapter(child: _buildAchievements(context, profile)),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  // ─── Daraja ring + ball ────────────────────────────────────────────────
  Widget _buildHeader(BuildContext context, GamificationProfile p) {
    final next = p.nextLevelPoints;
    final nextLabel = next == null
        ? 'Maksimal daraja'
        : 'Keyingi daraja: $next ball';

    return SafeArea(
      bottom: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [context.dsColors.accent, context.dsColors.info],
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.accent.withValues(alpha: 0.35),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            // Progress ring
            SizedBox(
              width: 92,
              height: 92,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 92,
                    height: 92,
                    child: CircularProgressIndicator(
                      value: p.levelProgress,
                      strokeWidth: 8,
                      strokeCap: StrokeCap.round,
                      backgroundColor: Colors.white.withValues(alpha: 0.25),
                      color: Colors.white,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${p.level}',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          height: 1.0,
                        ),
                      ),
                      const Text(
                        'DARaja',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.rankTitle,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.bolt, color: Colors.white, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        '${p.points} ball',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    nextLabel,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Statistikalar ────────────────────────────────────────────────────
  Widget _buildStats(BuildContext context, GamificationProfile p) {
    final stats = [
      (Icons.event_available, 'Kelgan', '${p.presentCount}'),
      (Icons.alarm, 'Kechikkan', '${p.lateCount}'),
      (Icons.face_retouching_natural, 'Yuz orqali', '${p.faceCount}'),
      (Icons.savings, "Yig'ilgan", _sum(p.totalCollected)),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? context.dsColors.surface
            : context.dsColors.card,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          for (final (i, (icon, label, value)) in stats.indexed) ...[
            if (i > 0)
              Container(
                width: 1,
                height: 36,
                color: Theme.of(context).dividerColor.withValues(alpha: 0.4),
              ),
            Expanded(
              child: Column(
                children: [
                  Icon(icon,
                      color: context.dsColors.accent,
                      size: 22),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).hintColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─── Yutuqlar ─────────────────────────────────────────────────────────
  Widget _buildAchievements(BuildContext context, GamificationProfile p) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Yutuqlar',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              Text(
                '${p.unlockedAchievements}/${p.achievements.length}',
                style: TextStyle(
                  color: context.dsColors.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 1.35,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: p.achievements.length,
            itemBuilder: (context, index) =>
                _AchievementCard(achievement: p.achievements[index]),
          ),
        ],
      ),
    );
  }

  static String _sum(int amount) {
    final s = amount.toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]} ');
    return '$s so\'m';
  }
}

class _AchievementCard extends StatelessWidget {
  final GamificationAchievement achievement;

  const _AchievementCard({required this.achievement});

  @override
  Widget build(BuildContext context) {
    final unlocked = achievement.isUnlocked;
    final icon = GamificationPage._achievementIcons[achievement.iconKey] ??
        Icons.emoji_events;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: unlocked
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFFD58A), Color(0xFFFF9ECF)],
              )
            : null,
        color: unlocked
            ? null
            : Theme.of(context).brightness == Brightness.dark
                ? context.dsColors.surface
                : context.dsColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: unlocked
              ? context.dsColors.warning
              : Theme.of(context).dividerColor.withValues(alpha: 0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: unlocked
                ? context.dsColors.warning.withValues(alpha: 0.3)
                : context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: unlocked
                      ? Colors.white.withValues(alpha: 0.35)
                      : Theme.of(context).disabledColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: unlocked ? Colors.white : Theme.of(context).disabledColor,
                ),
              ),
              const Spacer(),
              if (unlocked)
                const Icon(Icons.verified, color: Colors.white, size: 18)
              else
                Icon(
                  Icons.lock_outline,
                  size: 16,
                  color: Theme.of(context).disabledColor,
                ),
            ],
          ),
          const Spacer(),
          Text(
            achievement.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: unlocked ? Colors.white : null,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            achievement.description,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              color: unlocked
                  ? Colors.white.withValues(alpha: 0.85)
                  : Theme.of(context).hintColor,
            ),
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: achievement.progressRatio,
              minHeight: 4,
              backgroundColor: unlocked
                  ? Colors.white.withValues(alpha: 0.3)
                  : Theme.of(context).dividerColor.withValues(alpha: 0.4),
              color: unlocked ? Colors.white : context.dsColors.accent,
            ),
          ),
        ],
      ),
    );
  }
}
