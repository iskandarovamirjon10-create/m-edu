import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/auth/google_auth_service.dart';
import 'package:m_edu/features/audit/application/services/audit_service.dart';
import 'package:m_edu/features/audit/domain/entities/audit_log_entry.dart';
import 'package:m_edu/features/audit/domain/repositories/audit_repository.dart';
import 'package:m_edu/features/audit/presentation/providers/audit_providers.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/auth/presentation/providers/google_auth_provider.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/domain/repositories/settings_repository.dart';
import 'package:m_edu/features/settings/presentation/pages/settings_page.dart';
import 'package:m_edu/features/settings/presentation/providers/settings_providers.dart';

/// Backup yaratish/tiklash — RBAC tekshiruvi (AUDIT P2-02: manageBackup).
///
/// Zaxira tiklash butun bazani almashtiradi (destructive) — shuning uchun
/// `AppPermission.manageBackup` ruxsatisiz bajarilmasligi kerak.
/// Ruxsat yo'q rol (teacher) → DENY + xabar; ruxsat bor rol (admin) → ALLOW.
///
/// `pumpAndSettle` ishlatilmaydi: SettingsPage'dagi `_SecuritySection`
/// biometrik mavjudligini tekshiradi (test muhitida channel javob
/// bermaydi) — cheksiz spinner animatsiyasi `pumpAndSettle`'ni to'xtatadi.
void main() {
  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  Widget buildApp(FakeSettingsRepository repo, String role) {
    return ProviderScope(
      overrides: [
        // actorRoleProvider authControllerProvider'ni kuzatadi — real
        // controller appStarted()'da disk/secure-storage'ga uriladi,
        // shuning uchun fake ishlatiladi.
        authControllerProvider.overrideWith((ref) => _FakeAuthController(role)),
        settingsRepositoryProvider.overrideWithValue(repo),
        // Audit service test muhitida Isar'ga urilmasligi uchun no-op.
        auditServiceProvider.overrideWithValue(AuditService(
          repository: _NoopAuditRepository(),
          actorLoader: () async => AuditActor.system,
        )),
        appSettingsProvider.overrideWith((ref) async => const AppSettings()),
        userListProvider.overrideWith((ref) async => const <AppUser>[]),
        subjectListProvider.overrideWith((ref) async => const <Subject>[]),
        googleAuthProvider.overrideWithValue(const _NoOpGoogleAuthService()),
        googleAuthControllerProvider.overrideWith((ref) => _FakeGoogleAuthController()),
      ],
      child: const MaterialApp(home: SettingsPage()),
    );
  }

  /// Async initState yuklashlarini (biometrik tekshiruv, secure store)
  /// kutish uchun bir nechta frame'ni pompalaydi.
  Future<void> pumpFrames(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  /// Backup bo'limi test oynasi (800x600) pastida bo'lishi mumkin —
  /// tap'dan oldin ko'rinadigan qilamiz.
  Future<void> tapVisible(WidgetTester tester, String text) async {
    final finder = find.text(text);
    await tester.ensureVisible(finder);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(finder);
    await pumpFrames(tester);
  }

  testWidgets(
      'teacher zaxira YARATA olmaydi — DENY, createBackup chaqirilmaydi',
      (tester) async {
    final repo = FakeSettingsRepository();
    await tester.pumpWidget(buildApp(repo, 'teacher'));
    await pumpFrames(tester);

    await tapVisible(tester, 'Zaxira yaratish');

    expect(repo.createBackupCalls, 0,
        reason: 'Ruxsatsiz rol zaxira yaratish amalini boshlamasligi kerak');
    expect(
      find.text('Bu amal uchun ruxsatingiz yetarli emas'),
      findsOneWidget,
    );

    // SnackBar avtomatik yopilish timer'ini tugatamiz (pending timer qolmaydi).
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets(
      "teacher zaxira'dan TIKLAY olmaydi — DENY, restoreBackup chaqirilmaydi",
      (tester) async {
    final repo = FakeSettingsRepository();
    await tester.pumpWidget(buildApp(repo, 'teacher'));
    await pumpFrames(tester);

    // Restore bosilganda faqat RBAC tekshiruvi bajarilishi kerak —
    // fayl ro'yxati/path_provider'ga ham yetib bormasligi kerak.
    await tapVisible(tester, "Zaxira'dan tiklash");

    expect(repo.restoreBackupCalls, 0,
        reason: 'Ruxsatsiz rol tiklash amalini boshlamasligi kerak');
    expect(
      find.text('Bu amal uchun ruxsatingiz yetarli emas'),
      findsOneWidget,
    );

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('admin zaxira YARATADI — ALLOW, createBackup chaqiriladi',
      (tester) async {
    final repo = FakeSettingsRepository();
    await tester.pumpWidget(buildApp(repo, 'admin'));
    await pumpFrames(tester);

    await tapVisible(tester, 'Zaxira yaratish');

    expect(repo.createBackupCalls, 1,
        reason: "manageBackup ruxsati bor rol zaxira yaratishi kerak");
    expect(
      find.text('Bu amal uchun ruxsatingiz yetarli emas'),
      findsNothing,
    );

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('unknown rol zaxira YARATA olmaydi — DENY (fail-closed)',
      (tester) async {
    final repo = FakeSettingsRepository();
    await tester.pumpWidget(buildApp(repo, 'unknown'));
    await pumpFrames(tester);

    await tapVisible(tester, 'Zaxira yaratish');

    expect(repo.createBackupCalls, 0);
    expect(
      find.text('Bu amal uchun ruxsatingiz yetarli emas'),
      findsOneWidget,
    );

    await tester.pump(const Duration(seconds: 5));
  });
}

/// Rol holatida turuvchi fake auth controller (RBAC uchun).
class _FakeAuthController extends AuthController {
  _FakeAuthController(String role) : super() {
    state = AuthStateAuthenticated(
      userId: 'test-user',
      role: role,
      name: 'Test User',
    );
  }
}

/// Settings repository fake'i — faqat backup amallarini hisoblaydi.
class FakeSettingsRepository implements SettingsRepository {
  int createBackupCalls = 0;
  int restoreBackupCalls = 0;

  @override
  Future<String> createBackup() async {
    createBackupCalls++;
    return '/tmp/m_edu_test_backup.json';
  }

  @override
  Future<void> restoreBackup(String backupPath) async {
    restoreBackupCalls++;
  }

  @override
  Future<AppSettings> getSettings() async => const AppSettings();

  @override
  Future<AppSettings> saveSettings(AppSettings settings) async => settings;

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

class _FakeGoogleAuthController extends GoogleAuthController {
  _FakeGoogleAuthController() : super(const _NoOpGoogleAuthService());
  @override
  Future<GoogleAuthResult> signIn() async => const GoogleAuthError(message: 'mock', code: 'TEST');
}

class _NoOpGoogleAuthService implements GoogleAuthService {
  const _NoOpGoogleAuthService();
  @override
  Future<GoogleAuthResult> signIn() async => const GoogleAuthError(message: 'mock', code: 'TEST');
  @override
  Future<void> signOut() async {}  @override
  bool get isSignedIn => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

/// Audit yozuvlarini yozmaydigan no-op repository (test uchun).
class _NoopAuditRepository implements AuditRepository {
  @override
  Future<void> record(AuditLogEntry entry) async {}

  @override
  Future<List<AuditLogEntry>> fetchRecent({int limit = 50}) async => const [];

  @override
  Future<List<AuditLogEntry>> fetchByTarget(
    String targetType,
    String targetId,
  ) async =>
      const [];

  @override
  Future<int> count() async => 0;
}
