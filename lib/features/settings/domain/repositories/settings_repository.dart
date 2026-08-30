import '../entities/app_settings.dart';

/// Sozlamalar ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class SettingsRepository {
  /// Ilova sozlamalarini qaytaradi.
  Future<AppSettings> getSettings();

  /// Ilova sozlamalarini saqlaydi.
  Future<AppSettings> saveSettings(AppSettings settings);

  /// Foydalanuvchilar ro'yxatini qaytaradi.
  Future<List<AppUser>> fetchUsers();

  /// Yangi foydalanuvchi qo'shadi.
  Future<AppUser> addUser(AppUser user);

  /// Foydalanuvchini yangilaydi.
  Future<AppUser> updateUser(AppUser user);

  /// Foydalanuvchini o'chiradi.
  Future<void> deleteUser(String userId);

  /// Fanlar ro'yxatini qaytaradi.
  Future<List<Subject>> fetchSubjects();

  /// Yangi fan qo'shadi.
  Future<Subject> addSubject(Subject subject);

  /// Fanni yangilaydi.
  Future<Subject> updateSubject(Subject subject);

  /// Fanni o'chiradi.
  Future<void> deleteSubject(String subjectId);

  /// Zaxira nusxalash.
  Future<String> createBackup();

  /// Zaxiradan qayta tiklash.
  Future<void> restoreBackup(String backupPath);

  /// Biometrik kirish yoqilganmi?
  Future<bool> isBiometricEnabled();

  /// Biometrik kirishni yoqish/o'chirish.
  Future<void> setBiometricEnabled(bool enabled);
}
