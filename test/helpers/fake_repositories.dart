import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_session.dart';
import 'package:m_edu/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:m_edu/features/attendance/domain/repositories/attendance_session_repository.dart';
import 'package:m_edu/features/audit/domain/entities/audit_log_entry.dart';
import 'package:m_edu/features/audit/domain/repositories/audit_repository.dart';
import 'package:m_edu/features/face_recognition/application/face_matcher.dart';
import 'package:m_edu/features/face_recognition/domain/repositories/face_recognition_repository.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/groups/domain/repositories/group_repository.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/domain/entities/expense.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/repositories/payment_repository.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/domain/repositories/settings_repository.dart';
import 'package:m_edu/features/scheduling/domain/entities/room.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/domain/repositories/schedule_repository.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/repositories/student_repository.dart';
import 'package:m_edu/features/teachers/domain/entities/teacher.dart';
import 'package:m_edu/features/teachers/domain/repositories/teacher_repository.dart';

/// Audit log uchun xotira ichidagi (in-memory) fake repository.
///
/// Event-sync va command testlarida Isar talab qilinmasligi uchun.
class FakeAuditRepository implements AuditRepository {
  final List<AuditLogEntry> entries;

  FakeAuditRepository({List<AuditLogEntry>? entries}) : entries = entries ?? [];

  @override
  Future<void> record(AuditLogEntry entry) async {
    entries.add(entry);
  }

  @override
  Future<List<AuditLogEntry>> fetchRecent({int limit = 50}) async {
    final sorted = List<AuditLogEntry>.of(entries)
      ..sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
    return sorted.take(limit).toList();
  }

  @override
  Future<List<AuditLogEntry>> fetchByTarget(
    String targetType,
    String targetId,
  ) async =>
      entries
          .where((e) => e.targetType == targetType && e.targetId == targetId)
          .toList();

  @override
  Future<int> count() async => entries.length;
}

/// Identity uchun xotira ichidagi (in-memory) fake repository.
///
/// C-02/C-03 proyeksiya va event-sync testlarida ishlatiladi —
/// Isar talab qilinmaydi.
class FakeIdentityRepository implements IdentityRepository {
  final List<Identity> identities;
  final List<IdentityActivity> activities;

  FakeIdentityRepository({
    List<Identity>? identities,
    List<IdentityActivity>? activities,
  })  : identities = identities ?? [],
        activities = activities ?? [];

  @override
  Future<Identity> save(Identity identity) async {
    final i = identities.indexWhere((x) => x.identityId == identity.identityId);
    if (i >= 0) {
      identities[i] = identity;
    } else {
      identities.add(identity);
    }
    return identity;
  }

  @override
  Future<void> recordActivity(IdentityActivity activity) async {
    activities.add(activity);
  }

  @override
  Future<Identity?> fetchByIdentityId(String identityId) async {
    for (final i in identities) {
      if (i.identityId == identityId) return i;
    }
    return null;
  }

  @override
  Future<Identity?> fetchByPhone(String normalizedPhone) async {
    for (final i in identities) {
      if (i.phone == normalizedPhone) return i;
    }
    return null;
  }

  @override
  Future<List<Identity>> fetchAll() async => List.of(identities);

  @override
  Future<List<Identity>> fetchByIds(List<String> identityIds) async =>
      identities.where((i) => identityIds.contains(i.identityId)).toList();

  @override
  Future<List<Identity>> fetchByRole(IdentityRole role) async =>
      identities.where((i) => i.role == role).toList();

  @override
  Future<List<Identity>> fetchByStatus(IdentityStatus status) async =>
      identities.where((i) => i.status == status).toList();

  @override
  Future<List<IdentityActivity>> fetchActivities(String identityId) async =>
      activities.where((a) => a.identityId == identityId).toList();

  @override
  Future<Identity> update(Identity identity) async => save(identity);

  @override
  Future<Identity> updateStatus(
    String identityId,
    IdentityStatus newStatus,
  ) async {
    final i = identities.indexWhere((x) => x.identityId == identityId);
    final current = identities[i];
    final updated = Identity(
      identityId: current.identityId,
      firstName: current.firstName,
      lastName: current.lastName,
      middleName: current.middleName,
      role: current.role,
      status: newStatus,
      phone: current.phone,
      email: current.email,
      photoPath: current.photoPath,
      qrSeed: current.qrSeed,
      createdAt: current.createdAt,
      updatedAt: DateTime.now(),
      syncVersion: current.syncVersion + 1,
      pendingSync: current.pendingSync,
    );
    identities[i] = updated;
    return updated;
  }

  @override
  Future<int> repointActivities(
      String fromIdentityId, String toIdentityId) async {
    var moved = 0;
    for (final a in activities) {
      if (a.identityId == fromIdentityId) {
        activities[activities.indexOf(a)] = IdentityActivity(
          identityId: toIdentityId,
          type: a.type,
          description: a.description,
          occurredAt: a.occurredAt,
        );
        moved++;
      }
    }
    return moved;
  }

  @override
  Future<void> deleteByIdentityId(String identityId) async {
    identities.removeWhere((i) => i.identityId == identityId);
    activities.removeWhere((a) => a.identityId == identityId);
  }
}

/// Student uchun xotira ichidagi (in-memory) fake repository.
class FakeStudentRepository implements StudentRepository {
  final List<Student> students;

  FakeStudentRepository({List<Student>? students}) : students = students ?? [];

  @override
  Future<Student> save(Student student) async {
    students.add(student);
    return student;
  }

  @override
  Future<Student> update(Student student) async {
    final i = students.indexWhere((s) => s.identityId == student.identityId);
    if (i >= 0) {
      students[i] = student;
    } else {
      students.add(student);
    }
    return student;
  }

  @override
  Future<Student?> fetchByIdentityId(String identityId) async {
    for (final s in students) {
      if (s.identityId == identityId) return s;
    }
    return null;
  }

  @override
  Future<List<Student>> fetchAll() async => List.of(students);

  @override
  Future<List<Student>> fetchPage({
    required int offset,
    required int limit,
  }) async {
    final sorted = List.of(students)
      ..sort((a, b) => b.enrolledAt.compareTo(a.enrolledAt));
    if (offset >= sorted.length) return [];
    final end = (offset + limit).clamp(0, sorted.length);
    return List.of(sorted.sublist(offset, end));
  }

  @override
  Future<int> countAll() async => students.length;

  @override
  Future<List<Student>> fetchActive() async =>
      students.where((s) => s.isActive).toList();

  @override
  Future<List<Student>> fetchByGroupId(String groupId) async =>
      students.where((s) => s.groupId == groupId).toList();

  @override
  Future<List<Student>> fetchUnpaid() async =>
      students.where((s) => !s.hasPaid).toList();

  @override
  Future<int> nextStudentNumber() async {
    if (students.isEmpty) return 1;
    return students
            .map((s) => s.studentNumber)
            .reduce((a, b) => a > b ? a : b) +
        1;
  }

  @override
  Future<Student> updateStatus(
    String identityId,
    StudentStatus newStatus,
  ) async {
    final student = await fetchByIdentityId(identityId);
    if (student == null) throw Exception('Talaba topilmadi: $identityId');
    final updated = student.copyWith(studentStatus: newStatus);
    return update(updated);
  }

  @override
  Future<Student> updateParentInfo(
    String identityId, {
    String? parentName,
    String? parentPhone,
    String? parentTelegramId,
  }) async {
    final student = await fetchByIdentityId(identityId);
    if (student == null) throw Exception('Talaba topilmadi: $identityId');
    final updated = student.copyWith(
      parentName: parentName,
      parentPhone: parentPhone,
      parentTelegramId: parentTelegramId,
    );
    return update(updated);
  }

  @override
  Future<Student> startTransfer(String identityId, String targetGroupId) async {
    final student = await fetchByIdentityId(identityId);
    if (student == null) throw Exception('Talaba topilmadi: $identityId');
    return update(
      student.copyWith(
        transferStatus: TransferStatus.pending,
        transferToGroupId: targetGroupId,
      ),
    );
  }

  @override
  Future<Student> confirmTransfer(String identityId) async {
    final student = await fetchByIdentityId(identityId);
    if (student == null) throw Exception('Talaba topilmadi: $identityId');
    return update(
      student.copyWith(
        groupId: student.transferToGroupId,
        transferStatus: TransferStatus.none,
        transferToGroupId: null,
      ),
    );
  }

  @override
  Future<Student> cancelTransfer(String identityId) async {
    final student = await fetchByIdentityId(identityId);
    if (student == null) throw Exception('Talaba topilmadi: $identityId');
    return update(
      student.copyWith(
        transferStatus: TransferStatus.none,
        transferToGroupId: null,
      ),
    );
  }

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
  Future<void> deleteByIdentityId(String identityId) async {
    students.removeWhere((s) => s.identityId == identityId);
  }

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    var moved = 0;
    for (var i = 0; i < students.length; i++) {
      if (students[i].identityId == fromIdentityId) {
        students[i] = _withIdentityId(students[i], toIdentityId);
        moved++;
      }
    }
    return moved;
  }

  static Student _withIdentityId(Student s, String newIdentityId) {
    return Student(
      identityId: newIdentityId,
      studentNumber: s.studentNumber,
      groupId: s.groupId,
      groupName: s.groupName,
      parentId: s.parentId,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      parentTelegramId: s.parentTelegramId,
      studentStatus: s.studentStatus,
      transferStatus: s.transferStatus,
      transferToGroupId: s.transferToGroupId,
      academicYear: s.academicYear,
      paymentStatus: s.paymentStatus,
      lastPaymentDate: s.lastPaymentDate,
      totalPaid: s.totalPaid,
      enrolledAt: s.enrolledAt,
      assignedAt: s.assignedAt,
      completedAt: s.completedAt,
      notes: s.notes,
      syncVersion: s.syncVersion,
      pendingSync: s.pendingSync,
    );
  }
}

/// Davomat uchun xotira ichidagi (in-memory) fake repository.
///
/// V3 (P0-02) upsert semantikasi: yozuv `lessonId` bilan bo'lsa — dars
/// darajasida merge (1 talaba + 1 dars = 1 yozuv), aks holda legacy
/// kundalik (1 talaba + 1 kun). Dublikat yaratilmaydi.
class FakeAttendanceRepository implements AttendanceRepository {
  final List<AttendanceEntry> entries;

  FakeAttendanceRepository({List<AttendanceEntry>? entries})
      : entries = entries ?? [];

  @override
  Future<AttendanceEntry> record(AttendanceEntry entry) async {
    final i = _indexOf(entry);
    if (i < 0) {
      entries.add(entry);
      return entry;
    }
    final existing = entries[i];
    final merged = existing.copyWith(
      // Legacy kundalik yozuv dars aniqlanganda yangilanadi (upgrade).
      lessonId: entry.lessonId ?? existing.lessonId,
      checkInAt: _earlier(existing.checkInAt, entry.checkInAt),
      checkOutAt: _later(existing.checkOutAt, entry.checkOutAt),
      // Isar putUpsert bilan bir xil qoida: primary (check-in) usuli
      // saqlanadi — check-out/status yozuv usulini almashtirmaydi.
      method: existing.method.isNotEmpty ? existing.method : entry.method,
      status: entry.status.isNotEmpty ? entry.status : existing.status,
      confidence: entry.confidence ?? existing.confidence,
      source: entry.source ?? existing.source,
      // V4: tahrirlangan yozuvlar uchun belgi (Isar putUpsert bilan mos).
      editedAt: entry.editedAt ?? existing.editedAt,
    );
    entries[i] = merged;
    return merged;
  }

  /// Isar `putUpsert` bilan bir xil qidiruv qoidasi:
  /// lessonId berilgan → avval aniq dars, keyin kundalik legacy (null);
  /// lessonId yo'q → kundalik.
  int _indexOf(AttendanceEntry entry) {
    if (entry.lessonId != null) {
      final byLesson = entries.indexWhere((e) =>
          e.identityId == entry.identityId &&
          e.lessonId == entry.lessonId &&
          !e.isLegacyMerged);
      if (byLesson >= 0) return byLesson;
      return entries.indexWhere((e) =>
          e.identityId == entry.identityId &&
          e.lessonId == null &&
          _sameDay(e.attendanceDate, entry.attendanceDate) &&
          !e.isLegacyMerged);
    }
    return entries.indexWhere((e) =>
        e.identityId == entry.identityId &&
        _sameDay(e.attendanceDate, entry.attendanceDate) &&
        !e.isLegacyMerged);
  }

  @override
  Future<AttendanceEntry?> fetchByStudentAndLesson(
    String identityId,
    String lessonId,
  ) async {
    for (final e in entries) {
      if (e.identityId == identityId &&
          e.lessonId == lessonId &&
          !e.isLegacyMerged) {
        return e;
      }
    }
    return null;
  }

  @override
  Future<AttendanceEntry?> fetchByStudentAndDate(
    String identityId,
    DateTime attendanceDate,
  ) async {
    for (final e in entries) {
      if (e.identityId == identityId &&
          _sameDay(e.attendanceDate, attendanceDate) &&
          !e.isLegacyMerged) {
        return e;
      }
    }
    return null;
  }

  @override
  Future<List<AttendanceEntry>> fetchByLesson(String lessonId) async =>
      entries.where((e) => e.lessonId == lessonId && !e.isLegacyMerged).toList()
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));

  @override
  Future<bool> hasRecordedToday(String identityId) async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return await fetchByStudentAndDate(identityId, today) != null;
  }

  @override
  Future<List<AttendanceEntry>> fetchToday() async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    final end = start.add(const Duration(days: 1));
    return entries
        .where((e) =>
            !e.isLegacyMerged &&
            !e.attendanceDate.isBefore(start) &&
            e.attendanceDate.isBefore(end))
        .toList();
  }

  @override
  Future<List<AttendanceEntry>> fetchForDate(DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return entries
        .where((e) =>
            !e.isLegacyMerged &&
            !e.attendanceDate.isBefore(start) &&
            e.attendanceDate.isBefore(end))
        .toList();
  }

  @override
  Future<List<AttendanceEntry>> fetchForIdentity(String identityId) async =>
      entries.where((e) => e.identityId == identityId).toList();

  @override
  Future<List<AttendanceEntry>> fetchBetween(
          DateTime from, DateTime to) async =>
      entries
          .where((e) =>
              !e.isLegacyMerged &&
              !e.timestamp.isBefore(from) &&
              e.timestamp.isBefore(to))
          .toList();

  @override
  Future<int> countToday() async => (await fetchToday()).length;

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    var moved = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].identityId == fromIdentityId) {
        final e = entries[i];
        entries[i] = AttendanceEntry(
          id: e.id,
          identityId: toIdentityId,
          fullName: e.fullName,
          role: e.role,
          attendanceDate: e.attendanceDate,
          lessonId: e.lessonId,
          checkInAt: e.checkInAt,
          checkOutAt: e.checkOutAt,        method: e.method,
        status: e.status,
        confidence: e.confidence,
        source: e.source,
        isLegacyMerged: e.isLegacyMerged,
        mergedIntoId: e.mergedIntoId,
        editedAt: e.editedAt,
      );
        moved++;
      }
    }
    return moved;
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static DateTime? _earlier(DateTime? a, DateTime? b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isBefore(b) ? a : b;
  }

  static DateTime? _later(DateTime? a, DateTime? b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isAfter(b) ? a : b;
  }
}

/// Attendance session uchun xotira ichidagi fake repository (P1.5).
///
/// Isar `putUpsert` bilan bir xil qoida: `lessonId` bo'yicha yagona —
/// duplicate session yaratilmaydi.
class FakeAttendanceSessionRepository implements AttendanceSessionRepository {
  final List<AttendanceSession> sessions;

  FakeAttendanceSessionRepository({List<AttendanceSession>? sessions})
      : sessions = sessions ?? [];

  @override
  Future<AttendanceSession> upsert(AttendanceSession session) async {
    final i = sessions.indexWhere((s) => s.lessonId == session.lessonId);
    if (i >= 0) {
      sessions[i] = session;
      return session;
    }
    sessions.add(session);
    return session;
  }

  @override
  Future<AttendanceSession?> fetchByLesson(String lessonId) async {
    for (final s in sessions) {
      if (s.lessonId == lessonId) return s;
    }
    return null;
  }

  @override
  Future<AttendanceSession?> createIfAbsent(AttendanceSession session) async {
    if (await fetchByLesson(session.lessonId) != null) return null;
    sessions.add(session);
    return session;
  }

  @override
  Future<List<AttendanceSession>> fetchActive() async =>
      sessions.where((s) => s.isActive).toList();

  @override
  Future<AttendanceSession?> closeByLesson(
    String lessonId,
    DateTime closedAt,
  ) async {
    final i = sessions.indexWhere((s) => s.lessonId == lessonId);
    if (i < 0) return null;
    final updated = sessions[i].copyWith(
      status: AttendanceSessionStatus.completed,
      closedAt: closedAt,
    );
    sessions[i] = updated;
    return updated;
  }
}

/// Settings uchun xotira ichidagi (in-memory) fake repository.
///
/// [settings] berilsa — o'sha qiymat qaytariladi; berilmasa default.
/// Widget testlarda real Isar/secure-storage talab qilinmaydi.
class FakeSettingsRepository implements SettingsRepository {
  AppSettings settings;
  int createBackupCalls = 0;
  int restoreBackupCalls = 0;

  FakeSettingsRepository({AppSettings? settings})
      : settings = settings ?? const AppSettings();

  @override
  Future<AppSettings> getSettings() async => settings;

  @override
  Future<AppSettings> saveSettings(AppSettings newSettings) async {
    settings = newSettings;
    return settings;
  }

  @override
  Future<String> createBackup() async {
    createBackupCalls++;
    return '/tmp/m_edu_test_backup.json';
  }

  @override
  Future<void> restoreBackup(String backupPath) async {
    restoreBackupCalls++;
  }

  @override
  Future<List<AppUser>> fetchUsers() async => const [];

  @override
  Future<AppUser> addUser(AppUser user) async => user;

  @override
  Future<AppUser> updateUser(AppUser user) async => user;

  @override
  Future<void> deleteUser(String userId) async {}

  @override
  Future<List<Subject>> fetchSubjects() async => const [];

  @override
  Future<Subject> addSubject(Subject subject) async => subject;

  @override
  Future<Subject> updateSubject(Subject subject) async => subject;

  @override
  Future<void> deleteSubject(String subjectId) async {}

  @override
  Future<bool> isBiometricEnabled() async => false;

  @override
  Future<void> setBiometricEnabled(bool enabled) async {}
}

/// Group uchun xotira ichidagi (in-memory) fake repository.
class FakeGroupRepository implements GroupRepository {
  final List<Group> groups;

  FakeGroupRepository({List<Group>? groups}) : groups = groups ?? [];

  @override
  Future<Group> save(Group group) async {
    groups.add(group);
    return group;
  }

  @override
  Future<Group> update(Group group) async {
    final i = groups.indexWhere((g) => g.groupId == group.groupId);
    if (i >= 0) {
      groups[i] = group;
    } else {
      groups.add(group);
    }
    return group;
  }

  @override
  Future<Group?> fetchById(String groupId) async {
    for (final g in groups) {
      if (g.groupId == groupId) return g;
    }
    return null;
  }

  @override
  Future<List<Group>> fetchAll() async => List.of(groups);

  @override
  Future<List<Group>> fetchActive() async =>
      groups.where((g) => g.isActive).toList();

  @override
  Future<List<Group>> fetchByTeacherId(String teacherId) async =>
      groups.where((g) => g.teacherId == teacherId).toList();

  @override
  Future<List<Group>> fetchByRoomId(String roomId) async =>
      groups.where((g) => g.roomId == roomId).toList();

  @override
  Future<Group> addMember(String groupId) async {
    final g = await fetchById(groupId);
    if (g == null) throw Exception('Guruh topilmadi: $groupId');
    return update(_withCurrentSize(g, g.currentSize + 1));
  }

  @override
  Future<Group> removeMember(String groupId) async {
    final g = await fetchById(groupId);
    if (g == null) throw Exception('Guruh topilmadi: $groupId');
    final size = g.currentSize > 0 ? g.currentSize - 1 : 0;
    return update(_withCurrentSize(g, size));
  }

  @override
  Future<Group> updateStatus(String groupId, GroupStatus newStatus) async {
    final g = await fetchById(groupId);
    if (g == null) throw Exception('Guruh topilmadi: $groupId');
    return update(_withStatus(g, newStatus));
  }

  @override
  Future<Group> archive(String groupId) =>
      updateStatus(groupId, GroupStatus.archived);

  static Group _withCurrentSize(Group g, int size) {
    return Group(
      groupId: g.groupId,
      name: g.name,
      code: g.code,
      capacity: g.capacity,
      currentSize: size,
      teacherId: g.teacherId,
      teacherName: g.teacherName,
      roomId: g.roomId,
      roomName: g.roomName,
      subject: g.subject,
      academicYear: g.academicYear,
      monthlyFee: g.monthlyFee,
      status: g.status,
      startDate: g.startDate,
      endDate: g.endDate,
      daysOfWeek: g.daysOfWeek,
      startTime: g.startTime,
      endTime: g.endTime,
      notes: g.notes,
      syncVersion: g.syncVersion,
      pendingSync: g.pendingSync,
    );
  }

  static Group _withStatus(Group g, GroupStatus status) {
    return Group(
      groupId: g.groupId,
      name: g.name,
      code: g.code,
      capacity: g.capacity,
      currentSize: g.currentSize,
      teacherId: g.teacherId,
      teacherName: g.teacherName,
      roomId: g.roomId,
      roomName: g.roomName,
      subject: g.subject,
      academicYear: g.academicYear,
      monthlyFee: g.monthlyFee,
      status: status,
      startDate: g.startDate,
      endDate: g.endDate,
      daysOfWeek: g.daysOfWeek,
      startTime: g.startTime,
      endTime: g.endTime,
      notes: g.notes,
      syncVersion: g.syncVersion,
      pendingSync: g.pendingSync,
    );
  }
}

/// Teacher uchun xotira ichidagi (in-memory) fake repository.
class FakeTeacherRepository implements TeacherRepository {
  final List<Teacher> teachers;

  FakeTeacherRepository({List<Teacher>? teachers}) : teachers = teachers ?? [];

  @override
  Future<Teacher> save(Teacher teacher) async {
    teachers.add(teacher);
    return teacher;
  }

  @override
  Future<Teacher> update(Teacher teacher) async {
    final i = teachers.indexWhere((t) => t.identityId == teacher.identityId);
    if (i >= 0) {
      teachers[i] = teacher;
    } else {
      teachers.add(teacher);
    }
    return teacher;
  }

  @override
  Future<Teacher?> fetchByIdentityId(String identityId) async {
    for (final t in teachers) {
      if (t.identityId == identityId) return t;
    }
    return null;
  }

  @override
  Future<List<Teacher>> fetchAll() async => List.of(teachers);

  @override
  Future<List<Teacher>> fetchActive() async =>
      teachers.where((t) => t.isActive).toList();

  @override
  Future<List<Teacher>> fetchByGroupId(String groupId) async =>
      teachers.where((t) => t.assignedGroupIds.contains(groupId)).toList();

  @override
  Future<List<Teacher>> fetchBySpecialization(String specialization) async =>
      teachers.where((t) => t.specialization == specialization).toList();

  @override
  Future<Teacher> assignToGroup(String identityId, String groupId) async {
    final teacher = await fetchByIdentityId(identityId);
    if (teacher == null) throw Exception("O'qituvchi topilmadi: $identityId");
    return update(_withGroups(
      teacher,
      [...teacher.assignedGroupIds, groupId],
    ));
  }

  @override
  Future<Teacher> removeFromGroup(String identityId, String groupId) async {
    final teacher = await fetchByIdentityId(identityId);
    if (teacher == null) throw Exception("O'qituvchi topilmadi: $identityId");
    return update(_withGroups(
      teacher,
      teacher.assignedGroupIds.where((g) => g != groupId).toList(),
    ));
  }

  @override
  Future<int> nextTeacherNumber() async {
    if (teachers.isEmpty) return 1;
    return teachers
            .map((t) => t.teacherNumber)
            .reduce((a, b) => a > b ? a : b) +
        1;
  }

  @override
  Future<Teacher> updateStatus(
    String identityId,
    TeacherStatus newStatus,
  ) async {
    final teacher = await fetchByIdentityId(identityId);
    if (teacher == null) throw Exception("O'qituvchi topilmadi: $identityId");
    return update(Teacher(
      identityId: teacher.identityId,
      teacherNumber: teacher.teacherNumber,
      specialization: teacher.specialization,
      assignedGroupIds: teacher.assignedGroupIds,
      weeklyHours: teacher.weeklyHours,
      maxWeeklyHours: teacher.maxWeeklyHours,
      status: newStatus,
      startDate: teacher.startDate,
      endDate: teacher.endDate,
      salary: teacher.salary,
      notes: teacher.notes,
      syncVersion: teacher.syncVersion + 1,
      pendingSync: teacher.pendingSync,
    ));
  }

  @override
  Future<Teacher> updateWeeklyHours(String identityId, int hours) async {
    final teacher = await fetchByIdentityId(identityId);
    if (teacher == null) throw Exception("O'qituvchi topilmadi: $identityId");
    return update(Teacher(
      identityId: teacher.identityId,
      teacherNumber: teacher.teacherNumber,
      specialization: teacher.specialization,
      assignedGroupIds: teacher.assignedGroupIds,
      weeklyHours: hours,
      maxWeeklyHours: teacher.maxWeeklyHours,
      status: teacher.status,
      startDate: teacher.startDate,
      endDate: teacher.endDate,
      salary: teacher.salary,
      notes: teacher.notes,
      syncVersion: teacher.syncVersion + 1,
      pendingSync: teacher.pendingSync,
    ));
  }

  @override
  Future<void> deleteByIdentityId(String identityId) async {
    teachers.removeWhere((t) => t.identityId == identityId);
  }

  static Teacher _withGroups(Teacher t, List<String> groupIds) {
    return Teacher(
      identityId: t.identityId,
      teacherNumber: t.teacherNumber,
      specialization: t.specialization,
      assignedGroupIds: groupIds,
      weeklyHours: t.weeklyHours,
      maxWeeklyHours: t.maxWeeklyHours,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      salary: t.salary,
      notes: t.notes,
      syncVersion: t.syncVersion + 1,
      pendingSync: t.pendingSync,
    );
  }
}

/// Jadval/xonalar uchun xotira ichidagi (in-memory) fake repository.
class FakeScheduleRepository implements ScheduleRepository {
  final List<Schedule> schedules;
  final List<Room> rooms;

  FakeScheduleRepository({List<Schedule>? schedules, List<Room>? rooms})
      : schedules = schedules ?? [],
        rooms = rooms ?? [];

  @override
  Future<Schedule> save(Schedule schedule) async {
    schedules.add(schedule);
    return schedule;
  }

  @override
  Future<Schedule> update(Schedule schedule) async {
    final i = schedules.indexWhere((s) => s.scheduleId == schedule.scheduleId);
    if (i >= 0) {
      schedules[i] = schedule;
    } else {
      schedules.add(schedule);
    }
    return schedule;
  }

  @override
  Future<Schedule?> fetchById(String scheduleId) async {
    for (final s in schedules) {
      if (s.scheduleId == scheduleId) return s;
    }
    return null;
  }

  @override
  Future<List<Schedule>> fetchAll() async => List.of(schedules);

  @override
  Future<List<Schedule>> fetchByGroupId(String groupId) async =>
      schedules.where((s) => s.groupId == groupId).toList();

  @override
  Future<List<Schedule>> fetchByTeacherId(String teacherId) async =>
      schedules.where((s) => s.teacherId == teacherId).toList();

  @override
  Future<List<Schedule>> fetchByRoomId(String roomId) async =>
      schedules.where((s) => s.roomId == roomId).toList();

  @override
  Future<List<Schedule>> fetchByDay(DayOfWeek day) async =>
      schedules.where((s) => s.dayOfWeek == day).toList();

  @override
  Future<List<Schedule>> fetchByDateRange(DateTime start, DateTime end) async =>
      schedules.where((s) {
        final d = s.specificDate;
        return d != null && !d.isBefore(start) && d.isBefore(end);
      }).toList();

  @override
  Future<Schedule> cancel(String scheduleId) async {
    final s = await fetchById(scheduleId);
    if (s == null) throw Exception('Jadval topilmadi: $scheduleId');
    return update(Schedule(
      scheduleId: s.scheduleId,
      groupId: s.groupId,
      groupName: s.groupName,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      roomId: s.roomId,
      roomName: s.roomName,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      status: ScheduleStatus.cancelled,
      specificDate: s.specificDate,
      startDate: s.startDate,
      endDate: s.endDate,
      notes: s.notes,
      syncVersion: s.syncVersion,
    ));
  }

  /// Real to'qnashuv mantiqi (spec §21): faqat `scheduled` holatdagi
  /// jadvallar ustidan vaqt oralig'i ustma-ust tushishini aniqlaydi.
  bool _overlaps(
    Schedule s,
    String startTime,
    String endTime,
    String? excludeScheduleId,
  ) {
    if (s.status != ScheduleStatus.scheduled) return false;
    if (excludeScheduleId != null && s.scheduleId == excludeScheduleId) {
      return false;
    }
    return startTime.compareTo(s.endTime) < 0 &&
        endTime.compareTo(s.startTime) > 0;
  }

  @override
  Future<bool> hasConflict({
    required String roomId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) async {
    return schedules.any((s) =>
        s.roomId == roomId &&
        s.dayOfWeek == dayOfWeek &&
        _overlaps(s, startTime, endTime, excludeScheduleId));
  }

  @override
  Future<bool> hasTeacherConflict({
    required String teacherId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) async {
    return schedules.any((s) =>
        s.teacherId == teacherId &&
        s.dayOfWeek == dayOfWeek &&
        _overlaps(s, startTime, endTime, excludeScheduleId));
  }

  @override
  Future<bool> hasGroupConflict({
    required String groupId,
    required DayOfWeek dayOfWeek,
    required String startTime,
    required String endTime,
    String? excludeScheduleId,
  }) async {
    return schedules.any((s) =>
        s.groupId == groupId &&
        s.dayOfWeek == dayOfWeek &&
        _overlaps(s, startTime, endTime, excludeScheduleId));
  }

  // ─── Xonalar ───────────────────────────────────────────────────────────

  @override
  Future<Room> saveRoom(Room room) async {
    rooms.add(room);
    return room;
  }

  @override
  Future<Room> updateRoom(Room room) async {
    final i = rooms.indexWhere((r) => r.roomId == room.roomId);
    if (i >= 0) {
      rooms[i] = room;
    } else {
      rooms.add(room);
    }
    return room;
  }

  @override
  Future<Room?> fetchRoomById(String roomId) async {
    for (final r in rooms) {
      if (r.roomId == roomId) return r;
    }
    return null;
  }

  @override
  Future<List<Room>> fetchAllRooms() async => List.of(rooms);

  @override
  Future<List<Room>> fetchAvailableRooms() async =>
      rooms.where((r) => r.isAvailable).toList();

  @override
  Future<Room> updateRoomStatus(String roomId, RoomStatus newStatus) async {
    final room = await fetchRoomById(roomId);
    if (room == null) throw Exception('Xona topilmadi: $roomId');
    return updateRoom(Room(
      roomId: room.roomId,
      name: room.name,
      code: room.code,
      capacity: room.capacity,
      location: room.location,
      status: newStatus,
      amenities: room.amenities,
      photoPath: room.photoPath,
      notes: room.notes,
      syncVersion: room.syncVersion + 1,
    ));
  }
}

/// To'lovlar/qarzdorliklar/xarajatlar uchun xotira ichidagi fake repository.
class FakePaymentRepository implements PaymentRepository {
  final List<Payment> payments;
  final List<Debt> debts;
  final List<Expense> expenses;

  FakePaymentRepository({
    List<Payment>? payments,
    List<Debt>? debts,
    List<Expense>? expenses,
  })  : payments = payments ?? [],
        debts = debts ?? [],
        expenses = expenses ?? [];

  // ─── To'lovlar ─────────────────────────────────────────────────────────

  @override
  Future<Payment> save(Payment payment) async {
    payments.add(payment);
    return payment;
  }

  @override
  Future<Payment> saveWithDebts(Payment payment, List<Debt> debtUpdates) async {
    final saved = await save(payment);
    for (final debt in debtUpdates) {
      await updateDebt(debt);
    }
    return saved;
  }

  @override
  Future<Payment> updateStatus(
      String paymentId, PaymentStatus newStatus) async {
    final payment = await fetchById(paymentId);
    if (payment == null) throw Exception("To'lov topilmadi: $paymentId");
    final updated = Payment(
      paymentId: payment.paymentId,
      studentIdentityId: payment.studentIdentityId,
      studentName: payment.studentName,
      groupId: payment.groupId,
      groupName: payment.groupName,
      amount: payment.amount,
      paymentType: payment.paymentType,
      paymentDate: payment.paymentDate,
      status: newStatus,
      receiptNumber: payment.receiptNumber,
      dueDate: payment.dueDate,
      billingPeriod: payment.billingPeriod,
      discountAmount: payment.discountAmount,
      discountReason: payment.discountReason,
      lateFee: payment.lateFee,
      notes: payment.notes,
      receivedBy: payment.receivedBy,
      syncVersion: payment.syncVersion + 1,
      pendingSync: payment.pendingSync,
    );
    final i = payments.indexWhere((p) => p.paymentId == paymentId);
    if (i >= 0) payments[i] = updated;
    return updated;
  }

  @override
  Future<Payment?> fetchById(String paymentId) async {
    for (final p in payments) {
      if (p.paymentId == paymentId) return p;
    }
    return null;
  }

  @override
  Future<List<Payment>> fetchAll() async => List.of(payments);

  @override
  Future<List<Payment>> fetchByStudentId(String studentIdentityId) async =>
      payments.where((p) => p.studentIdentityId == studentIdentityId).toList();

  @override
  Future<List<Payment>> fetchByGroupId(String groupId) async =>
      payments.where((p) => p.groupId == groupId).toList();

  @override
  Future<List<Payment>> fetchByDateRange(DateTime start, DateTime end) async =>
      payments
          .where((p) =>
              !p.paymentDate.isBefore(start) && p.paymentDate.isBefore(end))
          .toList();

  @override
  Future<List<Payment>> fetchByType(PaymentType type) async =>
      payments.where((p) => p.paymentType == type).toList();

  @override
  Future<String?> lastReceiptNumber() async {
    if (payments.isEmpty) return null;
    final numbers =
        payments.map((p) => p.receiptNumber).whereType<String>().toList();
    return numbers.isEmpty ? null : numbers.last;
  }

  @override
  Future<int> repointPaymentAndDebtReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    var moved = 0;
    for (var i = 0; i < payments.length; i++) {
      if (payments[i].studentIdentityId == fromIdentityId) {
        final p = payments[i];
        payments[i] = Payment(
          paymentId: p.paymentId,
          studentIdentityId: toIdentityId,
          studentName: p.studentName,
          groupId: p.groupId,
          groupName: p.groupName,
          amount: p.amount,
          paymentType: p.paymentType,
          paymentDate: p.paymentDate,
          status: p.status,
          receiptNumber: p.receiptNumber,
          dueDate: p.dueDate,
          billingPeriod: p.billingPeriod,
          discountAmount: p.discountAmount,
          discountReason: p.discountReason,
          lateFee: p.lateFee,
          notes: p.notes,
          receivedBy: p.receivedBy,
          syncVersion: p.syncVersion + 1,
          pendingSync: p.pendingSync,
        );
        moved++;
      }
    }
    for (var i = 0; i < debts.length; i++) {
      if (debts[i].studentIdentityId == fromIdentityId) {
        final d = debts[i];
        debts[i] = Debt(
          debtId: d.debtId,
          studentIdentityId: toIdentityId,
          studentName: d.studentName,
          groupId: d.groupId,
          groupName: d.groupName,
          dueDate: d.dueDate,
          totalAmount: d.totalAmount,
          paidAmount: d.paidAmount,
          remainingAmount: d.remainingAmount,
          status: d.status,
          billingPeriod: d.billingPeriod,
          reminderSent: d.reminderSent,
          lastReminderDate: d.lastReminderDate,
          notes: d.notes,
          syncVersion: d.syncVersion + 1,
        );
        moved++;
      }
    }
    return moved;
  }

  // ─── Qarzdorlik ────────────────────────────────────────────────────────

  @override
  Future<Debt> saveDebt(Debt debt) async {
    debts.add(debt);
    return debt;
  }

  @override
  Future<Debt> updateDebt(Debt debt) async {
    final i = debts.indexWhere((d) => d.debtId == debt.debtId);
    if (i >= 0) {
      debts[i] = debt;
    } else {
      debts.add(debt);
    }
    return debt;
  }

  @override
  Future<List<Debt>> fetchDebtsByStudentId(String studentIdentityId) async =>
      debts.where((d) => d.studentIdentityId == studentIdentityId).toList();

  @override
  Future<List<Debt>> fetchOutstandingDebts() async => debts
      .where((d) =>
          d.status == DebtStatus.outstanding || d.status == DebtStatus.partial)
      .toList();

  @override
  Future<List<Debt>> fetchOverdueDebts() async =>
      debts.where((d) => d.isOverdue).toList();

  @override
  Future<List<Debt>> fetchDebtsByGroupId(String groupId) async =>
      debts.where((d) => d.groupId == groupId).toList();

  @override
  Future<Debt> markDebtAsPaid(String debtId) async {
    Debt? d;
    for (final x in debts) {
      if (x.debtId == debtId) {
        d = x;
        break;
      }
    }
    if (d == null) throw Exception('Qarzdorlik topilmadi: $debtId');
    return updateDebt(Debt(
      debtId: d.debtId,
      studentIdentityId: d.studentIdentityId,
      studentName: d.studentName,
      groupId: d.groupId,
      groupName: d.groupName,
      dueDate: d.dueDate,
      totalAmount: d.totalAmount,
      paidAmount: d.totalAmount,
      remainingAmount: 0,
      status: DebtStatus.paid,
      billingPeriod: d.billingPeriod,
      reminderSent: d.reminderSent,
      lastReminderDate: d.lastReminderDate,
      notes: d.notes,
      syncVersion: d.syncVersion + 1,
    ));
  }

  @override
  Future<Debt> markReminderSent(String debtId) async {
    Debt? d;
    for (final x in debts) {
      if (x.debtId == debtId) {
        d = x;
        break;
      }
    }
    if (d == null) throw Exception('Qarzdorlik topilmadi: $debtId');
    return updateDebt(Debt(
      debtId: d.debtId,
      studentIdentityId: d.studentIdentityId,
      studentName: d.studentName,
      groupId: d.groupId,
      groupName: d.groupName,
      dueDate: d.dueDate,
      totalAmount: d.totalAmount,
      paidAmount: d.paidAmount,
      remainingAmount: d.remainingAmount,
      status: d.status,
      billingPeriod: d.billingPeriod,
      reminderSent: true,
      lastReminderDate: DateTime.now(),
      notes: d.notes,
      syncVersion: d.syncVersion + 1,
    ));
  }

  // ─── Xarajatlar ────────────────────────────────────────────────────────

  @override
  Future<Expense> saveExpense(Expense expense) async {
    expenses.add(expense);
    return expense;
  }

  @override
  Future<void> deleteExpense(String expenseId) async {
    expenses.removeWhere((e) => e.expenseId == expenseId);
  }

  @override
  Future<Expense?> fetchExpenseById(String expenseId) async {
    for (final e in expenses) {
      if (e.expenseId == expenseId) return e;
    }
    return null;
  }

  @override
  Future<List<Expense>> fetchAllExpenses() async => List.of(expenses);

  @override
  Future<List<Expense>> fetchExpensesByDateRange(
    DateTime start,
    DateTime end,
  ) async =>
      expenses
          .where((e) =>
              !e.expenseDate.isBefore(start) && e.expenseDate.isBefore(end))
          .toList();
}

/// Yuz bazasi (enrollment) uchun xotira ichidagi fake repository.
class FakeFaceRecognitionRepository implements FaceRecognitionRepository {
  final Map<String, FaceSignature> faces;
  final Map<String, int> sampleCounts;

  FakeFaceRecognitionRepository({
    Map<String, FaceSignature>? faces,
  })  : faces = faces ?? {},
        sampleCounts = {};

  @override
  Future<void> saveFace({
    required String identityId,
    required FaceSignature signature,
    required int sampleCount,
  }) async {
    faces[identityId] = signature;
    sampleCounts[identityId] = sampleCount;
  }

  @override
  Future<EnrolledFace?> findFaceByIdentityId(String identityId) async {
    final signature = faces[identityId];
    return signature == null
        ? null
        : EnrolledFace(identityId: identityId, signature: signature);
  }

  @override
  Future<List<EnrolledFace>> findAllFaces() async => faces.entries
      .map((e) => EnrolledFace(identityId: e.key, signature: e.value))
      .toList();

  @override
  Future<void> deleteFace(String identityId) async {
    faces.remove(identityId);
    sampleCounts.remove(identityId);
  }

  @override
  Future<bool> hasFace(String identityId) async =>
      faces.containsKey(identityId);

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    final duplicate = faces[fromIdentityId];
    if (duplicate == null) return 0;
    if (faces.containsKey(toIdentityId)) {
      // Survivor yuzi ustun — duplicate'niki o'chiriladi.
      faces.remove(fromIdentityId);
      sampleCounts.remove(fromIdentityId);
      return 1;
    }
    faces[toIdentityId] = duplicate;
    sampleCounts[toIdentityId] = sampleCounts.remove(fromIdentityId) ?? 1;
    faces.remove(fromIdentityId);
    return 1;
  }
}
