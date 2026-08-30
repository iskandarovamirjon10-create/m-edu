import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';

/// Uy vazifalari markazi — guruh bo'yicha guruhlangan, holat filtri bilan.
class HomeworkPage extends ConsumerStatefulWidget {
  const HomeworkPage({super.key});

  @override
  ConsumerState<HomeworkPage> createState() => _HomeworkPageState();
}

class _HomeworkPageState extends ConsumerState<HomeworkPage> {
  String _filter = 'all';

  bool get _canCreate {
    final role = ref.read(actorRoleProvider);
    return role == UserRole.superAdmin ||
        role == UserRole.director ||
        role == UserRole.admin ||
        role == UserRole.manager ||
        role == UserRole.teacher;
  }

  @override
  Widget build(BuildContext context) {
    final homeworksAsync = ref.watch(homeworkListProvider);
    final canCreate = _canCreate;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.navHomework)),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/homework/new'),
              icon: const Icon(Icons.add_task_outlined),
              label: const Text('Yangi vazifa'),
            )
          : null,
      body: Column(
        children: [
          _buildFilterChips(),
          Expanded(
            child: homeworksAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Xatolik: $e')),
              data: (list) => _buildList(context, list, canCreate),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      ('all', 'Barchasi', Icons.view_list_outlined),
      ('active', 'Faol', Icons.schedule_outlined),
      ('overdue', "Muddati o'tgan", Icons.warning_amber_rounded),
      ('completed', 'Bajarilgan', Icons.check_circle_outline),
    ];
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (key, label, icon) = filters[i];
          final selected = _filter == key;
          return ChoiceChip(
            selected: selected,
            showCheckmark: false,
            avatar: Icon(
              icon,
              size: 16,
              color: selected
                  ? Colors.white
                  : context.dsColors.textSecondary,
            ),
            label: Text(label),
            labelStyle: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : context.dsColors.textPrimary,
            ),
            selectedColor: context.dsColors.accent,
            backgroundColor: context.dsColors.surface,
            side: BorderSide(
              color: selected
                  ? context.dsColors.accent
                  : context.dsColors.border.withValues(alpha: 0.8),
              width: selected ? 1.5 : 0.8,
            ),
            onSelected: (_) {
              AppHaptics.tap();
              setState(() => _filter = key);
            },
          );
        },
      ),
    );
  }

  Widget _buildList(
    BuildContext context,
    List<Homework> list,
    bool canCreate,
  ) {
    final filtered = list.where((h) {
      switch (_filter) {
        case 'active':
          return h.status == HomeworkStatus.active;
        case 'overdue':
          return h.isOverdue;
        case 'completed':
          return h.status == HomeworkStatus.completed;
        default:
          return true;
      }
    }).toList();

    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.assignment_outlined,
              size: 56,
              color: context.dsColors.textTertiary,
            ),
            const SizedBox(height: 12),
            Text(
              _filter == 'all' && list.isEmpty
                  ? "Hozircha uy vazifalari yo'q"
                  : 'Bu bo\'limda vazifa yo\'q',
              style: TextStyle(
                fontSize: 15,
                color: context.dsColors.textSecondary,
              ),
            ),
            if (canCreate) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => context.push('/homework/new'),
                icon: const Icon(Icons.add_task_outlined, size: 18),
                label: const Text('Birinchi vazifani qo\'shish'),
              ),
            ],
          ],
        ),
      );
    }

    // Guruh bo'yicha guruhlash, guruh ichida muddat bo'yicha.
    final byGroup = <String, List<Homework>>{};
    for (final h in filtered) {
      byGroup.putIfAbsent(h.groupId, () => []).add(h);
    }
    final groupKeys = byGroup.keys.toList()
      ..sort((a, b) {
        final na = byGroup[a]!.first.groupName ?? a;
        final nb = byGroup[b]!.first.groupName ?? b;
        return na.compareTo(nb);
      });

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
      itemCount: groupKeys.length,
      itemBuilder: (context, gi) {
        final groupId = groupKeys[gi];
        final items = byGroup[groupId]!;
        final groupName = items.first.groupName ?? groupId;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
              child: Row(
                children: [
                  Icon(
                    Icons.groups_outlined,
                    size: 16,
                    color: context.dsColors.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    groupName,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: context.dsColors.accent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${items.length}',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.accent,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            for (final h in items)
              _HomeworkCard(
                homework: h,
                canManage: canCreate,
                onToggleComplete: () => _toggleComplete(h),
                onDelete: () => _delete(h),
              ),
          ],
        );
      },
    );
  }

  Future<void> _toggleComplete(Homework h) async {
    try {
      await ref
          .read(completeHomeworkCommandProvider)
          .execute(h.homeworkId, !h.isCompleted);
      ref.invalidate(homeworkListVersionProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: context.dsColors.error),
      );
    }
  }

  Future<void> _delete(Homework h) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vazifani o\'chirish'),
        content: Text(
          '"${h.title}" vazifasi o\'chirilsinmi? Bu amalni ortga qaytarib '
          'bo\'lmaydi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('O\'chirish'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(deleteHomeworkCommandProvider).execute(h.homeworkId);
      ref.invalidate(homeworkListVersionProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: context.dsColors.error),
      );
    }
  }
}

class _HomeworkCard extends StatelessWidget {
  final Homework homework;
  final bool canManage;
  final VoidCallback onToggleComplete;
  final VoidCallback onDelete;

  const _HomeworkCard({
    required this.homework,
    required this.canManage,
    required this.onToggleComplete,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isOverdue = homework.isOverdue;
    final isDone = homework.isCompleted;
    final due = homework.dueDate;
    final dueText =
        '${due.day}.${due.month.toString().padLeft(2, '0')}.${due.year}';
    final Color accent = isDone
        ? context.dsColors.success
        : isOverdue
            ? context.dsColors.error
            : context.dsColors.accent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: context.dsColors.surface,
        border: Border.all(
          color: isOverdue
              ? context.dsColors.error.withValues(alpha: 0.4)
              : context.dsColors.border.withValues(alpha: 0.6),
          width: isOverdue ? 1.2 : 0.8,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: canManage ? onToggleComplete : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDone
                    ? context.dsColors.success
                    : Colors.transparent,
                border: Border.all(
                  color: isDone ? context.dsColors.success : accent,
                  width: 2,
                ),
              ),
              child: isDone
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  homework.title,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                    decoration: isDone ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.book_outlined,
                      size: 13,
                      color: context.dsColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      homework.subjectName,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.event_outlined,
                      size: 13,
                      color: isOverdue
                          ? context.dsColors.error
                          : context.dsColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isOverdue ? 'Muddat o\'tgan: $dueText' : dueText,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isOverdue ? FontWeight.w600 : null,
                        color: isOverdue
                            ? context.dsColors.error
                            : context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                if (homework.description.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    homework.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.35,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (canManage)
            PopupMenuButton<String>(
              icon: Icon(
                Icons.more_vert,
                size: 18,
                color: context.dsColors.textTertiary,
              ),
              onSelected: (v) {
                if (v == 'toggle') onToggleComplete();
                if (v == 'delete') onDelete();
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'toggle',
                  child: Text(isDone ? 'Bajarilmagan' : 'Bajarilgan'),
                ),
                PopupMenuItem(
                  value: 'delete',
                  child: const Text('O\'chirish'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
