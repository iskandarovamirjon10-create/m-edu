import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/infrastructure/migrations/attendance_migration_report.dart';
import 'package:m_edu/features/attendance/infrastructure/migrations/attendance_merge_plan.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';

/// Migration hisoboti — user talab qilgan 10 band verification (spec §37).
void main() {
  group('AttendanceMigrationReport', () {
    test('toJson barcha 10 band ko\'rsatkichini o\'z ichiga oladi', () {
      final report = AttendanceMigrationReport()
        ..totalRecords = 5
        ..mergedGroups = 1
        ..legacyFlaggedRecords = 2
        ..backfilledRecords = 1
        ..orphanReferences = 1
        ..skippedInvalid = 1;

      final json = report.toJson();

      // User talabi: legacy/migrated/merged/skipped/orphan/duplicate/
      // integrity/date/status-method/uniqueness.
      expect(json['totalRecords'], 5);
      expect(json['mergedGroups'], 1);
      expect(json['legacyFlaggedRecords'], 2);
      expect(json['backfilledRecords'], 1);
      expect(json['orphanReferences'], 1);
      expect(json['skippedInvalid'], 1);
      expect(json['duplicatesAfter'], 0);
      expect(json['integrityFailures'], 0);
      expect(json['dateIntegrityFailures'], 0);
      expect(json['statusMappingIssues'], 0);
      expect(json['methodMappingIssues'], 0);
      expect(json['verificationPassed'], isTrue);
    });

    test('verification: noto\'g\'ri status mapping — verificationPassed=false', () {
      final report = AttendanceMigrationReport();
      final weird = AttendanceRecord()
        ..id = 1
        ..identityId = 'M-EDU-2026-000001'
        ..timestamp = DateTime(2026, 7, 1, 9)
        ..fullName = 'Ali'
        ..role = 'student'
        ..method = 'face'
        ..status = 'unknown-status'; // §13 ro'yxatiga kirmaydi.

      AttendanceMergePlan.verify([weird], report);

      expect(report.statusMappingIssues, 1);
      expect(report.verificationPassed, isFalse);
    });

    test('verification: checkOut < checkIn — integrity buzilishi', () {
      final report = AttendanceMigrationReport();
      final broken = AttendanceRecord()
        ..id = 2
        ..identityId = 'M-EDU-2026-000001'
        ..timestamp = DateTime(2026, 7, 1, 9)
        ..attendanceDate = DateTime(2026, 7, 1)
        ..checkInAt = DateTime(2026, 7, 1, 12)
        ..checkOutAt = DateTime(2026, 7, 1, 10) // erta chiqish — xato.
        ..fullName = 'Ali'
        ..role = 'student'
        ..method = 'qr'
        ..status = 'present';

      AttendanceMergePlan.verify([broken], report);

      expect(report.integrityFailures, 1);
      expect(report.verificationPassed, isFalse);
    });

    test('verification: noto\'g\'ri method — methodMappingIssues', () {
      final report = AttendanceMigrationReport();
      final weird = AttendanceRecord()
        ..id = 3
        ..identityId = 'M-EDU-2026-000001'
        ..timestamp = DateTime(2026, 7, 1, 9)
        ..fullName = 'Ali'
        ..role = 'student'
        ..method = 'rfid'; // faqat face|qr|manual ruxsat etilgan.

      AttendanceMergePlan.verify([weird], report);

      expect(report.methodMappingIssues, 1);
      expect(report.verificationPassed, isFalse);
    });

    test('summary o\'qiladigan xulosa beradi', () {
      final report = AttendanceMigrationReport()
        ..totalRecords = 3
        ..mergedGroups = 1
        ..legacyFlaggedRecords = 2
        ..backupPath = '/tmp/backups/m_edu_attendance_v1_backup.json';

      final summary = report.summary;

      expect(summary, contains('✅'));
      expect(summary, contains('3 yozuv'));
      expect(summary, contains('Backup: /tmp/backups'));
    });

    test('failed — verificationPassed=false va summary ❌', () {
      final report = AttendanceMigrationReport()
        ..failed = true
        ..error = 'writeTxn failed';

      expect(report.verificationPassed, isFalse);
      expect(report.summary, contains('❌'));
      expect(report.summary, contains('FAILED: writeTxn failed'));
    });
  });
}
