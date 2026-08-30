import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../application/commands/create_group_command.dart';
import '../../application/commands/update_group_command.dart';
import '../../domain/entities/group.dart';
import '../providers/group_providers.dart';

/// Guruh yaratish / tahrirlash sahifasi.
///
/// Ro'yxat sahifasidagi "+" tugmasidan ochiladi (`/groups/create`).
/// `editGroupId` berilgan bo'lsa edit rejimi (`/groups/:groupId/edit`):
/// mavjud guruh ma'lumotlari forma'ga to'ldiriladi va
/// [UpdateGroupCommand] ishga tushiriladi.
class CreateGroupPage extends ConsumerStatefulWidget {
  /// Edit rejimida tahrirlanadigan guruh ID'si (null = yangi guruh).
  final String? editGroupId;

  const CreateGroupPage({super.key, this.editGroupId});

  @override
  ConsumerState<CreateGroupPage> createState() => _CreateGroupPageState();
}

class _CreateGroupPageState extends ConsumerState<CreateGroupPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _capacityController = TextEditingController(text: '20');
  final _feeController = TextEditingController();
  final _startTimeController = TextEditingController();
  final _endTimeController = TextEditingController();
  final _notesController = TextEditingController();

  String? _subjectId;
  String? _teacherId;
  String? _roomId;

  /// Edit rejimida guruhdan olingan fan nomi — `_subjectId` fan ro'yxati
  /// yuklanishidan oldin ma'lum bo'lmasligi mumkin, shuning uchun nom
  /// saqlanadi va keyin (yoki saqlashda) ID'ga moslanadi.
  String? _existingSubject;
  GroupStatus _status = GroupStatus.active;
  bool _saving = false;

  /// Edit rejimida guruh yuklanganda bir marta forma'ga to'ldirish.
  bool _prefilled = false;

  static const List<String> _allDays = [
    'dushanba',
    'seshanba',
    'chorshanba',
    'payshanba',
    'juma',
    'shanba',
    'yakshanba',
  ];

  final Set<String> _daysOfWeek = {};

  bool get _isEdit => widget.editGroupId != null;

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _capacityController.dispose();
    _feeController.dispose();
    _startTimeController.dispose();
    _endTimeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String _dayLabel(String day) {
    return switch (day) {
      'dushanba' => 'Du',
      'seshanba' => 'Se',
      'chorshanba' => 'Ch',
      'payshanba' => 'Pa',
      'juma' => 'Ju',
      'shanba' => 'Sh',
      'yakshanba' => 'Ya',
      _ => day,
    };
  }

  /// Edit rejimida yuklangan guruhni forma'ga bir marta to'ldiradi.
  ///
  /// Build fazasidan TASHQARI (post-frame) chaqirilishi shart — aks holda
  /// TextEditingController.text o'zgarishi mounted TextField'larning
  /// listener'ini ishga tushirib "setState() called during build" xatosini
  /// chiqaradi.
  void _prefill(Group group) {
    _nameController.text = group.name;
    _codeController.text = group.code ?? '';
    _capacityController.text = '${group.capacity}';
    _feeController.text = group.monthlyFee > 0 ? '${group.monthlyFee}' : '';
    _startTimeController.text = group.startTime ?? '';
    _endTimeController.text = group.endTime ?? '';
    _notesController.text = group.notes ?? '';
    _teacherId = group.teacherId;
    _roomId = group.roomId;
    _existingSubject = group.subject;
    _status = group.status;
    _daysOfWeek
      ..clear()
      ..addAll(group.daysOfWeek);
    _prefilled = true;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      // Tanlangan fan/o'qituvchi/xona nomlarini denormalizatsiya uchun topamiz.
      final subjects = await ref.read(subjectListProvider.future);
      final teachers = await ref.read(teachersListProvider.future);
      final rooms = await ref.read(roomListProvider.future);

      // Fan tanlanmagan bo'lsa ham (dropdown yuklanmasdan oldin),
      // edit rejimida saqlangan nom orqali topiladi — ma'lumot yo'qolmaydi.
      final subject = _subjectId != null
          ? subjects.where((s) => s.subjectId == _subjectId).firstOrNull
          : (_existingSubject != null
              ? subjects.where((s) => s.name == _existingSubject).firstOrNull
              : null);
      final teacher =
          teachers.where((t) => t.identityId == _teacherId).firstOrNull;
      final room = rooms.where((r) => r.roomId == _roomId).firstOrNull;

      if (_isEdit) {
        await ref.read(updateGroupCommandProvider).execute(
              UpdateGroupRequest(
                groupId: widget.editGroupId!,
                name: _nameController.text.trim(),
                code: _codeController.text.trim().isEmpty
                    ? null
                    : _codeController.text.trim(),
                capacity: int.tryParse(_capacityController.text.trim()) ?? 0,
                teacherId: teacher?.identityId,
                teacherName: teacher?.fullName,
                roomId: room?.roomId,
                roomName: room?.name,
                subject: subject?.name,
                monthlyFee: int.tryParse(_feeController.text.trim()) ?? 0,
                status: _status,
                daysOfWeek: _daysOfWeek.toList(),
                startTime: _startTimeController.text.trim().isEmpty
                    ? null
                    : _startTimeController.text.trim(),
                endTime: _endTimeController.text.trim().isEmpty
                    ? null
                    : _endTimeController.text.trim(),
                notes: _notesController.text.trim().isEmpty
                    ? null
                    : _notesController.text.trim(),
              ),
            );
      } else {
        await ref.read(createGroupCommandProvider).execute(
              CreateGroupRequest(
                name: _nameController.text.trim(),
                code: _codeController.text.trim().isEmpty
                    ? null
                    : _codeController.text.trim(),
                capacity: int.tryParse(_capacityController.text.trim()) ?? 0,
                teacherId: teacher?.identityId,
                teacherName: teacher?.fullName,
                roomId: room?.roomId,
                roomName: room?.name,
                subject: subject?.name,
                monthlyFee: int.tryParse(_feeController.text.trim()) ?? 0,
                daysOfWeek: _daysOfWeek.toList(),
                startTime: _startTimeController.text.trim().isEmpty
                    ? null
                    : _startTimeController.text.trim(),
                endTime: _endTimeController.text.trim().isEmpty
                    ? null
                    : _endTimeController.text.trim(),
                notes: _notesController.text.trim().isEmpty
                    ? null
                    : _notesController.text.trim(),
              ),
            );
      }

      ref.invalidate(groupListVersionProvider);
      ref.invalidate(groupListProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Guruh yangilandi ✓' : 'Guruh yaratildi ✓'),
          backgroundColor: context.dsColors.success,
        ),
      );
      context.pop();
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Xatolik: $e'),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final subjectsAsync = ref.watch(subjectListProvider);
    final teachersAsync = ref.watch(teachersListProvider);
    final roomsAsync = ref.watch(roomListProvider);

    // Edit rejimida guruhni yuklaymiz va forma'ga bir marta to'ldiramiz.
    // `ref.listen` build'dan keyin chaqiriladi — controller.text o'zgarishi
    // build fazasida "setState during build" xatosini bermaydi.
    if (_isEdit) {
      ref.listen<AsyncValue<Group?>>(
        groupDetailProvider(widget.editGroupId!),
        (previous, next) {
          final group = next.valueOrNull;
          if (group != null && !_prefilled) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _prefill(group);
            });
          }
        },
      );
    }

    // Edit rejimida fan ro'yxati yuklangach, tanlangan fanni vizual
    // tiklash (nom → ID moslashuvi). Ma'lumot xavfsizligi saqlashda ham
    // kafolatlanadi (yuqoridagi _save'dagi nom orqali qidiruv).
    if (_isEdit) {
      ref.listen<AsyncValue<List<Subject>>>(
        subjectListProvider,
        (previous, next) {
          final subjects = next.valueOrNull;
          if (subjects != null &&
              _subjectId == null &&
              _existingSubject != null) {
            final match =
                subjects.where((s) => s.name == _existingSubject).firstOrNull;
            if (match != null && mounted) {
              setState(() => _subjectId = match.subjectId);
            }
          }
        },
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Guruhni tahrirlash' : 'Guruh yaratish'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_isEdit) ...[
              // Edit rejimida: guruh holati boshqaruvi.
              ref.watch(groupDetailProvider(widget.editGroupId!)).when(
                    loading: () => const LinearProgressIndicator(minHeight: 2),
                    error: (error, _) => Text(
                      'Guruh yuklanmadi: $error',
                      style: TextStyle(color: context.dsColors.error),
                    ),
                    data: (_) => const SizedBox.shrink(),
                  ),
              DropdownButtonFormField<GroupStatus>(
                initialValue: _status,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Holat',
                  prefixIcon: Icon(Icons.radio_button_checked_outlined),
                ),
                items: const [
                  DropdownMenuItem(
                    value: GroupStatus.active,
                    child: Text('Faol'),
                  ),
                  DropdownMenuItem(
                    value: GroupStatus.inactive,
                    child: Text('Nofaol'),
                  ),
                  DropdownMenuItem(
                    value: GroupStatus.archived,
                    child: Text('Arxiv'),
                  ),
                ],
                onChanged: (v) => setState(() => _status = v ?? _status),
              ),
              const SizedBox(height: 14),
            ],
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Guruh nomi *',
                hintText: 'masalan: Matematika-101',
                prefixIcon: Icon(Icons.groups_outlined),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Guruh nomi shart' : null,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _codeController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Kod',
                      hintText: 'masalan: MATH-101',
                      prefixIcon: Icon(Icons.tag),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _capacityController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: "Sig'im *",
                      hintText: '20',
                      prefixIcon: Icon(Icons.person_add_alt_1),
                    ),
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      if (n == null || n <= 0) return "To'g'ri sig'im kiriting";
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Fan tanlash
            subjectsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text('Fanlar xatosi: $error'),
              data: (subjects) {
                if (subjects.isEmpty) return const SizedBox.shrink();
                return DropdownButtonFormField<String>(
                  // Qiymat ro'yxatda bo'lmasa null — aks holda dropdown
                  // assertion xatosi chiqadi (o'chirilgan fan/o'qituvchi/xona).
                  initialValue: subjects.any((s) => s.subjectId == _subjectId)
                      ? _subjectId
                      : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Fan',
                    prefixIcon: Icon(Icons.menu_book_outlined),
                  ),
                  hint: const Text("Fan tanlang"),
                  items: [
                    for (final s in subjects)
                      DropdownMenuItem(
                        value: s.subjectId,
                        child: Text(s.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _subjectId = v),
                );
              },
            ),
            const SizedBox(height: 14),
            // O'qituvchi tanlash
            teachersAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text("O'qituvchilar xatosi: $error"),
              data: (teachers) {
                if (teachers.isEmpty) return const SizedBox.shrink();
                return DropdownButtonFormField<String>(
                  initialValue: teachers.any((t) => t.identityId == _teacherId)
                      ? _teacherId
                      : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: "O'qituvchi",
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  hint: const Text("O'qituvchi tanlang"),
                  items: [
                    for (final t in teachers)
                      DropdownMenuItem(
                        value: t.identityId,
                        child:
                            Text(t.fullName, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _teacherId = v),
                );
              },
            ),
            const SizedBox(height: 14),
            // Xona tanlash
            roomsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text('Xonalar xatosi: $error'),
              data: (rooms) {
                if (rooms.isEmpty) return const SizedBox.shrink();
                return DropdownButtonFormField<String>(
                  initialValue: rooms.any((r) => r.roomId == _roomId) ? _roomId : null,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Xona',
                    prefixIcon: Icon(Icons.meeting_room_outlined),
                  ),
                  hint: const Text('Xona tanlang'),
                  items: [
                    for (final r in rooms)
                      DropdownMenuItem(
                        value: r.roomId,
                        child: Text(r.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _roomId = v),
                );
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _feeController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: "Oylik to'lov (so'm)",
                hintText: '0',
                prefixIcon: Icon(Icons.attach_money),
              ),
            ),
            SizedBox(height: 20),
            Text(
              'Haftalik dars kunlari',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final day in _allDays)
                  FilterChip(
                    label: Text(_dayLabel(day)),
                    selected: _daysOfWeek.contains(day),
                    onSelected: (selected) {
                      setState(() {
                        if (selected) {
                          _daysOfWeek.add(day);
                        } else {
                          _daysOfWeek.remove(day);
                        }
                      });
                    },
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _startTimeController,
                    decoration: const InputDecoration(
                      labelText: 'Boshlanish vaqti',
                      hintText: '09:00',
                      prefixIcon: Icon(Icons.schedule),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _endTimeController,
                    decoration: const InputDecoration(
                      labelText: 'Tugash vaqti',
                      hintText: '10:30',
                      prefixIcon: Icon(Icons.timer_outlined),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Izoh',
                alignLabelWithHint: true,
                prefixIcon: Icon(Icons.notes_outlined),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: Text(
                _saving
                    ? 'Saqlanmoqda…'
                    : (_isEdit ? 'O\'zgarishlarni saqlash' : 'Guruh yaratish'),
              ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
