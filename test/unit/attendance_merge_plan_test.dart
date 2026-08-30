import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/attendance/infrastructure/migrations/attendance_merge_plan.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';

/// §14 merge qoidalari — [AttendanceMergePlan] pure yadrosi (Isar'siz).
void main() {
  group('AttendanceMergePlan.compute', () {
    test('dublikatlar bitta primary yozuvga birlashadi (face+qr+manual)', () {
      final day = DateTime(2026, 7, 1);
      final face = _record(1, 'M-EDU-2026-000001', day, 9);
      final qr = _record(2, 'M-EDU-2026-000001', day, 9, minute: 10, method: 'qr');
      final manual =
          _record(3, 'M-EDU-2026-000001', day, 9, minute: 20, method: 'manual');

      final plan = AttendanceMergePlan.compute([face, qr, manual]);

      expect(plan.report.totalRecords, 3);
      expect(plan.report.mergedGroups, 1);
      expect(plan.report.legacyFlaggedRecords, 2);
      expect(plan.report.duplicatesAfter, 0);
      expect(plan.report.verificationPassed, isTrue);

      final primary = plan.recordsToWrite.firstWhere((r) => r.id == 1);
      final qrLegacy = plan.recordsToWrite.firstWhere((r) => r.id == 2);
      final manualLegacy = plan.recordsToWrite.firstWhere((r) => r.id == 3);

      // Primary: eng erta = checkIn, eng kech = checkOut.
      expect(primary.checkInAt, DateTime(day.year, day.month, day.day, 9));
      expect(primary.checkOutAt, DateTime(day.year, day.month, day.day, 9, 20));
      expect(primary.method, 'face'); // check-in usuli saqlanadi.

      // Legacy: fizik o'chirilmaydi, faqat belgilanadi.
      expect(qrLegacy.isLegacyMerged, isTrue);
      expect(manualLegacy.isLegacyMerged, isTrue);
      expect(qrLegacy.mergedIntoId, 1);
      expect(manualLegacy.mergedIntoId, 1);
    });

    test('bitta yozuv — backfill (attendanceDate, checkInAt, status)', () {
      final single = AttendanceRecord()
        ..id = 10
        ..identityId = 'M-EDU-2026-000002'
        ..timestamp = DateTime(2026, 7, 2, 9, 30)
        ..fullName = 'Bek Karimov'
        ..role = 'student'
        ..method = 'qr';

      final plan = AttendanceMergePlan.compute([single]);

      expect(plan.report.singleRecordGroups, 1);
      expect(plan.report.backfilledRecords, 1);
      final result = plan.recordsToWrite.single;
      expect(result.attendanceDate, DateTime(2026, 7, 2));
      expect(result.checkInAt, DateTime(2026, 7, 2, 9, 30));
      expect(result.status, 'present');
      expect(result.isLegacyMerged, isFalse);
    });

    test('idempotent — qayta ishga tushirish natijani o\'zgartirmaydi', () {
      final day = DateTime(2026, 7, 3);
      final face = _record(20, 'M-EDU-2026-000003', day, 8);
      final qr = _record(21, 'M-EDU-2026-000003', day, 9, method: 'qr');

      final firstRun = AttendanceMergePlan.compute([face, qr]);

      // Birinchi ish natijasini ikkinchi ishga kirish sifatida ishlatamiz.
      final secondRun = AttendanceMergePlan.compute(firstRun.recordsToWrite);

      expect(secondRun.report.mergedGroups, 0);
      expect(secondRun.report.alreadyMergedGroups, 1);
      expect(secondRun.report.legacyFlaggedRecords, 0);
      // Natija o'zgarmadi: hali ham bitta primary + bitta legacy.
      final primary = secondRun.recordsToWrite.firstWhere((r) => r.id == 20);
      expect(primary.checkOutAt, DateTime(2026, 7, 3, 9));
      expect(primary.isLegacyMerged, isFalse);
    });

    test('turli studentlar/sanalar alohida guruh bo\'lib qoladi', () {
      final a1 = _record(30, 'M-EDU-2026-000001', DateTime(2026, 7, 1), 9);
      final a2 = _record(31, 'M-EDU-2026-000001', DateTime(2026, 7, 2), 9);
      final b1 = _record(32, 'M-EDU-2026-000002', DateTime(2026, 7, 1), 9,
          method: 'qr');

      final plan = AttendanceMergePlan.compute([a1, a2, b1]);

      expect(plan.report.totalGroups, 3);
      expect(plan.report.mergedGroups, 0);
      expect(plan.report.legacyFlaggedRecords, 0);
    });

    test('orphan reference hisobotga yoziladi (identity topilmasa)', () {
      final day = DateTime(2026, 7, 5);
      final orphan = _record(40, 'M-EDU-2026-999999', day, 9);

      final plan = AttendanceMergePlan.compute(
        [orphan],
        validIdentityIds: {'M-EDU-2026-000001'},
      );

      expect(plan.report.orphanReferences, 1);
      // Orphan yozuv o'chirilmaydi — faqat hisobot (user talabi).
      expect(plan.recordsToWrite, hasLength(1));
    });

    test('bo\'sh identityId — skippedInvalid hisobotga tushadi', () {
      final bad = AttendanceRecord()
        ..id = 50
        ..identityId = ''
        ..timestamp = DateTime(2026, 7, 5, 9)
        ..fullName = 'Noma\'lum'
        ..role = 'student'
        ..method = 'face';

      final plan = AttendanceMergePlan.compute([bad]);

      expect(plan.report.skippedInvalid, 1);
      expect(plan.recordsToWrite, isEmpty);
    });

    test('verify: mergedIntoId havolasi mavjud primary\'ga tegishli bo\'lmasa — inconsistency', () {
      final plan = AttendanceMergePlan.compute([]);
      final broken = AttendanceRecord()
        ..id = 60
        ..identityId = 'M-EDU-2026-000001'
        ..timestamp = DateTime(2026, 7, 6, 9)
        ..fullName = 'Ali'
        ..role = 'student'
        ..method = 'face'
        ..isLegacyMerged = true
        ..mergedIntoId = 999; // mavjud bo'lmagan primary.

      AttendanceMergePlan.verify([broken], plan.report);
      expect(plan.report.inconsistencies, 1);
      expect(plan.report.verificationPassed, isFalse);
    });
  });
}

AttendanceRecord _record(
  int id,
  String identityId,
  DateTime day,
  int hour, {
  int minute = 0,
  String method = 'face',
}) {
  return AttendanceRecord()
    ..id = id
    ..identityId = identityId
    ..timestamp = DateTime(day.year, day.month, day.day, hour, minute)
    ..fullName = 'Ism Familiya'
    ..role = 'student'
    ..method = method;
}
