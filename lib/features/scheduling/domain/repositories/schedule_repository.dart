import '../entities/schedule.dart';
import '../entities/room.dart';

/// Jadval va xonalar ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class ScheduleRepository {
  // ==================== Jadval ====================

  /// Yangi jadvalni saqlaydi.
  Future<Schedule> save(Schedule schedule);

  /// Jadvalni yangilaydi.
  Future<Schedule> update(Schedule schedule);

  /// Jadval ID bo'yicha topadi.
  Future<Schedule?> fetchById(String scheduleId);

  /// Barcha jadvallarni qaytaradi.
  Future<List<Schedule>> fetchAll();

  /// Guruh ID bo'yicha jadvallarni topadi.
  Future<List<Schedule>> fetchByGroupId(String groupId);

  /// O'qituvchi ID bo'yicha jadvallarni topadi.
  Future<List<Schedule>> fetchByTeacherId(String teacherId);

  /// Xona ID bo'yicha jadvallarni topadi.
  Future<List<Schedule>> fetchByRoomId(String roomId);

  /// Kun bo'yicha jadvallarni topadi.
  Future<List<Schedule>> fetchByDay(DayOfWeek day);

  /// Vaqt oralig'i bo'yicha jadvallarni topadi.
  Future<List<Schedule>> fetchByDateRange(DateTime start, DateTime end);

  /// Jadvalni bekor qiladi.
  Future<Schedule> cancel(String scheduleId);

  /// Vaqt to'qnashuvini tekshiradi.
  Future<bool> hasConflict({
    required String roomId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  });

  /// O'qituvchi vaqt to'qnashuvini tekshiradi.
  Future<bool> hasTeacherConflict({
    required String teacherId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  });

  /// Guruh vaqt to'qnashuvini tekshiradi (spec §21): bir guruh bir vaqtda
  /// ikkita darsga biriktirilmasligi kerak. Jadval (status=scheduled)
  /// yozuvlari ustidan vaqt oralig'i ustma-ust tushishini aniqlaydi.
  Future<bool> hasGroupConflict({
    required String groupId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  });

  // ==================== Xonalar ====================

  /// Yangi xonani saqlaydi.
  Future<Room> saveRoom(Room room);

  /// Xonani yangilaydi.
  Future<Room> updateRoom(Room room);

  /// Xona ID bo'yicha topadi.
  Future<Room?> fetchRoomById(String roomId);

  /// Barcha xonalarni qaytaradi.
  Future<List<Room>> fetchAllRooms();

  /// Bo'sh xonalarni qaytaradi.
  Future<List<Room>> fetchAvailableRooms();

  /// Xona holatini yangilaydi.
  Future<Room> updateRoomStatus(String roomId, RoomStatus newStatus);
}
