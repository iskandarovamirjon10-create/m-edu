import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_status_chip.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../domain/entities/homework.dart';
import '../../infrastructure/models/homework_submission_record.dart';
import '../providers/homework_providers.dart';
import '../providers/homework_submission_providers.dart';

/// Uy vazifasi tafsiloti (spec SCREEN 23).
///
/// Vazifa ma'lumoti + topshirish xulosasi (topshirildi/topshirilmadi) +
/// talabalar qatorlari (✓ topshirdi / ○ topshirmadi / \"Kechikib topshirdi\").
/// Barcha ma'lumotlar real bazadan — guruh a'zolari va topshiriq yozuvlari.
class HomeworkDetailPage extends ConsumerWidget {
  final String homeworkId;

  const HomeworkDetailPage({super.key, required this.homeworkId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkDetailProvider(homeworkId));
    final canManage = _canManage(ref.read(actorRoleProvider));

    return Scaffold(
      appBar: AppBar(
        title: Text('Vazifa tafsiloti'),
        actions: [
          if (canManage) ...[
            IconButton(
              tooltip: 'Tahrirlash',
              icon: Icon(Icons.edit_outlined),
              onPressed: () =>
                  context.push('/homework/$homeworkId/edit'),
            ),
            IconButton(
              tooltip: 'O\'chirish',
              icon: Icon(Icons.delete_outline),
              onPressed: () => _confirmDelete(context, ref),
            ),
          ],
        ],
      ),
      body: homeworkAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _DetailError(
          message: 'Ma\'lumotlarni yuklashda xatolik yuz berdi.',
          detail: '$e',
        ),
        data: (homework) {
          if (homework == null) {
            return const _DetailError(
              message: 'Vazifa topilmadi.',
              detail: 'U o\'chirilgan yoki mavjud emas.',
            );
          }
          return _HomeworkDetailBody(
            homework: homework,
            canManage: canManage,
          );
        },
      ),
    );
  }

  /// Destruktiv amal — tasdiq + oqibat (spec §15).
  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final homework = ref.read(homeworkDetailProvider(homeworkId)).valueOrNull;
    if (homework == null) return;

    final submissions = await ref
        .read(homeworkSubmissionsProvider(homeworkId).future)
        .then((s) => s.length)
        .catchError((_) => 0);
    if (!context.mounted) return;
    final count = submissions;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Vazifani o\'chirish'),
        content: Text(
          count > 0
              ? 'Bu vazifa va unga tegishli $count ta topshiriq o\'chiriladi. '
                  'Davom etasizmi?'
              : '"${homework.title}" vazifasi o\'chirilsinmi? '
                  'Bu amalni ortga qaytarib bo\'lmaydi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Bekor qilish'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: context.dsColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: Text('O\'chirish'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(deleteHomeworkCommandProvider).execute(homeworkId);
      ref.invalidate(homeworkListVersionProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Vazifa o\'chirildi.'),
          backgroundColor: context.dsColors.success,
        ),
      );
      context.go('/homework');
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    }
  }
}

class _HomeworkDetailBody extends ConsumerWidget {
  final Homework homework;
  final bool canManage;

  const _HomeworkDetailBody({
    required this.homework,
    required this.canManage,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submissionsAsync =
        ref.watch(homeworkSubmissionsProvider(homework.homeworkId));
    final studentsAsync = ref.watch(studentListProvider);
    final identitiesAsync = ref.watch(identityListProvider);

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        _HomeworkInfoCard(homework: homework, canManage: canManage),
        SizedBox(height: 16),
        submissionsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => _DetailError(
            message: 'Topshiriqlarni yuklashda xatolik yuz berdi.',
            detail: '$e',
          ),
          data: (submissions) {
            final groupStudents = studentsAsync.valueOrNull
                    ?.where((s) => s.groupId == homework.groupId)
                    .toList() ??
                const [];
            final identities = identitiesAsync.valueOrNull ?? const [];

            String nameFor(String identityId) {
              for (final i in identities) {
                if (i.identityId == identityId) return i.fullName;
              }
              return identityId;
            }

            final submitted = submissions
                .where((s) => s.submitted)
                .toList();
            final late = submitted.where((s) => s.isLate).length;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SummaryCard(
                  total: groupStudents.length,
                  submitted: submitted.length,
                  late: late,
                ),
                SizedBox(height: 16),
                Text(
                  'Talabalar',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                SizedBox(height: 10),
                if (groupStudents.isEmpty)
                  const _EmptyStudentsCard()
                else
                  for (final student in groupStudents)
                    _StudentSubmissionRow(
                      studentName: nameFor(student.identityId),
                      submission: _findSubmission(submissions, student.identityId),
                      dueDate: homework.dueDate,
                      canManage: canManage,
                      onToggle: () => _toggleSubmission(
                        context,
                        ref,
                        student.identityId,
                        nameFor(student.identityId),
                        _findSubmission(submissions, student.identityId),
                      ),
                    ),
              ],
            );
          },
        ),
      ],
    );
  }

  static HomeworkSubmissionRecord? _findSubmission(
    List<HomeworkSubmissionRecord> submissions,
    String studentId,
  ) {
    for (final s in submissions) {
      if (s.studentId == studentId) return s;
    }
    return null;
  }

  Future<void> _toggleSubmission(
    BuildContext context,
    WidgetRef ref,
    String studentId,
    String studentName,
    HomeworkSubmissionRecord? submission,
  ) async {
    if (!canManage) return;
    try {
      final newValue = !(submission?.submitted ?? false);
      await ref.read(markHomeworkSubmissionCommandProvider).execute(
            homeworkId: homework.homeworkId,
            studentId: studentId,
            studentName: studentName,
            submitted: newValue,
            dueDate: homework.dueDate,
          );
      ref.invalidate(homeworkSubmissionVersionProvider);
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    }
  }
}

class _HomeworkInfoCard extends StatelessWidget {
  final Homework homework;
  final bool canManage;

  const _HomeworkInfoCard({required this.homework, required this.canManage});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final isOverdue = homework.isOverdue;
    final isDone = homework.isCompleted;

    final (tone, label) = isDone
        ? (AppStatusTone.success, 'Bajarilgan')
        : isOverdue
            ? (AppStatusTone.error, "Muddati o'tgan")
            : (AppStatusTone.info, 'Faol');

    return Container(
      padding: EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colors.surface,
        border: Border.all(
          color: isOverdue
              ? context.dsColors.error.withValues(alpha: 0.4)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: isOverdue ? 1.2 : 0.8,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: context.dsColors.accentGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.assignment_outlined,
                    color: Colors.white, size: 24),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      homework.title,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: colors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      '${homework.subjectName} • ${homework.groupName ?? homework.groupId}',
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              AppStatusChip(tone: tone, icon: _statusIcon(isDone, isOverdue), label: label),
            ],
          ),
          SizedBox(height: 14),
          const Divider(height: 1),
          SizedBox(height: 12),
          _InfoRow(
            icon: Icons.event_outlined,
            label: 'Topshirish muddati',
            value: _fmtDate(homework.dueDate),
            valueColor: isOverdue ? context.dsColors.error : null,
          ),
          if (homework.createdByName != null) ...[
            SizedBox(height: 8),
            _InfoRow(
              icon: Icons.person_outline,
              label: 'Biriktirgan',
              value: homework.createdByName!,
            ),
          ],
          if (homework.description.isNotEmpty) ...[
            SizedBox(height: 12),
            Text(
              homework.description,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: colors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _statusIcon(bool isDone, bool isOverdue) {
    if (isDone) return Icons.check_circle_outline;
    if (isOverdue) return Icons.warning_amber_rounded;
    return Icons.schedule;
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: context.dsColors.textSecondary),
        SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            color: context.dsColors.textSecondary,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? context.dsColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

/// Xulosa: topshirildi / topshirilmadi / kechikib topshirilgan.
class _SummaryCard extends StatelessWidget {
  final int total;
  final int submitted;
  final int late;

  const _SummaryCard({
    required this.total,
    required this.submitted,
    required this.late,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final notSubmitted = total - submitted;
    final progress = total == 0 ? 0.0 : submitted / total;

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
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _SummaryItem(
                label: 'Topshirildi',
                value: '$submitted',
                color: context.dsColors.success,
              ),
              _SummaryItem(
                label: 'Topshirilmadi',
                value: '$notSubmitted',
                color: context.dsColors.warning,
              ),
              _SummaryItem(
                label: 'Kechikib',
                value: '$late',
                color: context.dsColors.info,
              ),
            ],
          ),
          SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(context.dsColors.success),
              minHeight: 6,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Topshirish darajasi: ${(progress * 100).round()}%',
            style: TextStyle(
              fontSize: 11.5,
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            color: context.dsColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

/// Bitta talaba qatori — ✓ / ○ / \"Kechikib topshirdi\".
class _StudentSubmissionRow extends ConsumerWidget {
  final String studentName;
  final HomeworkSubmissionRecord? submission;
  final DateTime dueDate;
  final bool canManage;
  final VoidCallback onToggle;

  const _StudentSubmissionRow({
    required this.studentName,
    required this.submission,
    required this.dueDate,
    required this.canManage,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.dsColors;
    final isSubmitted = submission?.submitted ?? false;
    final isLate = submission?.isLate ?? false;

    return Container(
      margin: EdgeInsets.only(bottom: 8),
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: colors.surface,
        border: Border.all(
          color: isLate
              ? context.dsColors.warning.withValues(alpha: 0.5)
              : context.dsColors.border.withValues(alpha: 0.5),
          width: isLate ? 1 : 0.8,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSubmitted
                  ? context.dsColors.success.withValues(alpha: 0.13)
                  : colors.surfaceOverlay,
              shape: BoxShape.circle,
            ),
            child: isSubmitted
                ? Icon(Icons.check, size: 18, color: context.dsColors.success)
                : Icon(
                    Icons.circle_outlined,
                    size: 18,
                    color: colors.textTertiary,
                  ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  studentName,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (isSubmitted) ...[
                  SizedBox(height: 2),
                  Text(
                    isLate
                        ? 'Kechikib topshirdi'
                        : 'Topshirdi • ${_fmtTime(submission?.submittedAt)}',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: isLate ? context.dsColors.warning : context.dsColors.success,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (isLate)
            AppStatusChip(
              tone: AppStatusTone.warning,
              icon: Icons.schedule,
              label: 'Kechikib',
            ),
          if (canManage)
            IconButton(
              tooltip: isSubmitted ? 'Topshirmagan deb belgilash' : 'Topshirgan deb belgilash',
              icon: Icon(
                isSubmitted
                    ? Icons.undo_rounded
                    : Icons.check_circle_outline,
                size: 20,
                color: isSubmitted
                    ? colors.textSecondary
                    : context.dsColors.success,
              ),
              onPressed: onToggle,
            ),
        ],
      ),
    );
  }
}

class _EmptyStudentsCard extends StatelessWidget {
  const _EmptyStudentsCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: context.dsColors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.group_off_outlined,
            size: 40,
            color: context.dsColors.textTertiary,
          ),
          SizedBox(height: 10),
          Text(
            'Guruhda o\'quvchilar yo\'q',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: context.dsColors.textPrimary,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Guruhga o\'quvchi qo\'shilgach topshirish holati shu yerda ko\'rinadi.',
            style: TextStyle(
              fontSize: 12.5,
              color: context.dsColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _DetailError extends StatelessWidget {
  final String message;
  final String detail;

  const _DetailError({required this.message, required this.detail});

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

bool _canManage(UserRole role) =>
    role == UserRole.superAdmin ||
    role == UserRole.director ||
    role == UserRole.admin ||
    role == UserRole.manager ||
    role == UserRole.teacher;

String _fmtDate(DateTime d) =>
    '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';

String _fmtTime(DateTime? t) {
  if (t == null) return '';
  final h = t.hour.toString().padLeft(2, '0');
  final m = t.minute.toString().padLeft(2, '0');
  return '$h:$m';
}
