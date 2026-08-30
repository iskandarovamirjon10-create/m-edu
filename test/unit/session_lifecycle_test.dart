import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/app/auth_lifecycle.dart';
import 'package:m_edu/core/auth/local_auth_store.dart';
import 'package:m_edu/core/auth/session_manager.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/settings/presentation/providers/settings_providers.dart';

import '../helpers/secure_storage_mock.dart';

/// PHASE E — actor hayot davri testlari:
/// - inactive (suspended/archived) hisob → login DENY
/// - 30 kunlik sessiya TTL → eskirgan sessiya DENY
/// - logout → actor-bog'liq cache invalidatsiya
void main() {
  setUp(() {
    mockSecureStorageChannel();
    secureStorageMock.clear();
  });

  group('Inactive account → DENY (PHASE E)', () {
    test('suspended hisob login qila olmaydi', () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      await store.register(
          email: 't@medu.uz', name: 'T', password: 'secret123');
      await store.setStatus(
          email: 't@medu.uz', status: AccountStatus.suspended);

      final controller = AuthController();
      await controller.login('t@medu.uz', 'secret123');
      expect(controller.state, isA<AuthStateError>(),
          reason: 'suspended hisob login qilolmasligi kerak');
    });

    test('archived hisob login qila olmaydi', () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      await store.register(
          email: 't@medu.uz', name: 'T', password: 'secret123');
      await store.setStatus(
          email: 't@medu.uz', status: AccountStatus.archived);

      final controller = AuthController();
      await controller.login('t@medu.uz', 'secret123');
      expect(controller.state, isA<AuthStateError>());
    });

    test('deaktivatsiya qilingan user sessiyasi restartda tiklanmaydi',
        () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      await store.register(
          email: 't@medu.uz', name: 'T', password: 'secret123');

      // User kirgan — sessiya saqlanadi.
      final c1 = AuthController();
      await c1.login('t@medu.uz', 'secret123');
      expect(c1.state, isA<AuthStateAuthenticated>());

      // Admin uni deaktivatsiya qildi.
      await store.setStatus(
          email: 't@medu.uz', status: AccountStatus.suspended);

      // "Restart" — sessiya tiklash urinishi DENY bo'ladi.
      final c2 = AuthController();
      await c2.appStarted();
      expect(c2.state, isA<AuthStateUnauthenticated>(),
          reason: 'deaktivatsiya qilingan user sessiyasi tiklanmasligi kerak');
    });
  });

  group('Session TTL (30 kun)', () {
    test('yangi sessiya tiklanadi', () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      final c1 = AuthController();
      await c1.login('owner@medu.uz', 'secret123');

      final c2 = AuthController();
      await c2.appStarted();
      expect(c2.state, isA<AuthStateAuthenticated>());
    });

    test('31 kunlik sessiya → muddati o\'tgan, DENY', () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      final c1 = AuthController();
      await c1.login('owner@medu.uz', 'secret123');

      // Sessiyani 31 kun eski qilamiz (created_at ni orqaga surish).
      final old = DateTime.now().subtract(const Duration(days: 31));
      secureStorageMock['session_created_at'] = old.toIso8601String();

      final manager = SessionManager();
      final session = await manager.loadSession();
      expect(session, isNull,
          reason: '31 kunlik sessiya yaroqsiz — qayta login kerak');
      expect(secureStorageMock['is_logged_in'], 'false',
          reason: 'eskirgan sessiya tozalanishi kerak');
    });

    test('29 kunlik sessiya hali yaroqli', () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');
      await store.authenticate(email: 'owner@medu.uz', password: 'secret123');

      final manager = SessionManager();
      await manager.saveSession(const UserSession(
        userId: 'u1',
        email: 'owner@medu.uz',
        displayName: 'Owner',
        role: 'super_admin',
      ));
      final old = DateTime.now().subtract(const Duration(days: 29));
      secureStorageMock['session_created_at'] = old.toIso8601String();

      final session = await manager.loadSession();
      expect(session, isNotNull);
    });
  });

  group('Logout izolyatsiyasi (cache invalidation)', () {
    test('logout → userAccountsProvider qayta yuklanadi (cache tozalanadi)',
        () async {
      final store = LocalAuthStore();
      await store.register(
          email: 'owner@medu.uz', name: 'Owner', password: 'secret123');

      var loads = 0;
      final container = ProviderContainer(overrides: [
        userAccountsProvider.overrideWith(
          (ref) async {
            loads++;
            return store.listAccounts();
          },
        ),
      ]);
      addTearDown(container.dispose);

      // Koordinator'ni faollashtiramiz (auth o'zgarishlarini tinglaydi).
      container.read(authLifecycleCoordinatorProvider);

      // Login → autentifikatsiya.
      await container
          .read(authControllerProvider.notifier)
          .login('owner@medu.uz', 'secret123');
      expect(container.read(authControllerProvider),
          isA<AuthStateAuthenticated>());

      // Ro'yxat bir marta yuklangan.
      await container.read(userAccountsProvider.future);
      expect(loads, 1);

      // Logout → cache invalidatsiya → keyingi o'qish qayta yuklaydi.
      await container.read(authControllerProvider.notifier).logout();
      expect(container.read(authControllerProvider),
          isA<AuthStateUnauthenticated>());
      await container.read(userAccountsProvider.future);
      expect(loads, 2,
          reason: 'logoutdan keyin eski cache qolmasligi kerak (PHASE E)');
    });
  });
}
