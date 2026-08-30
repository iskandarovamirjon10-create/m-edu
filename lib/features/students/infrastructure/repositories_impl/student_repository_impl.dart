import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/student.dart';
import '../../domain/repositories/student_repository.dart';
import '../datasources/isar_student_datasource.dart';
import '../models/student_record.dart';

/// `StudentRepository` interfeysining Isar asosidagi implementatsiyasi.
class StudentRepositoryImpl implements StudentRepository {
  final IsarStudentDataSource _datasource;

  StudentRepositoryImpl(this._datasource);

  @override
  Future<Student> save(Student student) async {
    final record = _toRecord(student);
    final saved = await _datasource.insert(record);
    // Fresh write — record har doim valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Student> update(Student student) async {
    final record = _toRecord(student);
    record.syncVersion += 1;
    record.pendingSync = true;
    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student> updateStatus(
      String identityId, StudentStatus newStatus) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('Talaba topilmadi: $identityId');

    // Fresh update — record valid (`!` xavfsiz).

    record.studentStatus = newStatus.name;
    if (newStatus == StudentStatus.graduated ||
        newStatus == StudentStatus.archived) {
      record.completedAt = DateTime.now();
    }
    // Restore (arxiv → faol): completedAt tozalanadi — arxivlangan sana
    // faol talaba profilida "Bitirgan/Arxivlangan sana" bo'lib qolmaydi.
    if (newStatus == StudentStatus.active) {
      record.completedAt = null;
    }
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student> startTransfer(String identityId, String targetGroupId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('Talaba topilmadi: $identityId');

    record.transferStatus = 'pending';
    record.transferToGroupId = targetGroupId;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student> confirmTransfer(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('Talaba topilmadi: $identityId');

    final targetGroupId = record.transferToGroupId;
    record.groupId = targetGroupId;
    record.transferStatus = 'none';
    record.transferToGroupId = null;
    record.assignedAt = DateTime.now();
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student> cancelTransfer(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('Talaba topilmadi: $identityId');

    record.transferStatus = 'none';
    record.transferToGroupId = null;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student> updateParentInfo(
    String identityId, {
    String? parentName,
    String? parentPhone,
    String? parentTelegramId,
  }) async {
    final record = await _datasource.findByIdentityId(identityId);
    if (record == null) throw Exception('Talaba topilmadi: $identityId');

    record.parentName = parentName;
    record.parentPhone = parentPhone;
    record.parentTelegramId = parentTelegramId;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.update(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Student?> fetchByIdentityId(String identityId) async {
    final record = await _datasource.findByIdentityId(identityId);
    // Corrupt yozuv → null (UI "Topilmadi" holati, crash yo'q).
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Student>> fetchByGroupId(String groupId) async {
    final records = await _datasource.findByGroupId(groupId);
    // Corrupt yozuvlar o'tkazib yuboriladi (spec §7) — noto'g'ri status
    // talaba faol/arxiv ro'yxatlarida ko'rinmaydi.
    return records.map(_toEntity).whereType<Student>().toList();
  }

  @override
  Future<List<Student>> fetchAll() async {
    final records = await _datasource.findAll();
    return records.map(_toEntity).whereType<Student>().toList();
  }

  @override
  Future<List<Student>> fetchPage({
    required int offset,
    required int limit,
  }) async {
    final records = await _datasource.findPage(offset: offset, limit: limit);
    return records.map(_toEntity).whereType<Student>().toList();
  }

  @override
  Future<int> countAll() => _datasource.countAll();

  @override
  Future<List<Student>> fetchActive() async {
    final records = await _datasource.findActive();
    return records.map(_toEntity).whereType<Student>().toList();
  }

  @override
  Future<List<Student>> fetchUnpaid() async {
    final records = await _datasource.findUnpaid();
    return records.map(_toEntity).whereType<Student>().toList();
  }

  @override
  Future<int> nextStudentNumber() => _datasource.getMaxStudentNumber();

  @override
  Future<Student> archive(String identityId) =>
      updateStatus(identityId, StudentStatus.archived);

  @override
  Future<Student> graduate(String identityId) =>
      updateStatus(identityId, StudentStatus.graduated);

  @override
  Future<Student> freeze(String identityId) =>
      updateStatus(identityId, StudentStatus.frozen);

  @override
  Future<Student> reactivate(String identityId) =>
      updateStatus(identityId, StudentStatus.active);

  @override
  Future<void> deleteByIdentityId(String identityId) =>
      _datasource.deleteByIdentityId(identityId);

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      _datasource.repointIdentityReferences(fromIdentityId, toIdentityId);

  StudentRecord _toRecord(Student student) {
    return StudentRecord()
      ..identityId = student.identityId
      ..studentNumber = student.studentNumber
      ..groupId = student.groupId
      ..groupName = student.groupName
      ..parentId = student.parentId
      ..parentName = student.parentName
      ..parentPhone = student.parentPhone
      ..parentTelegramId = student.parentTelegramId
      ..studentStatus = student.studentStatus.name
      ..transferStatus = student.transferStatus.name
      ..transferToGroupId = student.transferToGroupId
      ..academicYear = student.academicYear
      ..paymentStatus = student.paymentStatus
      ..lastPaymentDate = student.lastPaymentDate
      ..totalPaid = student.totalPaid
      ..enrolledAt = student.enrolledAt
      ..assignedAt = student.assignedAt
      ..completedAt = student.completedAt
      ..notes = student.notes
      ..syncVersion = student.syncVersion
      ..pendingSync = student.pendingSync;
  }

  /// [Student]'ga xavfsiz o'giradi. Statuslar nomuvofiq bo'lsa `null`
  /// (corrupt yozuv o'tkazib yuboriladi — crash YO'Q, spec §7, §17).
  /// Noto'g'ri status talaba faol deb ko'rinib, davomat/to'lov hisobiga
  /// kirmaydi.
  Student? _toEntity(StudentRecord record) {
    final studentStatus =
        tryEnumByName(StudentStatus.values, record.studentStatus);
    final transferStatus =
        tryEnumByName(TransferStatus.values, record.transferStatus);
    if (studentStatus == null || transferStatus == null) return null;
    return Student(
      identityId: record.identityId,
      studentNumber: record.studentNumber,
      groupId: record.groupId,
      groupName: record.groupName,
      parentId: record.parentId,
      parentName: record.parentName,
      parentPhone: record.parentPhone,
      parentTelegramId: record.parentTelegramId,
      studentStatus: studentStatus,
      transferStatus: transferStatus,
      transferToGroupId: record.transferToGroupId,
      academicYear: record.academicYear,
      paymentStatus: record.paymentStatus,
      lastPaymentDate: record.lastPaymentDate,
      totalPaid: record.totalPaid,
      enrolledAt: record.enrolledAt,
      assignedAt: record.assignedAt,
      completedAt: record.completedAt,
      notes: record.notes,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
