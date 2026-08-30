import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/complete_task_command.dart';
import '../../application/commands/create_task_command.dart';
import '../../domain/entities/lead_task.dart';
import '../providers/task_providers.dart';

/// Lead detail sahifasida ko'rsatiladigan vazifalar kartochkasi.
///
/// Lead'ning barcha vazifalarini ro'yxat ko'rinishida ko'rsatadi.
/// Yangi vazifa qo'shish, bajarilgan deb belgilash va bekor qilish imkoniyatlari.
class LeadTasksCard extends ConsumerStatefulWidget {
  final String leadId;

  const LeadTasksCard({super.key, required this.leadId});

  @override
  ConsumerState<LeadTasksCard> createState() => _LeadTasksCardState();
}

class _LeadTasksCardState extends ConsumerState<LeadTasksCard> {
  bool _busy = false;

  Future<void> _createTask() async {
    final now = DateTime.now();
    final initial = now.add(const Duration(days: 1));

    // Title
    final titleController = TextEditingController();
    final descriptionController = TextEditingController();
    LeadTaskType type = LeadTaskType.reminder;
    int priority = 3;

    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;

    final dueAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);

    // Task type and priority dialog
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(context.l10n.crmScheduleFollowUp),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleController,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Vazifa nomi',
                    hintText: 'Masalan: Qayta qo\'ng\'iroq qilish',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descriptionController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Tavsif (ixtiyoriy)',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<LeadTaskType>(
                  value: type,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'Vazifa turi',
                    isDense: true,
                  ),
                  items: [
                    for (final t in LeadTaskType.values)
                      DropdownMenuItem(
                        value: t,
                        child: Text(t.label),
                      ),
                  ],
                  onChanged: (v) {
                    if (v != null) setDialogState(() => type = v);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  value: priority,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'Prioritet',
                    isDense: true,
                  ),
                  items: [
                    for (var i = 1; i <= 5; i++)
                      DropdownMenuItem(
                        value: i,
                        child: Text(
                          '$i — ${i == 1 ? "Juda muhim" : i == 2 ? "Muhim" : i == 3 ? "O\'rta" : i == 4 ? "Past" : "Kam muhim"}',
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    if (v != null) setDialogState(() => priority = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(context.l10n.crmCancel),
            ),
            FilledButton(
              onPressed: () {
                if (titleController.text.trim().isEmpty) return;
                Navigator.pop(dialogContext, {
                  'title': titleController.text.trim(),
                  'description': descriptionController.text.trim(),
                  'type': type,
                  'priority': priority,
                });
              },
              child: Text(context.l10n.crmSave),
            ),
          ],
        ),
      ),
    );

    titleController.dispose();
    descriptionController.dispose();

    if (result == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final userId = ref.read(currentUserEmailProvider) ?? 'unknown';
      await ref.read(createTaskCommandProvider).execute(
            CreateTaskRequest(
              leadId: widget.leadId,
              title: result['title'] as String,
              description: (result['description'] as String).isEmpty
                  ? null
                  : result['description'] as String,
              type: result['type'] as LeadTaskType,
              dueAt: dueAt,
              assignedToUserId: userId,
              priority: result['priority'] as int,
            ),
          );
      ref.read(taskListVersionProvider.notifier).state++;
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _completeTask(LeadTask task) async {
    setState(() => _busy = true);
    try {
      final userId = ref.read(currentUserEmailProvider) ?? 'unknown';
      await ref.read(completeTaskCommandProvider).execute(
            CompleteTaskRequest(
              taskId: task.taskId,
              completedByUserId: userId,
            ),
          );
      ref.read(taskListVersionProvider.notifier).state++;
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final tasksAsync = ref.watch(leadTasksProvider(widget.leadId));
    final canEdit = Permissions.can(
      ref.watch(actorRoleProvider),
      AppPermission.crmLeadsEdit,
    );

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                'Vazifalar',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: colors.textTertiary,
                ),
              ),
              const Spacer(),
              if (canEdit)
                IconButton(
                  onPressed: _busy ? null : _createTask,
                  icon: const Icon(Icons.add_task, size: 20),
                  tooltip: 'Vazifa qo\'shish',
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          const SizedBox(height: 8),
          tasksAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(12),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            error: (e, _) => Text(
              userFriendlyMessage(e),
              style: TextStyle(fontSize: 13, color: colors.textSecondary),
            ),
            data: (tasks) {
              if (tasks.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'Hali vazifalar yo\'q',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                );
              }

              return Column(
                children: [
                  for (final task in tasks)
                    _TaskTile(
                      task: task,
                      busy: _busy,
                      onComplete: canEdit ? () => _completeTask(task) : null,
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

class _TaskTile extends StatelessWidget {
  final LeadTask task;
  final bool busy;
  final VoidCallback? onComplete;

  const _TaskTile({
    required this.task,
    required this.busy,
    this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final status = task.effectiveStatus;
    final isCompleted = status == LeadTaskStatus.completed;
    final isOverdue = status == LeadTaskStatus.overdue;

    final statusColor = switch (status) {
      LeadTaskStatus.pending => context.dsColors.accent,
      LeadTaskStatus.completed => context.dsColors.success,
      LeadTaskStatus.cancelled => Colors.grey,
      LeadTaskStatus.overdue => context.dsColors.error,
    };

    final typeIcon = switch (task.type) {
      LeadTaskType.call => Icons.phone_outlined,
      LeadTaskType.message => Icons.message_outlined,
      LeadTaskType.meeting => Icons.event_outlined,
      LeadTaskType.document => Icons.description_outlined,
      LeadTaskType.reminder => Icons.notifications_outlined,
      LeadTaskType.other => Icons.more_horiz,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: isCompleted
            ? Colors.transparent
            : isOverdue
                ? context.dsColors.error.withValues(alpha: 0.05)
                : colors.card,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                if (!isCompleted && onComplete != null)
                  GestureDetector(
                    onTap: busy ? null : onComplete,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.5),
                          width: 1.5,
                        ),
                      ),
                      child: isCompleted
                          ? Icon(Icons.check, size: 14, color: statusColor)
                          : null,
                    ),
                  )
                else
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: statusColor.withValues(alpha: 0.15),
                    ),
                    child: Icon(
                      isCompleted ? Icons.check : typeIcon,
                      size: 13,
                      color: statusColor,
                    ),
                  ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isCompleted
                              ? colors.textTertiary
                              : colors.textPrimary,
                          decoration: isCompleted
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      if (task.description != null &&
                          task.description!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          task.description!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: colors.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _formatDue(task.dueAt),
                      style: TextStyle(
                        fontSize: 11,
                        color: isOverdue ? context.dsColors.error : colors.textTertiary,
                        fontWeight: isOverdue ? FontWeight.w600 : null,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _priorityLabel(task.priority),
                      style: TextStyle(
                        fontSize: 10,
                        color: colors.textTertiary,
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

  String _formatDue(DateTime due) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dueDay = DateTime(due.year, due.month, due.day);

    if (dueDay == today) {
      return 'Bugun ${DateFormat('HH:mm').format(due)}';
    } else if (dueDay == today.add(const Duration(days: 1))) {
      return 'Ertaga ${DateFormat('HH:mm').format(due)}';
    } else if (due.isBefore(now)) {
      final days = now.difference(dueDay).inDays;
      return '$days kun ortdi';
    }
    return DateFormat('dd.MM HH:mm').format(due);
  }

  String _priorityLabel(int priority) => switch (priority) {
        1 => 'P1',
        2 => 'P2',
        3 => 'P3',
        4 => 'P4',
        5 => 'P5',
        _ => '',
      };
}
