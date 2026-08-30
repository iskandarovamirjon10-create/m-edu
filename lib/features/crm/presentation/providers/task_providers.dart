import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/complete_task_command.dart';
import '../../application/commands/create_task_command.dart';
import '../../application/services/lead_task_service.dart';
import '../../domain/entities/lead_task.dart';
import '../../domain/repositories/lead_task_repository.dart';
import '../../infrastructure/datasources/isar_task_datasource.dart';
import '../../infrastructure/repositories_impl/lead_task_repository_impl.dart';
import '../providers/lead_providers.dart';

/// Joriy foydalanuvchi email'ini olish (task tayinlash uchun).
final currentUserEmailProvider = Provider<String?>((ref) {
  final user = ref.watch(currentUserProvider);
  return user?.email;
});

/// Lead task repository provider.
final leadTaskRepositoryProvider = Provider<LeadTaskRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LeadTaskRepositoryImpl(IsarTaskDataSource(db.instance));
});

/// Lead task service provider.
final leadTaskServiceProvider = Provider<LeadTaskService>((ref) {
  return LeadTaskService(ref.watch(leadTaskRepositoryProvider));
});

/// CreateTask command provider.
final createTaskCommandProvider = Provider<CreateTaskCommand>((ref) {
  return CreateTaskCommand(
    taskService: ref.watch(leadTaskServiceProvider),
    leadRepository: ref.watch(leadRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
  );
});

/// CompleteTask command provider.
final completeTaskCommandProvider = Provider<CompleteTaskCommand>((ref) {
  return CompleteTaskCommand(
    taskService: ref.watch(leadTaskServiceProvider),
    auditService: ref.watch(auditServiceProvider),
  );
});

/// Task list version — task o'zgarganda oshiriladi.
final taskListVersionProvider = StateProvider<int>((ref) => 0);

/// Lead'ning barcha vazifalari.
final leadTasksProvider =
    FutureProvider.family<List<LeadTask>, String>((ref, leadId) {
  ref.watch(taskListVersionProvider);
  return ref.watch(leadTaskServiceProvider).getLeadTasks(leadId);
});

/// Joriy foydalanuvchining bugungi vazifalari.
final todayTasksProvider = FutureProvider<List<LeadTask>>((ref) async {
  ref.watch(taskListVersionProvider);
  final userId = ref.watch(currentUserEmailProvider);
  if (userId == null) return [];
  return ref.watch(leadTaskServiceProvider).getTodayTasks(userId);
});

/// Joriy foydalanuvchining muddati o'tgan vazifalari.
final overdueTasksProvider = FutureProvider<List<LeadTask>>((ref) async {
  ref.watch(taskListVersionProvider);
  final userId = ref.watch(currentUserEmailProvider);
  if (userId == null) return [];
  return ref.watch(leadTaskServiceProvider).getOverdueTasks(userId);
});

/// Eslatma yuborishi kerak bo'lgan vazifalar.
final tasksNeedingReminderProvider =
    FutureProvider<List<LeadTask>>((ref) async {
  ref.watch(taskListVersionProvider);
  return ref.watch(leadTaskServiceProvider).getTasksNeedingReminder();
});
