import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../scheduling/application/services/lesson_instance_service.dart';
import '../../../scheduling/domain/entities/lesson_instance.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../domain/entities/attendance_entry.dart';
import '../providers/attendance_providers.dart';

/// Davomat markazi (spec SCREEN 20).
///
/// Muassasa darajasidagi holat: SANA NAVIGATORI orqali tanlangan kundagi
/// barcha darslar va ularning holati:
///
/// - **Belgilangan** — davomat yozuvlari mavjud (icon + matn + rang).
/// - **Kutilmoqda** — dars tugagan, lekin davomat belgilanmagan (P0: buni
///   topish va tezkor Marking'ga o'tish asosiy user goal).
/// - **Rejalashtirilgan** — dars hali boshlanmagan (yoki kelajak sana).
///
/// Kelajakdagi sana tanlansa barcha darslar Rejalashtirilgan bo'ladi va
/// davomat belgilash BLOKLANADI — sabab tushunarli ko'rsatiladi (spec §03).
/// Bu ANALITIK ko'rinish; belgilashning o'zi Attendance Marking'da.
class AttendanceCenterPage extends ConsumerStatefulWidget {
  const AttendanceCenterPage({super.key});

  @override
  ConsumerState<AttendanceCenterPage> createState() =>
      _AttendanceCenterPageState();
}

class _AttendanceCenterPageState extends ConsumerState<AttendanceCenterPage> {
  String? _groupId;

  /// Tanlangan sana — navigator orqali o'zgaradi (spec §03: P1 oldingi
  /// sanalarni ko'rish).
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    _selectedDate = _dateOnly(DateTime.now());
  }

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Widget build(BuildContext context) {
    final schedulesAsync = ref.watch(scheduleListProvider);
    final groupsAsync = ref.watch(groupListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.attendanceCenterTitle)),
      body: Column(
        children: [
          _buildDateNavigator(),
          _buildFilters(groupsAsync),
          Expanded(
            child: schedulesAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => _CenterError(
                message: context.l10n.attendanceLoadError,
                detail: '$e',
                onRetry: () =>
                    ref.invalidate(scheduleListVersionProvider),
              ),
              data: (schedules) {
                final lessons = LessonInstanceService.instancesForDate(
                  schedules,
                  _selectedDate,
                ).where((l) =>
                    _groupId == null || l.groupId == _groupId).toList();

                if (lessons.isEmpty) {
                  return _EmptyCenter(
                    hasGroupFilter: _groupId != null,
                    onClear: () => setState(() => _groupId = null),
                  );
                }

                return _CenterBody(
                  lessons: lessons,
                  selectedDate: _selectedDate,
                  onMark: (lesson) => _openMarking(lesson),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Belgilash → o'sha dars oldindan tanlangan holda Attendance Marking.
  void _openMarking(LessonInstance lesson) {
    AppHaptics.tap();
    ref.read(selectedMarkingLessonProvider.notifier).state = lesson;
    context.go('/attendance');
  }

  /// Sana navigatori: ◀ 18-avgust, seshanba ▶ + [Bugun] (boshqa kunda).
  Widget _buildDateNavigator() {
    final today = _dateOnly(DateTime.now());
    final isFuture = _selectedDate.isAfter(today);

    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: context.l10n.attendancePrevDay,
            onPressed: () => setState(() =>
                _selectedDate = _selectedDate.subtract(const Duration(days: 1))),
            icon: Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  _uzDateLabel(_selectedDate),
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: isFuture
                        ? context.dsColors.info
                        : context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (isFuture)
                  Text(
                    context.l10n.attendanceFutureDateWarning,
                    style: TextStyle(
                      fontSize: 11,
                      color: context.dsColors.info,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: context.l10n.attendanceNextDay,
            onPressed: () => setState(() =>
                _selectedDate = _selectedDate.add(const Duration(days: 1))),
            icon: Icon(Icons.chevron_right),
          ),
          if (!_selectedDate.isAtSameMomentAs(today)) ...[
            SizedBox(width: 4),
            TextButton(
              onPressed: () => setState(() => _selectedDate = today),
              child: Text(context.l10n.attendanceToday),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFilters(AsyncValue<List<Group>> groupsAsync) {
    final groups = groupsAsync.valueOrNull ?? const <Group>[];
    final items = <String, String>{
      for (final g in groups) g.groupId: g.name,
    };

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          Icon(Icons.filter_alt_outlined,
              size: 17, color: context.dsColors.textSecondary),
          SizedBox(width: 8),
          Expanded(
            child: DropdownButtonFormField<String?>(
              initialValue: _groupId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: context.l10n.groupsTitle,
                prefixIcon: Icon(Icons.groups_outlined),
                isDense: true,
              ),
              items: [
                DropdownMenuItem<String?>(
                  value: null,
                  child: Text(context.l10n.attendanceAllGroups),
                ),
                for (final entry in items.entries)
                  DropdownMenuItem<String?>(
                    value: entry.key,
                    child: Text(entry.value, overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: (v) => setState(() => _groupId = v),
            ),
          ),
        ],
      ),
    );
  }

  /// O'zbekcha sana: "18-avgust, seshanba" (dashboard bilan bir xil stil).
  static String _uzDateLabel(DateTime d) {
    const weekdays = [
      'Dushanba',
      'Seshanba',
      'Chorshanba',
      'Payshanba',
      'Juma',
      'Shanba',
      'Yakshanba',
    ];
    const months = [
      'yanvar',
      'fevral',
      'mart',
      'aprel',
      'may',
      'iyun',
      'iyul',
      'avgust',
      'sentabr',
      'oktabr',
      'noyabr',
      'dekabr',
    ];
    return '${weekdays[d.weekday - 1]}, ${d.day}-${months[d.month - 1]}';
  }
}

/// Darslar ro'yxati + umumiy holat xulosasi.
class _CenterBody extends ConsumerWidget {
  final List<LessonInstance> lessons;
  final DateTime selectedDate;
  final ValueChanged<LessonInstance> onMark;

  const _CenterBody({
    required this.lessons,
    required this.selectedDate,
    required this.onMark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lessonIds = lessons.map((l) => l.lessonId).toList();
    final marked = <String, bool>{};
    for (final id in lessonIds) {
      final entries = ref.watch(lessonAttendanceProvider(id)).valueOrNull;
      marked[id] = entries != null && entries.isNotEmpty;
    }
    final markedCount = marked.values.where((m) => m).length;

    return Column(
      children: [
        _SummaryBar(
          total: lessons.length,
          marked: markedCount,
        ),
        Expanded(
          child: ListView.builder(
            padding: EdgeInsets.fromLTRB(16, 4, 16, 32),
            itemCount: lessons.length,
            itemBuilder: (context, index) {
              final lesson = lessons[index];
              return _LessonStatusCard(
                lesson: lesson,
                isMarked: marked[lesson.lessonId] ?? false,
                onMark: () => onMark(lesson),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// "Belgilangani: X/Y dars" xulosasi (spec §03 information hierarchy #2).
class _SummaryBar extends StatelessWidget {
  final int total;
  final int marked;

  const _SummaryBar({required this.total, required this.marked});

  @override
  Widget build(BuildContext context) {
    final pending = total - marked;
    return Container(
      margin: EdgeInsets.fromLTRB(16, 4, 16, 10),
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: context.dsColors.surfaceOverlay,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.fact_check_outlined, size: 17, color: context.dsColors.accent),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Belgilangani: $marked/$total dars',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: context.dsColors.textPrimary,
              ),
            ),
          ),
          if (pending > 0)
            Text(
              '$pending ${context.l10n.attendanceRemaining}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: context.dsColors.warning,
              ),
            ),
        ],
      ),
    );
  }
}

/// Bitta dars holati: vaqt, guruh, o'qituvchi, xona + holat chipi.
class _LessonStatusCard extends ConsumerWidget {
  final LessonInstance lesson;
  final bool isMarked;
  final VoidCallback onMark;

  const _LessonStatusCard({
    required this.lesson,
    required this.isMarked,
    required this.onMark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(lessonAttendanceProvider(lesson.lessonId));
    final colors = context.dsColors;
    final (statusIcon, statusColor, statusLabel) =
        _statusOf(context, lesson, isMarked, DateTime.now());

    return Container(
      margin: EdgeInsets.only(bottom: 10),
      padding: EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: colors.surface,
        border: Border.all(
          color: statusColor.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: () {
          AppHaptics.tap();
          context.push('/schedule/lesson/${lesson.scheduleId}');
        },
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: EdgeInsets.only(bottom: 2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    padding: EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          lesson.startTime,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: statusColor,
                          ),
                        ),
                        Text(
                          lesson.endTime,
                          style: TextStyle(
                            fontSize: 10.5,
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lesson.subject ?? context.l10n.attendanceLessonDefault,
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: colors.textPrimary,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          '${lesson.groupName ?? lesson.groupId} • '
                          '${lesson.teacherName ?? '—'}',
                          style: TextStyle(
                            fontSize: 12,
                            color: colors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 8),
                  if (lesson.roomName != null)
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        lesson.roomName!,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ),
                ],
              ),
              SizedBox(height: 10),
              Row(
                children: [
                  Icon(statusIcon, size: 15, color: statusColor),
                  SizedBox(width: 6),
                  Text(
                    statusLabel,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                  const Spacer(),
                  _buildTrailing(
                    context,
                    ref,
                    entriesAsync,
                    colors,
                    statusLabel,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Holat (icon + matn + rang — rangga tayanilmaydi, spec §09):
  /// Belgilangan / Kutilmoqda / Rejalashtirilgan.
  (IconData, Color, String) _statusOf(
    BuildContext context,
    LessonInstance lesson,
    bool isMarked,
    DateTime now,
  ) {
    final today = DateTime(now.year, now.month, now.day);
    final date = lesson.date;
    if (isMarked) {
      return (Icons.check_circle_outline, context.dsColors.success, 'Belgilangan');
    }
    // Kelajakdagi sana yoki bugungi hali boshlanmagan dars.
    if (date.isAfter(today)) {
      return (Icons.schedule, context.dsColors.info, 'Rejalashtirilgan');
    }
    // O'tgan kun yoki bugun tugagan dars — hali belgilanmagan → Kutilmoqda.
    if (date.isBefore(today) || _lessonEnded(lesson, now)) {
      return (
        Icons.warning_amber_rounded,
        context.dsColors.warning,
        context.l10n.attendancePendingLabel,
      );
    }
    return (Icons.schedule, context.dsColors.info, 'Rejalashtirilgan');
  }

  bool _lessonEnded(LessonInstance lesson, DateTime now) {
    final parts = lesson.endTime.split(':');
    final endMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
    return now.hour * 60 + now.minute >= endMinutes;
  }

  /// O'ng tomondagi amal: Belgilangan → yozuvlar soni; Kutilmoqda →
  /// [Belgilash]; Rejalashtirilgan → bloklangan tugma + tushunarli sabab.
  Widget _buildTrailing(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<AttendanceEntry>> entriesAsync,
    DsColors colors,
    String statusLabel,
  ) {
    if (isMarked) {
      final entries = entriesAsync.valueOrNull;
      final present = entries
              ?.where((e) => e.status == 'present' || e.status == 'late')
              .length ??
          0;
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.how_to_reg_outlined, size: 15, color: context.dsColors.success),
          SizedBox(width: 4),
          Text(
            '$present/${_groupStudentCount(ref)} qatnashdi',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: context.dsColors.success,
            ),
          ),
        ],
      );
    }

    // Rejalashtirilgan (kelajak/boshlanmagan) — belgilash bloklanadi.
    if (statusLabel == 'Rejalashtirilgan') {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock_outline, size: 14, color: colors.textTertiary),
          SizedBox(width: 4),
          Text(
            context.l10n.attendanceLessonNotStarted,
            style: TextStyle(fontSize: 11.5, color: colors.textTertiary),
          ),
        ],
      );
    }

    // Kutilmoqda → tezkor belgilash (asosiy user goal).
    return FilledButton.tonal(
      style: FilledButton.styleFrom(visualDensity: VisualDensity.compact),
      onPressed: onMark,
      child: Text(context.l10n.attendanceMark),
    );
  }

  /// Guruhdagi o'quvchilar soni — real bazadan (agregatsiya yo'q).
  /// `watch` — provider ishga tushiriladi (read bilan null qolardi).
  int _groupStudentCount(WidgetRef ref) {
    final students = ref.watch(studentListProvider).valueOrNull;
    if (students == null) return 0;
    return students.where((s) => s.groupId == lesson.groupId).length;
  }
}

class _EmptyCenter extends StatelessWidget {
  final bool hasGroupFilter;
  final VoidCallback onClear;

  const _EmptyCenter({
    required this.hasGroupFilter,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.event_available_outlined,
              size: 48,
              color: colors.textTertiary,
            ),
            SizedBox(height: 12),
            Text(
              hasGroupFilter
                  ? 'Tanlangan guruh bo\'yicha bu kunda darslar topilmadi.'
                  : 'Bu kunda dars yo\'q.',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: colors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 6),
            Text(
              hasGroupFilter
                  ? 'Filtrni tozalang yoki boshqa guruh tanlang.'
                  : 'Jadvalga dars qo\'shilgach, davomat holati shu yerda ko\'rinadi.',
              style: TextStyle(
                fontSize: 12.5,
                color: colors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (hasGroupFilter) ...[
              SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onClear,
                icon: Icon(Icons.filter_alt_off_outlined, size: 18),
                label: Text(context.l10n.attendanceClearFilters),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CenterError extends StatelessWidget {
  final String message;
  final String detail;
  final VoidCallback onRetry;

  const _CenterError({
    required this.message,
    required this.detail,
    required this.onRetry,
  });

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
            SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: Icon(Icons.refresh, size: 18),
              label: Text(context.l10n.actionRetry),
            ),
          ],
        ),
      ),
    );
  }
}
