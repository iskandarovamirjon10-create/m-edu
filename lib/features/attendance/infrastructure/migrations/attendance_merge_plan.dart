import '../models/attendance_record.dart';
import 'attendance_migration_report.dart';

/// Attendance V1 → V2 merge rejasi (spec §14, user talablari).
///
/// TOZA FUNKSIYA (Isar'siz): [compute] barcha eski yozuvlarni
/// (identityId, sana) guruhlariga ajratib, qanday o'zgarish kerakligini
/// hisoblaydi; [verify] yakuniy holatni tekshiradi. Bu — to'liq unit
/// test qilinadigan yadro. `run` qatlami (Isar + fayl) faqat shu plan'ni
/// qo'llaydi.
///
/// QOIDALAR (idempotent, noaniqlikda taxmin yo'q):
/// - Har guruhda eng erta yozuv = primary; boshqalar legacy.
/// - checkIn = eng erta vaqt; checkOut = eng kech vaqt (agar farqli bo'lsa).
/// - Legacy yozuvlar FIZIK O'CHIRILMAYDI — `isLegacyMerged=true` va
///   `mergedIntoId=primary.id` bilan belgilanadi.
/// - Guruh allaqachon merge qilingan bo'lsa (legacy marker bor) — o'tkazib
///   yuboriladi (idempotent; qayta ishga tushirish natijani o'zgartirmaydi).
/// - Primary legacy belgilangan bo'lsa (buzilgan holat) — inconsistency,
///   taxmin qilinmaydi.
/// - Method mapping: primary (check-in) yozuvning usuli saqlanadi.
/// - Status mapping: `status` bo'sh bo'lsa `present` (§13 default).
class AttendanceMergePlan {
  /// Qo'llanilishi kerak bo'lgan yangilangan yozuvlar (primary + legacy).
  final List<AttendanceRecord> recordsToWrite;

  final AttendanceMigrationReport report;

  AttendanceMergePlan._(this.recordsToWrite, this.report);

  /// Barcha yozuvlardan merge rejasini hisoblaydi. `validIdentityIds`
  /// berilsa orphan (tegishli bo'lmagan identity) hisobotga yoziladi.
  factory AttendanceMergePlan.compute(
    List<AttendanceRecord> all, {
    Set<String>? validIdentityIds,
  }) {
    final report = AttendanceMigrationReport()..totalRecords = all.length;
    final writes = <AttendanceRecord>[];

    // (identityId, sana) bo'yicha guruhlash — sana timestamp'dan olinadi
    // (attendanceDate legacy yozuvlarda null bo'lishi mumkin).
    final groups = <String, List<AttendanceRecord>>{};
    for (final record in all) {
      if (record.identityId.isEmpty) {
        report.skippedInvalid++;
        continue;
      }
      final key = '${record.identityId}|${_dateKey(record.timestamp)}';
      groups.putIfAbsent(key, () => []).add(record);
    }
    report.totalGroups = groups.length;

    for (final group in groups.values) {
      group.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      final primary = group.first;

      if (validIdentityIds != null &&
          !validIdentityIds.contains(primary.identityId)) {
        report.orphanReferences++;
      }

      if (group.length == 1) {
        _backfill(primary, report);
        writes.add(primary);
        report.singleRecordGroups++;
        continue;
      }

      // Guruh allaqachon merge qilinganmi? (idempotentlik)
      if (group.any((r) => r.isLegacyMerged == true)) {
        if (primary.isLegacyMerged == true) {
          // Buzilgan holat: primary legacy bo'lishi mumkin emas — taxmin qilmaymiz.
          report.inconsistencies++;
        } else {
          report.alreadyMergedGroups++;
        }
        writes.addAll(group);
        continue;
      }

      // MERGE: primary = eng erta; checkOut = eng kech (agar farqli bo'lsa).
      _backfill(primary, report);
      final latest = group.last.timestamp;
      if (latest.isAfter(primary.timestamp)) {
        primary.checkOutAt = latest;
      }
      report.mergedGroups++;
      writes.add(primary);

      for (final legacy in group.skip(1)) {
        legacy.isLegacyMerged = true;
        legacy.mergedIntoId = primary.id;
        report.legacyFlaggedRecords++;
        writes.add(legacy);
      }
    }

    return AttendanceMergePlan._(writes, report);
  }

  /// Yakuniy holatni tekshiradi (user talab qilgan 10 band).
  static void verify(
    List<AttendanceRecord> records,
    AttendanceMigrationReport report,
  ) {
    const allowedStatus = {'present', 'late', 'absent', 'excused'};
    const allowedMethods = {'face', 'qr', 'manual'};

    final ids = records.map((r) => r.id).toSet();

    // 1) Uniqueness: primary (identityId, sana) dublikatlari.
    final primaryKeys = <String>{};
    for (final r in records) {
      if (r.isLegacyMerged == true) continue;
      final key = '${r.identityId}|${_dateKey(r.timestamp)}';
      if (!primaryKeys.add(key)) report.duplicatesAfter++;
    }

    for (final r in records) {
      if (r.isLegacyMerged == true) continue;

      // 2) checkIn/checkOut integrity.
      if (r.checkInAt != null &&
          r.checkOutAt != null &&
          r.checkOutAt!.isBefore(r.checkInAt!)) {
        report.integrityFailures++;
      }

      // 3) Date integrity: attendanceDate = sana(timestamp).
      final expectedDate = DateTime(
        r.timestamp.year,
        r.timestamp.month,
        r.timestamp.day,
      );
      if (r.attendanceDate != null && r.attendanceDate != expectedDate) {
        report.dateIntegrityFailures++;
      }

      // 4) Status/method mapping.
      if (r.status != null && !allowedStatus.contains(r.status)) {
        report.statusMappingIssues++;
      }
      if (!allowedMethods.contains(r.method)) {
        report.methodMappingIssues++;
      }
    }

    // 5) Legacy havola (mergedIntoId) mavjud primary'ga tegishli bo'lishi shart.
    for (final r in records) {
      if (r.isLegacyMerged == true &&
          r.mergedIntoId != null &&
          !ids.contains(r.mergedIntoId)) {
        report.inconsistencies++;
      }
    }
  }

  static void _backfill(AttendanceRecord record, AttendanceMigrationReport report) {
    if (record.attendanceDate != null) return;
    record.attendanceDate = DateTime(
      record.timestamp.year,
      record.timestamp.month,
      record.timestamp.day,
    );
    record.checkInAt ??= record.timestamp;
    record.status ??= 'present';
    // Non-legacy yozuvlar doim `false` bo'lsin — datasource filtrlari
    // `isLegacyMergedEqualTo(false)` bilan toza ishlaydi.
    record.isLegacyMerged ??= false;
    report.backfilledRecords++;
  }

  static String _dateKey(DateTime d) => '${d.year}-${d.month}-${d.day}';
}
