import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/app/event_sync.dart';
import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/di/core_providers.dart';
import 'package:m_edu/features/attendance/application/commands/mark_attendance_status_command.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_session_record.dart';
import 'package:m_edu/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
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
import 'package:m_edu/features/payments/application/commands/create_debt_command.dart';
import 'package:m_edu/features/payments/application/commands/receive_payment_command.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/payments/presentation/providers/payment_providers.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

// ────────────────────────────────────────────────────────────────────────────
// M-EDU ATTENDANCE STATUS + PAYMENT RECEIPT — REAL INTEGRATION TEST
//
// Real production stack (hech qanday mock/fake emas):
//   REAL AppDatabase (Isar, diskda) → REAL datasource → REAL repository →
//   REAL command → REAL EventBus + EventSyncCoordinator.
//
// Tekshirilayotgan spec qoidalari:
//   §21  Davomat holatlari: present/late/absent/excused (REAL DB'ga yoziladi)
//   §23  Dublikat himoyasi (1 talaba + 1 kun = 1 primary yozuv)
//   §24  Holat tahriri (late → present) + audit (actor, vaqt, eski→yangi)
//   §33  To'lov atomikligi (to'lov + qarz bitta tranzaksiya)
//   §34  Kvitansiya raqami — dublikatsiz (writeTxn ichida atomik)
//   §67  RESTART → hammasi saqlanadi
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

void main() {
  // authControllerProvider kabi provider'lar WidgetsBinding.instance'ga
  // murojaat qiladi — test mustaqil (boshqa faylsiz) ishlaganda ham
  // binding bo'lishi shart.
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late String dbPath;
  var dbCounter = 0;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_att_status');
    dbPath = tempDir.path;
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'ATTENDANCE STATUS: late belgilash → tahrirlash (present) → audit → absent → RESTART',
    () async {
      final dbName = 'm_edu_att_restart';
      final app = await TestApp.start(dbName: dbName, dbPath: dbPath);
      final ref = app.container;

      try {
        // Talaba ro'yxatga olinadi (real Identity → Student proyeksiyasi).
        final identity = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Jasur',
                lastName: 'Rahimov',
                role: IdentityRole.student,
                phone: '+998901112233',
              ),
            );
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 1,
        );

        final today = DateTime.now();

        // ── 1. LATE belgilash (check-in bo'lmagan talaba ham) ───────────
        final lateResult = await ref
            .read(markAttendanceStatusCommandProvider)
            .execute(
              MarkAttendanceStatusRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                attendanceDate: today,
                status: AttendanceStatus.late,
              ),
            );
        expect(lateResult.wasUpdated, isFalse,
            reason: 'Birinchi belgilash — yangi yozuv');
        expect(lateResult.entry.status, 'late');

        // REAL DB'da yozildi.
        final records = await app.db.instance.attendanceRecords.where().findAll();
        expect(records, hasLength(1));
        expect(records.single.identityId, identity.identityId);
        expect(records.single.status, 'late');
        expect(records.single.checkInAt, isNotNull,
            reason: 'Late — kirish vaqti bilan belgilanadi');

        // Provider (UI state) yangilandi.
        await waitUntil(
          () async => (await readAsync(ref, todayAttendanceProvider))
              .any((e) => e.identityId == identity.identityId && e.status == 'late'),
        );

        // ── 2. TAHRIRLASH: late → present (spec §24) ────────────────────
        final editResult = await ref
            .read(markAttendanceStatusCommandProvider)
            .execute(
              MarkAttendanceStatusRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                attendanceDate: today,
                status: AttendanceStatus.present,
              ),
            );
        expect(editResult.wasUpdated, isTrue,
            reason: 'Mavjud yozuv yangilanadi (edit)');
        expect(editResult.previousStatus, 'late');

        // Dublikat YO'Q — 1 talaba + 1 kun = 1 primary yozuv (§23).
        expect(
          await app.db.instance.attendanceRecords.where().count(),
          1,
          reason: "Tahrirlash yangi yozuv yaratmaydi — §23",
        );
        final afterEdit =
            (await app.db.instance.attendanceRecords.where().findAll()).single;
        expect(afterEdit.status, 'present');

        // AUDIT yozildi (actor, eski→yangi holat) — §24.
        final audits =
            await app.db.instance.auditLogRecords.where().findAll();
        final attendanceAudits =
            audits.where((a) => a.action == 'attendanceEdited').toList();
        expect(attendanceAudits, isNotEmpty,
            reason: "Holat o'zgarishi audit log'ga yoziladi");
        expect(attendanceAudits.last.details, contains('late → present'));

        // ── 3. ABSENT — ikkinchi talaba, check-in'siz ────────────────────
        final identity2 = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Malika',
                lastName: 'Yusupova',
                role: IdentityRole.student,
              ),
            );
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 2,
        );
        final absentResult = await ref
            .read(markAttendanceStatusCommandProvider)
            .execute(
              MarkAttendanceStatusRequest(
                identityId: identity2.identityId,
                fullName: identity2.fullName,
                role: identity2.role.name,
                attendanceDate: today,
                status: AttendanceStatus.absent,
              ),
            );
        expect(absentResult.entry.status, 'absent');
        expect(absentResult.entry.checkInAt, isNull,
            reason: "Kelmagan talaba — check-in yo'q, faqat holat");

        // Restartdan keyin taqqoslash uchun audit soni snapshot'i (absent
        // belgilash ham attendanceEdited audit yozadi).
        final attendanceEditedCount =
            (await app.db.instance.auditLogRecords.where().findAll())
                .where((a) => a.action == 'attendanceEdited')
                .length;

        // ── 4. RESTART ──────────────────────────────────────────────────
        await app.dispose();
        final restarted = await TestApp.start(dbName: dbName, dbPath: dbPath);
        final ref2 = restarted.container;

        await waitUntil(
          () async => (await readAsync(ref2, todayAttendanceProvider)).length == 2,
        );
        final persisted = await readAsync(ref2, todayAttendanceProvider);
        expect(
          persisted.firstWhere((e) => e.identityId == identity.identityId).status,
          'present',
          reason: "Restartdan keyin holat saqlanadi",
        );
        expect(
          persisted.firstWhere((e) => e.identityId == identity2.identityId).status,
          'absent',
        );
        // Dublikat yo'q, audit saqlanadi.
        expect(
          await restarted.db.instance.attendanceRecords.where().count(),
          2,
        );
        expect(
          (await restarted.db.instance.auditLogRecords.where().findAll())
              .where((a) => a.action == 'attendanceEdited')
              .length,
          attendanceEditedCount,
        );

        await restarted.dispose();
      } finally {
        await app.dispose();
      }
    },
  );

  test(
    'RECEIPT (§34): parallel to\'lovlar dublikat kvitansiya raqami olmaydi + qarz atomik yangilanadi',
    () async {
      final app = await TestApp.start(
        dbName: 'm_edu_receipt_${dbCounter++}',
        dbPath: dbPath,
      );
      final ref = app.container;

      try {
        final identity = await ref
            .read(registerIdentityCommandProvider)
            .execute(
              RegisterIdentityRequest(
                firstName: 'Bekzod',
                lastName: 'Toshev',
                role: IdentityRole.student,
              ),
            );
        await waitUntil(
          () async => (await readAsync(ref, studentListProvider)).length == 1,
        );

        // ── PARALLEL to'lovlar (race condition sinovi) ──────────────────
        final results = await Future.wait([
          ref.read(receivePaymentCommandProvider).execute(
                ReceivePaymentRequest(
                  studentIdentityId: identity.identityId,
                  studentName: identity.fullName,
                  amount: 100000,
                  paymentType: PaymentType.cash,
                ),
              ),
          ref.read(receivePaymentCommandProvider).execute(
                ReceivePaymentRequest(
                  studentIdentityId: identity.identityId,
                  studentName: identity.fullName,
                  amount: 100000,
                  paymentType: PaymentType.cash,
                ),
              ),
        ]);

        final receipts = results.map((p) => p.receiptNumber).toSet();
        expect(receipts.length, 2,
            reason: '§34: har bir to\'lov YAGONA kvitansiya raqamiga ega');
        // A2/E2: kvitansiyalar global yagona ULID — parallel to\'lovlar
        // hech qachon dublikat raqam olmaydi.
        for (final p in results) {
          expect(
            p.receiptNumber,
            matches(RegExp(r'^REC-[0-9A-Z]{16}$')),
            reason: 'kvitansiya yagona ULID formatida',
          );
        }

        // DB'da ikkala to'lov saqlangan.
        final payments =
            await app.db.instance.paymentRecords.where().findAll();
        expect(payments, hasLength(2));
        final storedReceipts =
            payments.map((p) => p.receiptNumber).toSet();
        expect(storedReceipts.length, 2);

        // ── §33: to'lov + qarz atomik — qisman holat yo'q ───────────────
        // 1 ta qarz yaratamiz, keyin to'liq to'laymiz — qarz paid bo'ladi.
        final billingPeriod =
            '${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}';
        await ref.read(createDebtCommandProvider).execute(
              CreateDebtRequest(
                studentIdentityId: identity.identityId,
                studentName: identity.fullName,
                dueDate: DateTime.now().add(const Duration(days: 7)),
                totalAmount: 100000,
                billingPeriod: billingPeriod,
              ),
            );
        final debtBefore = (await app.db.instance.debtRecords.where().findAll()).single;
        expect(debtBefore.status, 'outstanding');

        await ref.read(receivePaymentCommandProvider).execute(
              ReceivePaymentRequest(
                studentIdentityId: identity.identityId,
                studentName: identity.fullName,
                amount: 100000,
                paymentType: PaymentType.cash,
              ),
            );

        final debtAfter =
            (await app.db.instance.debtRecords.where().findAll()).single;
        expect(debtAfter.status, 'paid',
            reason: 'To\'lov qabul qilinganda qarz ham yangilanadi');
        expect(debtAfter.paidAmount, 100000);
        expect(debtAfter.remainingAmount, 0);

        await app.dispose();
      } finally {
        await app.dispose();
      }
    },
  );
}
