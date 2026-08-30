import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_conflict_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_cursor_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/face_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/recognition_attempt_record.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_activity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/sequence_counter.dart';
import 'package:m_edu/features/notifications/infrastructure/models/notification_record.dart';
import 'package:m_edu/features/organization/infrastructure/models/organization_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

/// `main.dart`'dagi 20 ta sxema ro'yxati (P0 #1: Isar startup regression).
///
/// Acceptance:
///  - Fresh install  → Isar.open hech qanday xatoliksiz ochiladi
///    (auditda ko'rsatilgan "Missing TypeSchema" kabi crash YO'Q).
///  - Restart        → yozilgan ma'lumot saqlanib qoladi.
///  - Old DB         → sxema ro'yxati o'zgarmasa, eski fayl ochiladi.
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
      RecognitionAttemptRecordSchema,
      AttendanceRecordSchema,
      SettingsRecordSchema,
      UserRecordSchema,
      SubjectRecordSchema,
      AuditLogRecordSchema,
      ReportRecordSchema,
      SyncCursorRecordSchema,
      SyncConflictRecordSchema,
    ];

void main() {
  late Directory tempDir;
  late String dbPath;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_isar_test');
    dbPath = tempDir.path;
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  // Isar instansiyalari name bo'yicha process-global singleton — har bir
  // test alohida name ishlatadi ("Instance has already been opened" xavfi).
  var testCounter = 0;
  String uniqueDbName() => 'm_edu_startup_${testCounter++}';

  test('fresh install: barcha 20 sxema bilan Isar ochiladi', () async {
    final db = await AppDatabase.open(
      schemas: _allSchemas(),
      name: uniqueDbName(),
      directory: dbPath,
    );
    // Barcha collection'lar mavjud va so'rovga tayyor.
    expect(db.instance.identityRecords, isNotNull);
    expect(db.instance.studentRecords, isNotNull);
    expect(db.instance.attendanceRecords, isNotNull);
    expect(db.instance.recognitionAttemptRecords, isNotNull);
    expect(db.instance.syncCursorRecords, isNotNull);
    expect(db.instance.syncConflictRecords, isNotNull);
    expect(await db.instance.identityRecords.where().count(), 0);
    expect(await db.instance.recognitionAttemptRecords.where().count(), 0);
    await db.close();
  });

  test('restart: yozilgan ma\'lumot saqlanadi (data remains)', () async {
    // Restart semanticasi: XUDDI SHU bazani qayta ochish → bitta name.
    final dbName = uniqueDbName();
    final db1 = await AppDatabase.open(
      schemas: _allSchemas(),
      name: dbName,
      directory: dbPath,
    );
    final record = IdentityRecord()
      ..identityId = 'M-EDU-2026-000001'
      ..firstName = 'Ali'
      ..lastName = 'Valiyev'
      ..role = 'student'
      ..status = 'active'
      ..qrSeed = 'seed-1'
      ..createdAt = DateTime(2026, 8, 10);
    // Isar 3: yozuvlar eksplisit tranzaksiya talab qiladi (app datasource'lari
    // ham aynan shu konventsiyani ishlatadi).
    await db1.instance.writeTxn(() => db1.instance.identityRecords.put(record));
    await db1.close();

    // Ilova qayta ishga tushdi — yangi AppDatabase.open (restart).
    final db2 = await AppDatabase.open(
      schemas: _allSchemas(),
      name: dbName,
      directory: dbPath,
    );
    expect(await db2.instance.identityRecords.where().count(), 1);
    final loaded = await db2.instance.identityRecords.getByIdentityId(
      'M-EDU-2026-000001',
    );
    expect(loaded, isNotNull);
    expect(loaded!.firstName, 'Ali');
    expect(loaded.lastName, 'Valiyev');
    await db2.close();
  });

  test('existing DB: qayta ochilganda eski fayl buzuq deb o\'chirilmaydi',
      () async {
    final dbName = uniqueDbName();
    final db1 = await AppDatabase.open(
      schemas: _allSchemas(),
      name: dbName,
      directory: dbPath,
    );
    await db1.instance.writeTxn(() => db1.instance.sequenceCounters.put(
          SequenceCounter()..name = 'identity'..value = 42,
        ));
    await db1.close();

    final db2 = await AppDatabase.open(
      schemas: _allSchemas(),
      name: dbName,
      directory: dbPath,
    );
    expect(await db2.instance.sequenceCounters.where().count(), 1);
    final counter = await db2.instance.sequenceCounters.getByName('identity');
    expect(counter, isNotNull);
    expect(counter!.value, 42);
    await db2.close();
  });
}
