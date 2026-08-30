import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/app/event_sync.dart';
import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/di/core_providers.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/face_record.dart';
import 'package:m_edu/features/groups/application/commands/create_group_command.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/groups/presentation/providers/group_providers.dart';
import 'package:m_edu/features/identity/application/commands/register_identity_command.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_activity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/sequence_counter.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/notifications/infrastructure/models/notification_record.dart';
import 'package:m_edu/features/organization/infrastructure/models/organization_record.dart';
import 'package:m_edu/features/payments/application/commands/receive_payment_command.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/payments/presentation/providers/payment_providers.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

// ────────────────────────────────────────────────────────────────────────────
// M-EDU REAL USER FLOW TEST (integration, real production stack)
//
// MUHIM: Bu test hech qanday mock/fake ishlatmaydi:
//   REAL AppDatabase (Isar, diskda) → REAL datasource → REAL repository →
//   REAL command → REAL EventBus + EventSyncCoordinator + REAL projectors.
//
// Oqim (user talab qilgan CRITICAL TEST):
//   LOGIN (rol: superAdmin) → HOME (bo'sh dashboard) → ADD STUDENT → SAVE →
//   STUDENT LIST → CREATE GROUP → OPEN GROUP → ADD EXISTING STUDENT →
//   VERIFY MEMBER → OPEN STUDENT → VERIFY GROUP → MARK ATTENDANCE →
//   VERIFY ATTENDANCE → ADD PAYMENT → VERIFY FINANCE →
//   RESTART APP → VERIFY EVERYTHING STILL EXISTS.
//
// Keyin secondary flow: guruhdan chiqarish → boshqa guruhga o'tkazish →
// arxivlash → qayta tiklash.
// ────────────────────────────────────────────────────────────────────────────

/// `main.dart` dagi barcha sxemalar — real baza shu sxemalar bilan ochiladi.
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
      SettingsRecordSchema,
      UserRecordSchema,
      SubjectRecordSchema,
      AuditLogRecordSchema,
      ReportRecordSchema,
    ];

/// Real ishga tushirilgan ilova: real Isar DB + real provider grafi +
/// real EventSyncCoordinator (projectors bilan).
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
        // LOGIN simulyatsiyasi: haqiqiy login (LocalAuthStore + sessiya)
        // `session_lifecycle_test`/`rbac_auth_flow_test`da isbotlangan; bu
        // yerda xuddi login'da o'rnatiladigan `actorRole` beriladi.
        actorRoleProvider.overrideWithValue(UserRole.superAdmin),
      ],
    );
    // C-03: Real EventSyncCoordinator'ni ishga tushiramiz — Identity →
    // Student proyeksiyasi va to'lov → Student proyeksiyasi shu orqali
    // ishlaydi (production bilan bir xil yo'l).
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

/// Provider holatini robust o'qish — real widget'lar (`ref.watch`) kabi
/// listen orqali. Riverpod 2.6.1'da invalidatsiya kaskadi paytida
/// `read(provider.future)` osib qolishi mumkin; listen esa bu xatoni
/// chetlab o'tadi va REAL STATE'ni beradi.
///
/// Version bump provider'ni invalidate qiladi, lekin eski qiymat cache'da
/// qoladi. Yangilangan qiymatni olish uchun avval `invalidate` qilamiz
/// (app'dagi `ref.watch` doim jonli — bu bir martalik o'qishga xos yondashuv).
Future<T> readAsync<T>(
  ProviderContainer container,
  FutureProvider<T> provider, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  // Eski (stale) cache qiymatini bekor qilib, yangi hisoblashga majbur
  // qilamiz. `fireImmediately` YO'Q — eski qiymat yetkazilmaydi, rebuild
  // natijasidagi yangi qiymat kutadi (app'dagi `ref.watch` jonliligi kabi).
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

/// Event bus (broadcast stream) + proyeksiyalar async — shart bajarilmaguncha
/// real ma'lumotni kutadi. Timeout bo'lsa test fail bo'ladi.
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

void main() {
  late Directory tempDir;
  late String dbPath;
  var dbCounter = 0;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_e2e_flow');
    dbPath = tempDir.path;
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'CRITICAL FLOW: o\'quvchi → guruh → davomat → to\'lov → RESTART → hammasi saqlanadi',
    () async {
      // RESTART APP testi: XUDDI SHU name bilan qayta ochiladi (Isar
      // instance nomi = baza fayli nomi — restart uchun bir xil bo'lishi
      // shart, isar_startup_test'dagi konvensiya).
      final dbName = 'm_edu_e2e_restart';
      final app = await TestApp.start(
        dbName: dbName,
        dbPath: dbPath,
      );
      final ref = app.container;

      try {
        // ── 1. LOGIN: actor rol superAdmin (fail-closed tekshiruv) ──────
        expect(ref.read(actorRoleProvider), UserRole.superAdmin);

        // ── 2. HOME: bo'sh baza — dashboard counterlar 0 ─────────────────
        expect(await readAsync(ref, studentCountProvider), 0);
        expect(await readAsync(ref, groupCountProvider), 0);

        // ── 3. ADD STUDENT (identity, rol=student) ───────────────────────
        final identity = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Ali',
                lastName: 'Valiyev',
                role: IdentityRole.student,
                phone: '+998901234567',
              ),
            );
        expect(identity.identityId, startsWith('M-EDU-'),
            reason: 'Real ID generator ishladi');

        // ── 4. SAVE → STUDENT LIST (real proyeksiya: Identity → Student) ─
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 1,
        );
        final students = await readAsync(ref, studentListProvider);
        expect(students.single.identityId, identity.identityId);
        expect(students.single.studentStatus, StudentStatus.active);
        expect(students.single.groupId, isNull,
            reason: "Yangi o'quvchi hali guruhga tayinlanmagan");
        // Dashboard counter yangilandi.
        expect(await readAsync(ref, studentCountProvider), 1);
        expect(await readAsync(ref, activeStudentCountProvider), 1);

        // ── 5. CREATE GROUP ─────────────────────────────────────────────
        final group = await ref.read(createGroupCommandProvider).execute(
              CreateGroupRequest(
                name: 'Matematika-101',
                capacity: 10,
                monthlyFee: 200000,
              ),
            );
        expect(group.groupId, startsWith('GRP-'));
        expect(group.currentSize, 0);

        // ── 6. OPEN GROUP ───────────────────────────────────────────────
        await waitUntil(
          () async =>
              (await readAsync(ref, groupDetailProvider(group.groupId)))
                      ?.groupId ==
                  group.groupId,
        );
        expect(
          (await readAsync(ref, groupDetailProvider(group.groupId)))!.name,
          'Matematika-101',
        );
        expect(await readAsync(ref, groupCountProvider), 1);

        // ── 7. ADD EXISTING STUDENT → guruhga qo'shish ──────────────────
        await ref.read(assignStudentToGroupCommandProvider).execute(
              groupId: group.groupId,
              studentIdentityId: identity.identityId,
            );

        // VERIFY MEMBER: guruh a'zolari ro'yxati yangilandi.
        await waitUntil(
          () async =>
              (await readAsync(ref, studentsByGroupProvider(group.groupId)))
                  .isNotEmpty,
        );
        final members = await readAsync(ref, studentsByGroupProvider(group.groupId));
        expect(members.single.identityId, identity.identityId);

        // VERIFY GROUP SIZE: currentSize 0 → 1.
        await waitUntil(
          () async =>
              (await readAsync(ref, groupDetailProvider(group.groupId)))!
                      .currentSize ==
                  1,
        );
        expect(
          (await readAsync(ref, groupDetailProvider(group.groupId)))!
              .currentSize,
          1,
        );

        // ── 8. OPEN STUDENT → VERIFY GROUP ──────────────────────────────
        await waitUntil(
          () async =>
              (await readAsync(ref, studentDetailProvider(identity.identityId)))
                      ?.groupId ==
                  group.groupId,
        );
        final inGroup =
            await readAsync(ref, studentDetailProvider(identity.identityId));
        expect(inGroup!.groupName, 'Matematika-101');
        expect(inGroup.assignedAt, isNotNull);

        // ── 9. MARK ATTENDANCE (xuddi QR/Face/manual oqimlari kabi) ─────
        final attResult =
            await ref.read(recordAttendanceCommandProvider).execute(
                  RecordAttendanceRequest(
                    identityId: identity.identityId,
                    fullName: identity.fullName,
                    role: identity.role.name,
                    method: 'manual',
                    source: 'admin',
                  ),
                );
        expect(attResult.recorded, isTrue);
        expect(attResult.action, AttendanceAction.checkIn);

        // VERIFY ATTENDANCE: bugungi davomatda talaba paydo bo'ldi.
        await waitUntil(
          () async => (await readAsync(ref, todayAttendanceProvider))
              .any((e) => e.identityId == identity.identityId),
        );
        final today = await readAsync(ref, todayAttendanceProvider);
        expect(today.single.identityId, identity.identityId);

        // ── 10. ADD PAYMENT ─────────────────────────────────────────────
        final payment = await ref.read(receivePaymentCommandProvider).execute(
              ReceivePaymentRequest(
                studentIdentityId: identity.identityId,
                studentName: identity.fullName,
                groupId: group.groupId,
                groupName: group.name,
                amount: 200000,
                paymentType: PaymentType.cash,
              ),
            );
        // A2/E2: kvitansiya global yagona ULID (qurilmaviy REC-000001 emas).
        expect(
          payment.receiptNumber,
          matches(RegExp(r'^REC-[0-9A-Z]{16}$')),
          reason: 'kvitansiya yagona ULID formatida',
        );

        // VERIFY FINANCE: to'lov ro'yxatda + jami summa.
        await waitUntil(
          () async => (await readAsync(ref, paymentListProvider)).isNotEmpty,
        );
        expect(
            (await readAsync(ref, paymentListProvider)).single.paymentId,
            payment.paymentId);
        expect(await readAsync(ref, totalCollectedProvider), 200000);

        // VERIFY STUDENT READ-MODEL (real StudentPaymentProjector):
        // paymentStatus=true, totalPaid=200000.
        await waitUntil(
          () async =>
              (await readAsync(ref, studentDetailProvider(identity.identityId)))
                      ?.hasPaid ==
                  true,
        );
        final paidStudent =
            await readAsync(ref, studentDetailProvider(identity.identityId));
        expect(paidStudent!.totalPaid, 200000);
        expect(paidStudent.lastPaymentDate, isNotNull);

        // ── 11. RESTART APP ─────────────────────────────────────────────
        // Xuddi shu bazani yopamiz (app yopildi) ...
        await app.dispose();

        // ... va XUDDI SHU name bilan qayta ochamiz (app qayta ishga
        // tushdi — restart: baza diskdan qayta yuklanadi).
        final restarted = await TestApp.start(
          dbName: dbName,
          dbPath: dbPath,
        );
        final ref2 = restarted.container;

        // VERIFY EVERYTHING STILL EXISTS:
        //  - Student (guruh bilan) saqlanib qoldi
        await waitUntil(
          () async => (await readAsync(ref2, studentListProvider)).length == 1,
        );
        final keptStudent = (await readAsync(ref2, studentListProvider)).single;
        expect(keptStudent.identityId, identity.identityId);
        expect(keptStudent.groupId, group.groupId,
            reason: "Restartdan keyin guruh bog'lanishi saqlanadi");

        //  - Guruh (currentSize=1) saqlanib qoldi
        final keptGroup = (await readAsync(ref2, groupListProvider)).single;
        expect(keptGroup.groupId, group.groupId);
        expect(keptGroup.currentSize, 1,
            reason: "Restartdan keyin guruh sig'imi saqlanadi");

        //  - Davomat yozuvi saqlanib qoldi
        await waitUntil(
          () async =>
              (await readAsync(ref2, todayAttendanceProvider)).isNotEmpty,
        );
        expect(
          (await readAsync(ref2, todayAttendanceProvider))
              .any((e) => e.identityId == identity.identityId),
          isTrue,
        );

        //  - To'lov va moliya saqlanib qoldi
        expect(
            (await readAsync(ref2, paymentListProvider)).single.paymentId,
            payment.paymentId);
        expect(await readAsync(ref2, totalCollectedProvider), 200000);

        //  - Student to'lov holati saqlanib qoldi
        final keptPaid =
            await readAsync(ref2, studentDetailProvider(identity.identityId));
        expect(keptPaid!.hasPaid, isTrue);
        expect(keptPaid.totalPaid, 200000);

        //  - Dashboard counterlar saqlanib qoldi
        expect(await readAsync(ref2, studentCountProvider), 1);
        expect(await readAsync(ref2, groupCountProvider), 1);

        await restarted.dispose();
      } finally {
        await app.dispose();
      }
    },
  );

  test(
    'SECONDARY FLOW: guruhdan chiqarish → boshqa guruhga o\'tkazish → arxivlash → qayta tiklash',
    () async {
      final app = await TestApp.start(
        dbName: 'm_edu_e2e_${dbCounter++}',
        dbPath: dbPath,
      );
      final ref = app.container;

      try {
        // O'quvchi ro'yxatga olinadi (real proyeksiya).
        final identity = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Dilnoza',
                lastName: 'Karimova',
                role: IdentityRole.student,
              ),
            );
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 1,
        );

        // Guruh A va B yaratiladi.
        final groupA = await ref.read(createGroupCommandProvider).execute(
              CreateGroupRequest(name: 'Ingliz tili-A', capacity: 10),
            );
        final groupB = await ref.read(createGroupCommandProvider).execute(
              CreateGroupRequest(name: 'Ingliz tili-B', capacity: 10),
            );

        // ── Guruh A ga qo'shish ─────────────────────────────────────────
        await ref.read(assignStudentToGroupCommandProvider).execute(
              groupId: groupA.groupId,
              studentIdentityId: identity.identityId,
            );
        await waitUntil(
          () async => (await readAsync(
                      ref, studentDetailProvider(identity.identityId)))!
                  .groupId ==
              groupA.groupId,
        );

        // ── Guruhdan CHIQARISH ──────────────────────────────────────────
        await ref.read(removeStudentFromGroupCommandProvider).execute(
              groupId: groupA.groupId,
              studentIdentityId: identity.identityId,
            );
        await waitUntil(
          () async => (await readAsync(
                      ref, studentDetailProvider(identity.identityId)))!
                  .groupId ==
              null,
        );
        expect(
          (await readAsync(ref, groupDetailProvider(groupA.groupId)))!
              .currentSize,
          0,
        );

        // ── Guruh A ga qayta qo'shish (transfer uchun asos) ─────────────
        await ref.read(assignStudentToGroupCommandProvider).execute(
              groupId: groupA.groupId,
              studentIdentityId: identity.identityId,
            );
        await waitUntil(
          () async => (await readAsync(
                      ref, studentDetailProvider(identity.identityId)))!
                  .groupId ==
              groupA.groupId,
        );

        // ── BOSHQA GURUHGA O'TKAZISH (A → B) ────────────────────────────
        final transfer = ref.read(transferStudentCommandProvider);
        await transfer.startTransfer(identity.identityId, groupB.groupId);
        await transfer.confirmTransfer(identity.identityId);

        await waitUntil(
          () async => (await readAsync(
                      ref, studentDetailProvider(identity.identityId)))!
                  .groupId ==
              groupB.groupId,
        );
        final transferred =
            await readAsync(ref, studentDetailProvider(identity.identityId));
        expect(transferred!.groupName, 'Ingliz tili-B',
            reason: 'Denormalizatsiya: groupName yangi guruh bilan sinxron');
        expect(
          (await readAsync(ref, groupDetailProvider(groupA.groupId)))!
              .currentSize,
          0,
          reason: "Eski guruh sig'imi kamayadi",
        );
        expect(
          (await readAsync(ref, groupDetailProvider(groupB.groupId)))!
              .currentSize,
          1,
          reason: "Yangi guruh sig'imi oshadi",
        );

        // ── ARXIVLASH (talaba guruhdan chiqariladi) ─────────────────────
        final archived =
            await ref.read(updateStudentStatusCommandProvider).execute(
                  identity.identityId,
                  StudentStatus.archived,
                );
        expect(archived.studentStatus, StudentStatus.archived);
        expect(archived.groupId, isNull,
            reason: 'Arxivlangan talaba guruhdan chiqariladi');
        await waitUntil(
          () async =>
              (await readAsync(ref, groupDetailProvider(groupB.groupId)))!
                      .currentSize ==
                  0,
        );
        expect(
          (await readAsync(ref, groupDetailProvider(groupB.groupId)))!
              .currentSize,
          0,
          reason: "Arxivlash guruh sig'imini kamaytiradi",
        );

        // ── QAYTA TIKLASH (arxiv → faol) ────────────────────────────────
        final restored =
            await ref.read(updateStudentStatusCommandProvider).execute(
                  identity.identityId,
                  StudentStatus.active,
                );
        expect(restored.studentStatus, StudentStatus.active);
        expect(restored.completedAt, isNull,
            reason: 'Restore completedAt sanasini tozalaydi');
        expect(
          (await readAsync(ref, studentDetailProvider(identity.identityId)))!
              .isActive,
          isTrue,
        );

        // Qayta tiklangach o'quvchi istalgan faol guruhga qayta qo'shilishi
        // mumkin (restore oqimi guruhsiz holatga keltiradi).
        await ref.read(assignStudentToGroupCommandProvider).execute(
              groupId: groupB.groupId,
              studentIdentityId: identity.identityId,
            );
        await waitUntil(
          () async => (await readAsync(
                      ref, studentDetailProvider(identity.identityId)))!
                  .groupId ==
              groupB.groupId,
        );
        expect(
          (await readAsync(ref, groupDetailProvider(groupB.groupId)))!
              .currentSize,
          1,
        );

        await app.dispose();
      } finally {
        await app.dispose();
      }
    },
  );
}
