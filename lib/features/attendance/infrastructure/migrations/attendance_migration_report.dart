/// Attendance V2 migration natijasi va verification hisoboti (spec §37).
///
/// Barcha ko'rsatkichlar user talab qilgan 10 band bo'yicha yig'iladi
/// (legacy/migrated/merged/skipped/orphan/duplicate/integrity/date/
/// status-method/uniqueness). Audit uchun JSON faylga yoziladi.
class AttendanceMigrationReport {
  bool failed = false;
  String? error;
  DateTime? startedAt;
  DateTime? finishedAt;
  String backupPath = '';

  // ── Plan ko'rsatkichlari ────────────────────────────────────────────
  int totalRecords = 0;
  int totalGroups = 0;
  int singleRecordGroups = 0;

  /// `attendanceDate`/`checkInAt`/`status` to'ldirilgan yozuvlar soni.
  int backfilledRecords = 0;

  /// Dublikatlar birlashtirilgan guruhlar soni.
  int mergedGroups = 0;

  /// `isLegacyMerged = true` qilingan (fizik o'chirilmagan) yozuvlar soni.
  int legacyFlaggedRecords = 0;

  /// Idempotent: oldingi ishda birlashtirilgan guruhlar (qayta ishga
  /// tushirilganda natija o'zgarmaydi).
  int alreadyMergedGroups = 0;

  /// Mantiqiy buzilishlar (primary legacy flag qilingan, yaroqsiz havola).
  int inconsistencies = 0;

  /// Identity'ga tegishli bo'lmagan identityId'li yozuvlar (o'chirilmaydi,
  /// faqat hisobot).
  int orphanReferences = 0;

  /// identityId/timestamp yaroqsiz (bo'sh) yozuvlar.
  int skippedInvalid = 0;

  // ── Verification ko'rsatkichlari ─────────────────────────────────────
  /// Primary (identityId, sana) dublikatlari — 0 bo'lishi shart (§14).
  int duplicatesAfter = 0;

  /// checkOut < checkIn bo'lgan yozuvlar — 0 bo'lishi shart.
  int integrityFailures = 0;

  /// attendanceDate != sana(timestamp) — 0 bo'lishi shart.
  int dateIntegrityFailures = 0;

  /// §13 ga kirmagan status qiymatlari.
  int statusMappingIssues = 0;

  /// face|qr|manual dan tashqari method qiymatlari.
  int methodMappingIssues = 0;

  bool get verificationPassed =>
      !failed &&
      inconsistencies == 0 &&
      duplicatesAfter == 0 &&
      integrityFailures == 0 &&
      dateIntegrityFailures == 0 &&
      statusMappingIssues == 0 &&
      methodMappingIssues == 0;

  Map<String, dynamic> toJson() => {
        'failed': failed,
        'error': error,
        'startedAt': startedAt?.toIso8601String(),
        'finishedAt': finishedAt?.toIso8601String(),
        'backupPath': backupPath,
        'totalRecords': totalRecords,
        'totalGroups': totalGroups,
        'singleRecordGroups': singleRecordGroups,
        'backfilledRecords': backfilledRecords,
        'mergedGroups': mergedGroups,
        'legacyFlaggedRecords': legacyFlaggedRecords,
        'alreadyMergedGroups': alreadyMergedGroups,
        'inconsistencies': inconsistencies,
        'orphanReferences': orphanReferences,
        'skippedInvalid': skippedInvalid,
        'duplicatesAfter': duplicatesAfter,
        'integrityFailures': integrityFailures,
        'dateIntegrityFailures': dateIntegrityFailures,
        'statusMappingIssues': statusMappingIssues,
        'methodMappingIssues': methodMappingIssues,
        'verificationPassed': verificationPassed,
      };

  /// Qisqa, o'qiladigan xulosa (log/UI uchun).
  String get summary {
    final state = verificationPassed ? '✅' : '❌';
    return '$state davomat V2 migration: '
        '$totalRecords yozuv / $totalGroups guruh, '
        '$mergedGroups guruh birlashtirildi, '
        '$legacyFlaggedRecords legacy yozuv belgilandi, '
        '$backfilledRecords backfill, '
        '$duplicatesAfter dublikat, '
        '$integrityFailures integrity, '
        '$orphanReferences orphan, '
        '$inconsistencies noaniqlik. '
        'Backup: $backupPath'
        '${failed ? ' | FAILED: $error' : ''}';
  }
}
