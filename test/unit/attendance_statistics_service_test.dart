import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/application/services/attendance_statistics_service.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/scheduling/application/services/lesson_instance_service.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

/// Phase 5 formulasi (user qarori):
/// scheduledLessons = guruh jadvalidagi REAL darslar (assignedAt..bugun)
/// presentLessons   = present + late
/// excusedLessons   = denominatorga kirmaydi
/// percentage       = (present + late) / (scheduled − excused) * 100
void main() {
  final student = _student(
    groupId: 'GRP-1',
    assignedAt: DateTime(2026, 7, 1), // 1-iyul — chorshanba
  );

  // Deterministik hisoblash: "bugun" = 2026-iyul oyi oxiri.
  // Iyul 2026 dushanbalari: 6, 13, 20, 27 → 4 ta.
  final now = DateTime(2026, 7, 31);

  group('AttendanceStatisticsService.compute', () {
    test('recurring darslar: dushanba darsi — to\'g\'ri scheduledLessons', () {
      // Iyul 2026: dushanba kunlari 6, 13, 20, 27 (4 ta).
      // Student 1-iyuldan qo'shilgan → hammasi period ichida.
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: const [],
        now: now,
      );

      expect(stats.scheduledLessons, 4);
      expect(stats.presentLessons, 0);
      expect(stats.lateLessons, 0);
      expect(stats.excusedLessons, 0);
      expect(stats.absentLessons, 4);
      expect(stats.percentage, 0);
    });

    test('present va late — percentage to\'g\'ri hisoblanadi', () {
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];
      // 2 ta darsga keldi (1 present + 1 late), 2 ta absent.
      final entries = [
        _entry(DateTime(2026, 7, 6), status: 'present'),
        _entry(DateTime(2026, 7, 13), status: 'late'),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      expect(stats.scheduledLessons, 4);
      expect(stats.presentLessons, 1);
      expect(stats.lateLessons, 1);
      expect(stats.presentCount, 2);
      expect(stats.absentLessons, 2);
      expect(stats.percentage, closeTo(50, 1e-9));
    });

    test('excused denominatorga kirmaydi — foizni tushirmaydi', () {
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];
      final entries = [
        _entry(DateTime(2026, 7, 6), status: 'present'),
        _entry(DateTime(2026, 7, 13), status: 'excused'),
        // 20, 27-iyul — kelmagan (absent).
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      // Excused denominator'dan chiqariladi: 4 - 1 = 3.
      expect(stats.denominator, 3);
      expect(stats.excusedLessons, 1);
      expect(stats.absentLessons, 2);
      expect(stats.percentage, closeTo(1 / 3 * 100, 1e-9));
    });

    test('specificDate dars — aniq sana hisobga olinadi', () {
      final schedules = [
        _schedule(
          day: DayOfWeek.monday,
          specificDate: DateTime(2026, 7, 8), // chorshanba — maxsus dars
        ),
      ];
      final entries = [
        _entry(DateTime(2026, 7, 8), status: 'present'),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      expect(stats.scheduledLessons, 1);
      expect(stats.presentLessons, 1);
      expect(stats.percentage, 100);
    });

    test('guruhga qo\'shilishdan oldingi darslar hisoblanmaydi', () {
      // Dushanba 22, 29-iyun — student 1-iyulda qo'shilgan.
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 6, 1)),
      ];
      // 6-iyulda keldi (birinchi darsdan keyin).
      final entries = [
        _entry(DateTime(2026, 6, 29), status: 'present'), // perioddan oldin!
        _entry(DateTime(2026, 7, 6), status: 'present'),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      // Period ichidagi dushanbalar: 6, 13, 20, 27 → 4 ta.
      expect(stats.scheduledLessons, 4);
      // 29-iyun yozuvi perioddan tashqari — hisobga olinmaydi.
      expect(stats.presentLessons, 1);
    });

    test('kelajakdagi darslar denominatorga kirmaydi', () {
      final futureDate = DateTime.now().add(const Duration(days: 60));
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];
      final futureEntry = _entry(futureDate, status: 'present');

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: [futureEntry],
        now: now,
      );

      // Kelajakdagi entry — scheduled darslar ichida yo'q → present emas.
      expect(stats.presentLessons, 0);
      // scheduledLessons faqat o'tgan/hozirgi darslar (periodEnd = bugun).
      expect(stats.scheduledLessons, greaterThanOrEqualTo(1));
    });

    test('scheduled lesson bo\'lmagan kun denominatorga kirmaydi', () {
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];
      // Seshanba kuni kelgan — jadvalda dars yo'q → hisobga olinmaydi.
      final entries = [
        _entry(DateTime(2026, 7, 7), status: 'present'),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      expect(stats.presentLessons, 0);
      expect(stats.scheduledLessons, 4);
    });

    test('guruhsiz student — scheduledLessons 0, percentage 0', () {
      final noGroupStudent = _student(
        groupId: null,
        assignedAt: DateTime(2026, 7, 1),
      );

      final stats = AttendanceStatisticsService.compute(
        student: noGroupStudent,
        // Guruhsiz student uchun hech qanday schedule o'tmaydi
        // (fetchForStudent da groupId == null → bo'sh ro'yxat).
        schedules: const [],
        entries: const [],
        now: now,
      );

      expect(stats.scheduledLessons, 0);
      expect(stats.percentage, 0);
    });

    test('arxivlangan student — completedAt dan keyingi darslar hisoblanmaydi', () {
      final archivedStudent = _student(
        groupId: 'GRP-1',
        assignedAt: DateTime(2026, 7, 1),
        completedAt: DateTime(2026, 7, 15), // 15-iyulda arxivlangan
      );
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
      ];
      final entries = [
        _entry(DateTime(2026, 7, 6), status: 'present'),
        _entry(DateTime(2026, 7, 20), status: 'present'), // arxivdan keyin!
      ];

      final stats = AttendanceStatisticsService.compute(
        student: archivedStudent,
        schedules: schedules,
        entries: entries,
        now: now,
      );

      // 1-15 iyul oralig'idagi dushanbalar: 6, 13 → 2 ta.
      expect(stats.scheduledLessons, 2);
      expect(stats.presentLessons, 1); // 20-iyul hisobga olinmaydi
      expect(stats.absentLessons, 1); // 13-iyulga kelmagan
    });

    test('cancelled dars scheduledLessons hisoblanmaydi', () {
      final schedules = [
        _schedule(day: DayOfWeek.monday, startDate: DateTime(2026, 7, 1)),
        _schedule(
          day: DayOfWeek.wednesday,
          startDate: DateTime(2026, 7, 1),
          status: ScheduleStatus.cancelled,
        ),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: schedules,
        entries: const [],
        now: now,
      );

      // Faqat dushanba darslari (4 ta) — chorshanba bekor qilingan.
      expect(stats.scheduledLessons, 4);
    });

    test('P0-02: bir kunda ikkita dars — har biri alohida scheduled lesson',
        () {
      // Dushanba kuni ikkita dars: 09:00 Matematika + 14:00 Ingliz tili.
      final morning = Schedule(
        scheduleId: 'SCH-MORNING',
        groupId: 'GRP-1',
        teacherId: 'M-EDU-2026-000002',
        roomId: 'ROOM-1',
        dayOfWeek: DayOfWeek.monday,
        startTime: '09:00',
        endTime: '10:30',
        subject: 'Matematika',
        startDate: DateTime(2026, 7, 1),
      );
      final afternoon = Schedule(
        scheduleId: 'SCH-AFTERNOON',
        groupId: 'GRP-1',
        teacherId: 'M-EDU-2026-000002',
        roomId: 'ROOM-1',
        dayOfWeek: DayOfWeek.monday,
        startTime: '14:00',
        endTime: '15:30',
        subject: 'Ingliz tili',
        startDate: DateTime(2026, 7, 1),
      );

      // Faqat 6-iyul ertalabki darsga keldi (lessonId bilan belgilangan).
      final morningLessonId = LessonInstanceService.lessonIdFor(
        morning,
        DateTime(2026, 7, 6),
      );
      final entries = [
        AttendanceEntry(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          attendanceDate: DateTime(2026, 7, 6),
          lessonId: morningLessonId,
          checkInAt: DateTime(2026, 7, 6, 9, 5),
          status: 'present',
          method: 'face',
        ),
      ];

      final stats = AttendanceStatisticsService.compute(
        student: student,
        schedules: [morning, afternoon],
        entries: entries,
        now: now,
      );

      // 4 dushanba × 2 dars = 8 scheduled lesson (eski Set bilan 4 bo'lardi).
      expect(stats.scheduledLessons, 8);
      expect(stats.presentLessons, 1);
      expect(stats.absentLessons, 7);
      expect(stats.percentage, closeTo(1 / 8 * 100, 1e-9));
    });
  });
}

Student _student({
  String? groupId,
  DateTime? assignedAt,
  DateTime? completedAt,
}) {
  return Student(
    identityId: 'M-EDU-2026-000001',
    studentNumber: 1,
    groupId: groupId,
    groupName: 'Guruh A',
    studentStatus: StudentStatus.active,
    enrolledAt: DateTime(2026, 6, 1),
    assignedAt: assignedAt,
    completedAt: completedAt,
  );
}

Schedule _schedule({
  required DayOfWeek day,
  DateTime? startDate,
  DateTime? endDate,
  DateTime? specificDate,
  ScheduleStatus status = ScheduleStatus.scheduled,
}) {
  return Schedule(
    scheduleId: 'SCH-${day.name}-${specificDate ?? startDate ?? 'recurring'}',
    groupId: 'GRP-1',
    teacherId: 'M-EDU-2026-000002',
    roomId: 'ROOM-1',
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '10:30',
    specificDate: specificDate,
    startDate: startDate,
    endDate: endDate,
    status: status,
  );
}

AttendanceEntry _entry(DateTime date, {String status = 'present'}) {
  return AttendanceEntry(
    identityId: 'M-EDU-2026-000001',
    fullName: 'Ali Valiyev',
    role: 'student',
    attendanceDate: date,
    checkInAt: date,
    status: status,
    method: 'face',
  );
}
