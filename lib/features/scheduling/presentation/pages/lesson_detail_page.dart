import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_status_chip.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../application/services/lesson_instance_service.dart';
import '../../domain/entities/schedule.dart';
import '../providers/schedule_providers.dart';

/// Dars tafsiloti (spec SCREEN 17).
///
/// Fan, guruh, o'qituvchi, xona, sana, vaqt va dars holati. Agar dars
/// bugungi kunga to'g'ri kelsa — real davomat xulosasi ham ko'rsatiladi.
/// Tezkor amallar: davomat belgilash (→ Attendance) va jadvalda ochish.
class LessonDetailPage extends ConsumerWidget {
  final String scheduleId;

  const LessonDetailPage({super.key, required this.scheduleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheduleAsync = ref.watch(scheduleDetailProvider(scheduleId));

    return Scaffold(
      appBar: AppBar(title: Text('Dars tafsiloti')),
      body: scheduleAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _LessonError(
          message: 'Ma\'lumotlarni yuklashda xatolik yuz berdi.',
          detail: '$e',
        ),
        data: (schedule) {
          if (schedule == null) {
            return const _LessonError(
              message: 'Dars topilmadi.',
              detail: 'Jadval o\'chirilgan yoki mavjud emas.',
            );
          }
          return _LessonDetailBody(schedule: schedule);
        },
      ),
    );
  }
}

class _LessonDetailBody extends ConsumerWidget {
  final Schedule schedule;

  const _LessonDetailBody({required this.schedule});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = LessonInstanceService.coversDate(schedule, today);
    final instance =
        LessonInstanceService.instanceFor(schedule, today);

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        _LessonHeaderCard(schedule: schedule, isToday: isToday),
        SizedBox(height: 16),
        _LessonInfoCard(schedule: schedule),
        if (isToday && instance != null) ...[
          SizedBox(height: 16),
          _TodayAttendanceCard(lessonId: instance.lessonId),
        ],
        SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () {
                  AppHaptics.tap();
                  context.go('/attendance');
                },
                icon: Icon(Icons.how_to_reg_outlined),
                label: Text('Davomat belgilash'),
                style: FilledButton.styleFrom(
                  backgroundColor: context.dsColors.accent,
                  padding: EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  AppHaptics.tap();
                  context.go('/schedule');
                },
                icon: Icon(Icons.calendar_month_outlined),
                label: Text('Jadvalda ochish'),
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Dars sarlavhasi: fan + holat.
class _LessonHeaderCard extends StatelessWidget {
  final Schedule schedule;
  final bool isToday;

  const _LessonHeaderCard({required this.schedule, required this.isToday});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final status = _lessonStatus(schedule);

    return Container(
      padding: EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colors.surface,
        border: Border.all(
          color: status.tone == AppStatusTone.error
              ? context.dsColors.error.withValues(alpha: 0.4)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: status.tone == AppStatusTone.error ? 1.2 : 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.divider.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -6,
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: context.dsColors.accentGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.school_outlined,
                color: Colors.white, size: 26),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  schedule.subject ?? 'Dars',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  '${schedule.timeRange} • ${schedule.dayName}',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.accent,
                  ),
                ),
              ],
            ),
          ),
          AppStatusChip(tone: status.tone, icon: status.icon, label: status.label),
        ],
      ),
    );
  }

  ({AppStatusTone tone, IconData icon, String label}) _lessonStatus(
    Schedule schedule,
  ) {
    if (schedule.status == ScheduleStatus.cancelled) {
      return (
        tone: AppStatusTone.error,
        icon: Icons.cancel_outlined,
        label: 'Bekor qilingan',
      );
    }
    final now = DateTime.now();
    final nowMinutes = now.hour * 60 + now.minute;
    final start = _toMinutes(schedule.startTime);
    final end = _toMinutes(schedule.endTime);
    if (nowMinutes >= start && nowMinutes < end) {
      return (
        tone: AppStatusTone.success,
        icon: Icons.play_circle_outline,
        label: 'Jarayonda',
      );
    }
    if (nowMinutes < start) {
      return (
        tone: AppStatusTone.info,
        icon: Icons.schedule,
        label: 'Rejalashtirilgan',
      );
    }
    return (
      tone: AppStatusTone.neutral,
      icon: Icons.check_circle_outline,
      label: 'Tugagan',
    );
  }

  int _toMinutes(String time) {
    final parts = time.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }
}

/// Guruh, o'qituvchi, xona, sana qatorlari.
class _LessonInfoCard extends StatelessWidget {
  final Schedule schedule;

  const _LessonInfoCard({required this.schedule});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateText = LessonInstanceService.coversDate(schedule, today)
        ? 'Bugun (${_fmtDate(today)})'
        : schedule.specificDate != null
            ? _fmtDate(schedule.specificDate!)
            : 'Har ${schedule.dayName}';

    return Container(
      padding: EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        children: [
          _InfoLine(
            icon: Icons.groups_outlined,
            label: 'Guruh',
            value: schedule.groupName ?? schedule.groupId,
          ),
          SizedBox(height: 12),
          _InfoLine(
            icon: Icons.person_outline,
            label: "O'qituvchi",
            value: schedule.teacherName ?? schedule.teacherId,
          ),
          SizedBox(height: 12),
          _InfoLine(
            icon: Icons.meeting_room_outlined,
            label: 'Xona',
            value: schedule.roomName ?? schedule.roomId,
          ),
          SizedBox(height: 12),
          _InfoLine(
            icon: Icons.event_outlined,
            label: 'Sana',
            value: dateText,
          ),
          SizedBox(height: 12),
          _InfoLine(
            icon: Icons.schedule,
            label: 'Vaqt',
            value: schedule.timeRange,
          ),
          SizedBox(height: 12),
          _InfoLine(
            icon: Icons.timelapse_outlined,
            label: 'Davomiyligi',
            value: '${schedule.durationMinutes} daqiqa',
          ),
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoLine({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: context.dsColors.accent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: context.dsColors.accent),
        ),
        SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(fontSize: 13, color: colors.textSecondary),
        ),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }
}

/// Bugungi dars uchun real davomat xulosasi (spec SCREEN 17).
class _TodayAttendanceCard extends ConsumerWidget {
  final String lessonId;

  const _TodayAttendanceCard({required this.lessonId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(lessonAttendanceProvider(lessonId));
    final colors = context.dsColors;

    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: colors.surfaceOverlay,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.how_to_reg_outlined,
                  size: 16, color: context.dsColors.success),
              SizedBox(width: 8),
              Text(
                'Bugungi davomat',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          entriesAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (e, _) => Text(
              'Davomatni yuklashda xatolik yuz berdi.',
              style: TextStyle(fontSize: 12.5, color: context.dsColors.error),
            ),
            data: (entries) {
              if (entries.isEmpty) {
                return Text(
                  'Bu dars uchun hali davomat belgilanmagan.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: colors.textSecondary,
                  ),
                );
              }
              final present = entries
                  .where((e) => e.status == 'present' || e.status == 'late')
                  .length;
              final late = entries.where((e) => e.status == 'late').length;
              return Wrap(
                spacing: 18,
                runSpacing: 8,
                children: [
                  _MiniStat(
                    label: 'Qatnashdi',
                    value: '$present',
                    color: context.dsColors.success,
                  ),
                  _MiniStat(
                    label: 'Kechikkan',
                    value: '$late',
                    color: context.dsColors.warning,
                  ),
                  _MiniStat(
                    label: 'Jami yozuv',
                    value: '${entries.length}',
                    color: context.dsColors.accent,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: context.dsColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _LessonError extends StatelessWidget {
  final String message;
  final String detail;

  const _LessonError({required this.message, required this.detail});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 52, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              message,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 6),
            Text(
              detail,
              style: TextStyle(
                fontSize: 12,
                color: context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

String _fmtDate(DateTime d) =>
    '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';
