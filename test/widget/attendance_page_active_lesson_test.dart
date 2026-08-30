import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/application/commands/mark_attendance_status_command.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/presentation/pages/attendance_page.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/scheduling/domain/entities/lesson_instance.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';

import '../helpers/fake_repositories.dart';

/// P1: Attendance sahifasi AKTIV DARS kontekstiga bog'langan.
///
/// - Faol dars yo'q → "Hozir faol dars yo'q" empty state (real repo).
/// - Faol dars bor → dars sarlavhasi (Guruh • Fan / vaqt / Teacher / status
///   / "X / Y qatnashdi") + shu DARS bo'yicha TO'LIQ o'quvchi ro'yxati.
/// - HAMMASI KELDI tezkor workflow (spec §07): barcha o'quvchilarga
///   `present` belgilanadi.
/// - Inline holat boshqaruvi (spec §08): tanlov DARHOL saqlanadi va
///   command'ga `lessonId` MAJBURIY o'tadi.
void main() {
  /// Deterministik faol dars — test vaqtidan mustaqil (yarim tungi chekka
  /// holatlarda ham ishonchli).
  final lesson = LessonInstance(
    lessonId: 'LESSON-SCH-ACTIVE-001-20260811',
    scheduleId: 'SCH-ACTIVE-001',
    date: DateTime(2026, 8, 11),
    startTime: '18:00',
    endTime: '19:30',
    subject: 'Ingliz tili',
    groupId: 'GRP-A',
    groupName: 'Elementary A1',
    teacherName: 'Aziza Karimova',
    roomName: 'Xona 1',
  );

  Student student(String id) => Student(
        identityId: id,
        studentNumber: 1,
        groupId: 'GRP-A',
        groupName: 'Elementary A1',
        studentStatus: StudentStatus.active,
        enrolledAt: DateTime(2026, 1, 1),
      );

  Identity identity(String id, String first, String last) => Identity(
        identityId: id,
        firstName: first,
        lastName: last,
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'seed-$id',
        createdAt: DateTime(2026, 1, 1),
      );

  /// Sahifani real provider grafi bilan quradi — faqat repository'lar fake
  /// (repo holati UI state manbai: loading/empty/error/success — P1 #14).
  Widget buildPage({
    required FakeScheduleRepository scheduleRepo,
    required FakeStudentRepository studentRepo,
    required FakeAttendanceRepository attendanceRepo,
    required FakeIdentityRepository identityRepo,
    required EventBus eventBus,
    LessonInstance? activeLessonOverride,
    FakeAttendanceSessionRepository? sessionRepo,
  }) {
    return ProviderScope(
      overrides: [
        if (activeLessonOverride != null)
          activeLessonProvider.overrideWith((ref) async => activeLessonOverride),
        if (sessionRepo != null)
          attendanceSessionRepositoryProvider.overrideWithValue(sessionRepo),
        scheduleRepositoryProvider.overrideWithValue(scheduleRepo),
        studentRepositoryProvider.overrideWithValue(studentRepo),
        attendanceRepositoryProvider.overrideWithValue(attendanceRepo),
        identityRepositoryProvider.overrideWithValue(identityRepo),
        markAttendanceStatusCommandProvider.overrideWithValue(
          MarkAttendanceStatusCommand(
            repository: attendanceRepo,
            eventBus: eventBus,
            actorRole: UserRole.superAdmin,
          ),
        ),
        recordAttendanceCommandProvider.overrideWithValue(
          RecordAttendanceCommand(
            repository: attendanceRepo,
            eventBus: eventBus,
            actorRole: UserRole.superAdmin,
          ),
        ),
      ],
      child: const MaterialApp(home: AttendancePage()),
    );
  }

  testWidgets("faol dars yo'q — 'Hozir faol dars yo'q' empty state",
      (tester) async {
    await tester.pumpWidget(buildPage(
      scheduleRepo: FakeScheduleRepository(), // jadval bo'sh → faol dars yo'q
      studentRepo: FakeStudentRepository(students: [student('M-EDU-2026-000001')]),
      attendanceRepo: FakeAttendanceRepository(),
      identityRepo: FakeIdentityRepository(),
      eventBus: EventBus(),
      sessionRepo: FakeAttendanceSessionRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.text("Hozir faol dars yo'q"), findsOneWidget);
    expect(find.text('Dars jadvali'), findsOneWidget);
    // Eski daily ko'rinish (umumiy ro'yxat) ko'rinmaydi.
    expect(find.text('Face ID'), findsNothing);
  });

  testWidgets(
      "faol dars bor — sarlavhada Guruh • Fan / vaqt / Teacher / status / hisob",
      (tester) async {
    final attendanceRepo = FakeAttendanceRepository(entries: [
      AttendanceEntry(
        identityId: 'M-EDU-2026-000001',
        fullName: 'Ali Valiyev',
        role: 'student',
        attendanceDate: lesson.date,
        lessonId: lesson.lessonId,
        checkInAt: DateTime(2026, 8, 11, 18, 10),
        method: 'face',
        status: 'present',
      ),
    ]);

    await tester.pumpWidget(buildPage(
      activeLessonOverride: lesson,
      scheduleRepo: FakeScheduleRepository(),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
        student('M-EDU-2026-000002'),
      ]),
      attendanceRepo: attendanceRepo,
      identityRepo: FakeIdentityRepository(identities: [
        identity('M-EDU-2026-000001', 'Ali', 'Valiyev'),
        identity('M-EDU-2026-000002', 'Bekzod', 'Rahimov'),
      ]),
      eventBus: EventBus(),
      sessionRepo: FakeAttendanceSessionRepository(),
    ));
    await tester.pumpAndSettle();

    // Guruh • Fan, vaqt, Teacher, status, hisob (P1 UI talabi).
    expect(find.text('Ingliz tili — Elementary A1'), findsOneWidget);
    expect(find.text('Teacher: Aziza Karimova'), findsOneWidget);
    expect(find.text('1 / 2 qatnashdi'), findsOneWidget);
    // ListView lazy — ro'yxat qatorini ko'rish uchun pastga aylantiramiz.
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    // To'liq o'quvchi ro'yxati: belgilangan talaba + belgilanmagan talaba.
    expect(find.text('Ali Valiyev'), findsOneWidget);
    expect(find.text('Bekzod Rahimov'), findsOneWidget);
  });

  testWidgets(
      "inline holat boshqaruvi — lessonId MAJBURIY command'ga o'tadi",
      (tester) async {
    final attendanceRepo = FakeAttendanceRepository();
    final eventBus = EventBus();

    await tester.pumpWidget(buildPage(
      activeLessonOverride: lesson,
      scheduleRepo: FakeScheduleRepository(),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
        student('M-EDU-2026-000002'),
      ]),
      attendanceRepo: attendanceRepo,
      identityRepo: FakeIdentityRepository(identities: [
        identity('M-EDU-2026-000001', 'Ali', 'Valiyev'),
        identity('M-EDU-2026-000002', 'Bekzod', 'Rahimov'),
      ]),
      eventBus: eventBus,
      sessionRepo: FakeAttendanceSessionRepository(),
    ));
    await tester.pumpAndSettle();

    // O'quvchi qatorigacha aylantiramiz.
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();

    // Ali Valiyev qatoridagi "Keldi" tugmasi → DARHOL saqlanadi (spec §08).
    final row = find.byKey(const ValueKey('mark-row-M-EDU-2026-000001'));
    expect(row, findsOneWidget);
    await tester.tap(find.descendant(
      of: row,
      matching: find.text('Keldi'),
    ));
    await tester.pumpAndSettle();

    // Yozuv dars darajasida: lessonId + status saqlangan.
    expect(attendanceRepo.entries, hasLength(1));
    expect(attendanceRepo.entries.single.lessonId, lesson.lessonId,
        reason: "lessonId UI'dan commandgacha majburiy o'tadi (P1 #3)");
    expect(attendanceRepo.entries.single.status, 'present');
    expect(attendanceRepo.entries.single.attendanceDate, lesson.date);
  });

  testWidgets(
      "HAMMASI KELDI — barcha o'quvchilarga present belgilaydi (spec §07)",
      (tester) async {
    final attendanceRepo = FakeAttendanceRepository();
    final eventBus = EventBus();

    await tester.pumpWidget(buildPage(
      activeLessonOverride: lesson,
      scheduleRepo: FakeScheduleRepository(),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
        student('M-EDU-2026-000002'),
      ]),
      attendanceRepo: attendanceRepo,
      identityRepo: FakeIdentityRepository(identities: [
        identity('M-EDU-2026-000001', 'Ali', 'Valiyev'),
        identity('M-EDU-2026-000002', 'Bekzod', 'Rahimov'),
      ]),
      eventBus: eventBus,
      sessionRepo: FakeAttendanceSessionRepository(),
    ));
    await tester.pumpAndSettle();

    // "Hammasi keldi" tugmasigacha aylantiramiz.
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hammasi keldi'));
    await tester.pumpAndSettle();

    // Ikkala o'quvchi ham present — bitta dars (lessonId bir xil).
    expect(attendanceRepo.entries, hasLength(2));
    expect(
      attendanceRepo.entries.every((e) =>
          e.status == 'present' && e.lessonId == lesson.lessonId),
      isTrue,
    );
  });
}
