import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';

/// Dars konteksti banneri — Face oqimi attendance sahifasi bilan BIR XIL
/// kontekstdan ishlaydi. Attendance Marking'dan (Lesson Detail → Face ID)
/// kelganda TANLANGAN dars ustuvor ko'rsatiladi; aks holda faol dars.
class ActiveLessonBanner extends ConsumerWidget {
  const ActiveLessonBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedLesson = ref.watch(selectedMarkingLessonProvider);
    final lessonAsync = ref.watch(activeLessonProvider);
    final lesson = selectedLesson ?? lessonAsync.valueOrNull;

    if (lesson == null) {
      final loading = lessonAsync.isLoading && selectedLesson == null;
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: context.dsColors.warning.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.dsColors.warning.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(
                loading ? Icons.hourglass_top : Icons.event_busy,
                size: 18,
                color: loading ? context.dsColors.info : context.dsColors.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  loading
                      ? 'Faol dars aniqlanmoqda…'
                      : "Hozir faol dars yo'q — davomat belgilanmaydi",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: loading ? context.dsColors.info : context.dsColors.warning,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final isSelected = selectedLesson != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: context.dsColors.success.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.dsColors.success.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(Icons.school_outlined, size: 18, color: context.dsColors.success),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                lesson.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.success,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              isSelected ? 'Tanlangan dars' : 'Faol',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: context.dsColors.success,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
