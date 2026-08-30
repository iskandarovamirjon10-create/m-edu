import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../application/commands/create_room_command.dart';
import '../../application/commands/create_schedule_command.dart';
import '../../application/queries/schedule_queries.dart';
import '../../domain/entities/schedule.dart';
import '../../domain/entities/room.dart';
import '../../domain/repositories/schedule_repository.dart';
import '../../infrastructure/datasources/isar_schedule_datasource.dart';
import '../../infrastructure/repositories_impl/schedule_repository_impl.dart';

/// Schedule repository provider.
final scheduleRepositoryProvider = Provider<ScheduleRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return ScheduleRepositoryImpl(IsarScheduleDataSource(db.instance));
});

/// Schedule queries provider.
final scheduleQueriesProvider = Provider<ScheduleQueries>(
  (ref) => ScheduleQueries(repository: ref.watch(scheduleRepositoryProvider)),
);

/// Create schedule command provider.
final createScheduleCommandProvider = Provider<CreateScheduleCommand>(
  (ref) => CreateScheduleCommand(
    repository: ref.watch(scheduleRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Create room command provider.
final createRoomCommandProvider = Provider<CreateRoomCommand>(
  (ref) => CreateRoomCommand(
    repository: ref.watch(scheduleRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final scheduleListVersionProvider = StateProvider<int>((ref) => 0);
final roomListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha jadvallar ro'yxati.
final scheduleListProvider = FutureProvider<List<Schedule>>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchAll();
});

/// Bitta dars tafsiloti.
final scheduleDetailProvider =
    FutureProvider.family<Schedule?, String>((ref, scheduleId) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchById(scheduleId);
});

/// Bugungi jadval.
final todayScheduleProvider = FutureProvider<List<Schedule>>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchTodaySchedule();
});

/// Guruh jadvali.
final scheduleByGroupProvider =
    FutureProvider.family<List<Schedule>, String>((ref, groupId) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchByGroupId(groupId);
});

/// O'qituvchi jadvali.
final scheduleByTeacherProvider =
    FutureProvider.family<List<Schedule>, String>((ref, teacherId) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchByTeacherId(teacherId);
});

/// Haftalik jadval.
final weeklyScheduleProvider =
    FutureProvider<Map<DayOfWeek, List<Schedule>>>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchWeeklySchedule();
});

/// Xonalar ro'yxati.
final roomListProvider = FutureProvider<List<Room>>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchAllRooms();
});

/// Bo'sh xonalar ro'yxati.
final availableRoomsProvider = FutureProvider<List<Room>>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).fetchAvailableRooms();
});

/// Xonalar soni.
final roomCountProvider = FutureProvider<int>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).countRooms();
});

/// Bo'sh xonalar soni.
final availableRoomCountProvider = FutureProvider<int>((ref) {
  ref.watch(scheduleListVersionProvider);
  return ref.watch(scheduleQueriesProvider).countAvailableRooms();
});
