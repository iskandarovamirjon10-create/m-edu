import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';

import 'package:m_edu/core/database/backup_collections.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_conflict_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_cursor_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_operation_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_session_record.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/crm/infrastructure/models/lead_activity_record.dart';
import 'package:m_edu/features/crm/infrastructure/models/lead_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/face_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/recognition_attempt_record.dart';
import 'package:m_edu/features/grades/infrastructure/models/grade_record.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_activity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/sequence_counter.dart';
import 'package:m_edu/features/identity/infrastructure/models/signed_qr_nonce_record.dart';
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
import 'package:m_edu/features/settings/infrastructure/services/backup_codec.dart';
import 'package:m_edu/features/settings/infrastructure/services/database_backup_service.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

/// A7/E6 BACKUP TORTURE — registry to'liqligi + export → clear → import →
/// verify round-trip + korruptsiya aniqlash + yangiroq schema rad etish.
///
/// Kafolatlar:
/// 1. Registry Isar'dagi BARCHA persistent kolleksiyani qamrab oladi
///    (yangi kolleksiya qo'shilsa jimgina to'liqsiz backup bo'lmaydi).
/// 2. Avval qo'shilmagan kolleksiyalar (recognitionAttemptRecords,
///    syncOperationRecords) ham zaxiralanadi/tiklanadi.
/// 3. Restore'dan keyin har bir kolleksiya soni backup'dagi bilan teng.
/// 4. Buzilgan backup restore oldidan aniqlanadi.
class _FakePathProvider extends PathProviderPlatform {
  final String dir;
  _FakePathProvider(this.dir);

  @override
  Future<String?> getApplicationSupportPath() async => dir;

  @override
  Future<String?> getApplicationDocumentsPath() async => dir;

  @override
  Future<String?> getTemporaryPath() async => dir;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late Isar db;

  // main.dart bilan bir xil schema ro'yxati (DeviceInfoRecord ham bor,
  // lekin registry uni ataylab zaxiralamaydi — qurilmaga xos).
  final schemas = <CollectionSchema<dynamic>>[
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
    GradeRecordSchema,
    NotificationRecordSchema,
    FaceRecordSchema,
    RecognitionAttemptRecordSchema,
    AttendanceRecordSchema,
    AttendanceSessionRecordSchema,
    LeadRecordSchema,
    LeadActivityRecordSchema,
    SignedQrNonceRecordSchema,
    SettingsRecordSchema,
    UserRecordSchema,
    SubjectRecordSchema,
    AuditLogRecordSchema,
    ReportRecordSchema,
    SyncOperationRecordSchema,
    SyncCursorRecordSchema,
    SyncConflictRecordSchema,
  ];

  late PathProviderPlatform originalPathProvider;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_backup_test');
    db = await Isar.open(
      schemas,
      name: 'm_edu_backup_test_${tempDir.path.hashCode.abs()}',
      directory: tempDir.path,
    );
    originalPathProvider = PathProviderPlatform.instance;
    PathProviderPlatform.instance =
        _FakePathProvider('${tempDir.path}/support');
  });

  tearDown(() async {
    await db.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
    PathProviderPlatform.instance = originalPathProvider;
  });

  test('registry Isar\'dagi barcha persistent kolleksiyalarni qamrab oladi',
      () {
    // Registry kalitlari (DeviceInfoRecord ataylab tashqarida — qurilmaga
    // xos identifikator, backup'da ko'chirilmasligi kerak).
    final registryKeys = BackupCollections.all.map((s) => s.key).toSet();
    expect(registryKeys, containsAll([
      'identityRecords',
      'identityActivityRecords',
      'sequenceCounters',
      'organizationRecords',
      'studentRecords',
      'teacherRecords',
      'groupRecords',
      'paymentRecords',
      'debtRecords',
      'expenseRecords',
      'scheduleRecords',
      'roomRecords',
      'gradeRecords',
      'notificationRecords',
      'faceRecords',
      'recognitionAttemptRecords',
      'attendanceRecords',
      'attendanceSessionRecords',
      'leadRecords',
      'leadActivityRecords',
      'signedQrNonceRecords',
      'settingsRecords',
      'userRecords',
      'subjectRecords',
      'auditLogRecords',
      'reportRecords',
      'syncOperationRecords',
      'syncCursorRecords',
      'syncConflictRecords',
    ]));
    // DeviceInfoRecord registry'da YO'Q (ataylab istisno).
    expect(registryKeys, isNot(contains('deviceInfoRecords')));
  });

  test(
      'round-trip: export → clear → import → verify — BARCHA kolleksiyalar '
      '(avval qo\'shilmaganlar ham) tiklanadi', () async {
    final service = DatabaseBackupService(db);

    // ── SEED: har bir kolleksiyaga haqiqiy yozuv ──────────────────────
    await db.writeTxn(() async {
      await db.identityRecords.put(IdentityRecord()
        ..identityId = 'M-EDU-2026-000001'
        ..firstName = 'Ali'
        ..lastName = 'Valiyev'
        ..role = 'student'
        ..status = 'active'
        ..qrSeed = 'seed-1'
        ..createdAt = DateTime(2026, 8, 1));
      await db.recognitionAttemptRecords.put(RecognitionAttemptRecord()
        ..outcome = 'identified'
        ..identityId = 'M-EDU-2026-000001'
        ..confidence = 0.91
        ..cameraSource = 'test'
        ..timestamp = DateTime(2026, 8, 1, 9, 0)
        ..timestampIndex = DateTime(2026, 8, 1, 9, 0));
      await db.syncOperationRecords.put(SyncOperationRecord()
        ..operationId = 'identity:M-EDU-2026-000001'
        ..entityType = 'identity'
        ..entityId = 'M-EDU-2026-000001'
        ..operationType = 'upsert'
        ..payload = '{}'
        ..version = 1
        ..deviceId = 'device-A'
        ..syncStatus = 'pending'
        ..retryCount = 0
        ..createdAt = DateTime(2026, 8, 1)
        ..updatedAt = DateTime(2026, 8, 1));
      await db.paymentRecords.put(PaymentRecord()
        ..paymentId = 'PAY-1'
        ..studentIdentityId = 'M-EDU-2026-000001'
        ..amount = 200000
        ..paymentType = 'cash'
        ..status = 'paid'
        ..receiptNumber = 'REC-AAAAAAAAAAAAAAAA'
        ..paymentDate = DateTime(2026, 8, 1));
      await db.faceRecords.put(FaceRecord()
        ..identityId = 'M-EDU-2026-000001'
        ..signature = const []
        ..sampleCount = 3
        ..createdAt = DateTime(2026, 8, 1));
      await db.attendanceRecords.put(AttendanceRecord()
        ..identityId = 'M-EDU-2026-000001'
        ..timestamp = DateTime(2026, 8, 1, 9, 5)
        ..fullName = 'Ali Valiyev'
        ..role = 'student'
        ..method = 'manual'
        ..attendanceDate = DateTime(2026, 8, 1));
      await db.settingsRecords.put(SettingsRecord()
        ..language = 'uz'
        ..themeMode = 'system'
        ..notificationsEnabled = true
        ..pushEnabled = true
        ..smsEnabled = false
        ..telegramEnabled = false
        ..paperSize = 'A4'
        ..autoBackupEnabled = true
        ..backupIntervalDays = 7
        ..glassIntensity = 40);
      await db.userRecords.put(UserRecord()
        ..userId = 'user-1'
        ..identityId = 'M-EDU-2026-000001'
        ..email = 'a@b.uz'
        ..role = 'admin'
        ..isActive = true
        ..createdAt = DateTime(2026, 8, 1));
    });

    final backupPath = await service.createBackup();

    // ── VERIFY (yozilgandan keyin) ────────────────────────────────────
    final verification = await service.verifyBackup(backupPath);
    expect(verification.isValid, isTrue, reason: verification.error);

    // ── CLEAR: hamma narsani o'chiramiz ───────────────────────────────
    await db.writeTxn(() async {
      for (final spec in BackupCollections.all) {
        await spec.accessor(db).clear();
      }
    });
    expect(await db.identityRecords.count(), 0);
    expect(await db.recognitionAttemptRecords.count(), 0);
    expect(await db.syncOperationRecords.count(), 0);

    // ── IMPORT (restore) ──────────────────────────────────────────────
    await service.restoreBackup(backupPath);

    // ── VERIFY: har bir kolleksiya soni backup bilan teng ─────────────
    for (final spec in BackupCollections.all) {
      expect(await spec.accessor(db).count(),
          _expectedCounts[spec.key] ?? 0,
          reason: '${spec.key} restore\'dan keyin to\'liq tiklanmadi');
    }

    // Spot-check: tiklanmagan (avval qo'shilmagan) kolleksiyalar.
    final attempt = await db.recognitionAttemptRecords.where().findFirst();
    expect(attempt, isNotNull);
    expect(attempt!.outcome, 'identified');
    expect(attempt.identityId, 'M-EDU-2026-000001');

    final op = await db.syncOperationRecords.where().findFirst();
    expect(op, isNotNull);
    expect(op!.entityType, 'identity');
    expect(op.syncStatus, 'pending');

    final payment = await db.paymentRecords.where().findFirst();
    expect(payment!.receiptNumber, 'REC-AAAAAAAAAAAAAAAA');
  });

  test('buzilgan backup verify qilinmaydi — restore rad etiladi', () async {
    final service = DatabaseBackupService(db);
    await db.writeTxn(() async {
      await db.identityRecords.put(IdentityRecord()
        ..identityId = 'M-EDU-2026-000001'
        ..firstName = 'Ali'
        ..lastName = 'Valiyev'
        ..role = 'student'
        ..status = 'active'
        ..qrSeed = 'seed-1'
        ..createdAt = DateTime(2026, 8, 1));
    });

    final backupPath = await service.createBackup();
    expect((await service.verifyBackup(backupPath)).isValid, isTrue);

    // Faylni buzamiz (checksum mos kelmaydi).
    final file = File(backupPath);
    var raw = await file.readAsString();
    raw = raw.replaceFirst('"firstName":"Ali"', '"firstName":"Buzilgan"');
    await file.writeAsString(raw);

    final corrupted = await service.verifyBackup(backupPath);
    expect(corrupted.isValid, isFalse);

    // Restore ham rad etiladi (fayl buzilgan — eski ma'lumot qoladi).
    await expectLater(
      service.restoreBackup(backupPath),
      throwsA(anything),
    );
    expect(await db.identityRecords.count(), 1);
  });

  test('yangiroq schema bilan yaratilgan backup restore qilinmaydi',
      () async {
    final service = DatabaseBackupService(db);
    // Registry'dagi barcha kolleksiyalar uchun bo'sh backup yaratamiz.
    final collections = <String, dynamic>{};
    for (final spec in BackupCollections.all) {
      collections[spec.key] = await spec.accessor(db).where().exportJson();
    }
    final backupPath = '${tempDir.path}/future_backup.json';
    await File(backupPath).writeAsString(
      BackupCodec.encode(
        collections: collections,
        appVersion: '9.9.9',
        schemaVersion: backupSchemaVersion + 1,
      ),
    );

    await expectLater(
      service.restoreBackup(backupPath),
      throwsA(anything),
    );
  });
}

// Testda seed qilingan yozuvlar soni (registry kaliti bo'yicha).
const _expectedCounts = <String, int>{
  'identityRecords': 1,
  'recognitionAttemptRecords': 1,
  'syncOperationRecords': 1,
  'paymentRecords': 1,
  'faceRecords': 1,
  'attendanceRecords': 1,
  'settingsRecords': 1,
  'userRecords': 1,
};
