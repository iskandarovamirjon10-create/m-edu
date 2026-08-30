import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../scheduling/domain/entities/lesson_instance.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/commands/mark_attendance_status_command.dart';
import '../../domain/entities/attendance_entry.dart';
import '../../domain/entities/attendance_session.dart';
import '../providers/attendance_providers.dart';

part 'attendance_page_widgets.dart';

/// Davomat sahifasi (spec §6 #23-27, P1 — lesson-instance integratsiya).
///
/// Attendance endi "bugungi umumiy davomat" EMAS — DARSGA bog'langan:
/// - `selectedMarkingLessonProvider` o'rnatilgan bo'lsa (Lesson Detail'dan
///   "Davomat belgilash") — o'sha dars (faol bo'lmasa ham) ochiladi;
/// - aks holda `activeLessonProvider` — hozir FAOL dars konteksti.
///
/// Face / QR / Manual uchala oqim ham o'sha darsning `lessonId`ini
/// command'larga yuboradi. Faol/tanlangan dars bo'lmasa — "Hozir faol dars
/// yo'q" empty state (fake ma'lumot yo'q; real repository holatidan).
class AttendancePage extends ConsumerWidget {
  const AttendancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final students = ref.watch(studentListProvider).valueOrNull ?? const [];
    final activeStudents = students.where((s) => s.isActive).toList();

    // Tanlangan dars konteksti (Lesson Detail → Marking) ustuvor.
    final selectedLesson = ref.watch(selectedMarkingLessonProvider);
    final activeLessonAsync = ref.watch(activeLessonProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.attendanceTitle),
        actions: [
          // SCREEN 21: davomat tarixi (o'qish uchun).
          IconButton(
            tooltip: 'Davomat tarixi',
            icon: const Icon(Icons.history_outlined),
            onPressed: () => context.push('/attendance/history'),
          ),
          // SCREEN 20: davomat markazi (muassasa ko'rinishi).
          IconButton(
            tooltip: 'Davomat markazi',
            icon: const Icon(Icons.dashboard_customize_outlined),
            onPressed: () => context.push('/attendance/center'),
          ),
          IconButton(
            tooltip: 'Face ID',
            icon: const Icon(Icons.face_retouching_natural),
            onPressed: () => context.push('/face-scan'),
          ),
        ],
      ),
      body: selectedLesson != null
          ? _SelectedLessonView(
              lesson: selectedLesson,
              activeStudents: activeStudents,
              onClose: () => ref
                  .read(selectedMarkingLessonProvider.notifier)
                  .state = null,
            )
          : activeLessonAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => _LessonLoadError(message: '$error'),
              data: (lesson) {
                if (lesson == null) {
                  return _NoActiveLesson(
                    hasStudents: activeStudents.isNotEmpty,
                  );
                }
                return _ActiveLessonView(
                  lesson: lesson,
                  activeStudents: activeStudents,
                );
              },
            ),
    );
  }
}

/// Tanlangan dars ko'rinishi — Lesson Detail'dan kelgan kontekst (SCREEN 17
/// → SCREEN 19). Tanlangan dars tugmasi bilan yopiladi va faol dars
/// ko'rinishiga qaytadi.
class _SelectedLessonView extends StatelessWidget {
  final LessonInstance lesson;
  final List<Student> activeStudents;
  final VoidCallback onClose;

  const _SelectedLessonView({
    required this.lesson,
    required this.activeStudents,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: context.dsColors.accent.withValues(alpha: 0.08),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
            child: Row(
              children: [
                Icon(
                  Icons.push_pin_outlined,
                  size: 16,
                  color: context.dsColors.accent,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Dars: ${lesson.label}',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.accent,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                TextButton(
                  onPressed: onClose,
                  child: const Text('Boshqa dars'),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: _ActiveLessonView(
            lesson: lesson,
            activeStudents: activeStudents,
          ),
        ),
      ],
    );
  }
}
