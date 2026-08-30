import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/schedule.dart';
import '../../domain/entities/room.dart';
import '../../domain/repositories/schedule_repository.dart';
import '../datasources/isar_schedule_datasource.dart';
import '../models/schedule_record.dart';
import '../models/room_record.dart';

/// `ScheduleRepository` interfeysining Isar asosidagi implementatsiyasi.
class ScheduleRepositoryImpl implements ScheduleRepository {
  final IsarScheduleDataSource _datasource;

  ScheduleRepositoryImpl(this._datasource);

  // ==================== Jadval ====================

  @override
  Future<Schedule> save(Schedule schedule) async {
    final record = _toRecord(schedule);
    final saved = await _datasource.insert(record);
    // Fresh write — record valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Schedule> update(Schedule schedule) async {
    final record = _toRecord(schedule);
    record.syncVersion += 1;
    // `update` — mavjud id saqlanadi (unique index buzilmaydi).
    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Schedule?> fetchById(String scheduleId) async {
    final record = await _datasource.findById(scheduleId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Schedule>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7).
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<List<Schedule>> fetchByGroupId(String groupId) async {
    final records = await _datasource.findByGroupId(groupId);
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<List<Schedule>> fetchByTeacherId(String teacherId) async {
    final records = await _datasource.findByTeacherId(teacherId);
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<List<Schedule>> fetchByRoomId(String roomId) async {
    final records = await _datasource.findByRoomId(roomId);
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<List<Schedule>> fetchByDay(DayOfWeek day) async {
    final records = await _datasource.findByDay(day.index);
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<List<Schedule>> fetchByDateRange(DateTime start, DateTime end) async {
    final records = await _datasource.findByDateRange(start, end);
    return records.map(_toEntity).whereType<Schedule>().toList();
  }

  @override
  Future<Schedule> cancel(String scheduleId) async {
    final record = await _datasource.findById(scheduleId);
    if (record == null) throw Exception('Jadval topilmadi: $scheduleId');

    record.status = 'cancelled';
    record.syncVersion += 1;

    final updated = await _datasource.insert(record);
    return _toEntity(updated)!;
  }

  @override
  Future<bool> hasConflict({
    required String roomId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _datasource.hasConflict(
      roomId: roomId,
      dayOfWeek: dayOfWeek.index,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  @override
  Future<bool> hasTeacherConflict({
    required String teacherId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _datasource.hasTeacherConflict(
      teacherId: teacherId,
      dayOfWeek: dayOfWeek.index,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  @override
  Future<bool> hasGroupConflict({
    required String groupId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) {
    return _datasource.hasGroupConflict(
      groupId: groupId,
      dayOfWeek: dayOfWeek.index,
      startTime: startTime,
      endTime: endTime,
      excludeScheduleId: excludeScheduleId,
    );
  }

  // ==================== Xonalar ====================

  @override
  Future<Room> saveRoom(Room room) async {
    final record = _toRoomRecord(room);
    final saved = await _datasource.insertRoom(record);
    return _toRoomEntity(saved)!;
  }

  @override
  Future<Room> updateRoom(Room room) async {
    final record = _toRoomRecord(room);
    record.syncVersion += 1;
    // `updateRoom` — mavjud id saqlanadi (unique index buzilmaydi).
    final updated = await _datasource.updateRoom(record);
    return _toRoomEntity(updated)!;
  }

  @override
  Future<Room?> fetchRoomById(String roomId) async {
    final record = await _datasource.findRoomById(roomId);
    return record == null ? null : _toRoomEntity(record);
  }

  @override
  Future<List<Room>> fetchAllRooms() async {
    final records = await _datasource.findAllRooms();
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7).
    return records.map(_toRoomEntity).whereType<Room>().toList();
  }

  @override
  Future<List<Room>> fetchAvailableRooms() async {
    final records = await _datasource.findAvailableRooms();
    return records.map(_toRoomEntity).whereType<Room>().toList();
  }

  @override
  Future<Room> updateRoomStatus(String roomId, RoomStatus newStatus) async {
    final record = await _datasource.findRoomById(roomId);
    if (record == null) throw Exception('Xona topilmadi: $roomId');

    record.status = newStatus.name;
    record.syncVersion += 1;

    final updated = await _datasource.insertRoom(record);
    return _toRoomEntity(updated)!;
  }

  // ==================== Mapping ====================

  ScheduleRecord _toRecord(Schedule schedule) {
    return ScheduleRecord()
      ..scheduleId = schedule.scheduleId
      ..groupId = schedule.groupId
      ..groupName = schedule.groupName
      ..teacherId = schedule.teacherId
      ..teacherName = schedule.teacherName
      ..roomId = schedule.roomId
      ..roomName = schedule.roomName
      ..dayOfWeek = schedule.dayOfWeek.index
      ..startTime = schedule.startTime
      ..endTime = schedule.endTime
      ..subject = schedule.subject
      ..status = schedule.status.name
      ..specificDate = schedule.specificDate
      ..startDate = schedule.startDate
      ..endDate = schedule.endDate
      ..notes = schedule.notes
      ..syncVersion = schedule.syncVersion;
  }

  /// [Schedule]'ga xavfsiz o'giradi. Status nomuvofiq yoki `dayOfWeek`
  /// indeks oralig'idan chiqqan bo'lsa `null` (corrupt yozuv o'tkazib
  /// yuboriladi — `values[index]` RangeError'i crash qilmaydi, spec §7).
  Schedule? _toEntity(ScheduleRecord record) {
    final status = tryEnumByName(ScheduleStatus.values, record.status);
    final dayIndex = record.dayOfWeek;
    final day = dayIndex >= 0 && dayIndex < DayOfWeek.values.length
        ? DayOfWeek.values[dayIndex]
        : null;
    if (status == null || day == null) return null;
    return Schedule(
      scheduleId: record.scheduleId,
      groupId: record.groupId,
      groupName: record.groupName,
      teacherId: record.teacherId,
      teacherName: record.teacherName,
      roomId: record.roomId,
      roomName: record.roomName,
      dayOfWeek: day,
      startTime: record.startTime,
      endTime: record.endTime,
      subject: record.subject,
      specificDate: record.specificDate,
      startDate: record.startDate,
      endDate: record.endDate,
      notes: record.notes,
      syncVersion: record.syncVersion,
    );
  }

  RoomRecord _toRoomRecord(Room room) {
    return RoomRecord()
      ..roomId = room.roomId
      ..name = room.name
      ..code = room.code
      ..capacity = room.capacity
      ..location = room.location
      ..status = room.status.name
      ..amenitiesJson = IsarScheduleDataSource.encodeAmenities(room.amenities)
      ..photoPath = room.photoPath
      ..notes = room.notes
      ..syncVersion = room.syncVersion;
  }

  /// [Room]'ga xavfsiz o'giradi — corrupt status o'tkazib yuboriladi
  /// (crash YO'Q, spec §7).
  Room? _toRoomEntity(RoomRecord record) {
    final status = tryEnumByName(RoomStatus.values, record.status);
    if (status == null) return null;
    return Room(
      roomId: record.roomId,
      name: record.name,
      code: record.code,
      capacity: record.capacity,
      location: record.location,
      status: status,
      amenities: IsarScheduleDataSource.parseAmenities(record.amenitiesJson),
      photoPath: record.photoPath,
      notes: record.notes,
      syncVersion: record.syncVersion,
    );
  }
}
