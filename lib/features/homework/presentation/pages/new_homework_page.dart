import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../groups/domain/entities/group.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../domain/entities/homework.dart';
import '../providers/homework_providers.dart';

/// Vazifa yaratish / tahrirlash sahifasi (spec SCREEN 24).
///
/// [editHomeworkId] berilgan bo'lsa — mavjud vazifa yuklanadi va
/// tahrirlanadi; aks holda yangi vazifa yaratiladi. Muddat bugundan
/// oldin bo'lmaydi (picker firstDate cheklovi + validatsiya).
class NewHomeworkPage extends ConsumerStatefulWidget {
  final String? editHomeworkId;

  const NewHomeworkPage({super.key, this.editHomeworkId});

  @override
  ConsumerState<NewHomeworkPage> createState() => _NewHomeworkPageState();
}

class _NewHomeworkPageState extends ConsumerState<NewHomeworkPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();

  String? _selectedGroupId;
  String? _selectedGroupName;

  DateTime _dueDate = DateTime.now().add(
    const Duration(days: 3),
  );

  bool _saving = false;
  bool _loading = false;

  bool get _isEdit => widget.editHomeworkId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadExisting());
    }
  }

  Future<void> _loadExisting() async {
    final homework = await ref
        .read(homeworkDetailProvider(widget.editHomeworkId!).future)
        .catchError((_) => null);
    if (!mounted) return;
    setState(() {
      _loading = false;
    });
    if (homework == null) return;
    setState(() {
      _selectedGroupId = homework.groupId;
      _selectedGroupName = homework.groupName;
      _subjectController.text = homework.subjectName;
      _titleController.text = homework.title;
      _descriptionController.text = homework.description;
      _dueDate = homework.dueDate;
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Vazifani tahrirlash' : 'Yangi uy vazifasi'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Guruh *',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  groupsAsync.when(
                    loading: () => const SizedBox(
                      height: 52,
                      child: Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    error: (_, __) => const Text(
                      'Guruhlarni yuklashda xatolik yuz berdi.',
                    ),
                    data: (groups) {
                      final items = groups
                          .where(
                            (group) => group.status != GroupStatus.archived,
                          )
                          .toList()
                        ..sort((a, b) => a.name.compareTo(b.name));

                      if (items.isEmpty) {
                        return const Text(
                          'Avval guruh yarating.',
                        );
                      }

                      return DropdownButtonFormField<String>(
                        initialValue: _selectedGroupId,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.groups_outlined),
                          hintText: 'Guruhni tanlang',
                        ),
                        items: [
                          for (final group in items)
                            DropdownMenuItem<String>(
                              value: group.groupId,
                              child: Text(
                                group.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (groupId) {
                          if (groupId == null) return;
                          final selectedGroup = items.firstWhere(
                            (group) => group.groupId == groupId,
                          );
                          setState(() {
                            _selectedGroupId = groupId;
                            _selectedGroupName = selectedGroup.name;
                          });
                        },
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Guruhni tanlang';
                          }
                          return null;
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _subjectController,
                    decoration: const InputDecoration(
                      labelText: 'Fan nomi *',
                      hintText: 'masalan: Matematika, Ingliz tili',
                      prefixIcon: Icon(Icons.book_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Fan nomi shart';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _titleController,
                    decoration: const InputDecoration(
                      labelText: 'Vazifa sarlavhasi *',
                      hintText: 'masalan: 3-bob, 120-124 bet',
                      prefixIcon: Icon(Icons.title),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Sarlavha shart';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Tavsif',
                      hintText: 'Batafsil vazifa shartlari...',
                      alignLabelWithHint: true,
                      prefixIcon: Padding(
                        padding: EdgeInsets.only(bottom: 48),
                        child: Icon(Icons.notes_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.event_outlined,
                      color: context.dsColors.accent,
                    ),
                    title: Text(
                      'Topshirish muddati',
                      style: TextStyle(
                        color: context.dsColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: Text(
                      '${_dueDate.day.toString().padLeft(2, '0')}.'
                      '${_dueDate.month.toString().padLeft(2, '0')}.'
                      '${_dueDate.year}',
                      style: TextStyle(
                        color: context.dsColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    trailing: Icon(
                      Icons.chevron_right,
                      color: context.dsColors.textTertiary,
                    ),
                    onTap: _pickDate,
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
                        : const Icon(Icons.save_outlined),
                    label: Text(
                      _saving
                          ? 'Saqlanmoqda...'
                          : _isEdit
                              ? 'Saqlash'
                              : 'Vazifani yaratish',
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate.isBefore(DateTime.now())
          ? DateTime.now()
          : _dueDate,
      firstDate: DateTime.now(),
      lastDate: DateTime(2035),
    );
    if (picked != null && mounted) {
      setState(() => _dueDate = picked);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final groupId = _selectedGroupId;
    if (groupId == null) return;

    setState(() => _saving = true);

    try {
      final Homework saved;
      if (_isEdit) {
        saved = await ref.read(updateHomeworkCommandProvider).execute(
              homeworkId: widget.editHomeworkId!,
              subjectName: _subjectController.text.trim(),
              title: _titleController.text.trim(),
              description: _descriptionController.text.trim(),
              dueDate: _dueDate,
            );
      } else {
        saved = await ref.read(createHomeworkCommandProvider).execute(
              groupId: groupId,
              groupName: _selectedGroupName,
              subjectName: _subjectController.text.trim(),
              title: _titleController.text.trim(),
              description: _descriptionController.text.trim(),
              dueDate: _dueDate,
            );
      }

      ref.invalidate(homeworkListVersionProvider);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saqlandi.'),
          backgroundColor: context.dsColors.success,
        ),
      );
      // Save → Homework Detail (spec SCREEN 24: "Save: → Homework Detail").
      context.go('/homework/${saved.homeworkId}');
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
