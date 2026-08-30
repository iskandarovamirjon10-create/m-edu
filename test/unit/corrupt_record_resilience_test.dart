import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/extensions/enum_x.dart';
import 'package:m_edu/features/audit/infrastructure/datasources/isar_audit_datasource.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/audit/infrastructure/repositories_impl/audit_repository_impl.dart';
import 'package:m_edu/features/identity/infrastructure/datasources/isar_identity_datasource.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/repositories_impl/identity_repository_impl.dart';
import 'package:m_edu/features/payments/infrastructure/datasources/isar_payment_datasource.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/payments/infrastructure/repositories_impl/payment_repository_impl.dart';
import 'package:m_edu/features/scheduling/infrastructure/datasources/isar_schedule_datasource.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/repositories_impl/schedule_repository_impl.dart';
import 'package:m_edu/features/settings/infrastructure/datasources/isar_settings_datasource.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/repositories_impl/settings_repository_impl.dart';
import 'package:m_edu/features/settings/infrastructure/services/secure_settings_store.dart';
import 'package:m_edu/features/students/infrastructure/datasources/isar_student_datasource.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/students/infrastructure/repositories_impl/student_repository_impl.dart';

import '../helpers/secure_storage_mock.dart';

/// CORRUPT RECORD RESILIENCE (spec §7, §17).
///
/// Acceptance: bitta buzilgan (corrupt) DB yozuvi — noto'g'ri enum qiymati,
/// chegaradan chiqqan indeks — butun ro'yxat so'rovini yiqitmasligi va
/// app'ni crash qildirmasligi kerak. Buzilgan yozuv o'tkazib yuboriladi;
/// valid yozuvlar o'zgarishsiz qaytadi.
///
/// Bu testlar haqiqiy Isar bazasida ishlaydi: record'lar to'g'ridan-to'g'ri
/// yoziladi (repo orqali emas — repo xavfsiz parse qiladi), so'ng repo
/// orqali o'qiladi.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  mockSecureStorageChannel();

  late Directory tempDir;
  late String dbPath;
  var testCounter = 0;
  String uniqueDbName() => 'm_edu_corrupt_${testCounter++}';

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_corrupt_test');
    dbPath = tempDir.path;
    secureStorageMock.clear();
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<Isar> openDb() async {
    final db = await AppDatabase.open(
      schemas: [
        PaymentRecordSchema,
        DebtRecordSchema,
        ExpenseRecordSchema,
        StudentRecordSchema,
        IdentityRecordSchema,
        ScheduleRecordSchema,
        RoomRecordSchema,
        AuditLogRecordSchema,
        SettingsRecordSchema,
      ],
      name: uniqueDbName(),
      directory: dbPath,
    );
    return db.instance;
  }

  group('helper: tryEnumByName', () {
    test('valid nom → qiymat, null/noto\'g\'ri → null', () {
      expect(tryEnumByName(PaymentStatusTest.values, 'completed'),
          PaymentStatusTest.completed);
      expect(tryEnumByName(PaymentStatusTest.values, 'BUZIQ'), isNull);
      expect(tryEnumByName(PaymentStatusTest.values, null), isNull);
      expect(tryEnumByName(PaymentStatusTest.values, ''), isNull);
    });
  });

  group('PaymentRepositoryImpl — corrupt yozuv', () {
    test('noto\'g\'ri status yozuv: fetchAll crash qilmaydi va kirmaydi',
        () async {
      final isar = await openDb();
      final now = DateTime(2026, 8, 10);
      await isar.writeTxn(() => isar.paymentRecords.putAll([
            // Valid to'lov — qaytishi kerak.
            PaymentRecord()
              ..paymentId = 'PAY-1'
              ..studentIdentityId = 'S1'
              ..amount = 100000
              ..paymentType = 'cash'
              ..status = 'completed'
              ..paymentDate = now,
            // Corrupt status — o'tkazib yuborilishi kerak (FAKE revenue yo'q).
            PaymentRecord()
              ..paymentId = 'PAY-2'
              ..studentIdentityId = 'S2'
              ..amount = 999999
              ..paymentType = 'cash'
              ..status = 'hacked-status'
              ..paymentDate = now,
          ]));

      final repo = PaymentRepositoryImpl(IsarPaymentDataSource(isar));

      // CRITICAL: hech qanday exception tashlanmasligi kerak.
      final payments = await repo.fetchAll();

      expect(payments.length, 1);
      expect(payments.single.paymentId, 'PAY-1');
      expect(payments.single.amount, 100000);
      await isar.close();
    });

    test('noto\'g\'ri paymentType ham o\'tkazib yuboriladi (fetchByStudentId)',
        () async {
      final isar = await openDb();
      final now = DateTime(2026, 8, 10);
      await isar.writeTxn(() => isar.paymentRecords.putAll([
            PaymentRecord()
              ..paymentId = 'PAY-3'
              ..studentIdentityId = 'S3'
              ..amount = 5000
              ..paymentType = 'bitcoin-future'
              ..status = 'completed'
              ..paymentDate = now,
            PaymentRecord()
              ..paymentId = 'PAY-4'
              ..studentIdentityId = 'S3'
              ..amount = 7000
              ..paymentType = 'card'
              ..status = 'completed'
              ..paymentDate = now,
          ]));

      final repo = PaymentRepositoryImpl(IsarPaymentDataSource(isar));
      final payments = await repo.fetchByStudentId('S3');

      expect(payments.length, 1);
      expect(payments.single.paymentId, 'PAY-4');
      await isar.close();
    });

    test('noto\'g\'ri debt status: fetchOutstandingDebts crash qilmaydi',
        () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.debtRecords.putAll([
            DebtRecord()
              ..debtId = 'DEBT-1'
              ..studentIdentityId = 'S1'
              ..dueDate = DateTime(2026, 9, 1)
              ..totalAmount = 200000
              ..paidAmount = 0
              ..remainingAmount = 200000
              ..status = 'outstanding'
              ..billingPeriod = '2026-08'
              ..reminderSent = false,
            DebtRecord()
              ..debtId = 'DEBT-2'
              ..studentIdentityId = 'S2'
              ..dueDate = DateTime(2026, 9, 1)
              ..totalAmount = 300000
              ..paidAmount = 0
              ..remainingAmount = 300000
              ..status = 'corrupt-status'
              ..billingPeriod = '2026-08'
              ..reminderSent = false,
          ]));

      final repo = PaymentRepositoryImpl(IsarPaymentDataSource(isar));
      final debts = await repo.fetchDebtsByStudentId('S1');
      expect(debts.length, 1);
      expect(debts.single.debtId, 'DEBT-1');
      await isar.close();
    });
  });

  group('StudentRepositoryImpl — corrupt yozuv', () {
    test('noto\'g\'ri studentStatus: fetchAll/fetchByIdentityId xavfsiz',
        () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.studentRecords.putAll([
            StudentRecord()
              ..identityId = 'M-EDU-2026-000001'
              ..studentNumber = 1
              ..studentStatus = 'active'
              ..transferStatus = 'none'
              ..paymentStatus = false
              ..totalPaid = 0
              ..enrolledAt = DateTime(2026, 8, 1),
            StudentRecord()
              ..identityId = 'M-EDU-2026-000002'
              ..studentNumber = 2
              ..studentStatus = 'alien-status'
              ..transferStatus = 'none'
              ..paymentStatus = false
              ..totalPaid = 0
              ..enrolledAt = DateTime(2026, 8, 1),
          ]));

      final repo = StudentRepositoryImpl(IsarStudentDataSource(isar));

      final all = await repo.fetchAll();
      expect(all.length, 1);
      expect(all.single.identityId, 'M-EDU-2026-000001');

      // Single fetch: corrupt → null (crash emas, "Topilmadi" holati).
      final corrupt = await repo.fetchByIdentityId('M-EDU-2026-000002');
      expect(corrupt, isNull);
      await isar.close();
    });
  });

  group('IdentityRepositoryImpl — corrupt yozuv', () {
    test('noto\'g\'ri role: fetchAll xavfsiz, valid yozuv qaytadi', () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.identityRecords.putAll([
            IdentityRecord()
              ..identityId = 'M-EDU-2026-000100'
              ..firstName = 'Ali'
              ..lastName = 'Valiyev'
              ..role = 'student'
              ..status = 'active'
              ..qrSeed = 'seed-1'
              ..createdAt = DateTime(2026, 8, 10),
            IdentityRecord()
              ..identityId = 'M-EDU-2026-000200'
              ..firstName = 'Buziq'
              ..lastName = 'Yozuv'
              ..role = 'ghost-role'
              ..status = 'active'
              ..qrSeed = 'seed-2'
              ..createdAt = DateTime(2026, 8, 10),
          ]));

      final repo = IdentityRepositoryImpl(IsarIdentityDataSource(isar));
      final identities = await repo.fetchAll();

      expect(identities.length, 1);
      expect(identities.single.identityId, 'M-EDU-2026-000100');
      await isar.close();
    });
  });

  group('ScheduleRepositoryImpl — corrupt yozuv', () {
    test('chegaradan chiqqan dayOfWeek indeks: fetchAll xavfsiz', () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.scheduleRecords.putAll([
            ScheduleRecord()
              ..scheduleId = 'SCH-1'
              ..groupId = 'G1'
              ..teacherId = 'T1'
              ..roomId = 'R1'
              ..dayOfWeek = 0 // monday
              ..startTime = '09:00'
              ..endTime = '10:00'
              ..subject = 'Matematika'
              ..status = 'scheduled',
            // 99 — DayOfWeek 0..6 oralig'idan tashqarida (RangeError xavfi).
            ScheduleRecord()
              ..scheduleId = 'SCH-2'
              ..groupId = 'G2'
              ..teacherId = 'T2'
              ..roomId = 'R2'
              ..dayOfWeek = 99
              ..startTime = '09:00'
              ..endTime = '10:00'
              ..subject = 'Buziq'
              ..status = 'scheduled',
          ]));

      final repo = ScheduleRepositoryImpl(IsarScheduleDataSource(isar));
      final schedules = await repo.fetchAll();

      expect(schedules.length, 1);
      expect(schedules.single.scheduleId, 'SCH-1');
      expect(schedules.single.dayOfWeek.name, 'monday');
      await isar.close();
    });

    test('noto\'g\'ri status: fetchAllRooms xavfsiz', () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.roomRecords.putAll([
            RoomRecord()
              ..roomId = 'R1'
              ..name = '101-xona'
              ..capacity = 20
              ..status = 'available',
            RoomRecord()
              ..roomId = 'R2'
              ..name = 'Buziq-xona'
              ..capacity = 20
              ..status = 'in-the-void',
          ]));

      final repo = ScheduleRepositoryImpl(IsarScheduleDataSource(isar));
      final rooms = await repo.fetchAllRooms();

      expect(rooms.length, 1);
      expect(rooms.single.roomId, 'R1');
      await isar.close();
    });
  });

  group('AuditRepositoryImpl — corrupt yozuv', () {
    test('noto\'g\'ri action: fetchRecent xavfsiz', () async {
      final isar = await openDb();
      final now = DateTime(2026, 8, 10);
      await isar.writeTxn(() => isar.auditLogRecords.putAll([
            AuditLogRecord()
              ..auditId = 'AUD-1'
              ..actorUserId = 'user-1'
              ..actorName = 'Admin'
              ..action = 'studentCreated'
              ..occurredAt = now
              ..targetType = 'student'
              ..targetId = 'M-EDU-2026-000001'
              ..result = 'success',
            AuditLogRecord()
              ..auditId = 'AUD-2'
              ..actorUserId = 'user-1'
              ..actorName = 'Admin'
              ..action = 'deleteEverything'
              ..occurredAt = now
              ..targetType = 'student'
              ..targetId = 'X'
              ..result = 'success',
          ]));

      final repo = AuditRepositoryImpl(IsarAuditDataSource(isar));
      final recent = await repo.fetchRecent();

      expect(recent.length, 1);
      expect(recent.single.auditId, 'AUD-1');
      await isar.close();
    });
  });

  group('SettingsRepositoryImpl — corrupt yozuv', () {
    test('noto\'g\'ri themeMode → system (singleton o\'chib qolmaydi)',
        () async {
      final isar = await openDb();
      await isar.writeTxn(() => isar.settingsRecords.put(
            SettingsRecord()
              ..language = 'uz'
              ..themeMode = 'night-black-ops'
              ..notificationsEnabled = true
              ..pushEnabled = false
              ..smsEnabled = false
              ..telegramEnabled = false
              ..paperSize = 'A4'
              ..autoBackupEnabled = false
              ..backupIntervalDays = 7
              ..glassIntensity = 30,
          ));

      final repo = SettingsRepositoryImpl(
        IsarSettingsDataSource(isar),
        SecureSettingsStore(),
      );
      final settings = await repo.getSettings();

      expect(settings.themeMode.name, 'system');
      expect(settings.language, 'uz');
      await isar.close();
    });
  });

  group('Valid yozuvlar — regression (hech narsa buzilmadi)', () {
    test('normal payment round-trip o\'zgarishsiz ishlaydi', () async {
      final isar = await openDb();
      final now = DateTime(2026, 8, 10);
      await isar.writeTxn(() => isar.paymentRecords.put(
            PaymentRecord()
              ..paymentId = 'PAY-OK'
              ..studentIdentityId = 'S1'
              ..amount = 250000
              ..paymentType = 'transfer'
              ..status = 'pending'
              ..paymentDate = now,
          ));

      final repo = PaymentRepositoryImpl(IsarPaymentDataSource(isar));
      final payment = await repo.fetchById('PAY-OK');

      expect(payment, isNotNull);
      expect(payment!.status.name, 'pending');
      expect(payment.paymentType.name, 'transfer');
      expect(payment.amount, 250000);
      await isar.close();
    });
  });
}

/// Test uchun kichik enum — helper'ning o'zini tekshirish uchun.
enum PaymentStatusTest { pending, completed, failed, refunded, cancelled }
