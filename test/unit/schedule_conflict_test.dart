import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/scheduling/application/commands/create_schedule_command.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_repositories.dart';

/// Spec §21: Conflict detection — bir guruh/o'qituvchi/xona bir vaqtda
/// ikkita darsga biriktirilmasligi kerak.
///
/// Uchta o'lchov tekshiriladi:
///  1. guruh to'qnashuvi → DENY
///  2. o'qituvchi to'qnashuvi → DENY
///  3. xona to'qnashuvi → DENY
///  4. bir vaqtda turli guruhlar (turli xona/o'qituvchi) → PASS
///  5. to'qnashuv chetida (end == start) → PASS (qo'shni darslar)
void main() {
  final bus = EventBus();

  FakeScheduleRepository makeRepo() => FakeScheduleRepository();

  CreateScheduleCommand makeCommand(FakeScheduleRepository repo) =>
      CreateScheduleCommand(
        repository: repo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

  CreateScheduleRequest request({
    String groupId = 'GRP-1',
    String teacherId = 'T-1',
    String roomId = 'ROOM-1',
    DayOfWeek day = DayOfWeek.monday,
    String start = '09:00',
    String end = '10:00',
  }) {
    return CreateScheduleRequest(
      groupId: groupId,
      teacherId: teacherId,
      roomId: roomId,
      dayOfWeek: day,
      startTime: start,
      endTime: end,
    );
  }

  group('Schedule conflict detection (spec §21)', () {
    test('bir guruh bir vaqtda ikkita darsga biriktirilmaydi -> DENY',
        () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      // Birinchi dars muvaffaqiyatli saqlanadi.
      await cmd.execute(
        request(start: '09:00', end: '10:30', day: DayOfWeek.monday),
      );

      // Xuddi shu guruh, ustma-ust vaqt, boshqa xona/o'qituvchi -> DENY.
      await expectLater(
        cmd.execute(
          request(
            roomId: 'ROOM-2',
            teacherId: 'T-2',
            start: '10:00',
            end: '11:00',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("qo'shni darslar (end == start) to'qnashuv EMAS -> PASS", () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      await cmd.execute(
        request(start: '09:00', end: '10:00', day: DayOfWeek.tuesday),
      );
      // 10:00 da boshlanadi — 09:00-10:00 bilan ustma-ust emas.
      final schedule = await cmd.execute(
        request(start: '10:00', end: '11:00', day: DayOfWeek.tuesday),
      );
      expect(schedule.groupId, 'GRP-1');
    });

    test("bir o'qituvchi bir vaqtda ikki darsga qo'yilmaydi -> DENY",
        () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      await cmd.execute(
        request(teacherId: 'T-1', start: '09:00', end: '10:00'),
      );
      await expectLater(
        cmd.execute(
          request(
            groupId: 'GRP-2',
            roomId: 'ROOM-2',
            teacherId: 'T-1',
            start: '09:30',
            end: '10:30',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('bir xona bir vaqtda ikki darsga berilmaydi -> DENY', () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      await cmd.execute(
        request(roomId: 'ROOM-1', start: '09:00', end: '10:00'),
      );
      await expectLater(
        cmd.execute(
          request(
            groupId: 'GRP-2',
            teacherId: 'T-2',
            roomId: 'ROOM-1',
            start: '09:15',
            end: '10:15',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("bir vaqtda turli guruhlar (turli xona/o'qituvchi) -> PASS",
        () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      final a = await cmd.execute(
        request(
          groupId: 'GRP-A',
          teacherId: 'T-A',
          roomId: 'ROOM-A',
          start: '09:00',
          end: '10:00',
        ),
      );
      final b = await cmd.execute(
        request(
          groupId: 'GRP-B',
          teacherId: 'T-B',
          roomId: 'ROOM-B',
          start: '09:00',
          end: '10:00',
        ),
      );
      expect(a.groupId, 'GRP-A');
      expect(b.groupId, 'GRP-B');
    });

    test("cancelled dars to'qnashuv hisoblanmaydi -> PASS", () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      final first = await cmd.execute(
        request(start: '09:00', end: '10:00', day: DayOfWeek.wednesday),
      );
      await repo.cancel(first.scheduleId);

      // Bekor qilingan dars ustiga yangi dars qo'yish mumkin.
      final second = await cmd.execute(
        request(start: '09:30', end: '10:30', day: DayOfWeek.wednesday),
      );
      expect(second.groupId, 'GRP-1');
    });

    test("turli kunlarda bir xil vaqt -> to'qnashuv EMAS -> PASS", () async {
      final repo = makeRepo();
      final cmd = makeCommand(repo);

      await cmd.execute(
        request(start: '09:00', end: '10:00', day: DayOfWeek.monday),
      );
      final tuesday = await cmd.execute(
        request(start: '09:00', end: '10:00', day: DayOfWeek.tuesday),
      );
      expect(tuesday.groupId, 'GRP-1');
    });
  });
}
