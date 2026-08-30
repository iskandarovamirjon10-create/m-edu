import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/group.dart';
import '../../domain/repositories/group_repository.dart';
import '../datasources/isar_group_datasource.dart';
import '../models/group_record.dart';

/// `GroupRepository` interfeysining Isar asosidagi implementatsiyasi.
class GroupRepositoryImpl implements GroupRepository {
  final IsarGroupDataSource _datasource;

  GroupRepositoryImpl(this._datasource);

  @override
  Future<Group> save(Group group) async {
    final record = _toRecord(group);
    final saved = await _datasource.insert(record);
    // Fresh write — record valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Group> update(Group group) async {
    final record = _toRecord(group);
    record.syncVersion += 1;
    record.pendingSync = true;
    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Group?> fetchById(String groupId) async {
    final record = await _datasource.findById(groupId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Group>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7).
    return records.map(_toEntity).whereType<Group>().toList();
  }

  @override
  Future<List<Group>> fetchActive() async {
    final records = await _datasource.findActive();
    return records.map(_toEntity).whereType<Group>().toList();
  }

  @override
  Future<List<Group>> fetchByTeacherId(String teacherId) async {
    final records = await _datasource.findByTeacherId(teacherId);
    return records.map(_toEntity).whereType<Group>().toList();
  }

  @override
  Future<List<Group>> fetchByRoomId(String roomId) async {
    final records = await _datasource.findByRoomId(roomId);
    return records.map(_toEntity).whereType<Group>().toList();
  }

  @override
  Future<Group> addMember(String groupId) async {
    final record = await _datasource.findById(groupId);
    if (record == null) throw Exception('Guruh topilmadi: $groupId');

    record.currentSize += 1;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Group> removeMember(String groupId) async {
    final record = await _datasource.findById(groupId);
    if (record == null) throw Exception('Guruh topilmadi: $groupId');

    if (record.currentSize > 0) {
      record.currentSize -= 1;
    }
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Group> updateStatus(String groupId, GroupStatus newStatus) async {
    final record = await _datasource.findById(groupId);
    if (record == null) throw Exception('Guruh topilmadi: $groupId');

    record.status = newStatus.name;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Group> archive(String groupId) =>
      updateStatus(groupId, GroupStatus.archived);

  GroupRecord _toRecord(Group group) {
    return GroupRecord()
      ..groupId = group.groupId
      ..name = group.name
      ..code = group.code
      ..capacity = group.capacity
      ..currentSize = group.currentSize
      ..teacherId = group.teacherId
      ..teacherName = group.teacherName
      ..roomId = group.roomId
      ..roomName = group.roomName
      ..subject = group.subject
      ..academicYear = group.academicYear
      ..monthlyFee = group.monthlyFee
      ..status = group.status.name
      ..startDate = group.startDate
      ..endDate = group.endDate
      ..daysOfWeekJson = IsarGroupDataSource.encodeDaysOfWeek(group.daysOfWeek)
      ..startTime = group.startTime
      ..endTime = group.endTime
      ..notes = group.notes
      ..syncVersion = group.syncVersion
      ..pendingSync = group.pendingSync;
  }

  /// [Group]'ga xavfsiz o'giradi — corrupt status o'tkazib yuboriladi
  /// (crash YO'Q, spec §7).
  Group? _toEntity(GroupRecord record) {
    final status = tryEnumByName(GroupStatus.values, record.status);
    if (status == null) return null;
    return Group(
      groupId: record.groupId,
      name: record.name,
      code: record.code,
      capacity: record.capacity,
      currentSize: record.currentSize,
      teacherId: record.teacherId,
      teacherName: record.teacherName,
      roomId: record.roomId,
      roomName: record.roomName,
      subject: record.subject,
      academicYear: record.academicYear,
      monthlyFee: record.monthlyFee,
      status: status,
      startDate: record.startDate,
      endDate: record.endDate,
      daysOfWeek: IsarGroupDataSource.parseDaysOfWeek(record.daysOfWeekJson),
      startTime: record.startTime,
      endTime: record.endTime,
      notes: record.notes,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
