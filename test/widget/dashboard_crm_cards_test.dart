import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/dashboard/presentation/widgets/dashboard_widgets.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/presentation/providers/payment_providers.dart';
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

  group('TodayAttendanceCard (bugungi davomat)', () {
    testWidgets("davomat bo'lsa statistika va so'nggi yozuvlar ko'rinadi",
        (tester) async {
      final repo = FakeAttendanceRepository(entries: [
        AttendanceEntry(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          attendanceDate: today(),
          checkInAt: DateTime.now(),
          method: 'manual',
        ),
        AttendanceEntry(
          identityId: 'M-EDU-2026-000002',
          fullName: 'Bekzod Karimov',
          role: 'student',
          attendanceDate: today(),
          checkInAt: DateTime.now(),
          method: 'face',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [attendanceRepositoryProvider.overrideWithValue(repo)],
        const TodayAttendanceCard(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bugungi davomat'), findsOneWidget);
      expect(find.text('Jonli'), findsOneWidget);
      expect(find.text('2'), findsOneWidget); // Jami statistika
      expect(find.text('Ali Valiyev'), findsOneWidget);
      expect(find.text('Bekzod Karimov'), findsOneWidget);
      // "Qo'lda"/"Yuz" statistika labelida ham, yozuv chipida ham bor — ≥1.
      expect(find.text("Qo'lda"), findsWidgets);
      expect(find.text('Yuz'), findsWidgets);
      expect(find.text('Davomat belgilash'), findsOneWidget);
    });

    testWidgets("davomat bo'lmasa empty-state ko'rinadi", (tester) async {
      final repo = FakeAttendanceRepository();

      await tester.pumpWidget(wrap(
        [attendanceRepositoryProvider.overrideWithValue(repo)],
        const TodayAttendanceCard(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bugun hali davomat belgilanmagan'), findsOneWidget);
      // Jami/Yuz/QR/Qo'lda — hammasi 0 (4 ta kichik statistika).
      expect(find.text('0'), findsNWidgets(4));
    });
  });

  group('UpcomingLessonsCard (yaqinlashib kelayotgan darslar)', () {
    testWidgets("bugungi kelayotgan dars ko'rinadi", (tester) async {
      final todayDay = DayOfWeek.values[DateTime.now().weekday - 1];
      final repo = FakeScheduleRepository(schedules: [
        Schedule(
          scheduleId: 'SCH-1',
          groupId: 'GRP-1',
          groupName: 'Matematika-101',
          teacherId: 'M-EDU-2026-000010',
          teacherName: 'Bek Karimov',
          roomId: 'ROOM-1',
          roomName: '101-xona',
          dayOfWeek: todayDay,
          // Har doim "kelayotgan" bo'lib qoladigan vaqt (kunning oxiri).
          startTime: '23:30',
          endTime: '23:59',
          subject: 'Matematika',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [scheduleRepositoryProvider.overrideWithValue(repo)],
        const UpcomingLessonsCard(),
      ));
      await tester.pumpAndSettle();

      expect(
        find.text('Yaqinlashib kelayotgan darslar'),
        findsOneWidget,
      );
      expect(find.text('Matematika'), findsOneWidget);
      expect(find.text('Bek Karimov • 101-xona'), findsOneWidget);
    });

    testWidgets("bugun dars yo'q bo'lsa empty-state", (tester) async {
      // Bugundan har doim farq qiladigan kun (dushanba %7 = 1 xatosidan qochish).
      final todayIndex = DateTime.now().weekday - 1;
      final otherDay = DayOfWeek.values[(todayIndex + 1) % 7];
      final repo = FakeScheduleRepository(schedules: [
        Schedule(
          scheduleId: 'SCH-1',
          groupId: 'GRP-1',
          groupName: 'Matematika-101',
          teacherId: 'M-EDU-2026-000010',
          roomId: 'ROOM-1',
          dayOfWeek: otherDay,
          startTime: '09:00',
          endTime: '10:30',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [scheduleRepositoryProvider.overrideWithValue(repo)],
        const UpcomingLessonsCard(),
      ));
      await tester.pumpAndSettle();

      expect(
        find.text('Bugun darslar rejalashtirilmagan'),
        findsOneWidget,
      );
    });
  });

  group('DebtorsCard (qarzdorlar)', () {
    testWidgets("qarzdorlar va jami qarz ko'rinadi", (tester) async {
      final repo = FakePaymentRepository(debts: [
        Debt(
          debtId: 'DEBT-1',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 8, 1), // muddati o'tgan
          totalAmount: 300000,
          remainingAmount: 300000,
          billingPeriod: '2026-08',
        ),
        Debt(
          debtId: 'DEBT-2',
          studentIdentityId: 'M-EDU-2026-000002',
          studentName: 'Bekzod Karimov',
          dueDate: DateTime(2099, 1, 1), // hali muddati yetmagan
          totalAmount: 150000,
          paidAmount: 50000,
          remainingAmount: 100000,
          billingPeriod: '2026-08',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [paymentRepositoryProvider.overrideWithValue(repo)],
        const DebtorsCard(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Qarzdorlar'), findsOneWidget);
      expect(find.text('Ali Valiyev'), findsOneWidget);
      expect(find.text('Bekzod Karimov'), findsOneWidget);
      // Jami qarz = 300.000 + 100.000 = 400.000
      expect(find.text("400.000 so'm"), findsOneWidget);
      expect(find.text("Muddati o'tgan"), findsOneWidget);
    });

    testWidgets("bitta talaba bir necha qarz bilan takrorlanmaydi",
        (tester) async {
      final repo = FakePaymentRepository(debts: [
        // Bir talabaning ikki xil davr qarzi — birlashtirilishi kerak.
        Debt(
          debtId: 'DEBT-1',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 7, 1),
          totalAmount: 200000,
          remainingAmount: 200000,
          billingPeriod: '2026-07',
        ),
        Debt(
          debtId: 'DEBT-2',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 8, 1),
          totalAmount: 150000,
          remainingAmount: 150000,
          billingPeriod: '2026-08',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [paymentRepositoryProvider.overrideWithValue(repo)],
        const DebtorsCard(),
      ));
      await tester.pumpAndSettle();

      // Takrorlanmaydi — bitta qator.
      expect(find.text('Ali Valiyev'), findsOneWidget);
      // Birlashtirilgan summa: 200.000 + 150.000 = 350.000
      // (header "Jami qarz" ham xuddi shu summani ko'rsatadi — 2 ta).
      expect(find.text("350.000 so'm"), findsNWidgets(2));
    });

    testWidgets("qarz yo'q bo'lsa empty-state", (tester) async {
      final repo = FakePaymentRepository();

      await tester.pumpWidget(wrap(
        [paymentRepositoryProvider.overrideWithValue(repo)],
        const DebtorsCard(),
      ));
      await tester.pumpAndSettle();

      expect(find.text("Qarzdorliklar yo'q"), findsOneWidget);
    });
  });
}
