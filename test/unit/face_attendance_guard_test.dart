import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/application/face_attendance_guard.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/scheduling/domain/entities/lesson_instance.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_repositories.dart';

Identity _identity({
  IdentityRole role = IdentityRole.student,
  IdentityStatus status = IdentityStatus.active,
}) =>
    Identity(
      identityId: 'M-EDU-2026-000001',
      firstName: 'Ali',
      lastName: 'Valiyev',
      role: role,
      status: status,
      qrSeed: 'seed-1',
      createdAt: DateTime(2026, 8, 1),
    );

Student _student({
  StudentStatus status = StudentStatus.active,
  String? groupId = 'GRP-1',
}) =>
    Student(
      identityId: 'M-EDU-2026-000001',
      studentNumber: 1,
      groupId: groupId,
      studentStatus: status,
      enrolledAt: DateTime(2026, 8, 1),
    );

LessonInstance _lesson({String groupId = 'GRP-1'}) => LessonInstance(
      lessonId: 'LESSON-SCH-1-20260812',
      scheduleId: 'SCH-1',
      date: DateTime(2026, 8, 12),
      startTime: '09:00',
      endTime: '10:30',
      groupId: groupId,
    );

void main() {
  group('FaceAttendanceGuard (spec §17-18)', () {
    test('faol o\'quvchi + guruh mos → allow', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(students: [_student()]),
      );
      final decision = await guard.evaluate(
        identity: _identity(),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.allow);
    });

    test('arxivlangan identity → identityInactive (§17)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(students: [_student()]),
      );
      final decision = await guard.evaluate(
        identity: _identity(status: IdentityStatus.archived),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.identityInactive);
    });

    test('student bazada yo\'q → studentNotFound (§17)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(),
      );
      final decision = await guard.evaluate(
        identity: _identity(),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.studentNotFound);
    });

    test('arxivlangan student → studentInactive (§17)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(
          students: [_student(status: StudentStatus.archived)],
        ),
      );
      final decision = await guard.evaluate(
        identity: _identity(),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.studentInactive);
    });

    test('boshqa guruhdagi student → studentNotInLessonGroup (§18)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(
          students: [_student(groupId: 'GRP-2')],
        ),
      );
      final decision = await guard.evaluate(
        identity: _identity(),
        lesson: _lesson(groupId: 'GRP-1'),
      );
      expect(decision, FaceAttendanceDecision.studentNotInLessonGroup);
    });

    test('guruhga tayinlanmagan student → studentNotInLessonGroup (§18)',
        () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(
          students: [_student(groupId: null)],
        ),
      );
      final decision = await guard.evaluate(
        identity: _identity(),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.studentNotInLessonGroup);
    });

    test('o\'qituvchi (student emas) faol bo\'lsa → allow (§18)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(),
      );
      final decision = await guard.evaluate(
        identity: _identity(role: IdentityRole.teacher),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.allow);
    });

    test('o\'qituvchi faol emas bo\'lsa → identityInactive (§17)', () async {
      final guard = FaceAttendanceGuard(
        studentRepository: FakeStudentRepository(),
      );
      final decision = await guard.evaluate(
        identity: _identity(
          role: IdentityRole.teacher,
          status: IdentityStatus.frozen,
        ),
        lesson: _lesson(),
      );
      expect(decision, FaceAttendanceDecision.identityInactive);
    });
  });
}
