import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/features/attendance/infrastructure/migrations/attendance_schema_v2_migration.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';

/// Attendance V1 → V2 migration — real Isar bilan end-to-end tekshiruv.
///
/// Xavfsizlik talablari (spec §37):
/// - Legacy yozuvlar FIZIK O'CHIRILMAYDI (`isLegacyMerged` bilan belgilanadi);
/// - Backup migrationdan OLDIN yoziladi;
/// - Idempotent — qayta ishga tushirilganda natija o'zgarmaydi;
/// - Muvaffaqiyatsiz bo'lsa ham app ishlashda davom etadi (xato qaytariladi).
void main() {
  late Directory tempDir;
  late Isar isar;

  const identityId = 'M-EDU-2026-000001';
  final day = DateTime(2026, 8, 10);

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_att_migrate');
    isar = await Isar.open(
      [AttendanceRecordSchema, IdentityRecordSchema],
      directory: tempDir.path,
    );
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  AttendanceRecord legacyRecord({
    String? lessonId,
    DateTime? timestamp,
    String status = 'present',
    String method = 'face',
  }) {
    final rec = AttendanceRecord()
      ..identityId = identityId
      ..timestamp = timestamp ?? DateTime(day.year, day.month, day.day, 9, 0)
      ..fullName = 'Ali Valiyev'
      ..role = 'student'
      ..method = method
      ..status = status;
    if (lessonId != null) rec.lessonId = lessonId;
    return rec;
  }

  test('e2e: dublikatlar birlashadi, legacy saqlanadi, backup+report yoziladi', () async {
    // Identity — orphan bo'lmasligi uchun.
    await isar.writeTxn(() async {
      await isar.identityRecords.put(
        IdentityRecord()
          ..identityId = identityId
          ..firstName = 'Ali'
          ..lastName = 'Valiyev'
          ..role = 'student'
          ..status = 'active'
          ..qrSeed = 'seed'
          ..createdAt = DateTime(2026, 1, 1),
      );
      // V1 uslubidagi dublikatlar: same identity + same day, lessonId yo'q.
      await isar.attendanceRecords.putAll([
        legacyRecord(method: 'face'),
        legacyRecord(method: 'qr', timestamp: DateTime(2026, 8, 10, 9, 5)),
        legacyRecord(method: 'manual', timestamp: DateTime(2026, 8, 10, 9, 10)),
      ]);
    });

    final report = await AttendanceSchemaV2Migration.run(
      isar,
      backupDirectory: tempDir.path,
    );

    // Merge sodir bo'ldi va verification o'tdi.
    expect(report.verificationPassed, isTrue, reason: report.summary);
    expect(report.totalRecords, 3);
    expect(report.mergedGroups, 1);

    // Legacy yozuvlar O'CHIRILMADI — belgilandi (xavfsizlik).
    final all = await isar.attendanceRecords.where().findAll();
    expect(all.length, 3);
    final legacyCount = all.where((r) => r.isLegacyMerged == true).length;
    expect(legacyCount, 2);
    final primary = all.where((r) => r.isLegacyMerged != true).toList();
    expect(primary.length, 1);
    expect(primary.single.checkInAt, isNotNull);

    // Backup va hisobot fayllari yozildi.
    final backupsDir = Directory('${tempDir.path}/backups');
    expect(backupsDir.existsSync(), isTrue);
    final files = backupsDir.listSync().map((f) => f.path).toList();
    expect(
      files.any((p) => p.contains('m_edu_attendance_v1_backup')),
      isTrue,
      reason: 'backup fayli bo\'lishi kerak: $files',
    );
    expect(
      files.any((p) => p.contains('m_edu_attendance_v2_report')),
      isTrue,
      reason: 'report fayli bo\'lishi kerak: $files',
    );
  });

  test('e2e: ikkinchi run idempotent — natija o\'zgarmaydi, yangi merge yo\'q', () async {
    await isar.writeTxn(() async {
      await isar.identityRecords.put(
        IdentityRecord()
          ..identityId = identityId
          ..firstName = 'Ali'
          ..lastName = 'Valiyev'
          ..role = 'student'
          ..status = 'active'
          ..qrSeed = 'seed'
          ..createdAt = DateTime(2026, 1, 1),
      );
      await isar.attendanceRecords.putAll([
        legacyRecord(method: 'face'),
        legacyRecord(method: 'qr', timestamp: DateTime(2026, 8, 10, 9, 5)),
      ]);
    });

    final first = await AttendanceSchemaV2Migration.run(
      isar,
      backupDirectory: tempDir.path,
    );
    final afterFirst = await isar.attendanceRecords.where().findAll();
    final firstMerged = afterFirst.where((r) => r.isLegacyMerged == true).length;

    // Ikkinchi run — mavjud isLegacyMerged belgisi tufayli early-exit.
    final second = await AttendanceSchemaV2Migration.run(
      isar,
      backupDirectory: tempDir.path,
    );
    final afterSecond = await isar.attendanceRecords.where().findAll();

    expect(first.verificationPassed, isTrue);
    expect(afterSecond.length, afterFirst.length);
    expect(
      afterSecond.where((r) => r.isLegacyMerged == true).length,
      firstMerged,
    );
    // Early-exit yo'li: hech qanday yangi o'zgarish kiritilmaydi.
    expect(second.totalRecords, 0, reason: 'allaqachon bajarilgan — 0 yozuv');
  });

  test('e2e: bo\'sh baza — xato tashlamaydi, verification passed', () async {
    final report = await AttendanceSchemaV2Migration.run(
      isar,
      backupDirectory: tempDir.path,
    );

    expect(report.failed, isFalse);
    expect(report.verificationPassed, isTrue);
    expect(report.totalRecords, 0);
  });

  test('e2e: orphan identityId hisobotga yoziladi, yozuv o\'chirilmaydi', () async {
    // Identity yaratilmaydi — identityId orphan bo'ladi.
    await isar.writeTxn(() async {
      await isar.attendanceRecords.put(legacyRecord());
    });

    final report = await AttendanceSchemaV2Migration.run(
      isar,
      backupDirectory: tempDir.path,
    );

    expect(report.orphanReferences, greaterThanOrEqualTo(1));
    // Yozuv hali ham saqlangan (o'chirish yo'q).
    final all = await isar.attendanceRecords.where().findAll();
    expect(all.length, 1);
  });
}
