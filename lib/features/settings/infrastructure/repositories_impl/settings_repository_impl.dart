import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/app_settings.dart';
import '../../domain/repositories/settings_repository.dart';
import '../datasources/isar_settings_datasource.dart';
import '../models/settings_record.dart';
import '../models/user_record.dart';
import '../models/subject_record.dart';
import '../services/database_backup_service.dart';
import '../services/secure_settings_store.dart';

/// `SettingsRepository` interfeysining Isar asosidagi implementatsiyasi.
///
/// H-06: Hikvision paroli va Telegram bot tokeni Isar'da EMAS —
/// [SecureSettingsStore] (flutter_secure_storage) da saqlanadi. Isar'dagi
/// eski plaintext qiymatlar birinchi o'qishda avtomatik ko'chiriladi va
/// tozalanadi.
class SettingsRepositoryImpl implements SettingsRepository {
  final IsarSettingsDataSource _datasource;
  final SecureSettingsStore _secureStore;
  final DatabaseBackupService? _backupService;

  SettingsRepositoryImpl(
    this._datasource,
    this._secureStore, {
    DatabaseBackupService? backupService,
  }) : _backupService = backupService;

  @override
  Future<AppSettings> getSettings() async {
    var record = await _datasource.getSettings();

    // 0) Til normallashtirish (Phase 4 — "uz default" kafolati):
    //    Legacy/buzilgan/noto'g'ri language qiymati bo'lsa 'uz'ga qaytariladi.
    //    Faqat uz/ru/en qabul qilinadi — qolgan hamma narsa default 'uz'.
    //    (Yozish chegarasida ham xuddi shu qoida UpdateSettingsCommand'da.)
    if (!AppSettings.supportedLanguages.contains(record.language)) {
      record.language = 'uz';
      await _datasource.saveSettings(record);
    }

    // 1) Maxfiy qiymatlarni xavfsiz ombordan o'qish.
    var hikvisionPassword = await _secureStore.readHikvisionPassword();
    var telegramBotToken = await _secureStore.readTelegramBotToken();

    // 2) Bir martalik migratsiya: Isar'da qolgan eski plaintext qiymatlar
    //    bo'lsa — secure storage'ga ko'chirib, Isar'dan tozalaymiz.
    var migrated = false;
    if (hikvisionPassword == null &&
        record.hikvisionPassword != null &&
        record.hikvisionPassword!.isNotEmpty) {
      hikvisionPassword = record.hikvisionPassword;
      await _secureStore.writeHikvisionPassword(hikvisionPassword);
      record.hikvisionPassword = null;
      migrated = true;
    }
    if (telegramBotToken == null &&
        record.telegramBotToken != null &&
        record.telegramBotToken!.isNotEmpty) {
      telegramBotToken = record.telegramBotToken;
      await _secureStore.writeTelegramBotToken(telegramBotToken);
      record.telegramBotToken = null;
      migrated = true;
    }
    if (migrated) {
      await _datasource.saveSettings(record);
    }

    return _toSettingsEntity(
      record,
      hikvisionPassword: hikvisionPassword,
      telegramBotToken: telegramBotToken,
    );
  }

  @override
  Future<AppSettings> saveSettings(AppSettings settings) async {
    // Maxfiy qiymatlar secure storage'ga, Isar'ga esa faqat no-mohiy.
    await _secureStore.writeHikvisionPassword(settings.hikvisionPassword);
    await _secureStore.writeTelegramBotToken(settings.telegramBotToken);

    final record = _toSettingsRecord(settings);
    record.hikvisionPassword = null;
    record.telegramBotToken = null;
    final saved = await _datasource.saveSettings(record);

    return _toSettingsEntity(
      saved,
      hikvisionPassword: settings.hikvisionPassword,
      telegramBotToken: settings.telegramBotToken,
    );
  }

  @override
  Future<List<AppUser>> fetchUsers() async {
    final records = await _datasource.findAllUsers();
    return records.map(_toUserEntity).toList();
  }

  @override
  Future<AppUser> addUser(AppUser user) async {
    final record = _toUserRecord(user);
    final saved = await _datasource.addUser(record);
    return _toUserEntity(saved);
  }

  @override
  Future<AppUser> updateUser(AppUser user) async {
    final record = _toUserRecord(user);
    final saved = await _datasource.addUser(record);
    return _toUserEntity(saved);
  }

  @override
  Future<void> deleteUser(String userId) {
    return _datasource.deleteUser(userId);
  }

  @override
  Future<List<Subject>> fetchSubjects() async {
    final records = await _datasource.findAllSubjects();
    return records.map(_toSubjectEntity).toList();
  }

  @override
  Future<Subject> addSubject(Subject subject) async {
    final record = _toSubjectRecord(subject);
    final saved = await _datasource.addSubject(record);
    return _toSubjectEntity(saved);
  }

  @override
  Future<Subject> updateSubject(Subject subject) async {
    final record = _toSubjectRecord(subject);
    final saved = await _datasource.addSubject(record);
    return _toSubjectEntity(saved);
  }

  @override
  Future<void> deleteSubject(String subjectId) {
    return _datasource.deleteSubject(subjectId);
  }

  @override
  Future<String> createBackup() async {
    final service = _backupService ??
        DatabaseBackupService(_datasource.db);
    return service.createBackup();
  }

  @override
  Future<void> restoreBackup(String backupPath) async {
    final service = _backupService ??
        DatabaseBackupService(_datasource.db);
    await service.restoreBackup(backupPath);
  }

  @override
  Future<bool> isBiometricEnabled() => _secureStore.isBiometricEnabled();

  @override
  Future<void> setBiometricEnabled(bool enabled) =>
      _secureStore.setBiometricEnabled(enabled);

  // ==================== Settings Mapping ====================

  SettingsRecord _toSettingsRecord(AppSettings settings) {
    return SettingsRecord()
      ..id = 1
      ..language = settings.language
      ..themeMode = settings.themeMode.name
      ..notificationsEnabled = settings.notificationsEnabled
      ..pushEnabled = settings.pushEnabled
      ..smsEnabled = settings.smsEnabled
      ..telegramEnabled = settings.telegramEnabled
      ..printerName = settings.printerName
      ..paperSize = settings.paperSize
      ..autoBackupEnabled = settings.autoBackupEnabled
      ..backupIntervalDays = settings.backupIntervalDays
      ..lastBackupDate = settings.lastBackupDate
      ..glassIntensity = settings.glassIntensity
      ..hikvisionEnabled = settings.hikvisionEnabled
      ..hikvisionIp = settings.hikvisionIp
      ..hikvisionPort = settings.hikvisionPort
      ..hikvisionUsername = settings.hikvisionUsername
      ..hikvisionPassword = settings.hikvisionPassword
      ..hikvisionChannel = settings.hikvisionChannel
      ..hikvisionRtspPath = settings.hikvisionRtspPath
      ..autoMarkAttendance = settings.autoMarkAttendance
      ..scanIntervalMs = settings.scanIntervalMs
      ..matchThreshold = settings.matchThreshold
      ..ambiguousThreshold = settings.ambiguousThreshold
      ..telegramBotToken = settings.telegramBotToken
      ..sendMonthlyReport = settings.sendMonthlyReport
      ..lastMonthlyReportSent = settings.lastMonthlyReportSent
      ..syncVersion = settings.syncVersion;
  }

  AppSettings _toSettingsEntity(
    SettingsRecord record, {
    String? hikvisionPassword,
    String? telegramBotToken,
  }) {
    return AppSettings(
      language: record.language,
      // Corrupt/legacy themeMode → system (settings singleton o'chib
      // qolmasligi uchun — spec §7). `byName` exception tashlagan bo'lardi.
      themeMode:
          tryEnumByName(AppThemeMode.values, record.themeMode) ??
              AppThemeMode.system,
      notificationsEnabled: record.notificationsEnabled,
      pushEnabled: record.pushEnabled,
      smsEnabled: record.smsEnabled,
      telegramEnabled: record.telegramEnabled,
      printerName: record.printerName,
      paperSize: record.paperSize,
      autoBackupEnabled: record.autoBackupEnabled,
      backupIntervalDays: record.backupIntervalDays,
      lastBackupDate: record.lastBackupDate,
      glassIntensity: record.glassIntensity,
      hikvisionEnabled: record.hikvisionEnabled,
      hikvisionIp: record.hikvisionIp,
      hikvisionPort: record.hikvisionPort,
      hikvisionUsername: record.hikvisionUsername,
      hikvisionPassword:
          hikvisionPassword ?? record.hikvisionPassword,
      hikvisionChannel: record.hikvisionChannel,
      hikvisionRtspPath: record.hikvisionRtspPath,
      autoMarkAttendance: record.autoMarkAttendance,
      scanIntervalMs: record.scanIntervalMs,
      matchThreshold: record.matchThreshold,
      ambiguousThreshold: record.ambiguousThreshold,
      telegramBotToken: telegramBotToken ?? record.telegramBotToken,
      sendMonthlyReport: record.sendMonthlyReport,
      lastMonthlyReportSent: record.lastMonthlyReportSent,
      syncVersion: record.syncVersion,
    );
  }

  // ==================== User Mapping ====================

  UserRecord _toUserRecord(AppUser user) {
    return UserRecord()
      ..userId = user.userId
      ..identityId = user.identityId
      ..email = user.email
      ..role = user.role.name
      ..isActive = user.isActive
      ..createdAt = user.createdAt
      ..lastLoginAt = user.lastLoginAt;
  }

  AppUser _toUserEntity(UserRecord record) {
    return AppUser(
      userId: record.userId,
      identityId: record.identityId,
      email: record.email,
      // AUDIT P2-03: byName('super_admin') exception tashlaydi —
      // wire format'dan xavfsiz o'giramiz (noma'lum → unknown).
      role: UserRole.fromWire(record.role),
      isActive: record.isActive,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
    );
  }

  // ==================== Subject Mapping ====================

  SubjectRecord _toSubjectRecord(Subject subject) {
    return SubjectRecord()
      ..subjectId = subject.subjectId
      ..name = subject.name
      ..code = subject.code
      ..color = subject.color
      ..isActive = subject.isActive;
  }

  Subject _toSubjectEntity(SubjectRecord record) {
    return Subject(
      subjectId: record.subjectId,
      name: record.name,
      code: record.code,
      color: record.color,
      isActive: record.isActive,
    );
  }
}
