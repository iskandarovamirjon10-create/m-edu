import 'dart:convert';
import 'dart:io';

import '../../../../core/services/app_logger.dart';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

import '../../../identity/infrastructure/models/identity_record.dart';
import '../models/attendance_record.dart';
import 'attendance_merge_plan.dart';
import 'attendance_migration_report.dart';

/// Attendance V1 → V2 schema migration (spec §37, §14).
///
/// NIMA QILADI (user tasdiqlagan reja):
/// 1. BACKUP — o'zgarishdan OLDIN attendance to'plamini JSON snapshot
///    sifatida `backups/` papkasiga yozadi (Isar `Query.exportJson` —
///    izchil snapshot). `importJson` orqali tiklash mumkin.
/// 2. PLAN — [AttendanceMergePlan.compute] (pure, idempotent).
/// 3. APPLY — bitta writeTxn'da qo'llaydi.
/// 4. VERIFY — [AttendanceMergePlan.verify] (10 band, §user talabi).
/// 5. REPORT — hisobot faylga yoziladi + debugPrint bilan loglanadi.
///
/// XAVFSIZLIK: legacy yozuvlar FIZIK O'CHIRILMAYDI (`isLegacyMerged`).
/// Migration muvaffaqiyatsiz bo'lsa ham app ishlashda davom etadi —
/// eski yozuvlar yangi entitet orqali (timestamp'dan derivation) o'qiladi.
class AttendanceSchemaV2Migration {
  static const String backupDirName = 'backups';
  static const String _backupPrefix = 'm_edu_attendance_v1_backup';
  static const String _reportPrefix = 'm_edu_attendance_v2_report';

  /// Migrationni bajaradi va hisobot qaytaradi. Hech qachon rethrow
  /// qilmaydi — xatolik report'ga yoziladi (app bloklanmaydi, §63/§66).
  static Future<AttendanceMigrationReport> run(
    Isar db, {
    String? backupDirectory,
    bool createBackup = true,
  }) async {
    final report = AttendanceMigrationReport()..startedAt = DateTime.now();

    try {
      final dir =
          backupDirectory ?? (await getApplicationSupportDirectory()).path;

      if (createBackup) {
        report.backupPath = await _backupAttendance(db, dir);
      }

      final all = await db.attendanceRecords.where().findAll();
      if (all.isEmpty) {
        report.finishedAt = DateTime.now();
        await _writeReport(report, dir);
        return report;
      }

      // Early-exit: hamma yozuv allaqachon migratsiya qilingan bo'lsa
      // (isLegacyMerged non-null), qayta ishlash shart emas — har bir
      // launcher'da group+sort+putAll qilish keraksiz yuk (spec §95/§96,
      // 1000+ yozuvda sezilarli). Report fayli ham spamm qilinmaydi.
      if (all.every((r) => r.isLegacyMerged != null)) {
        report.finishedAt = DateTime.now();
        AppLogger.info(
          'Attendance V2 migration: already completed '
          '(${all.length} records) — skipped',
        );
        return report;
      }

      // Orphan tekshiruvi uchun mavjud identity ID'lari.
      final validIdentityIds = (await db.identityRecords.where().findAll())
          .map((i) => i.identityId)
          .toSet();

      final plan = AttendanceMergePlan.compute(
        all,
        validIdentityIds: validIdentityIds,
      );

      if (plan.recordsToWrite.isNotEmpty) {
        await db.writeTxn(
          () => db.attendanceRecords.putAll(plan.recordsToWrite),
        );
      }

      // Qayta o'qib, yakuniy holatni tekshiramiz.
      final finalRecords = await db.attendanceRecords.where().findAll();
      AttendanceMergePlan.verify(finalRecords, plan.report);

      plan.report.backupPath = report.backupPath;
      plan.report.finishedAt = DateTime.now();
      await _writeReport(plan.report, dir);
      return plan.report;
    } catch (error) {
      report.failed = true;
      report.error = '$error';
      report.finishedAt = DateTime.now();
      AppLogger.error('Attendance V2 migration FAILED: ${error.runtimeType}');
      try {
        await _writeReport(report,
            backupDirectory ?? (await getApplicationSupportDirectory()).path);
      } catch (_) {
        // Hisobot faylga yozilmasa ham xato allaqachon log qilingan.
      }
      return report;
    }
  }

  /// Attendance to'plamini izchil JSON snapshot sifatida zaxiralaydi.
  static Future<String> _backupAttendance(Isar db, String dir) async {
    final backupsDir = Directory('$dir/$backupDirName');
    if (!await backupsDir.exists()) {
      await backupsDir.create(recursive: true);
    }
    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
    final path = '${backupsDir.path}/$_backupPrefix-$timestamp.json';

    final snapshot = await db.attendanceRecords.where().exportJson();
    await File(path).writeAsString(jsonEncode(snapshot));
    return path;
  }

  static Future<void> _writeReport(
    AttendanceMigrationReport report,
    String dir,
  ) async {
    final backupsDir = Directory('$dir/$backupDirName');
    if (!await backupsDir.exists()) {
      await backupsDir.create(recursive: true);
    }
    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
    final path = '${backupsDir.path}/$_reportPrefix-$timestamp.json';
    await File(path).writeAsString(jsonEncode(report.toJson()));
    AppLogger.info('Attendance V2 migration: ${report.summary}');
  }
}
