import 'package:flutter/services.dart';
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';

/// flutter_secure_storage'ni unit test uchun in-memory mock qiladi.
/// Aks holda test muhitida MethodChannel yo'q — MissingPluginException
/// tashlanadi va auth testlari (hali ham eski mock-auth kutuvchi) ishlamaydi.
void _mockSecureStorage() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final storage = <String, String>{};
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (call) async {
    switch (call.method) {
      case 'read':
        return storage[call.arguments['key'] as String];
      case 'write':
        storage[call.arguments['key'] as String] =
            call.arguments['value'] as String;
        return null;
      case 'delete':
        storage.remove(call.arguments['key'] as String);
        return null;
      case 'deleteAll':
        storage.clear();
        return null;
      case 'containsKey':
        return storage.containsKey(call.arguments['key'] as String);
    }
    return null;
  });
}

void main() {
  setUp(_mockSecureStorage);

  group('AuthController', () {
    test('boshlang\'ich holat AuthStateInitial bo\'ladi', () {
      final controller = AuthController();
      expect(controller.state, isA<AuthStateInitial>());
    });

    test('appStarted → Loading → Unauthenticated', () async {
      final controller = AuthController();
      final states = <AuthState>[];
      controller.addListener((state) => states.add(state));

      unawaited(controller.appStarted());
      expect(controller.state, isA<AuthStateLoading>());

      await Future<void>.delayed(const Duration(seconds: 3));
      expect(controller.state, isA<AuthStateUnauthenticated>());
      expect(states, contains(isA<AuthStateLoading>()));
      expect(states, contains(isA<AuthStateUnauthenticated>()));
    });

    test(
        'register → Authenticated (super_admin — birinchi hisob egasi), '
        'login qaytadan ishlaydi', () async {
      final controller = AuthController();
      // Xavfsiz auth: hisob avval ro'yxatdan o'tishi shart.
      await controller.register('admin@medu.uz', 'secure123', 'Admin');
      expect(controller.state, isA<AuthStateAuthenticated>());
      var state = controller.state as AuthStateAuthenticated;
      // AUDIT P2-02: birinchi hisob egasi (super_admin) — hardcode admin emas.
      expect(state.role, 'super_admin');
      expect(state.name, 'Admin');
      expect(state.userId, isNotEmpty);

      await controller.logout();
      expect(controller.state, isA<AuthStateUnauthenticated>());

      // Ro'yxatdan o'tgan hisob bilan login ishlaydi (rol hisobdan olinadi).
      await controller.login('admin@medu.uz', 'secure123');
      expect(controller.state, isA<AuthStateAuthenticated>());
      state = controller.state as AuthStateAuthenticated;
      expect(state.role, 'super_admin');
      expect(state.email, 'admin@medu.uz');
    });

    test('ikkinchi hisob unknown rol bilan yaratiladi (fail-closed)', () async {
      final controller = AuthController();
      await controller.register('owner@medu.uz', 'secure123', 'Owner');
      await controller.logout();

      // Ikkinchi ochiq registratsiya — endi ADMIN yaratilmaydi.
      await controller.register('newbie@medu.uz', 'secure123', 'Newbie');
      final state = controller.state as AuthStateAuthenticated;
      expect(state.role, 'unknown');
    });

    test('noto\'g\'ri parol → AuthStateError', () async {
      final controller = AuthController();
      await controller.register('admin@medu.uz', 'secure123', 'Admin');
      await controller.logout();

      await controller.login('admin@medu.uz', 'wrong-pass');
      expect(controller.state, isA<AuthStateError>());
    });

    test('login keyin logout → Unauthenticated', () async {
      final controller = AuthController();
      await controller.register('admin@medu.uz', 'secure123', 'Admin');
      expect(controller.state, isA<AuthStateAuthenticated>());

      await controller.logout();
      expect(controller.state, isA<AuthStateUnauthenticated>());
    });
  });
}
