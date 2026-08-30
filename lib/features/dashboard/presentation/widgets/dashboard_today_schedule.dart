import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// BUGUNGI JADVAL (Section 2 — "Ikki ustunli pastki blok")
///
/// Timeline ko'rinishida: vertikal chiziq, har bir dars nuqta + vaqt.
/// Hozirgi vaqt chizig'i (qizil accent) bilan — jonli.
/// ═══════════════════════════════════════════════════════════════════════
class TodayScheduleTimeline extends ConsumerWidget {
  const TodayScheduleTimeline({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(todayScheduleProvider);

    return AppSurface.glass(
      elevation: 1,
      padding: const EdgeInsets.all(20),
      borderRadius: DsRadius.lg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Bugungi jadval",
                style: DsType.h3(
                  color: context.dsColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () => context.push('/schedule'),
                child: const Text('Jadval'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          schedulesAsync.when(
            loading: () => const _TimelineSkeleton(),
            error: (e, _) => _TimelineError(message: '$e'),
            data: (schedules) {
              final today = DayOfWeek.values[DateTime.now().weekday - 1];
              final todays = schedules
                  .where((s) => s.dayOfWeek == today)
                  .toList()
                ..sort((a, b) =>
                    _toMinutes(a.startTime).compareTo(_toMinutes(b.startTime)));

              if (todays.isEmpty) {
                return _TimelineEmpty(
                  icon: Icons.event_busy_outlined,
                  title: 'Bugun darslar rejalashtirilmagan',
                );
              }
              return _ScheduleTimeline(lessons: todays);
            },
          ),
        ],
      ),
    );
  }
}

class _ScheduleTimeline extends StatefulWidget {
  final List<Schedule> lessons;

  const _ScheduleTimeline({required this.lessons});

  @override
  State<_ScheduleTimeline> createState() => _ScheduleTimelineState();
}

class _ScheduleTimelineState extends State<_ScheduleTimeline> {
  late DateTime _now;
  Timer? _nowTimer;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    // Hozirgi vaqt chizig'i har daqiqada yangilanadi (jonli indikator).
    _nowTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _nowTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nowMinutes = _now.hour * 60 + _now.minute;

    // Hozirgi vaqt indikatori: davom etayotgan dars accent nuqta + glow
    // bilan ta'kidlanadi (jonli — har daqiqada yangilanadi).
    return Column(
      children: [
        for (var i = 0; i < widget.lessons.length; i++)
          _LessonTimelineRow(
            lesson: widget.lessons[i],
            isLast: i == widget.lessons.length - 1,
            isNow: nowMinutes >= _toMinutes(widget.lessons[i].startTime) &&
                nowMinutes <= _toMinutes(widget.lessons[i].endTime),
          ),
      ],
    );
  }
}

class _LessonTimelineRow extends StatelessWidget {
  final Schedule lesson;
  final bool isLast;
  final bool isNow;

  const _LessonTimelineRow({
    required this.lesson,
    required this.isLast,
    required this.isNow,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final title = lesson.subject ?? lesson.groupName ?? lesson.groupId;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Vaqt.
          SizedBox(
            width: 52,
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                lesson.startTime,
                style: DsType.label(
                  color: isNow ? colors.accent : colors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Chiziq + nuqta.
          SizedBox(
            width: 18,
            child: Column(
              children: [
                Container(
                  width: 11,
                  height: 11,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isNow ? colors.accent : colors.surface,
                    border: Border.all(
                      color: isNow ? colors.accent : colors.dividerStrong,
                      width: 2,
                    ),
                    boxShadow: isNow
                        ? [
                            BoxShadow(
                              color: colors.accent.withValues(alpha: 0.4),
                              blurRadius: 8,
                            ),
                          ]
                        : null,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      margin: const EdgeInsets.symmetric(vertical: 3),
                      color: colors.divider,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Dars ma'lumoti.
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
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
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (lesson.teacherName != null) lesson.teacherName!,
                      if (lesson.roomName != null) lesson.roomName!,
                      lesson.endTime,
                    ].join(' • '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineSkeleton extends StatelessWidget {
  const _TimelineSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: const [
        LoadingShimmer(height: 14),
        SizedBox(height: 14),
        LoadingShimmer(height: 14),
        SizedBox(height: 14),
        LoadingShimmer(height: 14, width: 180),
      ],
    );
  }
}

class _TimelineEmpty extends StatelessWidget {
  final IconData icon;
  final String title;

  const _TimelineEmpty({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Icon(icon, size: 32, color: colors.textTertiary),
          const SizedBox(height: 10),
          Text(
            title,
            style: DsType.body(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _TimelineError extends StatelessWidget {
  final String message;

  const _TimelineError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        'Xato: $message',
        style: DsType.caption(
          color: context.dsColors.error,
        ),
      ),
    );
  }
}

int _toMinutes(String time) {
  final parts = time.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}
