import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/application/services/attendance_session_service.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_session.dart';
import 'package:m_edu/features/attendance/domain/events/attendance_events.dart';
import 'package:m_edu/features/attendance/infrastructure/datasources/isar_attendance_session_datasource.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_session_record.dart';
import 'package:m_edu/features/attendance/infrastructure/repositories_impl/attendance_session_repository_impl.dart';
import 'package:m_edu/features/scheduling/domain/entities/lesson_instance.dart';

/// P1.5: ATTENDANCE SESSION — ochish, duplicate himoya, holat, yopish,
/// restartdan tiklanish (real Isar bilan).
void main() {
  late Directory tempDir;
  late Isar isar;
  late EventBus eventBus;
  late List<AttendanceSessionOpenedEvent> openedEvents;
  late AttendanceSessionService service;

  // Dushanba 09:00–10:30 dars.
  final lesson = LessonInstance(
    lessonId: 'LESSON-SCH-1-20260810',
    scheduleId: 'SCH-1',
    date: DateTime(2026, 8, 10),
    startTime: '09:00',
    endTime: '10:30',
    subject: 'Matematika',
    groupId: 'GRP-A',
    groupName: 'Group A',
    teacherName: 'Aziza Karimova',
  );

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_session');
    isar = await Isar.open(
      [AttendanceSessionRecordSchema],
      directory: tempDir.path,
    );
    eventBus = EventBus();
    openedEvents = [];
    eventBus.on<AttendanceSessionOpenedEvent>().listen(openedEvents.add);
    service = AttendanceSessionService(
      repository: AttendanceSessionRepositoryImpl(
        IsarAttendanceSessionDataSource(isar),
      ),
      eventBus: eventBus,
    );
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('dars vaqtida ochiladi — active + event chiqadi', () async {
    final session =
        await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30));

    expect(session.lessonId, lesson.lessonId);
    expect(session.sessionId, 'SESSION-${lesson.lessonId}');
    expect(session.groupId, 'GRP-A');
    expect(session.status, AttendanceSessionStatus.active);
    expect(session.closedAt, isNull);

    // Event tarqaldi (broadcast stream — async yetkaziladi).
    await Future<void>.delayed(Duration.zero);
    expect(openedEvents, hasLength(1));
    expect(openedEvents.single.session.lessonId, lesson.lessonId);

    // Isar'da saqlangan.
    final records = await isar.attendanceSessionRecords.where().findAll();
    expect(records, hasLength(1));
    expect(records.single.status, 'active');
  });

  test('duplicate ochish — yangi session YARATILMAYDI (idempotent)',
      () async {
    await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30));
    final second =
        await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 45));

    expect(second.sessionId, 'SESSION-${lesson.lessonId}');
    expect(
      await isar.attendanceSessionRecords.where().count(),
      1,
      reason: "Bitta dars uchun bitta session — duplicate bo'lmaydi",
    );
    // Faqat birinchi ochilish event chiqaradi.
    await Future<void>.delayed(Duration.zero);
    expect(openedEvents, hasLength(1));
  });

  test('dars boshlanishidan oldin — notStarted', () async {
    final session =
        await service.openForLesson(lesson, DateTime(2026, 8, 10, 8, 0));
    expect(session.status, AttendanceSessionStatus.notStarted);
  });

  test('dars tugagach — completed (ochilganda)', () async {
    final session =
        await service.openForLesson(lesson, DateTime(2026, 8, 10, 11, 0));
    expect(session.status, AttendanceSessionStatus.completed);
    expect(session.closedAt, DateTime(2026, 8, 10, 11, 0));
  });

  test('closeByLesson — completed + closedAt yoziladi', () async {
    await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30));
    final closed =
        await service.closeByLesson(lesson.lessonId, DateTime(2026, 8, 10, 10, 30));

    expect(closed, isNotNull);
    expect(closed!.status, AttendanceSessionStatus.completed);
    expect(closed.closedAt, DateTime(2026, 8, 10, 10, 30));
  });

  test("restart — sessiya Isar'dan tiklanishi (lessonId bo'yicha)", () async {
    await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30));

    // App qayta ishga tushdi — DB qayta ochiladi.
    await isar.close();
    isar = await Isar.open(
      [AttendanceSessionRecordSchema],
      directory: tempDir.path,
    );
    final restarted = AttendanceSessionService(
      repository: AttendanceSessionRepositoryImpl(
        IsarAttendanceSessionDataSource(isar),
      ),
      eventBus: EventBus(),
    );

    final found = await restarted.openForLesson(
      lesson,
      DateTime(2026, 8, 10, 9, 50),
    );
    expect(found.sessionId, 'SESSION-${lesson.lessonId}');
    expect(found.status, AttendanceSessionStatus.active);
    expect(
      await isar.attendanceSessionRecords.where().count(),
      1,
      reason: "Restartdan keyin ham bitta session — dublikat yo'q",
    );
  });

  test('boshqa dars — alohida session', () async {
    await service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30));

    final other = LessonInstance(
      lessonId: 'LESSON-SCH-2-20260810',
      scheduleId: 'SCH-2',
      date: DateTime(2026, 8, 10),
      startTime: '14:00',
      endTime: '15:30',
      subject: 'Ingliz tili',
      groupId: 'GRP-B',
    );
    await service.openForLesson(other, DateTime(2026, 8, 10, 14, 15));

    expect(await isar.attendanceSessionRecords.where().count(), 2);
    await Future<void>.delayed(Duration.zero);
    expect(openedEvents, hasLength(2));
  });

  test('parallel ochilish — bitta session, BIRTA event (race-xavfsiz)',
      () async {
    // Ikkala chaqiruv bir vaqtda boshlanadi — `createIfAbsent` atomic,
    // faqat bittasi yaratadi, event bir marta chiqadi (review P1.5 #2).
    final results = await Future.wait([
      service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 30)),
      service.openForLesson(lesson, DateTime(2026, 8, 10, 9, 31)),
    ]);

    expect(results.map((s) => s.sessionId).toSet(), hasLength(1));
    expect(await isar.attendanceSessionRecords.where().count(), 1,
        reason: "Bitta dars uchun bitta session — duplicate bo'lmaydi");
    await Future<void>.delayed(Duration.zero);
    expect(openedEvents, hasLength(1),
        reason: "Parallel ochilishda ham event faqat bir marta chiqadi");
  });

  test("boshqa kundagi dars — vaqt oralig'i emas, SANA hal qiladi", () async {
    // Bugungi vaqt oralig'iga mos, lekin KELAJAKDAGI sana: notStarted.
    final futureLesson = LessonInstance(
      lessonId: 'LESSON-SCH-9-20261231',
      scheduleId: 'SCH-9',
      date: DateTime(2026, 12, 31),
      startTime: '09:00',
      endTime: '10:30',
      subject: 'Matematika',
      groupId: 'GRP-A',
    );
    final futureSession = await service.openForLesson(
      futureLesson,
      DateTime(2026, 8, 10, 9, 30),
    );
    expect(futureSession.status, AttendanceSessionStatus.notStarted);

    // O'tgan kundagi dars: completed (vaqt oralig'iga qaramasdan).
    final pastLesson = LessonInstance(
      lessonId: 'LESSON-SCH-10-20260701',
      scheduleId: 'SCH-10',
      date: DateTime(2026, 7, 1),
      startTime: '09:00',
      endTime: '10:30',
      subject: 'Matematika',
      groupId: 'GRP-A',
    );
    final pastSession = await service.openForLesson(
      pastLesson,
      DateTime(2026, 8, 10, 9, 30),
    );
    expect(pastSession.status, AttendanceSessionStatus.completed);
    expect(pastSession.closedAt, DateTime(2026, 8, 10, 9, 30));
  });
}
