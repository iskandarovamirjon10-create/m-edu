import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/auth/local_auth_store.dart';
import 'package:m_edu/core/security/permissions.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

/// flutter_secure_storage'ni in-memory mock qiladi (AUDIT P2-02).
/// Barcha testlar shu omborni baham ko'radi — `setUp`da tozalanadi.
final Map<String, String> _storage = {};

void _mockSecureStorage() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    switch (call.method) {
      case 'read':
        return _storage[call.arguments['key'] as String];
      case 'write':
        _storage[call.arguments['key'] as String] =
            call.arguments['value'] as String;
        return null;
      case 'delete':
        _storage.remove(call.arguments['key'] as String);
        return null;
      case 'deleteAll':
        _storage.clear();
        return null;
      case 'containsKey':
        return _storage.containsKey(call.arguments['key'] as String);
    }
    return null;
  });
}

void main() {
  setUp(() {
    _mockSecureStorage();
    _storage.clear();
  });

  group('RBAC auth flow (AUDIT P2-02)', () {
    test('1. birinchi hisob → super_admin (egasi), keyingilari → unknown',
        () async {
      final store = LocalAuthStore();
      final first = await store.register(
        email: 'owner@medu.uz',
        name: 'Owner',
        password: 'secret123',
      );
      expect(first, isNotNull);
      expect(first!.role, 'super_admin',
          reason: 'birinchi hisob egasi bo\'lishi kerak');

      final second = await store.register(
        email: 'newbie@medu.uz',
        name: 'Newbie',
        password: 'secret123',
      );
      expect(second, isNotNull);
      expect(second!.role, 'unknown',
          reason: 'ochiq registratsiya ADMIN yaratmasligi kerak');
    });

    test('2. unknown rol bilan login → sessiya ham unknown (fail-closed)',
        () async {
      final store = LocalAuthStore();
      await store.register(email: 'owner@medu.uz', name: 'O', password: 'secret123');
      await store.register(email: 'newbie@medu.uz', name: 'N', password: 'secret123');

      final controller = AuthController();
      await controller.login('newbie@medu.uz', 'secret123');
      final state = controller.state as AuthStateAuthenticated;
      expect(state.role, 'unknown');
      expect(state.role, isNot('admin'),
          reason: 'noma\'lum aktyor hech qachon admin bo\'lmasligi kerak');
    });

    test('3. admin rol o\'zgartirilsa — keyingi login yangi ruxsatlarni beradi',
        () async {
      final store = LocalAuthStore();
      await store.register(email: 'owner@medu.uz', name: 'O', password: 'secret123');
      await store.register(email: 'teacher@medu.uz', name: 'T', password: 'secret123');

      // superAdmin yangi hisobni teacher qilib ko'tardi (permission change).
      final changed = await store.updateRole(email: 'teacher@medu.uz', role: 'teacher');
      expect(changed, isTrue);

      final account =
          await store.authenticate(email: 'teacher@medu.uz', password: 'secret123');
      expect(account, isNotNull);
      expect(account!.role, 'teacher');
      // Yangi rol darhol ta'sir qiladi.
      expect(Permissions.can(UserRole.teacher, AppPermission.attendanceCreate),
          isTrue);
      expect(Permissions.can(UserRole.teacher, AppPermission.financeCreate),
          isFalse);
    });

    test('4. rol sessiyada saqlanadi — restartdan so\'ng ham qaytadi', () async {
      final store = LocalAuthStore();
      await store.register(email: 'owner@medu.uz', name: 'Owner', password: 'secret123');

      final c1 = AuthController();
      await c1.login('owner@medu.uz', 'secret123');
      expect((c1.state as AuthStateAuthenticated).role, 'super_admin');

      // Ilova "qayta ishga tushdi" — yangi controller sessiyani tiklaydi.
      final c2 = AuthController();
      await c2.appStarted();
      final state = c2.state;
      expect(state, isA<AuthStateAuthenticated>());
      expect((state as AuthStateAuthenticated).role, 'super_admin',
          reason: 'restartdan keyin rol yo\'qolmasligi kerak');
    });

    test('5. legacy (rolsiz) hisoblar admin sifatida migratsiya qilinadi',
        () async {
      // P2-02 dan oldingi format: 'role' maydoni yo'q.
      _storage['m_edu_local_accounts_v1'] = jsonEncode([
        {
          'email': 'legacy@medu.uz',
          'name': 'Legacy',
          'passwordHash': 'old-sha256-hash',
        },
      ]);

      final store = LocalAuthStore();
      final account = await store.findByEmail('legacy@medu.uz');
      expect(account, isNotNull);
      expect(account!.role, 'admin',
          reason: 'eski hisoblar (hammasi admin edi) buzilmasligi kerak');
    });

    test('6. actorRoleProvider: noma\'lum rol string → UserRole.unknown',
        () async {
      final store = LocalAuthStore();
      await store.register(email: 'owner@medu.uz', name: 'O', password: 'secret123');
      await store.register(email: 'x@medu.uz', name: 'X', password: 'secret123');

      // Sessiyaga noto'g'ri rol yozilgan taqdir ham fail-closed bo'ladi:
      // UserSession default/fallback 'unknown'.
      final controller = AuthController();
      await controller.login('x@medu.uz', 'secret123');
      final state = controller.state as AuthStateAuthenticated;
      expect(state.role, 'unknown');
    });
  });
}
