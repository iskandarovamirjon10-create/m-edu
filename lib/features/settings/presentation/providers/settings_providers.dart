import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/local_auth_store.dart';
import '../../../../core/di/core_providers.dart';
import '../../../../core/theme/app_density.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/create_backup_command.dart';
import '../../application/commands/restore_backup_command.dart';
import '../../application/commands/update_settings_command.dart';
import '../../application/commands/user_management_commands.dart';
import '../../application/queries/settings_queries.dart';
import '../../domain/entities/app_settings.dart';
import '../../domain/repositories/settings_repository.dart';
import '../../infrastructure/datasources/isar_settings_datasource.dart';
import '../../infrastructure/repositories_impl/settings_repository_impl.dart';
import '../../infrastructure/services/secure_settings_store.dart';

/// Maxfiy sozlamalar ombori (secure storage) provider'i.
///
/// Hikvision paroli, Telegram tokeni, biometrik va tebranish sozlamalari
/// uchun umumiy provider — qayta yaratilmaydi (bir marta yaratiladi).
final secureSettingsStoreProvider =
    Provider<SecureSettingsStore>((ref) => SecureSettingsStore());

/// Settings repository provider.
final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return SettingsRepositoryImpl(
    IsarSettingsDataSource(db.instance),
    SecureSettingsStore(),
  );
});

/// Settings queries provider.
final settingsQueriesProvider = Provider<SettingsQueries>(
  (ref) => SettingsQueries(repository: ref.watch(settingsRepositoryProvider)),
);

/// Update settings command provider.
final updateSettingsCommandProvider = Provider<UpdateSettingsCommand>(
  (ref) => UpdateSettingsCommand(
    repository: ref.watch(settingsRepositoryProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Zaxira yaratish command'i (RBAC: manageBackup).
final createBackupCommandProvider = Provider<CreateBackupCommand>(
  (ref) => CreateBackupCommand(
    repository: ref.watch(settingsRepositoryProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Zaxira'dan tiklash command'i (RBAC: manageBackup).
final restoreBackupCommandProvider = Provider<RestoreBackupCommand>(
  (ref) => RestoreBackupCommand(
    repository: ref.watch(settingsRepositoryProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// USER MANAGEMENT command provider'lari (PHASE E).
/// Joriy aktor email'i self-guard'lar uchun uzatiladi.
final createUserCommandProvider = Provider<CreateUserCommand>(
  (ref) => CreateUserCommand(
    store: ref.watch(localAuthStoreProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
    actorEmail: ref.watch(currentUserProvider)?.email,
  ),
);

final updateUserCommandProvider = Provider<UpdateUserCommand>(
  (ref) => UpdateUserCommand(
    store: ref.watch(localAuthStoreProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
    actorEmail: ref.watch(currentUserProvider)?.email,
  ),
);

final changeUserStatusCommandProvider = Provider<ChangeUserStatusCommand>(
  (ref) => ChangeUserStatusCommand(
    store: ref.watch(localAuthStoreProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
    actorEmail: ref.watch(currentUserProvider)?.email,
  ),
);

final deleteUserCommandProvider = Provider<DeleteUserCommand>(
  (ref) => DeleteUserCommand(
    store: ref.watch(localAuthStoreProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
    actorEmail: ref.watch(currentUserProvider)?.email,
  ),
);

/// Ilova sozlamalari.
final appSettingsProvider = FutureProvider<AppSettings>((ref) {
  return ref.watch(settingsQueriesProvider).getSettings();
});

/// UI zichligi (Design System 4.0 §9) — secure storage'da saqlanadi.
///
/// Theme/Isar sxemasini o'zgartirmaydi; [AppDensityScope] orqali butun
/// app'ga uzatiladi. Settings'da tanlanganda `writeDensity` + `invalidate`
/// bilan yangilanadi.
final appDensityProvider = FutureProvider<AppDensity>((ref) async {
  final store = ref.watch(secureSettingsStoreProvider);
  final raw = await store.readDensity();
  return AppDensity.fromWire(raw);
});

/// Auth hisoblari ombori (login uchun yagona source of truth).
final localAuthStoreProvider = Provider<LocalAuthStore>((ref) {
  return LocalAuthStore();
});

/// Hisoblar versiyasi — user management amallaridan keyin oshiriladi.
final userAccountsVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha login hisoblari (USER MANAGEMENT — PHASE E).
///
/// `local_auth_store`'dagi haqiqiy auth hisoblari: email, ism, rol,
/// holat (active/suspended/archived), oxirgi kirish vaqti.
final userAccountsProvider = FutureProvider<List<LocalAccount>>((ref) {
  ref.watch(userAccountsVersionProvider);
  return ref.watch(localAuthStoreProvider).listAccounts();
});

/// Foydalanuvchilar ro'yxati.
final userListProvider = FutureProvider<List<AppUser>>((ref) {
  return ref.watch(settingsQueriesProvider).fetchUsers();
});

/// Fanlar ro'yxati.
final subjectListProvider = FutureProvider<List<Subject>>((ref) {
  return ref.watch(settingsQueriesProvider).fetchSubjects();
});
