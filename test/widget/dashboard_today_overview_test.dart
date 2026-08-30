import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/dashboard/presentation/widgets/dashboard_today_overview.dart';
import 'package:m_edu/features/scheduling/domain/entities/lesson_instance.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';

import '../helpers/fake_repositories.dart';

void main() {
  Widget wrap(List<Override> overrides, Widget child) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: child),
        ),
      ),
    );
  }

  DateTime today() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  group('TodayOverviewSection (Bugungi holat)', () {
    testWidgets("darslar va davomat taqsimoti REAL yozuvlardan ko'rinadi",
        (tester) async {
      final todayDay = DayOfWeek.values[DateTime.now().weekday - 1];
      final scheduleRepo = FakeScheduleRepository(schedules: [
        Schedule(
          scheduleId: 'SCH-1',
          groupId: 'GRP-1',
          groupName: 'Matematika-101',
          teacherId: 'M-EDU-2026-000010',
          teacherName: 'Bek Karimov',
          roomId: 'ROOM-1',
          roomName: '101-xona',
          dayOfWeek: todayDay,
          startTime: '09:00',
          endTime: '10:30',
          subject: 'Matematika',
        ),
      ]);

      final attendanceRepo = FakeAttendanceRepository(entries: [
        AttendanceEntry(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          attendanceDate: today(),
          checkInAt: DateTime.now(),
          method: 'manual',
          status: 'present',
        ),
        AttendanceEntry(
          identityId: 'M-EDU-2026-000002',
          fullName: 'Bekzod Karimov',
          role: 'student',
          attendanceDate: today(),
          checkInAt: DateTime.now(),
          method: 'manual',
          status: 'late',
        ),
        AttendanceEntry(
          identityId: 'M-EDU-2026-000003',
          fullName: 'Sardor Olimov',
          role: 'student',
          attendanceDate: today(),
          checkInAt: DateTime.now(),
          method: 'manual',
          status: 'absent',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [
          scheduleRepositoryProvider.overrideWithValue(scheduleRepo),
          attendanceRepositoryProvider.overrideWithValue(attendanceRepo),
        ],
        const TodayOverviewSection(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bugungi holat'), findsOneWidget);
      expect(find.text('Bugungi darslar'), findsOneWidget);
      expect(find.text('1'), findsOneWidget); // bugungi darslar soni
      expect(find.text('Belgilangan'), findsOneWidget);
      expect(find.text('3'), findsOneWidget); // jami belgilangan
      // Legend: status + son (real breakdown).
      expect(find.text('Qatnashdi • 1'), findsOneWidget);
      expect(find.text('Kechikkan • 1'), findsOneWidget);
      expect(find.text('Kelmagan • 1'), findsOneWidget);
      expect(find.text('Sababli • 0'), findsOneWidget);
    });

    testWidgets("davomat bo'lmasa — 'Bugun hali davomat belgilanmagan'",
        (tester) async {
      final todayDay = DayOfWeek.values[DateTime.now().weekday - 1];
      final scheduleRepo = FakeScheduleRepository(schedules: [
        Schedule(
          scheduleId: 'SCH-1',
          groupId: 'GRP-1',
          groupName: 'Matematika-101',
          teacherId: 'M-EDU-2026-000010',
          roomId: 'ROOM-1',
          dayOfWeek: todayDay,
          startTime: '09:00',
          endTime: '10:30',
          subject: 'Matematika',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [
          scheduleRepositoryProvider.overrideWithValue(scheduleRepo),
          attendanceRepositoryProvider.overrideWithValue(
            FakeAttendanceRepository(),
          ),
        ],
        const TodayOverviewSection(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bugungi holat'), findsOneWidget);
      expect(find.text('Bugun hali davomat belgilanmagan'), findsOneWidget);
    });

    testWidgets("faol dars bo'lsa — 'Davomatni boshlash' CTA ko'rinadi",
        (tester) async {
      final todayDay = DayOfWeek.values[DateTime.now().weekday - 1];
      final scheduleRepo = FakeScheduleRepository(schedules: [
        Schedule(
          scheduleId: 'SCH-ACTIVE',
          groupId: 'GRP-1',
          groupName: 'Ingliz tili-A1',
          teacherId: 'M-EDU-2026-000010',
          teacherName: 'Aziza Karimova',
          roomId: 'ROOM-2',
          roomName: '102-xona',
          dayOfWeek: todayDay,
          startTime: '09:00',
          endTime: '10:30',
          subject: 'Ingliz tili',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [
          scheduleRepositoryProvider.overrideWithValue(scheduleRepo),
          attendanceRepositoryProvider.overrideWithValue(
            FakeAttendanceRepository(),
          ),
          // Faol darsni deterministik override qilamiz — real vaqtga bog'liq
          // emas, attendance sahifasi bilan BIR XIL provider (P1).
          activeLessonProvider.overrideWith((ref) async => LessonInstance(
                lessonId: 'LESSON-SCH-ACTIVE-20260811',
                scheduleId: 'SCH-ACTIVE',
                date: DateTime.now(),
                startTime: '09:00',
                endTime: '10:30',
                subject: 'Ingliz tili',
                groupId: 'GRP-1',
                groupName: 'Ingliz tili-A1',
                teacherName: 'Aziza Karimova',
                roomName: '102-xona',
              )),
        ],
        const TodayOverviewSection(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Faol dars'), findsOneWidget);
      expect(find.text('Ingliz tili'), findsWidgets);
      expect(find.text('Davomatni boshlash'), findsOneWidget);
    });

    testWidgets("dars bo'lmasa — 0 dars, CTA yo'q (fake emas)", (tester) async {
      await tester.pumpWidget(wrap(
        [
          scheduleRepositoryProvider.overrideWithValue(
            FakeScheduleRepository(),
          ),
          attendanceRepositoryProvider.overrideWithValue(
            FakeAttendanceRepository(),
          ),
        ],
        const TodayOverviewSection(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bugungi holat'), findsOneWidget);
      expect(find.text('0'), findsWidgets); // 0 dars, 0 belgilangan
      expect(find.text('Davomatni boshlash'), findsNothing);
    });
  });
}
