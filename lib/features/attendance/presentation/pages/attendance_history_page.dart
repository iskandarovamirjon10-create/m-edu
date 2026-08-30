import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_status_chip.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../domain/entities/attendance_entry.dart';
import '../providers/attendance_providers.dart';

/// Davomat tarixi (spec SCREEN 21).
///
/// FAQAT o'qish uchun — bu yerda belgilash yo'q. Filtrlar: sana oralig'i,
/// guruh, o'quvchi (qidiruv), holat.
///
/// Batafsil tarix DARS bo'yicha guruhlanadi: "18.08 • Matematika-2A —
/// 12/14 keldi (86%)" — qator bosilganda o'sha darsning talabalar ro'yxati
/// expand qilinadi (yangi screen yaratilmaydi, spec §13). Tahrirlangan
/// yozuvlarda "Tahrirlangan" belgisi (icon + matn + rang).
///
/// Sana oralig'i 1 yildan katta bo'lsa — performans uchun oylik agregatsiya
/// ko'rinishiga avtomatik o'tiladi (spec §14).
class AttendanceHistoryPage extends ConsumerStatefulWidget {
  const AttendanceHistoryPage({super.key});

  @override
  ConsumerState<AttendanceHistoryPage> createState() =>
      _AttendanceHistoryPageState();
}

class _AttendanceHistoryPageState extends ConsumerState<AttendanceHistoryPage> {
  DateTime _from = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  ).subtract(const Duration(days: 6));
  DateTime _to = DateTime.now();

  String? _groupId;
  String _studentQuery = '';
  String _statusFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupListProvider);
    final schedulesAsync = ref.watch(scheduleListProvider);
    final range = (from: _from, to: _to.add(const Duration(days: 1)));
    final entriesAsync = ref.watch(attendanceBetweenProvider(range));

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.attendanceHistoryTitle)),
      body: Column(
        children: [
          _buildFilters(groupsAsync),
          Expanded(
            child: entriesAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => _HistoryError(
                message: context.l10n.attendanceLoadError,
                detail: '$e',
                onRetry: () =>
                    ref.invalidate(attendanceBetweenProvider(range)),
              ),
              data: (entries) {
                final schedules =
                    schedulesAsync.valueOrNull ?? const <Schedule>[];
                final filtered = _applyFilters(entries, schedules);
                return _buildContent(context, filtered, schedules);
              },
            ),
          ),
        ],
      ),
    );
  }

  List<AttendanceEntry> _applyFilters(
    List<AttendanceEntry> entries,
    List<Schedule> schedules,
  ) {
    return entries.where((e) {
      if (_groupId != null) {
        final scheduleId = _scheduleIdFromLesson(e.lessonId);
        final schedule = scheduleId == null
            ? null
            : _findSchedule(schedules, scheduleId);
        if (schedule == null || schedule.groupId != _groupId) return false;
      }
      if (_studentQuery.isNotEmpty &&
          !e.fullName.toLowerCase().contains(_studentQuery)) {
        return false;
      }
      if (_statusFilter != 'all' && e.status != _statusFilter) return false;
      return true;
    }).toList();
  }

  Widget _buildContent(
    BuildContext context,
    List<AttendanceEntry> filtered,
    List<Schedule> schedules,
  ) {
    final colors = context.dsColors;

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.history_outlined,
                  size: 48, color: colors.textTertiary),
              SizedBox(height: 12),
              Text(
                context.l10n.attendanceNoRecordsForPeriod,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 6),
              Text(
                context.l10n.attendanceExpandOrClearFilters,
                style: TextStyle(fontSize: 12.5, color: colors.textSecondary),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => setState(() {
                  _groupId = null;
                  _studentQuery = '';
                  _statusFilter = 'all';
                }),
                icon: Icon(Icons.filter_alt_off_outlined, size: 18),
                label: Text(context.l10n.attendanceClearFilters),
              ),
            ],
          ),
        ),
      );
    }

    final present = filtered
        .where((e) => e.status == 'present' || e.status == 'late')
        .length;
    final late = filtered.where((e) => e.status == 'late').length;
    final absent = filtered.where((e) => e.status == 'absent').length;
    final excused = filtered.where((e) => e.status == 'excused').length;
    final overallPct =
        filtered.isEmpty ? 0 : (present / filtered.length * 100).round();

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 900;
        return ListView(
          padding: EdgeInsets.fromLTRB(isWide ? 40 : 16, 4, isWide ? 40 : 16, 32),
          children: [
            _SummaryRow(
              total: filtered.length,
              present: present,
              late: late,
              absent: absent,
              excused: excused,
            ),
            SizedBox(height: 10),
            _AverageRow(percent: overallPct, total: filtered.length),
            SizedBox(height: 14),
            ..._buildHistoryGroups(context, filtered, schedules),
          ],
        );
      },
    );
  }

  /// Dars bo'yicha guruhlangan tarix (spec §12-13). Sana oralig'i 1 yildan
  /// katta bo'lsa — oylik agregatsiya (spec §14, performans).
  List<Widget> _buildHistoryGroups(
    BuildContext context,
    List<AttendanceEntry> filtered,
    List<Schedule> schedules,
  ) {
    final isLongRange =
        _to.difference(_from).inDays > 365;

    // Guruhlash kaliti: lessonId (V3) yoki sana (legacy kundalik).
    final groups = <String, List<AttendanceEntry>>{};
    for (final e in filtered) {
      final key = _groupKey(e, isLongRange);
      groups.putIfAbsent(key, () => []).add(e);
    }

    final orderedKeys = groups.keys.toList()
      ..sort((a, b) => b.compareTo(a));

    return [
      for (final key in orderedKeys)
        if (isLongRange)
          _MonthlyGroupCard(
            key: ValueKey('hist-$key'),
            monthLabel: key,
            entries: groups[key]!,
          )
        else
          _LessonGroupCard(
            key: ValueKey('hist-$key'),
            entries: groups[key]!,
            schedules: schedules,
          ),
    ];
  }

  /// Oylik agregatsiya uchun kalit: "2026-08"; oddiy ko'rinish uchun:
  /// "LESSON-...-20260818" yoki "DAY-2026-08-18".
  String _groupKey(AttendanceEntry e, bool monthly) {
    final d = e.attendanceDate;
    if (monthly) {
      return '${d.year}-${d.month.toString().padLeft(2, '0')}';
    }
    if (e.lessonId != null) return e.lessonId!;
    return 'DAY-${d.year}-${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
  }

  Widget _buildFilters(AsyncValue<List<Group>> groupsAsync) {
    final groups = groupsAsync.valueOrNull ?? const <Group>[];

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 6, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sana oralig'i tezkor filtrlari.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final range in _ranges(context))
                  Padding(
                    padding: EdgeInsets.only(right: 8),
                    child: Semantics(
                      label: '${context.l10n.actionSearch}: ${range.label}',
                      button: true,
                      child: ChoiceChip(
                        label: Text(range.label),
                        selected: _isActiveRange(range),
                        showCheckmark: false,
                        onSelected: (_) => setState(() {
                          _from = range.from;
                          _to = range.to;
                        }),
                      ),
                    ),
                  ),
                Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: ActionChip(
                    avatar: Icon(Icons.date_range_outlined, size: 16),
                    label: Text(
                      '${_fmtDate(_from)} – ${_fmtDate(_to)}',
                      style: TextStyle(fontSize: 12),
                    ),
                    onPressed: _pickCustomRange,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 10),
          // Guruh + holat filtrlari.
          Row(
            children: [
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
                    for (final g in groups)
                      DropdownMenuItem<String?>(
                        value: g.groupId,
                        child: Text(g.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _groupId = v),
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _statusFilter,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: context.l10n.attendanceStatus,
                    prefixIcon: Icon(Icons.filter_list_outlined),
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('Barchasi')),
                    DropdownMenuItem(value: 'present', child: Text('Kelgan')),
                    DropdownMenuItem(value: 'late', child: Text('Kechikkan')),
                    DropdownMenuItem(
                        value: 'absent', child: Text('Kelmagan')),
                    DropdownMenuItem(value: 'excused', child: Text('Uzrli')),
                  ],
                  onChanged: (v) => setState(() => _statusFilter = v ?? 'all'),
                ),
              ),
            ],
          ),
          SizedBox(height: 10),
          // O'quvchi qidiruvi.
          TextField(
            onChanged: (v) =>
                setState(() => _studentQuery = v.trim().toLowerCase()),
            decoration: InputDecoration(
              hintText: context.l10n.attendanceSearchHint,
              prefixIcon: Icon(Icons.search),
              isDense: true,
            ),
          ),
        ],
      ),
    );
  }

  List<({String label, DateTime from, DateTime to})> _ranges(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return [
      (label: context.l10n.attendanceTodayRange, from: today, to: today),
      (label: context.l10n.attendance7Days, from: today.subtract(const Duration(days: 6)), to: today),
      (
        label: context.l10n.attendance30Days,
        from: today.subtract(const Duration(days: 29)),
        to: today
      ),
      (label: context.l10n.attendanceThisMonth, from: DateTime(now.year, now.month, 1), to: today),
    ];
  }

  bool _isActiveRange(({String label, DateTime from, DateTime to}) range) {
    return _from == range.from &&
        _to == range.to &&
        _from != _customFrom &&
        _to != _customTo;
  }

  DateTime? _customFrom;
  DateTime? _customTo;

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final from = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime(2020),
      lastDate: now,
    );
    if (from == null || !mounted) return;
    final to = await showDatePicker(
      context: context,
      initialDate: _to.isBefore(from) ? from : _to,
      firstDate: from,
      lastDate: now,
    );
    if (to == null || !mounted) return;
    setState(() {
      _customFrom = from;
      _customTo = to;
      _from = from;
      _to = to;
    });
  }
}

/// Lesson ID formati: LESSON-{scheduleId}-{yyyyMMdd}
String? _scheduleIdFromLesson(String? lessonId) {
  if (lessonId == null) return null;
  const prefix = 'LESSON-';
  if (!lessonId.startsWith(prefix)) return null;
  final rest = lessonId.substring(prefix.length);
  final dash = rest.lastIndexOf('-');
  if (dash <= 0) return null;
  return rest.substring(0, dash);
}

Schedule? _findSchedule(List<Schedule> schedules, String scheduleId) {
  for (final s in schedules) {
    if (s.scheduleId == scheduleId) return s;
  }
  return null;
}

/// Umumiy xulosa: jami + holatlar bo'yicha (faqat matn — rangga tayanilmaydi).
class _SummaryRow extends StatelessWidget {
  final int total;
  final int present;
  final int late;
  final int absent;
  final int excused;

  const _SummaryRow({
    required this.total,
    required this.present,
    required this.late,
    required this.absent,
    required this.excused,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: colors.surfaceOverlay,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Wrap(
        spacing: 16,
        runSpacing: 8,
        children: [
          _SummaryChip(
              label: context.l10n.attendanceSummaryTotal, value: '$total', color: colors.textPrimary),
          _SummaryChip(
              label: context.l10n.attendancePresent, value: '$present', color: context.dsColors.success),
          _SummaryChip(
              label: context.l10n.attendanceLate, value: '$late', color: context.dsColors.warning),
          _SummaryChip(
              label: context.l10n.attendanceAbsent, value: '$absent', color: context.dsColors.error),
          _SummaryChip(
              label: context.l10n.attendanceExcused, value: '$excused', color: context.dsColors.info),
        ],
      ),
    );
  }
}

/// O'rtacha davomat (spec §12 misol: "O'rtacha davomat: 89%").
class _AverageRow extends StatelessWidget {
  final int percent;
  final int total;

  const _AverageRow({required this.percent, required this.total});

  @override
  Widget build(BuildContext context) {
    final color = percent >= 90
        ? context.dsColors.success
        : percent >= 70
            ? context.dsColors.warning
            : context.dsColors.error;
    return Row(
      children: [
        Icon(Icons.trending_up, size: 17, color: color),
        SizedBox(width: 6),
        Text(
          "${context.l10n.attendanceAveragePercent}: $percent%",
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        SizedBox(width: 8),
        Text(              '($total ${context.l10n.attendanceRecordsCount})',
          style: TextStyle(
            fontSize: 12,
            color: context.dsColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

/// Bitta dars tarixi — expand qilinadigan karta (spec §13): sarlavhada
/// sana • fan/guruh • "X/Y keldi (Z%)", expand'da talabalar ro'yxati.
class _LessonGroupCard extends ConsumerWidget {
  final List<AttendanceEntry> entries;
  final List<Schedule> schedules;

  const _LessonGroupCard({
    super.key,
    required this.entries,
    required this.schedules,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.dsColors;
    final first = entries.first;
    final schedule = _scheduleFor(first);
    final date = first.attendanceDate;
    final present =
        entries.where((e) => e.status == 'present' || e.status == 'late').length;

    // Guruh a'zolari soni — real bazadan (schedule.groupId bo'yicha).
    final students = ref.watch(studentListProvider).valueOrNull;
    final totalStudents = schedule == null
        ? entries.length
        : students
                ?.where((s) => s.groupId == schedule.groupId)
                .length ??
            entries.length;
    final denominator = totalStudents < entries.length
        ? entries.length
        : totalStudents;
    final pct = denominator == 0 ? 0 : (present / denominator * 100).round();

    final title = schedule == null
        ? (first.lessonId ?? 'Yozuv')
        : '${schedule.subject ?? 'Dars'} • '
            '${schedule.groupName ?? schedule.groupId}';

    return Container(
      margin: EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: colors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Semantics(
        label: '$title — $present/$denominator keldi ($pct%)',
        child: ExpansionTile(
          tilePadding: EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: EdgeInsets.only(bottom: 6),
          shape: const Border(),
          collapsedShape: const Border(),
          leading: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _pctColor(context, pct).withValues(alpha: 0.13),
            shape: BoxShape.circle,
          ),
          child: Text(
            '$pct%',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: _pctColor(context, pct),
            ),
          ),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: colors.textPrimary,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${_fmtDate(date)} • $present/$denominator keldi',
          style: TextStyle(fontSize: 11.5, color: colors.textSecondary),
        ),
        children: [
          const Divider(height: 1),
          for (final entry in entries)
            _HistoryEntryRow(entry: entry, schedules: schedules),
        ],
        ),
      ),
    );
  }

  Schedule? _scheduleFor(AttendanceEntry entry) {
    final scheduleId = _scheduleIdFromLesson(entry.lessonId);
    if (scheduleId == null) return null;
    return _findSchedule(schedules, scheduleId);
  }

  Color _pctColor(BuildContext context, int pct) {
    if (pct >= 90) return context.dsColors.success;
    if (pct >= 70) return context.dsColors.warning;
    return context.dsColors.error;
  }
}

/// Oylik agregatsiya kartasi (spec §14 — 1 yildan katta oraliq).
class _MonthlyGroupCard extends StatelessWidget {
  final String monthLabel;
  final List<AttendanceEntry> entries;

  const _MonthlyGroupCard({
    super.key,
    required this.monthLabel,
    required this.entries,
  });

  @override
  Widget build(BuildContext context) {
    final present =
        entries.where((e) => e.status == 'present' || e.status == 'late').length;
    final pct = (present / entries.length * 100).round();
    final parts = monthLabel.split('-');
    const months = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentabr',
      'Oktabr',
      'Noyabr',
      'Dekabr',
    ];
    final monthName = parts.length == 2 && int.parse(parts[1]) >= 1
        ? months[int.parse(parts[1]) - 1]
        : monthLabel;

    return Container(
      margin: EdgeInsets.only(bottom: 8),
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: context.dsColors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: context.dsColors.accent.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.calendar_month_outlined,
                size: 20, color: context.dsColors.accent),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$monthName ${parts.isNotEmpty ? parts[0] : ''}',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                Text(
                  '${entries.length} ta yozuv • $present keldi ($pct%)',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: context.dsColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta tarix yozuvi (expand qilingan dars ichida).
class _HistoryEntryRow extends StatelessWidget {
  final AttendanceEntry entry;
  final List<Schedule> schedules;

  const _HistoryEntryRow({required this.entry, required this.schedules});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final (:tone, :icon, :label) = _statusOf(entry.status);
    final edited = entry.editedAt != null;

    return Padding(
      padding: EdgeInsets.fromLTRB(14, 8, 14, 4),
      child: Row(
        children: [
          Icon(icon, size: 17, color: _statusColor(context, entry.status)),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        entry.fullName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (edited) ...[
                      SizedBox(width: 8),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: context.dsColors.info.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.edit_outlined,
                                size: 11, color: context.dsColors.info),
                            SizedBox(width: 3),
                            Text(
                              context.l10n.attendanceEditedBadge,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: context.dsColors.info,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                Text(
                  '${_fmtTime(entry.checkInAt ?? entry.attendanceDate)} • '
                  '${_methodLabel(context, entry.method)}',
                  style: TextStyle(fontSize: 11, color: colors.textSecondary),
                ),
              ],
            ),
          ),
          SizedBox(width: 8),
          AppStatusChip(tone: tone, icon: icon, label: label),
        ],
      ),
    );
  }

  static ({AppStatusTone tone, IconData icon, String label}) _statusOf(
    String status,
  ) {
    return switch (status) {
      'present' => (
          tone: AppStatusTone.success,
          icon: Icons.check_circle_outline,
          label: 'Kelgan'
        ),
      'late' => (
          tone: AppStatusTone.warning,
          icon: Icons.access_time,
          label: 'Kechikkan'
        ),
      'absent' => (
          tone: AppStatusTone.error,
          icon: Icons.cancel_outlined,
          label: "Kelmagan"
        ),
      'excused' => (
          tone: AppStatusTone.info,
          icon: Icons.event_busy_outlined,
          label: 'Uzrli'
        ),
      _ => (
          tone: AppStatusTone.neutral,
          icon: Icons.help_outline,
          label: status
        ),
    };
  }

  static Color _statusColor(BuildContext context, String status) {
    return switch (status) {
      'present' => context.dsColors.success,
      'late' => context.dsColors.warning,
      'absent' => context.dsColors.error,
      'excused' => context.dsColors.info,
      _ => context.dsColors.accent,
    };
  }

  static String _methodLabel(BuildContext context, String method) {
    return switch (method) {
      'face' => 'Face ID',
      'qr' => 'QR',
      _ => context.l10n.attendanceMarkManual,
    };
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryChip({
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
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        SizedBox(width: 4),
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

class _HistoryError extends StatelessWidget {
  final String message;
  final String detail;
  final VoidCallback onRetry;

  const _HistoryError({
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

String _fmtDate(DateTime d) =>
    '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';

String _fmtTime(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
