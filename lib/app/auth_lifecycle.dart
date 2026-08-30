import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/attendance/presentation/providers/attendance_providers.dart';
import '../features/audit/presentation/providers/audit_providers.dart';
import '../features/auth/presentation/providers/auth_providers.dart';
import '../features/groups/presentation/providers/group_providers.dart';
import '../features/notifications/presentation/providers/notification_providers.dart';
import '../features/payments/presentation/providers/payment_providers.dart';
import '../features/reports/presentation/providers/report_providers.dart';
import '../features/scheduling/presentation/providers/schedule_providers.dart';
import '../features/settings/presentation/providers/settings_providers.dart';
import '../features/students/presentation/providers/student_providers.dart';
import '../features/teachers/presentation/providers/teacher_providers.dart';

/// Auth hayot davri koordinatori (PHASE E — logout izolyatsiyasi).
///
/// Auth holati o'zgarganda actor-bog'liq provider cache'larini
/// invalidatsiya qiladi:
/// - **Logout** (Authenticated → boshqa holat): birinchi foydalanuvchining
///   cached ma'lumotlari ikkinchi foydalanuvchiga ko'rinmaydi.
/// - **Rol o'zgarishi** (Authenticated → Authenticated, rol boshqa):
///   eski permission cache yangi rolga o'tmaydi.
///
/// `actorRoleProvider` o'zi reaktiv (authControllerProvider'ni watch
/// qiladi) — bu yerda ma'lumot (data) cache'lari tozalanadi.
final authLifecycleCoordinatorProvider = Provider<Object?>((ref) {
  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    final wasAuthenticated = previous is AuthStateAuthenticated;
    final isAuthenticated = next is AuthStateAuthenticated;
    if (wasAuthenticated) {
      final loggedOut = !isAuthenticated;
      final roleChanged = isAuthenticated && previous.role != next.role;
      if (loggedOut || roleChanged) {
        _invalidateActorData(ref);
      }
    }
  });
  return null;
});

/// Logout/rol o'zgarishida tozalanadigan actor-bog'liq providerlar.
void _invalidateActorData(Ref ref) {
  // Settings / users — ro'yxatlar rolga bog'liq bo'lishi mumkin.
  ref.invalidate(userListProvider);
  ref.invalidate(userAccountsProvider);
  ref.invalidate(appSettingsProvider);
  ref.invalidate(subjectListProvider);

  // Barcha ma'lumot version'lari — keyingi ko'rishda qayta yuklanadi.
  ref.invalidate(studentListVersionProvider);
  ref.invalidate(groupListVersionProvider);
  ref.invalidate(teacherListVersionProvider);
  ref.invalidate(paymentListVersionProvider);
  ref.invalidate(scheduleListVersionProvider);
  ref.invalidate(attendanceVersionProvider);
  ref.invalidate(notificationListVersionProvider);
  ref.invalidate(savedReportsVersionProvider);
  ref.invalidate(auditLogListVersionProvider);

  // Hisobot cache'lar (version'larni watch qiladi — qayta hisoblanadi).
  ref.invalidate(studentStatsProvider);
  ref.invalidate(revenueStatsProvider);
  ref.invalidate(debtStatsProvider);
  ref.invalidate(attendanceStatsProvider);
  ref.invalidate(teacherWorkloadProvider);
  ref.invalidate(savedReportsProvider);
}
