import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/app/event_sync.dart';
import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/di/core_providers.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_session_record.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/face_record.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/application/commands/register_identity_command.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_activity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/signed_qr_nonce_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/sequence_counter.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/notifications/infrastructure/models/notification_record.dart';
import 'package:m_edu/features/organization/infrastructure/models/organization_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/scheduling/application/commands/create_schedule_command.dart';
import 'package:m_edu/features/scheduling/application/services/lesson_instance_service.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

// ────────────────────────────────────────────────────────────────────────────
// P1: ATTENDANCE UI → LESSON INSTANCE FULL INTEGRATION — REAL STACK
//
// REAL production stack (hech qanday mock/fake emas):
//   REAL AppDatabase (Isar, diskda) → REAL datasource → REAL repository →
//   REAL commands → REAL LessonInstanceService.
//
// Tekshirilayotgan P1 qoidalari:
//   #1  Attendance screen faol darsni REAL jadvaldan aniqlaydi (activeLesson).
//   #2  Faol dars bo'lmasa — empty state ("Hozir faol dars yo'q").
//   #3  lessonId UI'dan commandgacha majburiy o'tadi (real DB'da saqlanadi).
//   #7  Bir xil student + bir xil lesson → duplicate yozuv YO'Q (1 yozuv).
//   #8  Bir student boshqa darsda → alohida attendance yozuvi.
//   #12 Restartdan keyin lesson/attendance holati tiklansa.
//   #14 Loading/Empty/Error/Success — real repository state'idan.
// ────────────────────────────────────────────────────────────────────────────

List<CollectionSchema<dynamic>> _allSchemas() => [
      IdentityRecordSchema,
      IdentityActivityRecordSchema,
      SequenceCounterSchema,
      OrganizationRecordSchema,
      StudentRecordSchema,
      TeacherRecordSchema,
      GroupRecordSchema,
      PaymentRecordSchema,
      DebtRecordSchema,
      ExpenseRecordSchema,
      ScheduleRecordSchema,
      RoomRecordSchema,
      NotificationRecordSchema,
      FaceRecordSchema,
      AttendanceRecordSchema,
      AttendanceSessionRecordSchema,
      SignedQrNonceRecordSchema,
      SettingsRecordSchema,
      UserRecordSchema,
      SubjectRecordSchema,
      AuditLogRecordSchema,
      ReportRecordSchema,
    ];

class TestApp {
  final AppDatabase db;
  final ProviderContainer container;
  bool _disposed = false;

  TestApp({required this.db, required this.container});

  static Future<TestApp> start({
    required String dbName,
    required String dbPath,
  }) async {
    final db = await AppDatabase.open(
      schemas: _allSchemas(),
      name: dbName,
      directory: dbPath,
    );
    final container = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        actorRoleProvider.overrideWithValue(UserRole.superAdmin),
      ],
    );
    container.read(eventSyncProvider);
    return TestApp(db: db, container: container);
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    container.dispose();
    await db.close();
  }
}

Future<T> readAsync<T>(
  ProviderContainer container,
  FutureProvider<T> provider, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  container.invalidate(provider);
  final completer = Completer<T>();
  late final ProviderSubscription<AsyncValue<T>> sub;
  sub = container.listen<AsyncValue<T>>(
    provider,
    (previous, next) {
      if (next.hasValue && !completer.isCompleted) {
        completer.complete(next.requireValue);
      } else if (next.hasError && !completer.isCompleted) {
        completer.completeError(next.error!, next.stackTrace);
      }
    },
  );
  final timer = Timer(timeout, () {
    if (!completer.isCompleted) {
      completer.completeError(
        TimeoutException('Provider qiymati $timeout ichida kelmadi'),
      );
    }
  });
  try {
    return await completer.future;
  } finally {
    timer.cancel();
    sub.close();
  }
}

Future<void> waitUntil(
  Future<bool> Function() condition, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  final stopwatch = Stopwatch()..start();
  while (!await condition()) {
    if (stopwatch.elapsed > timeout) {
      fail('Shart ${timeout.inSeconds}s ichida bajarilmadi');
    }
    await Future<void>.delayed(const Duration(milliseconds: 30));
  }
}

String _two(int v) => v.toString().padLeft(2, '0');

/// Hozirgi vaqtni qamrab olgan jadval so'rovini quradi (real yozuv uchun).
///
/// Yarim tungi chekka holatda (masalan 23:45) vaqt oynasi kunga oshib
/// ketmasligi uchun kun chegarasiga qisqartiriladi — test ishonchli.
CreateScheduleRequest _activeScheduleRequest({
  required String schedulePrefix,
  required String groupId,
  required String roomId,
  required String teacherId,
  required String subject,
  required DateTime now,
  DateTime? specificDate,
}) {
  final day = DateTime(now.year, now.month, now.day);
  final dayEnd = DateTime(now.year, now.month, now.day, 23, 59);
  final start = now.subtract(const Duration(minutes: 30));
  final end = now.add(const Duration(minutes: 30));
  final startClamped = start.isBefore(day) ? day : start;
  final endClamped = end.isAfter(dayEnd) ? dayEnd : end;
  return CreateScheduleRequest(
    groupId: groupId,
    groupName: 'Group $schedulePrefix',
    teacherId: teacherId,
    teacherName: 'Teacher $schedulePrefix',
    roomId: roomId,
    roomName: 'Room $schedulePrefix',
    dayOfWeek: DayOfWeek.values[now.weekday - 1],
    startTime: '${_two(startClamped.hour)}:${_two(startClamped.minute)}',
    endTime: '${_two(endClamped.hour)}:${_two(endClamped.minute)}',
    subject: subject,
    specificDate: specificDate,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late String dbPath;
  var dbCounter = 0;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_p1_lesson');
    dbPath = tempDir.path;
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'P1: activeLesson → attendance(lessonId) → duplicate yo\'q → boshqa dars → RESTART',
    () async {
      final now = DateTime.now();
      final dbName = 'm_edu_p1_${dbCounter++}';
      final app = await TestApp.start(dbName: dbName, dbPath: dbPath);
      final ref = app.container;

      try {
        // ── 1. REAL jadval (bugungi, hozirgi vaqtni qamrab oladi) ───────
        final schedule1 = await ref
            .read(createScheduleCommandProvider)
            .execute(
              _activeScheduleRequest(
                schedulePrefix: 'A',
                groupId: 'GRP-A',
                roomId: 'ROOM-A',
                teacherId: 'M-EDU-2026-000002',
                subject: 'Ingliz tili',
                now: now,
              ),
            );
        await waitUntil(
          () async =>
              (await readAsync(ref, scheduleListProvider)).isNotEmpty,
        );

        // ── 2. Faol dars REAL jadvaldan aniqlanadi (P1 #1, #14) ─────────
        final active = await readAsync(ref, activeLessonProvider);
        expect(active, isNotNull,
            reason: "Hozir faol dars bo'lishi kerak (jadval vaqt oralig'ida)");
        // lessonId provider hisoblagan sanaga nisbatan tekshiriladi —
        // yarim tungi chekka holatda ham ishonchli.
        expect(active!.scheduleId, schedule1.scheduleId);
        expect(
          active.lessonId,
          LessonInstanceService.lessonIdFor(schedule1, active.date),
        );

        // ── 3. Talaba ro'yxatga olinadi (real Identity → Student) ───────
        final identity = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Jasur',
                lastName: 'Rahimov',
                role: IdentityRole.student,
              ),
            );
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 1,
        );

        // ── 4. Face usulida davomat — lessonId MAJBURIY o'tadi (P1 #3) ──
        final result = await ref
            .read(recordAttendanceCommandProvider)
            .execute(
              RecordAttendanceRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                method: 'face',
                lessonId: active.lessonId,
                confidence: 0.94,
                source: 'hikvision',
              ),
            );
        expect(result.recorded, isTrue);
        expect(result.action, AttendanceAction.checkIn);
        expect(result.entry!.lessonId, active.lessonId);

        // REAL DB'da lessonId bilan saqlangan.
        final records =
            await app.db.instance.attendanceRecords.where().findAll();
        expect(records, hasLength(1));
        expect(records.single.lessonId, active.lessonId);

        // ── 5. BIR XIL student + BIR XIL lesson → dublikat YO'Q (P1 #7) ─
        // Ikkinchi belgilash check-out bo'ladi — yozuv hali ham bitta.
        final second = await ref
            .read(recordAttendanceCommandProvider)
            .execute(
              RecordAttendanceRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                method: 'qr',
                lessonId: active.lessonId,
                source: 'qr-scanner',
              ),
            );
        expect(second.action, AttendanceAction.checkOut);
        expect(
          await app.db.instance.attendanceRecords.where().count(),
          1,
          reason: "1 talaba + 1 dars = 1 primary yozuv — dublikat yo'q",
        );

        // ── 6. BOSHQA dars → alohida attendance yozuvi (P1 #8) ──────────
        // schedule2 BUGUN faol bo'lmasligi kerak: ikki dars bir vaqtda faol
        // bo'lsa LESSON-OVERLAP qoidasi kichikroq scheduleId'ni tanlaydi
        // (suffix random) — sessiya boshqa darsga o'tib test noturg'un
        // bo'lardi. specificDate=ertaga → bugun coversDate=false, faqat
        // schedule1 faol qoladi (deterministik). Yozuv lessonId orqali
        // to'g'ridan-to'g'ri yoziladi — dars faol bo'lishi shart emas.
        final schedule2 = await ref
            .read(createScheduleCommandProvider)
            .execute(
              _activeScheduleRequest(
                schedulePrefix: 'B',
                groupId: 'GRP-B',
                roomId: 'ROOM-B',
                teacherId: 'M-EDU-2026-000003',
                subject: 'Matematika',
                now: now,
                specificDate: now.add(const Duration(days: 1)),
              ),
            );
        final lesson2Id =
            LessonInstanceService.lessonIdFor(schedule2, active.date);
        final otherLesson = await ref
            .read(recordAttendanceCommandProvider)
            .execute(
              RecordAttendanceRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                method: 'manual',
                lessonId: lesson2Id,
                source: 'admin',
              ),
            );
        expect(otherLesson.recorded, isTrue);
        expect(otherLesson.entry!.lessonId, lesson2Id);

        final afterOther =
            await app.db.instance.attendanceRecords.where().findAll();
        expect(afterOther, hasLength(2),
            reason: "Boshqa dars — alohida yozuv (kundalik merge emas)");
        expect(
          afterOther.map((r) => r.lessonId).toSet(),
          {active.lessonId, lesson2Id},
        );

        // ── 7. Dars bo'yicha ro'yxat (P1: lessonAttendance) ─────────────
        final lessonList = await readAsync(
          ref,
          lessonAttendanceProvider(active.lessonId),
        );
        expect(lessonList, hasLength(1));
        expect(lessonList.single.lessonId, active.lessonId);

        // ── 7b. P1.5: ATTENDANCE SESSION — faol dars uchun ochiladi ────
        final session = await readAsync(ref, attendanceSessionProvider);
        expect(session, isNotNull,
            reason: "Faol dars uchun attendance session ochilishi kerak");
        expect(session!.lessonId, active.lessonId);
        expect(session.groupId, schedule1.groupId);
        // Hozir dars vaqtida bo'lgani uchun active (yoki tugagan bo'lsa
        // completed — ikkalasi ham haqiqiy holat).
        expect(
          [
            'active',
            'completed',
          ],
          contains(session.status.name),
        );

        // ── 8. RESTART → lesson/attendance holati tiklanadi (P1 #12) ────
        await app.dispose();
        final restarted = await TestApp.start(dbName: dbName, dbPath: dbPath);
        final ref2 = restarted.container;

        final persistedRecords =
            await restarted.db.instance.attendanceRecords.where().findAll();
        expect(persistedRecords, hasLength(2));
        expect(
          persistedRecords.map((r) => r.lessonId).toSet(),
          {active.lessonId, lesson2Id},
          reason: "lessonId restartdan keyin saqlanadi",
        );
        // P1.5: session ham restartdan keyin tiklanadi.
        final persistedSession =
            await restarted.container
                .read(attendanceSessionRepositoryProvider)
                .fetchByLesson(active.lessonId);
        expect(persistedSession, isNotNull,
            reason: "Attendance session restartdan keyin tiklanadi");
        expect(persistedSession!.lessonId, active.lessonId);
        final persistedList = await readAsync(
          ref2,
          lessonAttendanceProvider(active.lessonId),
        );
        expect(persistedList, hasLength(1));
        expect(persistedList.single.identityId, identity.identityId);

        await restarted.dispose();
      } finally {
        await app.dispose();
      }
    },
  );

  test('P1: faol dars yo\'q bo\'lsa activeLessonProvider null qaytaradi (#2)',
      () async {
    final app = await TestApp.start(
      dbName: 'm_edu_p1_empty_${dbCounter++}',
      dbPath: dbPath,
    );
    final ref = app.container;

    try {
      // Jadval bo'sh — real repo: activeLesson → null (empty state manbai).
      final active = await readAsync(ref, activeLessonProvider);
      expect(active, isNull,
          reason: "Jadval bo'sh bo'lsa 'Hozir faol dars yo'q' empty state");
    } finally {
      await app.dispose();
    }
  });
}
