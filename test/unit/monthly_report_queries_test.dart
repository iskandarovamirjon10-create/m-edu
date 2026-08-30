import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';
import 'package:m_edu/features/reports/application/queries/monthly_report_queries.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/domain/repositories/student_repository.dart';

/// 2026-yil iyul oyi: 1-iyul — chorshanba. Dushanba–juma kunlari:
/// 23 ta o'quv kuni (31 kundan 8 ta dam olish kuni ayiriladi).
const int _july2026SchoolDays = 23;

void main() {
  group('MonthlyReportQueries', () {
    final identityA = _identity('M-EDU-2026-000001', 'Ali', 'Valiyev');
    final identityB = _identity('M-EDU-2026-000002', 'Bek', 'Karimov');

    final activeA = _student('M-EDU-2026-000001', parentTelegramId: '111');
    final activeB = _student('M-EDU-2026-000002', parentPhone: '+998901234567');
    final frozenC = _student('M-EDU-2026-000003', status: StudentStatus.frozen);

    final repo = MonthlyReportQueries(
      studentRepository: _FakeStudentRepo([activeA, activeB, frozenC]),
      identityRepository: _FakeIdentityRepo([
        identityA,
        identityB,
        _identity('M-EDU-2026-000003', 'Sardor', 'Aliyev'),
      ]),
      attendanceRepository: _FakeAttendanceRepo([
        // Ali — 3 kun kelgan (1, 2, 3-iyul), hammasi ish kuni.
        _entry('M-EDU-2026-000001', 2026, 7, 1, 'face'),
        _entry('M-EDU-2026-000001', 2026, 7, 2, 'face'),
        _entry('M-EDU-2026-000001', 2026, 7, 3, 'qr'),
        // Bir kunda ikki marta belgilash — bitta kun deb sanalishi kerak.
        _entry('M-EDU-2026-000001', 2026, 7, 1, 'manual'),
        // O'qituvchi yozuvi (role != student) — hisobga olinmaydi.
        _entry('M-EDU-2026-000002', 2026, 7, 1, 'face', role: 'teacher'),
        // Muzlatilgan talaba (C) — ro'yxatga kirmaydi.
        _entry('M-EDU-2026-000003', 2026, 7, 4, 'face'),
      ]),
    );

    test("kelgan/kelmagan kunlarni to'g'ri hisoblaydi", () async {
      final summaries = await repo.fetchForMonth(2026, 7);

      expect(summaries, hasLength(2));

      final ali =
          summaries.firstWhere((s) => s.identityId == 'M-EDU-2026-000001');
      expect(ali.presentDays, 3);
      expect(ali.absentDays, _july2026SchoolDays - 3);
      expect(ali.totalSchoolDays, _july2026SchoolDays);
      expect(
          ali.attendancePercent, closeTo(3 / _july2026SchoolDays * 100, 1e-9));

      final bek =
          summaries.firstWhere((s) => s.identityId == 'M-EDU-2026-000002');
      expect(bek.presentDays, 0);
      expect(bek.absentDays, _july2026SchoolDays);
    });

    test("telegram kontakt holatini aks ettiradi", () async {
      final summaries = await repo.fetchForMonth(2026, 7);

      final ali =
          summaries.firstWhere((s) => s.identityId == 'M-EDU-2026-000001');
      final bek =
          summaries.firstWhere((s) => s.identityId == 'M-EDU-2026-000002');

      expect(ali.hasTelegramContact, isTrue);
      expect(ali.parentTelegramId, '111');
      expect(bek.hasTelegramContact, isFalse);
    });

    test("roli student bo'lmagan yozuvlar hisobga olinmaydi", () async {
      final summaries = await repo.fetchForMonth(2026, 7);
      final bek =
          summaries.firstWhere((s) => s.identityId == 'M-EDU-2026-000002');
      // Bek uchun faqat teacher-role yozuv bor — present 0 bo'lishi kerak.
      expect(bek.presentDays, 0);
    });
  });
}

Identity _identity(String id, String first, String last) {
  return Identity(
    identityId: id,
    firstName: first,
    lastName: last,
    role: IdentityRole.student,
    status: IdentityStatus.active,
    qrSeed: 'seed-$id',
    createdAt: DateTime(2025, 9, 1),
  );
}

Student _student(
  String id, {
  String? parentPhone,
  String? parentTelegramId,
  StudentStatus status = StudentStatus.active,
}) {
  return Student(
    identityId: id,
    studentNumber: 1,
    studentStatus: status,
    parentPhone: parentPhone,
    parentTelegramId: parentTelegramId,
    groupName: 'Guruh A',
    enrolledAt: DateTime(2025, 9, 1),
  );
}

AttendanceEntry _entry(
  String identityId,
  int year,
  int month,
  int day,
  String method, {
  String role = 'student',
}) {
  return AttendanceEntry(
    identityId: identityId,
    fullName: 'Ism Familiya',
    role: role,
    attendanceDate: DateTime(year, month, day),
    checkInAt: DateTime(year, month, day, 9),
    method: method,
  );
}

// ───────────────────── Fake repositories ─────────────────────

class _FakeStudentRepo implements StudentRepository {
  final List<Student> students;
  _FakeStudentRepo(this.students);

  @override
  Future<List<Student>> fetchActive() async =>
      students.where((s) => s.isActive).toList();

  @override
  Future<List<Student>> fetchAll() async => students;

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
  Future<Student?> fetchByIdentityId(String identityId) async => null;

  @override
  Future<Student> save(Student student) => throw UnimplementedError();

  @override
  Future<Student> update(Student student) => throw UnimplementedError();

  @override
  Future<Student> updateStatus(String identityId, StudentStatus newStatus) =>
      throw UnimplementedError();

  @override
  Future<Student> updateParentInfo(
    String identityId, {
    String? parentName,
    String? parentPhone,
    String? parentTelegramId,
  }) =>
      throw UnimplementedError();

  @override
  Future<Student> startTransfer(String identityId, String targetGroupId) =>
      throw UnimplementedError();

  @override
  Future<Student> confirmTransfer(String identityId) =>
      throw UnimplementedError();

  @override
  Future<Student> cancelTransfer(String identityId) =>
      throw UnimplementedError();

  @override
  Future<List<Student>> fetchByGroupId(String groupId) =>
      throw UnimplementedError();

  @override
  Future<List<Student>> fetchUnpaid() => throw UnimplementedError();

  @override
  Future<int> nextStudentNumber() => throw UnimplementedError();

  @override
  Future<Student> archive(String identityId) => throw UnimplementedError();

  @override
  Future<Student> graduate(String identityId) => throw UnimplementedError();

  @override
  Future<Student> freeze(String identityId) => throw UnimplementedError();

  @override
  Future<void> deleteByIdentityId(String identityId) =>
      throw UnimplementedError();

  @override
  Future<Student> reactivate(String identityId) => throw UnimplementedError();

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      throw UnimplementedError();
}

class _FakeIdentityRepo implements IdentityRepository {
  final List<Identity> identities;
  _FakeIdentityRepo(this.identities);

  @override
  Future<List<Identity>> fetchAll() async => identities;

  @override
  Future<List<Identity>> fetchByIds(List<String> identityIds) async =>
      identities.where((i) => identityIds.contains(i.identityId)).toList();

  @override
  Future<Identity?> fetchByIdentityId(String identityId) async => null;

  @override
  Future<Identity> save(Identity identity) => throw UnimplementedError();

  @override
  Future<void> recordActivity(IdentityActivity activity) =>
      throw UnimplementedError();

  @override
  Future<Identity> updateStatus(String identityId, IdentityStatus newStatus) =>
      throw UnimplementedError();

  @override
  Future<Identity> update(Identity identity) => throw UnimplementedError();

  @override
  Future<int> repointActivities(String fromIdentityId, String toIdentityId) =>
      throw UnimplementedError();

  @override
  Future<void> deleteByIdentityId(String identityId) =>
      throw UnimplementedError();

  @override
  Future<Identity?> fetchByPhone(String normalizedPhone) =>
      throw UnimplementedError();

  @override
  Future<List<Identity>> fetchByRole(IdentityRole role) =>
      throw UnimplementedError();

  @override
  Future<List<Identity>> fetchByStatus(IdentityStatus status) =>
      throw UnimplementedError();

  @override
  Future<List<IdentityActivity>> fetchActivities(String identityId) =>
      throw UnimplementedError();
}

class _FakeAttendanceRepo implements AttendanceRepository {
  final List<AttendanceEntry> entries;
  _FakeAttendanceRepo(this.entries);

  @override
  Future<List<AttendanceEntry>> fetchBetween(DateTime from, DateTime to) async {
    return entries
        .where((e) => !e.timestamp.isBefore(from) && e.timestamp.isBefore(to))
        .toList();
  }

  @override
  Future<AttendanceEntry> record(AttendanceEntry entry) =>
      throw UnimplementedError();

  @override
  Future<List<AttendanceEntry>> fetchToday() => throw UnimplementedError();

  @override
  Future<List<AttendanceEntry>> fetchForDate(DateTime date) =>
      throw UnimplementedError();

  @override
  Future<List<AttendanceEntry>> fetchForIdentity(String identityId) =>
      throw UnimplementedError();

  @override
  Future<List<AttendanceEntry>> fetchByLesson(String lessonId) async =>
      entries.where((e) => e.lessonId == lessonId).toList();

  @override
  Future<bool> hasRecordedToday(String identityId) =>
      throw UnimplementedError();

  @override
  Future<AttendanceEntry?> fetchByStudentAndDate(
    String identityId,
    DateTime attendanceDate,
  ) =>
      throw UnimplementedError();

  @override
  Future<AttendanceEntry?> fetchByStudentAndLesson(
    String identityId,
    String lessonId,
  ) =>
      throw UnimplementedError();

  @override
  Future<int> countToday() => throw UnimplementedError();

  @override
  Future<int> repointIdentityReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      throw UnimplementedError();
}
