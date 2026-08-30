import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../teachers/presentation/providers/teacher_providers.dart';
import '../../application/services/gamification_service.dart';
import '../../domain/entities/gamification_profile.dart';

/// O'yinlashtirish profili — real ma'lumotlardan qayta hisoblanadi.
///
/// Ma'lumot o'zgarganda yangilanadi (query provider'lar kuzatiladi), shuning
/// uchun o'quvchi qo'shilganda / davomat belgilanganda ball darhol o'zgaradi.
final gamificationProfileProvider =
    FutureProvider<GamificationProfile>((ref) async {
  final attendance = await ref
      .watch(attendanceQueriesProvider)
      .fetchBetween(DateTime(2000), DateTime(2100));
  final payments = await ref.watch(paymentQueriesProvider).fetchAll();
  final totalCollected = await ref.watch(paymentQueriesProvider).totalCollected();
  final students = await ref.watch(studentQueriesProvider).countAll();
  final teachers = await ref.watch(teacherQueriesProvider).countAll();
  final groups = await ref.watch(groupQueriesProvider).countAll();

  return const GamificationService().compute(
    attendance: attendance,
    payments: payments,
    studentCount: students,
    teacherCount: teachers,
    groupCount: groups,
    totalCollected: totalCollected,
  );
});
