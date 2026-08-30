import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/commands/add_grade_command.dart';
import '../../domain/entities/grade.dart';
import '../providers/grade_providers.dart';

/// Baholar (o'zlashtirish) markazi — professional education CRM moduli.
///
/// O'quvchilarning o'rtacha baho reytingi, fanlar bo'yicha baholar va
/// yangi baho qo'shish imkonini beradi.
class GradesPage extends ConsumerWidget {
  const GradesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summariesAsync = ref.watch(gradeSummariesProvider);
    // RBAC: FAB faqat baho qo'shish ruxsatiga ega rollarga ko'rinadi
    // (student/parent kabi rollar ko'rmaydi — PHASE C UX pattern).
    final canCreate = Permissions.can(
      ref.watch(actorRoleProvider),
      AppPermission.gradesCreate,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.gradesTitle),
        centerTitle: true,
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _showAddGradeSheet(context, ref),
              icon: const Icon(Icons.add),
              label: Text(context.l10n.gradesAdd),
            )
          : null,
      body: summariesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            '${context.l10n.commonError}: $error',
            style: TextStyle(color: context.dsColors.textSecondary),
          ),
        ),
        data: (summaries) {
          if (summaries.isEmpty) {
            return _GradesEmpty(
              onCreate: canCreate
                  ? () => _showAddGradeSheet(context, ref)
                  : null,
            );
          }
          final totalAverage = summaries.fold<double>(
                0,
                (acc, s) => acc + s.average,
              ) /
              summaries.length;
          final totalCount =
              summaries.fold<int>(0, (acc, s) => acc + s.gradeCount);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
            children: [
              _GradesStatsHeader(
                studentCount: summaries.length,
                totalAverage: totalAverage,
                totalCount: totalCount,
              ),
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  context.l10n.gradesRating,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: context.dsColors.textTertiary,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              for (final summary in summaries) ...[
                _StudentGradeCard(summary: summary),
                const SizedBox(height: 10),
              ],
            ],
          );
        },
      ),
    );
  }

  void _showAddGradeSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddGradeSheet(ref: ref),
    );
  }
}

/// Umumiy statistika kartochkasi (o'rtacha, o'quvchilar, baholar soni).
class _GradesStatsHeader extends StatelessWidget {
  final int studentCount;
  final double totalAverage;
  final int totalCount;

  const _GradesStatsHeader({
    required this.studentCount,
    required this.totalAverage,
    required this.totalCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [context.dsColors.accent, context.dsColors.info],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.accent.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: -8,
          ),
        ],
      ),
      child: Row(
        children: [
          _StatItem(
            icon: Icons.school_outlined,
            value: '$studentCount',
            label: context.l10n.gradesStudents,
            color: Colors.white,
          ),
          _divider(),
          _StatItem(
            icon: Icons.workspace_premium_outlined,
            value: totalAverage.toStringAsFixed(2),
            label: context.l10n.gradesAverage,
            color: Colors.white,
          ),
          _divider(),
          _StatItem(
            icon: Icons.task_alt,
            value: '$totalCount',
            label: context.l10n.gradesTotal,
            color: Colors.white,
          ),
        ],
      ),
    );
  }

  Widget _divider() {
    return Container(
      width: 1,
      height: 40,
      color: Colors.white.withValues(alpha: 0.25),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: color.withValues(alpha: 0.9)),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta o'quvchining baho kartasi (o'rtacha, eng yaxshi/past).
class _StudentGradeCard extends StatelessWidget {
  final StudentGradeSummary summary;

  const _StudentGradeCard({required this.summary});

  Color _averageColor(BuildContext context) {
    if (summary.average >= 4.5) return context.dsColors.success;
    if (summary.average >= 3.5) return context.dsColors.accent;
    if (summary.average >= 3.0) return context.dsColors.warning;
    return context.dsColors.error;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: context.dsColors.card,
        border: Border.all(
          color: context.dsColors.divider.withValues(alpha: 0.5),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
            spreadRadius: -8,
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: _averageColor(context).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              summary.average >= 4.0
                  ? Icons.emoji_events_outlined
                  : Icons.menu_book_outlined,
              color: _averageColor(context),
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary.studentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (summary.groupName != null) ...[
                      Text(
                        summary.groupName!,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      '${summary.gradeCount} ${context.l10n.gradesCount}',
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
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                summary.average.toStringAsFixed(2),
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: _averageColor(context),
                ),
              ),
              Text(
                context.l10n.gradesAverageShort,
                style: TextStyle(
                  fontSize: 10,
                  color: context.dsColors.textTertiary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GradesEmpty extends StatelessWidget {
  final VoidCallback? onCreate;

  const _GradesEmpty({this.onCreate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Icon(Icons.grade_outlined, size: 44, color: Colors.white),
            ),
            const SizedBox(height: 24),
            Text(
              context.l10n.gradesEmptyTitle,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              context.l10n.gradesEmptyDesc,
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (onCreate != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onCreate,
                icon: const Icon(Icons.add),
                label: Text(context.l10n.gradesAdd),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Yangi baho qo'shish uchun bottom sheet.
class _AddGradeSheet extends ConsumerStatefulWidget {
  final WidgetRef ref;

  const _AddGradeSheet({required this.ref});

  @override
  ConsumerState<_AddGradeSheet> createState() => _AddGradeSheetState();
}

class _AddGradeSheetState extends ConsumerState<_AddGradeSheet> {
  String? _selectedStudentId;
  String? _selectedStudentName;
  String? _selectedGroupId;
  String? _selectedGroupName;
  String? _subjectId;
  String? _subjectName;
  int _gradeValue = 5;
  final _commentController = TextEditingController();
  DateTime _date = DateTime.now();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final studentsAsync = ref.watch(activeStudentsProvider);
    final subjectsAsync = ref.watch(subjectListProvider);
    final identitiesAsync = ref.watch(identityListProvider);
    final students = studentsAsync.valueOrNull ?? const [];
    final identities = identitiesAsync.valueOrNull ?? const [];
    final subjects = (subjectsAsync.valueOrNull ?? const [])
        .where((s) => s.isActive)
        .toList();

    return Container(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: BoxDecoration(
        color: context.dsColors.surfaceRaised,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.dsColors.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              context.l10n.gradesAdd,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            // O'quvchi tanlash
            _FieldLabel(context.l10n.gradesStudent),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _selectedStudentId,
              isExpanded: true,
              decoration: InputDecoration(hintText: context.l10n.gradesSelectStudent),
              items: [
                for (final student in students)
                  DropdownMenuItem(
                    value: student.identityId,
                    child: Text(
                      _studentDisplayName(student, identities),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (value) {
                if (value == null) return;
                final student =
                    students.where((s) => s.identityId == value).firstOrNull;
                setState(() {
                  _selectedStudentId = value;
                  _selectedStudentName = student == null
                      ? value
                      : _studentDisplayName(student, identities);
                  _selectedGroupId = student?.groupId;
                  _selectedGroupName = student?.groupName;
                });
              },
            ),
            const SizedBox(height: 16),
            // Fan tanlash
            _FieldLabel(context.l10n.gradesSubject),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _subjectId,
              isExpanded: true,
              decoration: InputDecoration(hintText: context.l10n.gradesSelectSubject),
              items: [
                for (final subject in subjects)
                  DropdownMenuItem(
                    value: subject.subjectId,
                    child: Text(subject.name, overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: (value) {
                if (value == null) return;
                final subject =
                    subjects.where((s) => s.subjectId == value).firstOrNull;
                setState(() {
                  _subjectId = value;
                  _subjectName = subject?.name;
                });
              },
            ),
            const SizedBox(height: 16),
            // Sana
            _FieldLabel(context.l10n.gradesDate),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: context.dsColors.fill,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_outlined,
                        size: 18, color: context.dsColors.textSecondary),
                    const SizedBox(width: 10),
                    Text(
                      '${_date.day.toString().padLeft(2, '0')}.'
                      '${_date.month.toString().padLeft(2, '0')}.'
                      '${_date.year}',
                      style: TextStyle(
                        fontSize: 15,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Baho (2..5)
            _FieldLabel(context.l10n.gradesValue),
            const SizedBox(height: 6),
            Row(
              children: [
                for (final value in [5, 4, 3, 2]) ...[
                  Expanded(
                    child: _GradeValueChip(
                      value: value,
                      selected: _gradeValue == value,
                      onTap: () => setState(() => _gradeValue = value),
                    ),
                  ),
                  if (value != 2) const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 16),
            // Izoh
            TextField(
              controller: _commentController,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: context.l10n.gradesComment,
                hintText: context.l10n.gradesCommentHint,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submit,
                icon: const Icon(Icons.check),
                label: Text(context.l10n.commonSave),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _studentDisplayName(Student student, List<Identity> identities) {
    final identity = identities
        .where((i) => i.identityId == student.identityId)
        .firstOrNull;
    return identity?.fullName ?? student.identityId;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365 * 3)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_selectedStudentId == null) {
      _showError(context.l10n.gradesSelectStudent);
      return;
    }
    if (_subjectId == null) {
      _showError(context.l10n.gradesSelectSubject);
      return;
    }

    try {
      await widget.ref.read(addGradeCommandProvider).execute(
            AddGradeRequest(
              studentIdentityId: _selectedStudentId!,
              studentName: _selectedStudentName ?? _selectedStudentId!,
              groupId: _selectedGroupId,
              groupName: _selectedGroupName,
              subjectId: _subjectId!,
              subjectName: _subjectName ?? _subjectId!,
              value: _gradeValue,
              comment: _commentController.text.trim(),
              date: _date,
            ),
          );

      widget.ref.invalidate(gradeListVersionProvider);
      unawaited(AppHaptics.tap());
      if (mounted) Navigator.pop(context);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.gradesSaved)),
        );
      }
    } catch (e) {
      _showError('$e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: context.dsColors.error,
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;

  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textSecondary,
      ),
    );
  }
}

/// Baho qiymati chipi (5, 4, 3, 2).
class _GradeValueChip extends StatelessWidget {
  final int value;
  final bool selected;
  final VoidCallback onTap;

  const _GradeValueChip({
    required this.value,
    required this.selected,
    required this.onTap,
  });

  Color _color(BuildContext context) => switch (value) {
        5 => context.dsColors.success,
        4 => context.dsColors.accent,
        3 => context.dsColors.warning,
        _ => context.dsColors.error,
      };

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? _color(context).withValues(alpha: 0.16)
              : context.dsColors.fill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? _color(context) : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: selected ? _color(context) : context.dsColors.textSecondary,
              ),
            ),
            if (selected)
              Text(
                '✓',
                style: TextStyle(fontSize: 12, color: _color(context)),
              ),
          ],
        ),
      ),
    );
  }
}
