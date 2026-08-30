import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../providers/dashboard_stats_provider.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// BUGUNGI HOLAT (P2, spec §14 / §17 / §18)
///
/// Home'dagi "Bugungi holat" bloki — REAL bazadan:
/// - Bugungi darslar soni (todayScheduleProvider)
/// - Bugungi davomat taqsimoti: Present / Late / Absent / Excused
///   (todayAttendanceBreakdownProvider — real yozuvlar)
/// - Faol dars bo'lsa: dars kartasi + "Davomatni boshlash" CTA
///
/// Fake counter yo'q — bo'sh ma'lumot 0 sifatida ko'rsatiladi.
/// ═══════════════════════════════════════════════════════════════════════
class TodayOverviewSection extends ConsumerWidget {
  const TodayOverviewSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(todayScheduleProvider);
    final breakdownAsync = ref.watch(todayAttendanceBreakdownProvider);
    // Yagona faol dars manbai: attendance/face/QR bilan BIR XIL provider
    // (P1 — activeLessonProvider). CTA shu darsga olib boradi.
    final activeLessonAsync = ref.watch(activeLessonProvider);
    final activeLesson = activeLessonAsync.valueOrNull;

    return AppSurface.glass(
      elevation: 1,
      padding: const EdgeInsets.all(20),
      borderRadius: DsRadius.lg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.today_rounded,
                size: 20,
                color: context.dsColors.accent,
              ),
              const SizedBox(width: 8),
              Text(
                'Bugungi holat',
                style: DsType.h3(
                  color: context.dsColors.textPrimary,
                ),
              ),
              const Spacer(),
              // Faol dars indikatori (real activeLessonProvider).
              if (activeLesson != null) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: context.dsColors.success,
                    boxShadow: [
                      BoxShadow(
                        color: context.dsColors.success
                            .withValues(alpha: 0.5),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'Faol dars',
                  style: DsType.label(
                    color: context.dsColors.success,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          // ── Birinchi qator: bugungi darslar + davomat soni ───────────
          schedulesAsync.when(
            loading: () => const _OverviewSkeleton(),
            error: (e, _) => _OverviewError(message: '$e'),
            data: (schedules) {
              final todays = schedules
                  .where((s) => s.status != ScheduleStatus.cancelled)
                  .toList();

              return breakdownAsync.when(
                loading: () => const _OverviewSkeleton(),
                error: (e, _) => _OverviewError(message: '$e'),
                data: (breakdown) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _OverviewStat(
                            icon: Icons.calendar_month_outlined,
                            label: "Bugungi darslar",
                            value: '${todays.length}',
                            color: context.dsColors.accent,
                          ),
                          const SizedBox(width: 12),
                          _OverviewStat(
                            icon: Icons.how_to_reg_rounded,
                            label: 'Belgilangan',
                            value: '${breakdown.total}',
                            color: context.dsColors.success,
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      // ── Davomat taqsimoti (real statuslar) ───────────
                      Text(
                        'Davomat taqsimoti',
                        style: DsType.label(
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (!breakdown.hasEntries)
                        _OverviewEmptyAttendance()
                      else ...[
                        _AttendanceSegmentBar(breakdown: breakdown),
                        const SizedBox(height: 14),
                        _AttendanceLegend(breakdown: breakdown),
                      ],
                      // ── Faol dars CTA (yagona activeLessonProvider) ──
                      if (activeLesson != null) ...[
                        const SizedBox(height: 18),
                        _ActiveLessonCard(
                          lessonId: activeLesson.lessonId,
                          title:
                              activeLesson.subject ?? activeLesson.groupName ??
                              activeLesson.groupId,
                          subtitle: [
                            activeLesson.groupName ?? activeLesson.groupId,
                            activeLesson.teacherName ?? '',
                            activeLesson.roomName ?? '',
                            '${activeLesson.startTime} – ${activeLesson.endTime}',
                          ].where((s) => s.isNotEmpty).join(' • '),
                          onStart: () => context.push('/attendance'),
                        ),
                      ],
                    ],
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }

}

/// Bitta katta stat: icon + qiymat + label.
class _OverviewStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _OverviewStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(DsRadius.md),
          border: Border.all(color: color.withValues(alpha: 0.18)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: DsType.statValue(color: colors.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(
                      color: colors.textSecondary,
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
}

/// Present/Late/Absent/Excused — rangli segment chizig'i (real ulushlar).
class _AttendanceSegmentBar extends StatelessWidget {
  final TodayAttendanceBreakdown breakdown;

  const _AttendanceSegmentBar({required this.breakdown});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final segments = [
      (breakdown.presentRatio, colors.success),
      (breakdown.lateRatio, colors.warning),
      (breakdown.absentRatio, colors.error),
      (breakdown.excusedRatio, colors.info),
    ];

    return ClipRRect(
      borderRadius: BorderRadius.circular(DsRadius.full),
      child: SizedBox(
        height: 10,
        child: Row(
          children: [
            for (final (ratio, color) in segments)
              if (ratio > 0)
                Expanded(
                  // flex >= 1 — juda kichik ulush (ratio>0) ham nol-kenglik
                  // flex'ga aylanib segment yo'qolmasin (review P2 #3).
                  flex: (ratio * 1000).round().clamp(1, 1000),
                  child: Container(color: color),
                ),
          ],
        ),
      ),
    );
  }
}

/// Taqsimot legendasi — har status + son.
class _AttendanceLegend extends StatelessWidget {
  final TodayAttendanceBreakdown breakdown;

  const _AttendanceLegend({required this.breakdown});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final items = [
      ('Qatnashdi', breakdown.present, colors.success),
      ('Kechikkan', breakdown.late, colors.warning),
      ("Kelmagan", breakdown.absent, colors.error),
      ('Sababli', breakdown.excused, colors.info),
    ];

    return Wrap(
      spacing: 14,
      runSpacing: 8,
      children: [
        for (final (label, count, color) in items)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                '$label • $count',
                style: DsType.caption(color: colors.textSecondary),
              ),
            ],
          ),
      ],
    );
  }
}

/// Faol dars kartasi — "Davomatni boshlash" CTA bilan.
///
/// `activeLessonProvider` dan kelgan LessonInstance ma'lumotlarini
/// ko'rsatadi (attendance sahifasi bilan bir xil manba).
class _ActiveLessonCard extends StatelessWidget {
  final String lessonId;
  final String title;
  final String subtitle;
  final VoidCallback onStart;

  const _ActiveLessonCard({
    required this.lessonId,
    required this.title,
    required this.subtitle,
    required this.onStart,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Semantics(
      container: true,
      label: 'Faol dars: $title — $subtitle',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colors.accent.withValues(alpha: 0.14),
              colors.accent.withValues(alpha: 0.08),
            ],
          ),
          borderRadius: BorderRadius.circular(DsRadius.md),
          border:
              Border.all(color: colors.accent.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    gradient: colors.accentGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    size: 20,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.bodyStrong(
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.caption(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onStart,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(DsRadius.md),
                  ),
                ),
                icon: const Icon(Icons.how_to_reg_rounded, size: 18),
                label: const Text('Davomatni boshlash'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bugun hali davomat belgilanmagan — real empty state (0 emas, fake emas).
class _OverviewEmptyAttendance extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.divider.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(DsRadius.md),
      ),
      child: Row(
        children: [
          Icon(Icons.event_busy_outlined, size: 20, color: colors.textTertiary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Bugun hali davomat belgilanmagan',
              style: DsType.body(color: colors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _OverviewSkeleton extends StatelessWidget {
  const _OverviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: const [
        LoadingShimmer(height: 60),
        SizedBox(height: 12),
        LoadingShimmer(height: 14),
        SizedBox(height: 8),
        LoadingShimmer(height: 14),
      ],
    );
  }
}

class _OverviewError extends StatelessWidget {
  final String message;

  const _OverviewError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Text(
      'Ma\'lumotlar yuklanmadi: $message',
      style: DsType.caption(
        color: context.dsColors.error,
      ),
    );
  }
}
