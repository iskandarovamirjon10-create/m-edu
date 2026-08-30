import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../teachers/domain/entities/teacher.dart';
import '../../../teachers/presentation/providers/teacher_providers.dart';
import '../../application/commands/create_schedule_command.dart';
import '../../domain/entities/room.dart';
import '../../domain/entities/schedule.dart';
import '../providers/schedule_providers.dart';

/// "Dars qo'shish" bottom sheet'ini ochadi.
///
/// Foydalanuvchi guruh, o'qituvchi, xona, kun va vaqtni tanlaydi.
/// Muvaffaqiyatda ro'yxat versiyasi oshirilib, jadval real-time yangilanadi.
Future<void> showAddLessonSheet(
  BuildContext context,
  WidgetRef ref, {
  DayOfWeek initialDay = DayOfWeek.monday,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: _AddLessonSheet(initialDay: initialDay),
    ),
  );
}

class _AddLessonSheet extends ConsumerStatefulWidget {
  final DayOfWeek initialDay;

  const _AddLessonSheet({required this.initialDay});

  @override
  ConsumerState<_AddLessonSheet> createState() => _AddLessonSheetState();
}

class _AddLessonSheetState extends ConsumerState<_AddLessonSheet> {
  final _subjectController = TextEditingController();
  Group? _group;
  Teacher? _teacher;
  Room? _room;
  late DayOfWeek _day;
  TimeOfDay _start = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _end = const TimeOfDay(hour: 10, minute: 0);
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _day = widget.initialDay;
  }

  @override
  void dispose() {
    _subjectController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupListProvider);
    final teachersAsync = ref.watch(teacherListProvider);
    final identitiesAsync = ref.watch(identityListProvider);
    final roomsAsync = ref.watch(roomListProvider);

    return Container(
      decoration: BoxDecoration(
        color: context.dsColors.scaffold,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
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
                'Dars qo\'shish',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              SizedBox(height: 16),

              // Kun tanlash (pilla)
              _daySelector(),

              SizedBox(height: 16),

              // Guruh
              _DropdownField<Group>(
                label: 'Guruh',
                icon: Icons.groups_outlined,
                value: _group,
                loading: groupsAsync.isLoading,
                display: (g) => g.name,
                items: groupsAsync.valueOrNull ?? const [],
                onChanged: (g) => setState(() => _group = g),
              ),
              SizedBox(height: 12),

              // O'qituvchi
              _buildTeacherField(teachersAsync, identitiesAsync),
              SizedBox(height: 12),

              // Xona
              _DropdownField<Room>(
                label: 'Xona',
                icon: Icons.meeting_room_outlined,
                value: _room,
                loading: roomsAsync.isLoading,
                display: (r) => r.name,
                items: roomsAsync.valueOrNull ?? const [],
                onChanged: (r) => setState(() => _room = r),
              ),
              SizedBox(height: 12),

              // Fan (ixtiyoriy)
              TextField(
                controller: _subjectController,
                decoration: const InputDecoration(
                  labelText: 'Fan (ixtiyoriy)',
                  prefixIcon: Icon(Icons.menu_book_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                  ),
                ),
              ),
              SizedBox(height: 12),

              // Vaqt
              Row(
                children: [
                  Expanded(
                    child: _TimeButton(
                      label: 'Boshlanish',
                      time: _start,
                      onTap: () => _pickTime(updateEnd: false),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: _TimeButton(
                      label: 'Tugash',
                      time: _end,
                      onTap: () => _pickTime(updateEnd: true),
                    ),
                  ),
                ],
              ),

              if (_error != null) ...[
                SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: context.dsColors.error, fontSize: 13),
                ),
              ],

              SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(Icons.add),
                  label: Text(_saving ? 'Saqlanmoqda...' : 'Darsni saqlash'),
                  style: FilledButton.styleFrom(
                    backgroundColor: context.dsColors.accent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _daySelector() {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: DayOfWeek.values.length,
        separatorBuilder: (_, __) => SizedBox(width: 8),
        itemBuilder: (context, index) {
          final day = DayOfWeek.values[index];
          final selected = day == _day;
          return GestureDetector(
            onTap: () => setState(() => _day = day),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: selected ? context.dsColors.accent : context.dsColors.surface,
                border: Border.all(
                  color: selected
                      ? context.dsColors.accent
                      : context.dsColors.border.withValues(alpha: 0.4),
                ),
              ),
              child: Text(
                _dayFullName(day),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : context.dsColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTeacherField(
    AsyncValue<List<Teacher>> teachersAsync,
    AsyncValue<List<Identity>> identitiesAsync,
  ) {
    final teachers = teachersAsync.valueOrNull ?? const <Teacher>[];
    final identities = identitiesAsync.valueOrNull ?? const <Identity>[];

    String teacherName(Teacher t) {
      for (final i in identities) {
        if (i.identityId == t.identityId) {
          final name = '${i.firstName} ${i.lastName}'.trim();
          if (name.isNotEmpty) return name;
        }
      }
      return t.identityId;
    }

    return _DropdownField<Teacher>(
      label: 'O\'qituvchi',
      icon: Icons.person_outline,
      value: _teacher,
      loading: teachersAsync.isLoading,
      display: teacherName,
      items: teachers,
      onChanged: (t) => setState(() => _teacher = t),
    );
  }

  Future<void> _pickTime({required bool updateEnd}) async {
    final current = updateEnd ? _end : _start;
    final picked = await showTimePicker(
      context: context,
      initialTime: current,
    );
    if (picked == null) return;
    setState(() {
      if (updateEnd) {
        _end = picked;
      } else {
        _start = picked;
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });

    final group = _group;
    final teacher = _teacher;
    final room = _room;

    if (group == null || teacher == null || room == null) {
      setState(() {
        _saving = false;
        _error = 'Guruh, o\'qituvchi va xona tanlanishi shart';
      });
      return;
    }

    if (_end.hour * 60 + _end.minute <= _start.hour * 60 + _start.minute) {
      setState(() {
        _saving = false;
        _error = 'Tugash vaqti boshlanish vaqtdan keyin bo\'lishi kerak';
      });
      return;
    }

    try {
      await ref.read(createScheduleCommandProvider).execute(
            CreateScheduleRequest(
              groupId: group.groupId,
              groupName: group.name,
              teacherId: teacher.identityId,
              teacherName: _teacherName(teacher),
              roomId: room.roomId,
              roomName: room.name,
              dayOfWeek: _day,
              startTime: _fmt(_start),
              endTime: _fmt(_end),
              subject: _subjectController.text.trim().isEmpty
                  ? null
                  : _subjectController.text.trim(),
            ),
          );

      if (!mounted) return;
      ref.read(scheduleListVersionProvider.notifier).state++;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Dars qo\'shildi')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  String _teacherName(Teacher teacher) {
    final identities =
        ref.read(identityListProvider).valueOrNull ?? const <Identity>[];
    for (final i in identities) {
      if (i.identityId == teacher.identityId) {
        final name = '${i.firstName} ${i.lastName}'.trim();
        if (name.isNotEmpty) return name;
      }
    }
    return teacher.identityId;
  }

  static String _fmt(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  static String _dayFullName(DayOfWeek day) {
    return switch (day) {
      DayOfWeek.monday => 'Dushanba',
      DayOfWeek.tuesday => 'Seshanba',
      DayOfWeek.wednesday => 'Chorshanba',
      DayOfWeek.thursday => 'Payshanba',
      DayOfWeek.friday => 'Juma',
      DayOfWeek.saturday => 'Shanba',
      DayOfWeek.sunday => 'Yakshanba',
    };
  }
}

class _DropdownField<T> extends StatelessWidget {
  final String label;
  final IconData icon;
  final T? value;
  final bool loading;
  final List<T> items;
  final String Function(T) display;
  final ValueChanged<T?> onChanged;

  const _DropdownField({
    required this.label,
    required this.icon,
    required this.value,
    required this.loading,
    required this.items,
    required this.display,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      hint: Text('$label tanlang'),
      items: [
        for (final item in items)
          DropdownMenuItem(value: item, child: Text(display(item))),
      ],
      onChanged: onChanged,
    );
  }
}

class _TimeButton extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final VoidCallback onTap;

  const _TimeButton({
    required this.label,
    required this.time,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: context.dsColors.accent.withValues(alpha: 0.08),
          border: Border.all(
            color: context.dsColors.border.withValues(alpha: 0.5),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
            ),
            SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.schedule, size: 16, color: context.dsColors.accent),
                SizedBox(width: 6),
                Text(
                  '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.accent,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
