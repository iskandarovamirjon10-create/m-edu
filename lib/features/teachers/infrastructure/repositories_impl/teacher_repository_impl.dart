import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/teacher.dart';
import '../../domain/repositories/teacher_repository.dart';
import '../datasources/isar_teacher_datasource.dart';
import '../models/teacher_record.dart';

/// `TeacherRepository` interfeysining Isar asosidagi implementatsiyasi.
class TeacherRepositoryImpl implements TeacherRepository {
  final IsarTeacherDataSource _datasource;

  TeacherRepositoryImpl(this._datasource);

  @override
  Future<Teacher> save(Teacher teacher) async {
    final record = _toRecord(teacher);
    final saved = await _datasource.insert(record);
    // Fresh write — record valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Teacher> update(Teacher teacher) async {
    final record = _toRecord(teacher);
    record.syncVersion += 1;
    record.pendingSync = true;
    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Teacher?> fetchByIdentityId(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Teacher>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7).
    return records.map(_toEntity).whereType<Teacher>().toList();
  }

  @override
  Future<List<Teacher>> fetchActive() async {
    final records = await _datasource.findActive();
    return records.map(_toEntity).whereType<Teacher>().toList();
  }

  @override
  Future<List<Teacher>> fetchByGroupId(String groupId) async {
    final records = await _datasource.findByGroupId(groupId);
    return records.map(_toEntity).whereType<Teacher>().toList();
  }

  @override
  Future<List<Teacher>> fetchBySpecialization(String specialization) async {
    final records = await _datasource.findBySpecialization(specialization);
    return records.map(_toEntity).whereType<Teacher>().toList();
  }

  @override
  Future<Teacher> assignToGroup(String identityId, String groupId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('O\'qituvchi topilmadi');

    final groupIds = IsarTeacherDataSource.parseGroupIds(
      record.assignedGroupIdsJson,
    );
    if (!groupIds.contains(groupId)) {
      groupIds.add(groupId);
    }
    record.assignedGroupIdsJson = IsarTeacherDataSource.encodeGroupIds(groupIds);
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Teacher> removeFromGroup(String identityId, String groupId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('O\'qituvchi topilmadi');

    final groupIds = IsarTeacherDataSource.parseGroupIds(
      record.assignedGroupIdsJson,
    );
    groupIds.remove(groupId);
    record.assignedGroupIdsJson = IsarTeacherDataSource.encodeGroupIds(groupIds);
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<int> nextTeacherNumber() => _datasource.getMaxTeacherNumber();

  @override
  Future<Teacher> updateStatus(String identityId, TeacherStatus newStatus) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('O\'qituvchi topilmadi');

    record.status = newStatus.name;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<void> deleteByIdentityId(String identityId) =>
      _datasource.deleteByIdentityId(identityId);

  @override
  Future<Teacher> updateWeeklyHours(String identityId, int hours) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('O\'qituvchi topilmadi');

    record.weeklyHours = hours;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  TeacherRecord _toRecord(Teacher teacher) {
    return TeacherRecord()
      ..identityId = teacher.identityId
      ..teacherNumber = teacher.teacherNumber
      ..specialization = teacher.specialization
      ..assignedGroupIdsJson = IsarTeacherDataSource.encodeGroupIds(
        teacher.assignedGroupIds,
      )
      ..weeklyHours = teacher.weeklyHours
      ..maxWeeklyHours = teacher.maxWeeklyHours
      ..status = teacher.status.name
      ..startDate = teacher.startDate
      ..endDate = teacher.endDate
      ..salary = teacher.salary
      ..notes = teacher.notes
      ..syncVersion = teacher.syncVersion
      ..pendingSync = teacher.pendingSync;
  }

  /// [Teacher]'ga xavfsiz o'giradi — corrupt status o'tkazib yuboriladi
  /// (crash YO'Q, spec §7).
  Teacher? _toEntity(TeacherRecord record) {
    final status = tryEnumByName(TeacherStatus.values, record.status);
    if (status == null) return null;
    return Teacher(
      identityId: record.identityId,
      teacherNumber: record.teacherNumber,
      specialization: record.specialization,
      assignedGroupIds: IsarTeacherDataSource.parseGroupIds(
        record.assignedGroupIdsJson,
      ),
      weeklyHours: record.weeklyHours,
      maxWeeklyHours: record.maxWeeklyHours,
      status: status,
      startDate: record.startDate,
      endDate: record.endDate,
      salary: record.salary,
      notes: record.notes,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
