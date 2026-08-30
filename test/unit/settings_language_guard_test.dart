import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/database/app_database.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/settings/application/commands/update_settings_command.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/domain/repositories/settings_repository.dart';
import 'package:m_edu/features/settings/infrastructure/datasources/isar_settings_datasource.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/settings/infrastructure/repositories_impl/settings_repository_impl.dart';
import 'package:m_edu/features/settings/infrastructure/services/secure_settings_store.dart';

/// Phase 4 — "uz default" kafolati testlari.
///
/// Sabab: real device'da restartdan keyin rus tiliga o'tish kuzatildi —
/// legacy/avvalgi install data'si settings'da language'ni buzishi mumkin.
/// Kafolat: o'qishda noto'g'ri qiymat 'uz'ga normallashtiriladi,
/// yozishda esa faqat uz/ru/en qabul qilinadi.
void main() {
  group('UpdateSettingsCommand — til validatsiyasi (write boundary)', () {
    final cmd = UpdateSettingsCommand(
      repository: _RecordingSettingsRepository(),
      actorRole: UserRole.admin,
    );

    test("'uz'/'ru'/'en' qabul qilinadi", () async {
      for (final lang in ['uz', 'ru', 'en']) {
        final saved = await cmd.execute(
          const AppSettings().copyWith(language: lang),
        );
        expect(saved.language, lang);
      }
    });

    test("noto'g'ri til ('kz', '', 'uz-Latn') rad etiladi", () async {
      for (final bad in ['kz', '', 'uz-Latn', 'ru-RU']) {
        expect(
          () => cmd.execute(const AppSettings().copyWith(language: bad)),
          throwsA(isA<ValidationFailure>()),
          reason: "language='$bad' rad etilishi kerak",
        );
      }
    });
  });

  group('SettingsRepositoryImpl — o\'qishda normallashtirish (read boundary)',
      () {
    late Directory tempDir;
    var dbCounter = 0;

    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
      tempDir = Directory.systemTemp.createTempSync('m_edu_settings_test');
    });

    tearDown(() {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    Future<(AppDatabase, SettingsRepositoryImpl, SecureSettingsStore)> build(
      String language, {
      String? legacyHikvisionPassword,
    }) async {
      final db = await AppDatabase.open(
        schemas: [
          SettingsRecordSchema,
          UserRecordSchema,
          SubjectRecordSchema,
        ],
        name: 'm_edu_settings_${dbCounter++}',
        directory: tempDir.path,
      );
      // Legacy/buzilgan til bilan record yozamiz (transaction ichida).
      await db.instance.writeTxn(() async {
        await db.instance.settingsRecords.put(
              SettingsRecord()
                ..id = 1
                ..language = language
                ..themeMode = 'system'
                ..notificationsEnabled = true
                ..pushEnabled = true
                ..smsEnabled = false
                ..telegramEnabled = false
                ..paperSize = 'A4'
                ..autoBackupEnabled = false
                ..backupIntervalDays = 7
                ..glassIntensity = 80,
            );
      });
      final store = SecureSettingsStore();
      final repo = SettingsRepositoryImpl(
        IsarSettingsDataSource(db.instance),
        store,
      );
      if (legacyHikvisionPassword != null) {
        await db.instance.writeTxn(() async {
          await db.instance.settingsRecords.put(
                SettingsRecord()
                  ..id = 1
                  ..language = language
                  ..themeMode = 'system'
                  ..notificationsEnabled = true
                  ..pushEnabled = true
                  ..smsEnabled = false
                  ..telegramEnabled = false
                  ..paperSize = 'A4'
                  ..autoBackupEnabled = false
                  ..backupIntervalDays = 7
                  ..glassIntensity = 80
                  ..hikvisionPassword = legacyHikvisionPassword,
              );
        });
      }
      return (db, repo, store);
    }

    test('noto\'g\'ri legacy til (\'kz\') o\'qishda \'uz\'ga tuzatiladi',
        () async {
      final (db, repo, _) = await build('kz');

      final settings = await repo.getSettings();
      expect(settings.language, 'uz');

      // Tuzatish DB'ga ham yozilgan — qayta o'qishda ham 'uz'.
      final again = await repo.getSettings();
      expect(again.language, 'uz');
      await db.close();
    });

    test("to'g'ri til ('ru' — foydalanuvchi tanlovi) buzilmaydi", () async {
      final (db, repo, _) = await build('ru');

      final settings = await repo.getSettings();
      expect(settings.language, 'ru');
      await db.close();
    });

    test(
        'interaksiya (review #3): noto\'g\'ri til + legacy parol — til \'uz\'ga '
        'tuzatiladi VA parol secure storage\'ga ko\'chadi (yo\'qolmaydi)',
        () async {
      final (db, repo, store) =
          await build('kz', legacyHikvisionPassword: 'legacy-pass');

      final settings = await repo.getSettings();
      expect(settings.language, 'uz');
      // Legacy parol migratsiya orqali secure storage'ga ko'chgan — o'qiladi.
      expect(settings.hikvisionPassword, 'legacy-pass');
      expect(await store.readHikvisionPassword(), 'legacy-pass');

      // Isar'dagi plaintext tozalangan (sekret endi faqat xavfsiz omborda).
      final record =
          await IsarSettingsDataSource(db.instance).getSettings();
      expect(record.hikvisionPassword, isNull);
      await db.close();
    });
  });
}

/// Command testlari uchun recording fake repository.
class _RecordingSettingsRepository implements SettingsRepository {
  AppSettings? lastSaved;

  @override
  Future<AppSettings> getSettings() async => const AppSettings();

  @override
  Future<AppSettings> saveSettings(AppSettings settings) async {
    lastSaved = settings;
    return settings;
  }

  @override
  Future<String> createBackup() async => '/tmp/test_backup.json';

  @override
  Future<void> restoreBackup(String backupPath) async {}

  @override
  Future<List<AppUser>> fetchUsers() async => const [];

  @override
  Future<AppUser> addUser(AppUser user) async => user;

  @override
  Future<AppUser> updateUser(AppUser user) async => user;

  @override
  Future<void> deleteUser(String userId) async {}

  @override
  Future<List<Subject>> fetchSubjects() async => const [];

  @override
  Future<Subject> addSubject(Subject subject) async => subject;

  @override
  Future<Subject> updateSubject(Subject subject) async => subject;

  @override
  Future<void> deleteSubject(String subjectId) async {}

  @override
  Future<bool> isBiometricEnabled() async => false;

  @override
  Future<void> setBiometricEnabled(bool enabled) async {}
}
