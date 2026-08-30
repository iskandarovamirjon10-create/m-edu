import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/application/commands/mark_attendance_status_command.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/presentation/pages/attendance_center_page.dart';
import 'package:m_edu/features/attendance/presentation/pages/attendance_page.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/groups/presentation/providers/group_providers.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/scheduling/domain/entities/lesson_instance.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';

import '../helpers/fake_repositories.dart';

/// SCREEN 20 (Davomat markazi) + SCREEN 19 (Marking) status/blocking qoidalari
/// (spec §03, §10):
///
/// - O'tgan kundagi belgilanmagan dars → "Kutilmoqda" + [Belgilash].
/// - Kelajakdagi sana → barcha darslar "Rejalashtirilgan", belgilash
///   BLOKLANADI va sabab tushunarli ko'rsatiladi.
/// - Belgilangan dars → "Belgilangan" + "X/Y qatnashdi".
/// - Marking sahifasida hali boshlanmagan dars → "Dars hali boshlanmagan.",
///   Face/QR/Hammasi keldi inputlari bloklanadi.
void main() {
  Schedule sched(String id, DateTime date) => Schedule(
        scheduleId: id,
        groupId: 'GRP-A',
        groupName: 'Elementary A1',
        teacherId: 'TCH-1',
        teacherName: 'Aziza Karimova',
        roomId: 'RM-1',
        roomName: 'Xona 1',
        dayOfWeek: DayOfWeek.monday,
        startTime: '08:00',
        endTime: '09:00',
        subject: 'Matematika',
        status: ScheduleStatus.scheduled,
        specificDate: date,
      );

  Student student(String id) => Student(
        identityId: id,
        studentNumber: 1,
        groupId: 'GRP-A',
        groupName: 'Elementary A1',
        studentStatus: StudentStatus.active,
        enrolledAt: DateTime(2026, 1, 1),
      );

  Widget buildCenter({
    required FakeScheduleRepository scheduleRepo,
    required FakeAttendanceRepository attendanceRepo,
    required FakeStudentRepository studentRepo,
  }) {
    return ProviderScope(
      overrides: [
        scheduleRepositoryProvider.overrideWithValue(scheduleRepo),
        attendanceRepositoryProvider.overrideWithValue(attendanceRepo),
        studentRepositoryProvider.overrideWithValue(studentRepo),
        groupRepositoryProvider.overrideWithValue(FakeGroupRepository()),
        identityRepositoryProvider.overrideWithValue(FakeIdentityRepository()),
      ],
      child: const MaterialApp(home: AttendanceCenterPage()),
    );
  }

  testWidgets(
      "markaz: o'tgan kundagi belgilanmagan dars — 'Kutilmoqda' + [Belgilash]",
      (tester) async {
    final yesterday =
        DateTime.now().subtract(const Duration(days: 1));

    await tester.pumpWidget(buildCenter(
      scheduleRepo: FakeScheduleRepository(
        schedules: [sched('SCH-1', yesterday)],
      ),
      attendanceRepo: FakeAttendanceRepository(),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
        student('M-EDU-2026-000002'),
      ]),
    ));
    await tester.pumpAndSettle();

    // Bugun → empty state; o'tgan kunga o'tamiz.
    expect(find.text('Bu kunda dars yo\'q.'), findsOneWidget);
    await tester.tap(find.byTooltip('Oldingi kun'));
    await tester.pumpAndSettle();

    expect(find.text('Matematika'), findsOneWidget);
    expect(find.text('Kutilmoqda'), findsOneWidget);
    expect(find.text('Belgilash'), findsOneWidget);
    expect(find.text('Belgilangani: 0/1 dars'), findsOneWidget);
  });

  testWidgets(
      "markaz: kelajakdagi sana — hammasi 'Rejalashtirilgan', belgilash bloklanadi",
      (tester) async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));

    await tester.pumpWidget(buildCenter(
      scheduleRepo: FakeScheduleRepository(
        schedules: [sched('SCH-1', tomorrow)],
      ),
      attendanceRepo: FakeAttendanceRepository(),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
      ]),
    ));
    await tester.pumpAndSettle();

    // Bugun → empty; ertangi kunga o'tamiz.
    await tester.tap(find.byTooltip('Keyingi kun'));
    await tester.pumpAndSettle();

    expect(find.text('Matematika'), findsOneWidget);
    expect(find.text('Rejalashtirilgan'), findsOneWidget);
    expect(find.text('Belgilash'), findsNothing);
    expect(find.text('Dars hali boshlanmagan'), findsOneWidget);
    expect(
      find.text('Kelajakdagi sana — davomat belgilab bo\'lmaydi'),
      findsOneWidget,
    );
  });

  testWidgets(
      "markaz: belgilangan dars — 'Belgilangan' + 'X/Y qatnashdi'",
      (tester) async {
    final yesterday =
        DateTime.now().subtract(const Duration(days: 1));
    final lessonId =
        'LESSON-SCH-1-${yesterday.year}${yesterday.month.toString().padLeft(2, '0')}${yesterday.day.toString().padLeft(2, '0')}';

    await tester.pumpWidget(buildCenter(
      scheduleRepo: FakeScheduleRepository(
        schedules: [sched('SCH-1', yesterday)],
      ),
      attendanceRepo: FakeAttendanceRepository(entries: [
        AttendanceEntry(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          attendanceDate: yesterday,
          lessonId: lessonId,
          method: 'manual',
          status: 'present',
        ),
      ]),
      studentRepo: FakeStudentRepository(students: [
        student('M-EDU-2026-000001'),
        student('M-EDU-2026-000002'),
      ]),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Oldingi kun'));
    await tester.pumpAndSettle();

    expect(find.text('Belgilangan'), findsOneWidget);
    expect(find.text('1/2 qatnashdi'), findsOneWidget);
    expect(find.text('Belgilangani: 1/1 dars'), findsOneWidget);
  });

  testWidgets(
      "marking: hali boshlanmagan dars — 'Dars hali boshlanmagan.', inputlar blok",
      (tester) async {
    final futureLesson = LessonInstance(
      lessonId: 'LESSON-SCH-FUT-001-20990101',
      scheduleId: 'SCH-FUT-001',
      date: DateTime(2099, 1, 1), // kelajakdagi dars
      startTime: '09:00',
      endTime: '10:30',
      subject: 'Fizika',
      groupId: 'GRP-A',
      groupName: 'Elementary A1',
      teacherName: 'Aziza Karimova',
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [
        activeLessonProvider.overrideWith((ref) async => futureLesson),
        attendanceSessionRepositoryProvider
            .overrideWithValue(FakeAttendanceSessionRepository()),
        scheduleRepositoryProvider.overrideWithValue(FakeScheduleRepository()),
        studentRepositoryProvider.overrideWithValue(FakeStudentRepository(
          students: [student('M-EDU-2026-000001')],
        )),
        attendanceRepositoryProvider.overrideWithValue(FakeAttendanceRepository()),
        identityRepositoryProvider.overrideWithValue(FakeIdentityRepository()),
        markAttendanceStatusCommandProvider.overrideWithValue(
          MarkAttendanceStatusCommand(
            repository: FakeAttendanceRepository(),
            eventBus: EventBus(),
            actorRole: UserRole.superAdmin,
          ),
        ),
        recordAttendanceCommandProvider.overrideWithValue(
          RecordAttendanceCommand(
            repository: FakeAttendanceRepository(),
            eventBus: EventBus(),
            actorRole: UserRole.superAdmin,
          ),
        ),
      ],
      child: const MaterialApp(home: AttendancePage()),
    ));
    await tester.pumpAndSettle();

    // Bloklash xabari + sabab (spec §10).
    expect(find.text('Dars hali boshlanmagan.'), findsOneWidget);
    expect(find.text('Rejalashtirilgan'), findsOneWidget);

    // Face ID tugmasigacha aylantiramiz (panel ro'yxatda pastroq).
    await tester.drag(find.byType(ListView), const Offset(0, -250));
    await tester.pumpAndSettle();

    // Face ID tugmasi bloklangan.
    final faceButton = tester.widget<ElevatedButton>(
      find.ancestor(
        of: find.text('Face ID'),
        matching: find.bySubtype<ElevatedButton>(),
      ),
    );
    expect(faceButton.onPressed, isNull);

    // "Hammasi keldi" ham bloklangan.
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    final markAllButton = tester.widget<FilledButton>(
      find.ancestor(
        of: find.text('Hammasi keldi'),
        matching: find.bySubtype<FilledButton>(),
      ),
    );
    expect(markAllButton.onPressed, isNull);
  });
}
