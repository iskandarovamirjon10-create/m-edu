import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/scheduling/application/services/lesson_instance_service.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';

/// P0-02: Schedule shablonidan dars instance'larini deterministik hisoblash.
void main() {
  final recurring = Schedule(
    scheduleId: 'SCH-20260811-00042',
    groupId: 'GRP-01',
    groupName: 'Group A',
    teacherId: 'M-EDU-2026-000002',
    teacherName: 'Aziza Karimova',
    roomId: 'ROOM-1',
    roomName: 'Xona 1',
    dayOfWeek: DayOfWeek.monday,
    startTime: '09:00',
    endTime: '10:30',
    subject: 'Matematika',
    startDate: DateTime(2026, 8, 1),
    endDate: DateTime(2026, 8, 31),
  );

  group('lessonIdFor', () {
    test('deterministik format: LESSON-{scheduleId}-{yyyyMMdd}', () {
      final id = LessonInstanceService.lessonIdFor(
        recurring,
        DateTime(2026, 8, 11),
      );
      expect(id, 'LESSON-SCH-20260811-00042-20260811');
    });

    test('bir xil (schedule, sana) → bir xil ID (idempotent)', () {
      final a = LessonInstanceService.lessonIdFor(
        recurring,
        DateTime(2026, 8, 11, 9, 30),
      );
      final b = LessonInstanceService.lessonIdFor(
        recurring,
        DateTime(2026, 8, 11, 20, 0),
      );
      expect(a, b);
    });

    test('turli sanalar → turli ID', () {
      final a = LessonInstanceService.lessonIdFor(
        recurring,
        DateTime(2026, 8, 11),
      );
      final b = LessonInstanceService.lessonIdFor(
        recurring,
        DateTime(2026, 8, 18),
      );
      expect(a, isNot(b));
    });
  });

  group('coversDate', () {
    test('recurring: hafta kuni mos + startDate..endDate oralig\'ida', () {
      expect(
        LessonInstanceService.coversDate(recurring, DateTime(2026, 8, 10)),
        isTrue,
        reason: '2026-08-10 — dushanba, davr ichida',
      );
      expect(
        LessonInstanceService.coversDate(recurring, DateTime(2026, 8, 11)),
        isFalse,
        reason: '2026-08-11 — seshanba, hafta kuni mos emas',
      );
      expect(
        LessonInstanceService.coversDate(recurring, DateTime(2026, 9, 7)),
        isFalse,
        reason: '2026-09-07 — endDate (31-avgust) dan keyin',
      );
      expect(
        LessonInstanceService.coversDate(recurring, DateTime(2026, 7, 6)),
        isFalse,
        reason: '2026-07-06 — startDate (1-avgust) dan oldin',
      );
    });

    test('specificDate — faqat aniq sana', () {
      final oneOff = Schedule(
        scheduleId: 'SCH-ONE',
        groupId: 'GRP-01',
        teacherId: 'M-EDU-2026-000002',
        roomId: 'ROOM-1',
        dayOfWeek: DayOfWeek.monday,
        startTime: '09:00',
        endTime: '10:30',
        subject: 'Maxsus dars',
        specificDate: DateTime(2026, 8, 11),
      );

      expect(
        LessonInstanceService.coversDate(oneOff, DateTime(2026, 8, 11)),
        isTrue,
      );
      expect(
        LessonInstanceService.coversDate(oneOff, DateTime(2026, 8, 18)),
        isFalse,
        reason: 'boshqa sana — instance yo\'q',
      );
    });

    test('cancelled dars — hech qachon instance bermaydi', () {
      final cancelled = Schedule(
        scheduleId: 'SCH-CXL',
        groupId: 'GRP-01',
        teacherId: 'M-EDU-2026-000002',
        roomId: 'ROOM-1',
        dayOfWeek: DayOfWeek.monday,
        startTime: '09:00',
        endTime: '10:30',
        status: ScheduleStatus.cancelled,
        startDate: DateTime(2026, 8, 1),
      );

      expect(
        LessonInstanceService.coversDate(cancelled, DateTime(2026, 8, 10)),
        isFalse,
      );
      expect(
        LessonInstanceService.instanceFor(cancelled, DateTime(2026, 8, 10)),
        isNull,
      );
    });
  });

  group('instanceFor / instancesForDate', () {
    test('instance barcha muhim maydonlarni olib o\'tadi', () {
      final instance = LessonInstanceService.instanceFor(
        recurring,
        DateTime(2026, 8, 10),
      );
      expect(instance, isNotNull);
      expect(instance!.lessonId, 'LESSON-SCH-20260811-00042-20260810');
      expect(instance.scheduleId, 'SCH-20260811-00042');
      expect(instance.subject, 'Matematika');
      expect(instance.groupName, 'Group A');
      expect(instance.teacherName, 'Aziza Karimova');
      expect(instance.roomName, 'Xona 1');
      expect(instance.label, 'Matematika • 09:00 - 10:30');
    });

    test('instancesForDate: bir kunda ikkita dars — ikkalasi, vaqt bo\'yicha', () {
      final morning = recurring;
      final afternoon = Schedule(
        scheduleId: 'SCH-20260811-00043',
        groupId: 'GRP-01',
        teacherId: 'M-EDU-2026-000003',
        roomId: 'ROOM-2',
        dayOfWeek: DayOfWeek.monday,
        startTime: '14:00',
        endTime: '15:30',
        subject: 'Ingliz tili',
        startDate: DateTime(2026, 8, 1),
        endDate: DateTime(2026, 8, 31),
      );

      final instances = LessonInstanceService.instancesForDate(
        [afternoon, morning],
        DateTime(2026, 8, 10),
      );

      expect(instances, hasLength(2));
      expect(instances.first.startTime, '09:00', reason: 'tartiblangan');
      expect(instances.last.subject, 'Ingliz tili');
    });
  });

  group('activeLesson', () {
    final schedules = [recurring]; // Dushanba 09:00-10:30

    test('dars vaqti oralig\'ida — faol dars qaytadi', () {
      final active = LessonInstanceService.activeLesson(
        schedules,
        DateTime(2026, 8, 10, 9, 30), // dushanba, 09:30
      );
      expect(active, isNotNull);
      expect(active!.lessonId, 'LESSON-SCH-20260811-00042-20260810');
    });

    test('dars boshlanishidan oldin — faol dars yo\'q', () {
      final active = LessonInstanceService.activeLesson(
        schedules,
        DateTime(2026, 8, 10, 8, 59),
      );
      expect(active, isNull);
    });

    test('dars tugagandan keyin — faol dars yo\'q', () {
      final active = LessonInstanceService.activeLesson(
        schedules,
        DateTime(2026, 8, 10, 10, 30),
      );
      expect(active, isNull, reason: 'tugash vaqti ochiq interval');
    });

    test('dars kuni emas — faol dars yo\'q', () {
      final active = LessonInstanceService.activeLesson(
        schedules,
        DateTime(2026, 8, 11, 9, 30), // seshanba
      );
      expect(active, isNull);
    });

    Schedule overlap(String id, String start, String end) => Schedule(
          scheduleId: id,
          groupId: 'GRP-0X',
          teacherId: 'M-EDU-2026-00000X',
          roomId: 'ROOM-X',
          dayOfWeek: DayOfWeek.monday,
          startTime: start,
          endTime: end,
          subject: id,
          startDate: DateTime(2026, 8, 1),
          endDate: DateTime(2026, 8, 31),
        );

    test('OVERLAP: 09:00-10:00 va 09:30-10:30 — eng kech boshlangani g\'olib',
        () {
      // Ikkala dars ham 09:45 da faol. Birinchisiga ko'r-ko'rona qaytish
      // YO'Q — 09:30 boshlangani (hozirgi vaqtga eng yaqin) g'olib.
      final active = LessonInstanceService.activeLesson(
        [
          overlap('SCH-A', '09:00', '10:00'),
          overlap('SCH-B', '09:30', '10:30'),
        ],
        DateTime(2026, 8, 10, 9, 45),
      );
      expect(active, isNotNull);
      expect(active!.scheduleId, 'SCH-B');
      expect(active.startTime, '09:30');
    });

    test('OVERLAP: jadval tartibi o\'zgarsa ham natija bir xil (deterministik)',
        () {
      final now = DateTime(2026, 8, 10, 9, 45);
      final a = overlap('SCH-A', '09:00', '10:00');
      final b = overlap('SCH-B', '09:30', '10:30');

      final forward = LessonInstanceService.activeLesson([a, b], now);
      final reversed = LessonInstanceService.activeLesson([b, a], now);
      expect(forward!.scheduleId, reversed!.scheduleId);
      expect(forward.scheduleId, 'SCH-B');
    });

    test('OVERLAP: teng boshlanishda kichikroq scheduleId g\'olib (barqaror)',
        () {
      final now = DateTime(2026, 8, 10, 9, 15);
      final a = overlap('SCH-A', '09:00', '10:00');
      final b = overlap('SCH-B', '09:00', '10:30');

      final active = LessonInstanceService.activeLesson([b, a], now);
      expect(active, isNotNull);
      expect(active!.scheduleId, 'SCH-A',
          reason: 'teng startda lexicographic tie-break — jadval tartibi emas');
    });

    test('OVERLAP: biri tugagan (10:00) — faqat davom etayotgani faol', () {
      final active = LessonInstanceService.activeLesson(
        [
          overlap('SCH-A', '09:00', '10:00'),
          overlap('SCH-B', '09:30', '10:30'),
        ],
        DateTime(2026, 8, 10, 10, 15),
      );
      expect(active, isNotNull);
      expect(active!.scheduleId, 'SCH-B');
    });
  });

  group('instancesInPeriod', () {
    test('recurring dars — davrdagi har bir mos sana uchun instance', () {
      final instances = LessonInstanceService.instancesInPeriod(
        [recurring],
        DateTime(2026, 8, 1),
        DateTime(2026, 8, 31),
      );
      // 2026-avgust dushanbalari: 3, 10, 17, 24, 31 → 5 ta.
      expect(instances, hasLength(5));
      expect(instances.map((i) => i.date.day).toList(), [3, 10, 17, 24, 31]);
    });

    test('bir kunda ikkita dars — ikkala instance hisoblanadi', () {
      final afternoon = Schedule(
        scheduleId: 'SCH-AFTERNOON',
        groupId: 'GRP-01',
        teacherId: 'M-EDU-2026-000003',
        roomId: 'ROOM-2',
        dayOfWeek: DayOfWeek.monday,
        startTime: '14:00',
        endTime: '15:30',
        subject: 'Ingliz tili',
        startDate: DateTime(2026, 8, 1),
        endDate: DateTime(2026, 8, 31),
      );

      final instances = LessonInstanceService.instancesInPeriod(
        [recurring, afternoon],
        DateTime(2026, 8, 1),
        DateTime(2026, 8, 31),
      );

      // Har dushanba 2 tadan → 5 × 2 = 10.
      expect(instances, hasLength(10));
    });
  });
}
