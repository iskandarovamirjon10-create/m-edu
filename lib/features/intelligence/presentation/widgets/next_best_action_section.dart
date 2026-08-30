import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../domain/entities/action_priority.dart';
import '../providers/intelligence_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// NEXT BEST ACTION (spec §3, §9, §23-24)
///
/// REAL ma'lumotdan keladigan tavsiyalar — hech qanday fake insight yo'q.
/// Har bir tavsiya [Recommendation.sources] orqali real yozuvga bog'lanadi:
/// - "Why am I seeing this?" — kengaytirilganda manbalar ko'rinadi.
/// - Tavsiya ustuvorligi — deterministik [PriorityScorer] natijasi.
///
/// Bo'sh bo'lsa — blok ko'rsatilmaydi (foydalanuvchini ortiqcha yuklamaymiz).
/// ═══════════════════════════════════════════════════════════════════════
class NextBestActionSection extends ConsumerWidget {
  const NextBestActionSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recommendationsAsync = ref.watch(nextBestActionsProvider);

    return recommendationsAsync.when(
      loading: () => const _NbaSkeleton(),
      error: (e, _) => const SizedBox.shrink(),
      data: (recommendations) {
        // Faqat haqiqiy, real ma'lumotga asoslangan tavsiyalar.
        if (recommendations.isEmpty) return const SizedBox.shrink();
        // Ko'pi bilan 3 ta — ortiq yuk bo'lmasin (cognitive load).
        final top = recommendations.take(3).toList();

        return AppSurface.glass(
          elevation: 1,
          padding: const EdgeInsets.all(16),
          borderRadius: DsRadius.lg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.auto_awesome_rounded,
                    size: 18,
                    color: context.dsColors.accent,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Keyingi qadam',
                    style: DsType.h3(
                      color: context.dsColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Real ma\'lumot asosida',
                    style: DsType.caption(
                      color: context.dsColors.textTertiary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (var i = 0; i < top.length; i++) ...[
                _RecommendationRow(recommendation: top[i]),
                if (i != top.length - 1)
                  Divider(
                    height: 1,
                    color: context.dsColors.divider
                        .withValues(alpha: 0.4),
                  ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Bitta tavsiya qatori — priority chip + "Nega?" kengaytmasi.
class _RecommendationRow extends StatelessWidget {
  final Recommendation recommendation;

  const _RecommendationRow({required this.recommendation});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final priority = recommendation.priority;
    final sources = recommendation.sources;

    return Column(
      children: [
        InkWell(
          onTap: () {
            if (recommendation.route.isNotEmpty) {
              if (recommendation.isBranchGo) {
                context.go(recommendation.route);
              } else {
                context.push(recommendation.route);
              }
            }
          },
          borderRadius: BorderRadius.circular(DsRadius.sm),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: colors.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _iconFor(recommendation.iconKey),
                    size: 19,
                    color: colors.accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        recommendation.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.bodyStrong(
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        recommendation.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.caption(
                          color: colors.textSecondary,
                        ),
                      ),
                      // "Why am I seeing this?" — manbalar (real ma'lumot).
                      if (sources.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Nega? ${sources.map((s) => s.detail).join(' • ')}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: DsType.caption(
                            color: colors.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _PriorityBadge(priority: priority),
                const SizedBox(width: 4),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: colors.textTertiary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  IconData _iconFor(String key) {
    return switch (key) {
      'payment' => Icons.payments_outlined,
      'student' => Icons.school_outlined,
      'profile' => Icons.badge_outlined,
      'attendance' => Icons.how_to_reg_rounded,
      'sync' => Icons.sync_rounded,
      'debt' => Icons.warning_amber_rounded,
      _ => Icons.auto_awesome_rounded,
    };
  }
}

/// Priority chip — daraja + ball.
class _PriorityBadge extends StatelessWidget {
  final ActionPriority priority;

  const _PriorityBadge({required this.priority});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final (label, color) = switch (priority.level) {
      PriorityLevel.critical => ('Muhim', colors.error),
      PriorityLevel.high => ('Yuqori', colors.warning),
      PriorityLevel.medium => ("O'rta", colors.info),
      PriorityLevel.low => ('Past', colors.textTertiary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(DsRadius.full),
      ),
      child: Text(
        label,
        style: DsType.caption(color: color),
      ),
    );
  }
}

class _NbaSkeleton extends StatelessWidget {
  const _NbaSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: const [
        LoadingShimmer(height: 14, width: 120),
        SizedBox(height: 10),
        LoadingShimmer(height: 46),
        SizedBox(height: 8),
        LoadingShimmer(height: 46),
      ],
    );
  }
}
