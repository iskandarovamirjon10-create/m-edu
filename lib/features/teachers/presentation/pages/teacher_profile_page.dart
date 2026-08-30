import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../identity/presentation/widgets/identity_avatar.dart';
import '../../../identity/presentation/widgets/status_badge.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../application/commands/update_teacher_command.dart';
import '../../domain/entities/teacher.dart';
import '../providers/teacher_providers.dart';

/// O'qituvchi profili (spec SCREEN 14).
///
/// Header (avatar, ism, mutaxassislik, holat, kontakt) + ish yuki +
/// guruhlar + haftalik jadval. Barcha ma'lumotlar REAL bazadan
/// (identity, teacher, group, schedule) — hech qanday placeholder yo'q.
class TeacherProfilePage extends ConsumerWidget {
  final String identityId;

  const TeacherProfilePage({super.key, required this.identityId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teacherAsync = ref.watch(teacherDetailProvider(identityId));
    final identityAsync = ref.watch(identityDetailProvider(identityId));

    return Scaffold(
      appBar: AppBar(
        title: Text('${context.l10n.navTeachers} — ${context.l10n.navProfile}'),
        actions: [
          IconButton(
            tooltip: 'Tahrirlash',
            icon: Icon(Icons.edit_outlined),
            onPressed: () async {
              final teacher = teacherAsync.valueOrNull;
              if (teacher == null) return;
              await _openEditSheet(context, ref, teacher);
            },
          ),
        ],
      ),
      body: teacherAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(
          message: 'Ma\'lumotlarni yuklashda xatolik yuz berdi.',
          detail: '$e',
        ),
        data: (teacher) {
          if (teacher == null) {
            return const _ErrorView(
              message: 'O\'qituvchi topilmadi.',
              detail: 'Bu identity o\'qituvchi sifatida ro\'yxatdan o\'tgan emas.',
            );
          }
          return identityAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorView(
              message: 'Ma\'lumotlarni yuklashda xatolik yuz berdi.',
              detail: '$e',
            ),
            data: (identity) {
              if (identity == null) {
                return const _ErrorView(
                  message: 'Shaxs ma\'lumotlari topilmadi.',
                  detail: 'Identity o\'chirilgan yoki mavjud emas.',
                );
              }
              return _TeacherProfileBody(
                teacher: teacher,
                identity: identity,
              );
            },
          );
        },
      ),
    );
  }

  /// O'qituvchi profilini tahrirlash — bottom sheet (SCREEN 15 edit qismi).
  Future<void> _openEditSheet(
    BuildContext context,
    WidgetRef ref,
    Teacher teacher,
  ) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: _TeacherEditSheet(teacher: teacher),
      ),
    );
  }
}

class _TeacherProfileBody extends ConsumerWidget {
  final Teacher teacher;
  final Identity identity;

  const _TeacherProfileBody({
    required this.teacher,
    required this.identity,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(groupListProvider);
    final scheduleAsync = ref.watch(scheduleListProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 900;

        return SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            isDesktop ? 32 : 16,
            16,
            isDesktop ? 32 : 16,
            40,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1080),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _HeaderCard(teacher: teacher, identity: identity),
                SizedBox(height: 16),
                if (isDesktop)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 5,
                        child: _buildGroupsSection(context, groupsAsync),
                      ),
                      SizedBox(width: 16),
                      Expanded(
                        flex: 7,
                        child: _buildScheduleSection(context, scheduleAsync),
                      ),
                    ],
                  )
                else ...[
                  _buildGroupsSection(context, groupsAsync),
                  SizedBox(height: 24),
                  _buildScheduleSection(context, scheduleAsync),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildGroupsSection(
    BuildContext context,
    AsyncValue<List<Group>> groupsAsync,
  ) {
    return _SectionCard(
      title: 'Guruhlari',
      icon: Icons.groups_outlined,
      child: groupsAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        error: (e, _) => Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Guruhlarni yuklashda xatolik yuz berdi.',
            style: TextStyle(color: context.dsColors.error, fontSize: 13),
          ),
        ),
        data: (groups) {
          final mine = groups
              .where((g) => g.teacherId == teacher.identityId)
              .toList()
            ..sort((a, b) => a.name.compareTo(b.name));

          if (mine.isEmpty) {
            return Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(
                    Icons.group_off_outlined,
                    size: 36,
                    color: context.dsColors.textTertiary,
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Hozircha guruhlar biriktirilmagan',
                    style: TextStyle(
                      fontSize: 13,
                      color: context.dsColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              for (final group in mine) _GroupRow(group: group),
            ],
          );
        },
      ),
    );
  }

  Widget _buildScheduleSection(
    BuildContext context,
    AsyncValue<List<Schedule>> scheduleAsync,
  ) {
    return _SectionCard(
      title: 'Haftalik jadval',
      icon: Icons.calendar_month_outlined,
      child: scheduleAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        error: (e, _) => Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Jadvalni yuklashda xatolik yuz berdi.',
            style: TextStyle(color: context.dsColors.error, fontSize: 13),
          ),
        ),
        data: (schedules) {
          final mine = schedules
              .where((s) => s.teacherId == teacher.identityId)
              .toList()
            ..sort((a, b) {
              final dayCmp = a.dayOfWeek.index.compareTo(b.dayOfWeek.index);
              if (dayCmp != 0) return dayCmp;
              return a.startTime.compareTo(b.startTime);
            });

          if (mine.isEmpty) {
            return Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(
                    Icons.event_busy_outlined,
                    size: 36,
                    color: context.dsColors.textTertiary,
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Jadvalda darslar belgilanmagan',
                    style: TextStyle(
                      fontSize: 13,
                      color: context.dsColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              for (final s in mine) _ScheduleRow(schedule: s),
            ],
          );
        },
      ),
    );
  }
}

/// Sarlavha: avatar, ism, mutaxassislik, holat, kontakt, ish yuki.
class _HeaderCard extends StatelessWidget {
  final Teacher teacher;
  final Identity identity;

  const _HeaderCard({required this.teacher, required this.identity});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final workload = teacher.workloadPercentage;
    final workloadColor = workload >= 90
        ? context.dsColors.error
        : workload >= 70
            ? context.dsColors.warning
            : context.dsColors.success;

    return Container(
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
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
              IdentityAvatar(identity: identity, radius: 32),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      identity.fullName,
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: colors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      teacher.specialization ?? 'Mutaxassislik belgilanmagan',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: colors.textSecondary,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'O\'qituvchi raqami: ${teacher.teacherNumber}',
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(status: identity.status),
            ],
          ),
          SizedBox(height: 16),
          const Divider(height: 1),
          SizedBox(height: 14),
          // Kontakt qatori (faqat real ma'lumotlar).
          Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              if (identity.phone != null)
                _ContactItem(
                  icon: Icons.phone_outlined,
                  label: identity.phone!,
                ),
              if (identity.email != null)
                _ContactItem(
                  icon: Icons.email_outlined,
                  label: identity.email!,
                ),
              if (teacher.startDate != null)
                _ContactItem(
                  icon: Icons.work_outline,
                  label:
                      'Ish boshlagan: ${_fmtDate(teacher.startDate!)}',
                ),
            ],
          ),
          SizedBox(height: 16),
          // Ish yuki (foiz + soatlar — faqat rang emas, matn ham).
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: workload / 100,
                    backgroundColor:
                        context.dsColors.border.withValues(alpha: 0.3),
                    valueColor: AlwaysStoppedAnimation<Color>(workloadColor),
                    minHeight: 6,
                  ),
                ),
              ),
              SizedBox(width: 12),
              Text(
                '${teacher.weeklyHours}/${teacher.maxWeeklyHours} soat '
                '(${workload.round()}%)',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: workloadColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ContactItem extends StatelessWidget {
  final IconData icon;
  final String label;

  const _ContactItem({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: context.dsColors.textSecondary),
        SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            color: context.dsColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: colors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Row(
              children: [
                Icon(icon, size: 17, color: context.dsColors.accent),
                SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _GroupRow extends StatelessWidget {
  final Group group;

  const _GroupRow({required this.group});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return InkWell(
      onTap: () {
        AppHaptics.tap();
        context.push('/groups/${group.groupId}');
      },
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 10),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: context.dsColors.accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(
                Icons.groups_outlined,
                size: 20,
                color: context.dsColors.accent,
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.textPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    [
                      if (group.subject != null) group.subject!,
                      '${group.currentSize}/${group.capacity} o\'quvchi',
                    ].join(' • '),
                    style: TextStyle(
                      fontSize: 12,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              size: 18,
              color: colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  final Schedule schedule;

  const _ScheduleRow({required this.schedule});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        children: [
          Container(
            width: 64,
            padding: EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: context.dsColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                Text(
                  schedule.startTime,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.accent,
                  ),
                ),
                Text(
                  schedule.endTime,
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
                  schedule.subject ?? schedule.groupName ?? 'Dars',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 2),
                Text(
                  '${schedule.dayName} • ${schedule.groupName ?? schedule.groupId}',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: colors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          SizedBox(width: 8),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: context.dsColors.success.withValues(alpha: 0.14),
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
        ],
      ),
    );
  }
}

/// Profil tahrirlash — bottom sheet (mutaxassislik, soatlar, izoh).
class _TeacherEditSheet extends ConsumerStatefulWidget {
  final Teacher teacher;

  const _TeacherEditSheet({required this.teacher});

  @override
  ConsumerState<_TeacherEditSheet> createState() => _TeacherEditSheetState();
}

class _TeacherEditSheetState extends ConsumerState<_TeacherEditSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _specializationController;
  late final TextEditingController _hoursController;
  late final TextEditingController _notesController;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _specializationController = TextEditingController(
      text: widget.teacher.specialization ?? '',
    );
    _hoursController = TextEditingController(
      text: '${widget.teacher.maxWeeklyHours}',
    );
    _notesController = TextEditingController(text: widget.teacher.notes ?? '');
  }

  @override
  void dispose() {
    _specializationController.dispose();
    _hoursController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(updateTeacherCommandProvider).execute(
            UpdateTeacherRequest(
              identityId: widget.teacher.identityId,
              specialization: _specializationController.text.trim().isEmpty
                  ? null
                  : _specializationController.text.trim(),
              maxWeeklyHours: int.tryParse(_hoursController.text.trim()),
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
            ),
          );
      ref.invalidate(teacherListVersionProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saqlandi.'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = failure.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.dsColors.scaffold,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Theme.of(context).dividerColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                SizedBox(height: 16),
                Text(
                  "O'qituvchini tahrirlash",
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                ),
                SizedBox(height: 18),
                TextFormField(
                  controller: _specializationController,
                  decoration: const InputDecoration(
                    labelText: 'Mutaxassislik',
                    hintText: 'masalan: Matematika',
                    prefixIcon: Icon(Icons.menu_book_outlined),
                  ),
                ),
                SizedBox(height: 12),
                TextFormField(
                  controller: _hoursController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Maksimal haftalik soat',
                    prefixIcon: Icon(Icons.schedule_outlined),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) return null;
                    final hours = int.tryParse(value.trim());
                    if (hours == null || hours <= 0 || hours > 168) {
                      return 'Soatlar soni noto\'g\'ri';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 12),
                TextFormField(
                  controller: _notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Izoh',
                    alignLabelWithHint: true,
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(bottom: 40),
                      child: Icon(Icons.notes_outlined),
                    ),
                  ),
                ),
                if (_error != null) ...[
                  SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: context.dsColors.error,
                      fontSize: 13,
                    ),
                  ),
                ],
                SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(Icons.save_outlined),
                    label: Text(_saving ? 'Saqlanmoqda...' : 'Saqlash'),
                    style: FilledButton.styleFrom(
                      backgroundColor: context.dsColors.accent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final String detail;

  const _ErrorView({required this.message, required this.detail});

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
