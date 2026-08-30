import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../domain/entities/schedule.dart';
import '../providers/schedule_providers.dart';
import '../widgets/add_lesson_sheet.dart';

/// Haftalik jadval sahifasi (spec §6 #19).
///
/// Haftaning har bir kuni uchun darslar ro'yxatini ko'rsatadi.
class SchedulePage extends ConsumerStatefulWidget {
  const SchedulePage({super.key});

  @override
  ConsumerState<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends ConsumerState<SchedulePage> {
  DayOfWeek _selectedDay = DayOfWeek.monday;

  @override
  Widget build(BuildContext context) {
    final weeklyAsync = ref.watch(weeklyScheduleProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dars jadvali'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () =>
            showAddLessonSheet(context, ref, initialDay: _selectedDay),
        backgroundColor: context.dsColors.accent,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Dars qo\'shish',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          // Day selector
          Container(
            height: 80,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: DayOfWeek.values.length,
              itemBuilder: (context, index) {
                final day = DayOfWeek.values[index];
                final isSelected = day == _selectedDay;
                return GestureDetector(
                  onTap: () => setState(() => _selectedDay = day),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 64,
                    margin:
                        const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: isSelected
                          ? context.dsColors.accent
                          : context.dsColors.surface,
                      border: Border.all(
                        color: isSelected
                            ? context.dsColors.accent
                            : context.dsColors.border.withValues(alpha: 0.5),
                        width: isSelected ? 2 : 0.8,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _dayShortName(day),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isSelected
                                ? Colors.white
                                : context.dsColors.textSecondary,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          _dayNumber(day),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? Colors.white
                                : context.dsColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          // Schedule list
          Expanded(
            child: weeklyAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('Xato: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (weeklySchedule) {
                final daySchedule = weeklySchedule[_selectedDay] ?? [];
                if (daySchedule.isEmpty) {
                  return _EmptyDay(day: _selectedDay);
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: daySchedule.length,
                  itemBuilder: (context, index) => _ScheduleCard(
                    schedule: daySchedule[index],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _dayShortName(DayOfWeek day) {
    return switch (day) {
      DayOfWeek.monday => 'Du',
      DayOfWeek.tuesday => 'Se',
      DayOfWeek.wednesday => 'Ch',
      DayOfWeek.thursday => 'Pa',
      DayOfWeek.friday => 'Ju',
      DayOfWeek.saturday => 'Sh',
      DayOfWeek.sunday => 'Ya',
    };
  }

  String _dayNumber(DayOfWeek day) {
    final now = DateTime.now();
    final monday = now.subtract(Duration(days: now.weekday - 1));
    final dayDate = monday.add(Duration(days: day.index));
    return '${dayDate.day}';
  }
}

class _ScheduleCard extends StatelessWidget {
  final Schedule schedule;

  const _ScheduleCard({required this.schedule});

  @override
  Widget build(BuildContext context) {
    final isCancelled = schedule.status == ScheduleStatus.cancelled;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: isCancelled
            ? context.dsColors.textTertiary.withValues(alpha: 0.1)
            : context.dsColors.surface,
        border: Border.all(
          color: isCancelled
              ? context.dsColors.textTertiary.withValues(alpha: 0.3)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -6,
          ),
        ],
      ),
      // SCREEN 17: dars karta bosilganda dars tafsilotiga o'tadi.
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            AppHaptics.tap();
            context.push('/schedule/lesson/${schedule.scheduleId}');
          },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
          // Time column
          Container(
            width: 70,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(                      color: context.dsColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  schedule.startTime,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.accent,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  schedule.endTime,
                  style: TextStyle(
                    fontSize: 12,
                    color: context.dsColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          // Info column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  schedule.subject ?? schedule.groupName ?? schedule.groupId,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: isCancelled
                        ? context.dsColors.textSecondary
                        : context.dsColors.textPrimary,
                    decoration: isCancelled ? TextDecoration.lineThrough : null,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.group_outlined,
                        size: 14, color: context.dsColors.textSecondary),
                    SizedBox(width: 4),
                    Text(
                      schedule.groupName ?? schedule.groupId,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.person_outline,
                        size: 14, color: context.dsColors.textSecondary),
                    SizedBox(width: 4),
                    Text(
                      schedule.teacherName ?? schedule.teacherId,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Room
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: context.dsColors.success.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  schedule.roomName ?? schedule.roomId,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.success,
                  ),
                ),
              ),
              SizedBox(height: 4),
              Text(
                '${schedule.durationMinutes} daq',
                style: TextStyle(
                  fontSize: 11,
                  color: context.dsColors.textSecondary,
                ),
              ),
            ],
          ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyDay extends StatelessWidget {
  final DayOfWeek day;

  const _EmptyDay({required this.day});

  @override
  Widget build(BuildContext context) {
    final dayName = switch (day) {
      DayOfWeek.monday => 'Dushanba',
      DayOfWeek.tuesday => 'Seshanba',
      DayOfWeek.wednesday => 'Chorshanba',
      DayOfWeek.thursday => 'Payshanba',
      DayOfWeek.friday => 'Juma',
      DayOfWeek.saturday => 'Shanba',
      DayOfWeek.sunday => 'Yakshanba',
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: context.dsColors.surface,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                Icons.event_available,
                size: 40,
                color: context.dsColors.textTertiary,
              ),
            ),
            SizedBox(height: 16),
            Text(
              '$dayName kuni bo\'sh',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              "Bu kun uchun dars jadvali belgilanmagan.",
              style: TextStyle(
                fontSize: 13,
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
