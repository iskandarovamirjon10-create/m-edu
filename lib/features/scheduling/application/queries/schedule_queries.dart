import '../../domain/entities/schedule.dart';
import '../../domain/entities/room.dart';
import '../../domain/repositories/schedule_repository.dart';

/// Jadval o'qish operatsiyalari (CQRS queries).
class ScheduleQueries {
  final ScheduleRepository _repository;

  ScheduleQueries({required ScheduleRepository repository})
      : _repository = repository;

  // ==================== Jadval ====================

  Future<List<Schedule>> fetchAll() => _repository.fetchAll();

  Future<Schedule?> fetchById(String scheduleId) =>
      _repository.fetchById(scheduleId);

  Future<List<Schedule>> fetchByGroupId(String groupId) =>
      _repository.fetchByGroupId(groupId);

  Future<List<Schedule>> fetchByTeacherId(String teacherId) =>
      _repository.fetchByTeacherId(teacherId);

  Future<List<Schedule>> fetchByRoomId(String roomId) =>
      _repository.fetchByRoomId(roomId);

  Future<List<Schedule>> fetchByDay(DayOfWeek day) =>
      _repository.fetchByDay(day);

  Future<List<Schedule>> fetchByDateRange(DateTime start, DateTime end) =>
      _repository.fetchByDateRange(start, end);

  /// Haftalik jadval (barcha kunlar bo'yicha).
  Future<Map<DayOfWeek, List<Schedule>>> fetchWeeklySchedule({
    String? groupId,
    String? teacherId,
  }) async {
    final all = await _repository.fetchAll();
    final filtered = all.where((s) {
      if (groupId != null && s.groupId != groupId) return false;
      if (teacherId != null && s.teacherId != teacherId) return false;
      return true;
    }).toList();

    final map = <DayOfWeek, List<Schedule>>{};
    for (final day in DayOfWeek.values) {
      map[day] = filtered.where((s) => s.dayOfWeek == day).toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
    }
    return map;
  }

  /// Bugungi jadval.
  Future<List<Schedule>> fetchTodaySchedule({String? groupId}) async {
    final now = DateTime.now();
    final dayIndex = now.weekday - 1; // 1=Monday -> 0=Monday
    final day = DayOfWeek.values[dayIndex];
    return _repository.fetchByDay(day);
  }

  /// Jadval soni.
  Future<int> countAll() async {
    final schedules = await _repository.fetchAll();
    return schedules.length;
  }

  // ==================== Xonalar ====================

  Future<List<Room>> fetchAllRooms() => _repository.fetchAllRooms();

  Future<List<Room>> fetchAvailableRooms() => _repository.fetchAvailableRooms();

  Future<Room?> fetchRoomById(String roomId) =>
      _repository.fetchRoomById(roomId);

  Future<int> countRooms() async {
    final rooms = await _repository.fetchAllRooms();
    return rooms.length;
  }

  Future<int> countAvailableRooms() async {
    final rooms = await _repository.fetchAvailableRooms();
    return rooms.length;
  }
}
