import 'package:isar/isar.dart';

import '../models/settings_record.dart';
import '../models/user_record.dart';
import '../models/subject_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarSettingsDataSource {
  final Isar _db;

  IsarSettingsDataSource(this._db);

  /// Isar instance — to'liq baza zaxirasi (backup) uchun.
  Isar get db => _db;

  // ==================== Settings ====================

  Future<SettingsRecord> getSettings() async {
    final records = await _db.settingsRecords.where().findAll();
    if (records.isEmpty) {
      // Default settings yaratish.
      final defaultSettings = SettingsRecord()
        ..language = 'uz'
        ..themeMode = 'system'
        ..notificationsEnabled = true
        ..pushEnabled = true
        ..smsEnabled = false
        ..telegramEnabled = false
        ..paperSize = 'A4'
        ..autoBackupEnabled = false
        ..backupIntervalDays = 7
        ..glassIntensity = 80
        ..hikvisionEnabled = false
        ..hikvisionPort = 554
        ..hikvisionChannel = 1
        ..autoMarkAttendance = true
        ..scanIntervalMs = 1200
        ..matchThreshold = 0.92
        ..ambiguousThreshold = 0.88;
      await _db.writeTxn(() => _db.settingsRecords.put(defaultSettings));
      return defaultSettings;
    }
    return records.first;
  }

  Future<SettingsRecord> saveSettings(SettingsRecord record) async {
    return _db.writeTxn(() async {
      await _db.settingsRecords.put(record);
      return record;
    });
  }

  // ==================== Users ====================

  Future<UserRecord> addUser(UserRecord record) async {
    return _db.writeTxn(() async {
      // Upsert: mavjud userId bo'lsa — id saqlanib REPLACE qilinadi
      // (`userId` unique indeksi buzilmasligi uchun). Yangi bo'lsa — insert.
      final existing = await _db.userRecords
          .filter()
          .userIdEqualTo(record.userId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.userRecords.put(record);
      return record;
    });
  }

  Future<UserRecord?> findUserById(String userId) {
    return _db.userRecords.filter().userIdEqualTo(userId).findFirst();
  }

  Future<List<UserRecord>> findAllUsers() {
    return _db.userRecords.where().findAll();
  }

  Future<void> deleteUser(String userId) async {
    await _db.writeTxn(() async {
      final user = await findUserById(userId);
      if (user != null) {
        await _db.userRecords.delete(user.id);
      }
    });
  }

  // ==================== Subjects ====================

  Future<SubjectRecord> addSubject(SubjectRecord record) async {
    return _db.writeTxn(() async {
      // Upsert: mavjud subjectId bo'lsa — id saqlanib REPLACE qilinadi
      // (`subjectId` unique indeksi buzilmasligi uchun).
      final existing = await _db.subjectRecords
          .filter()
          .subjectIdEqualTo(record.subjectId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.subjectRecords.put(record);
      return record;
    });
  }

  Future<SubjectRecord?> findSubjectById(String subjectId) {
    return _db.subjectRecords
        .filter()
        .subjectIdEqualTo(subjectId)
        .findFirst();
  }

  Future<List<SubjectRecord>> findAllSubjects() {
    return _db.subjectRecords.where().findAll();
  }

  Future<void> deleteSubject(String subjectId) async {
    await _db.writeTxn(() async {
      final subject = await findSubjectById(subjectId);
      if (subject != null) {
        await _db.subjectRecords.delete(subject.id);
      }
    });
  }
}
