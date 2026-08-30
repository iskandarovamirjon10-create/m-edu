import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';

import '../helpers/test_helpers.dart';

/// PHASE D — RESPONSIVE ACCEPTANCE (brief §36).
///
/// Test kengliklari: 360/375/390/412/430/600/768/900/1024/1280/1440/1920.
/// Har birida: to'g'ri shell (mobil bottom bar | desktop sidebar+topbar),
/// overflow/exception yo'q.
void main() {
  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  Future<void> pumpShellAt(WidgetTester tester, Size size) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FakeAuthController('admin'),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: buildTestShellRouter(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('MOBILE shell (bottom bar)', () {
    // Spec §36 mobil kengliklari.
    for (final width in [360, 375, 390, 412, 430, 600, 768, 899]) {
      testWidgets('${width}px: bottom bar, sidebar yo\'q', (tester) async {
        await pumpShellAt(tester, Size(width.toDouble(), 900));

        expect(find.byKey(const Key('floating-nav-bar')), findsOneWidget);
        expect(find.byKey(const Key('desktop-nav-rail')), findsNothing);
        expect(find.byKey(const Key('app-shell-top-bar')), findsNothing);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('DESKTOP shell (sidebar + topbar)', () {
    // Spec §36 desktop kengliklari.
    for (final width in [900, 1024, 1280, 1440, 1920]) {
      testWidgets('${width}px: sidebar + topbar, bottom bar yo\'q',
          (tester) async {
        await pumpShellAt(tester, Size(width.toDouble(), 900));

        expect(find.byKey(const Key('desktop-nav-rail')), findsOneWidget);
        expect(find.byKey(const Key('app-shell-top-bar')), findsOneWidget);
        expect(find.byKey(const Key('floating-nav-bar')), findsNothing);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('Keyboard (§19)', () {
    testWidgets('keyboard ochilganda bottom nav overlap qilmaydi',
        (tester) async {
      await pumpShellAt(tester, const Size(390, 844));

      // Keyboard'siz: bar ko'rinadi.
      expect(find.byKey(const Key('floating-nav-bar')), findsOneWidget);

      // Keyboard simulyatsiyasi (viewInsets = 300px).
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pump();

      // Keyboard ochilganda bar o'chiriladi — overlap qilmaydi (§19).
      expect(find.byKey(const Key('floating-nav-bar')), findsNothing);

      // Keyboard yopilganda bar qaytadi.
      tester.view.resetViewInsets();
      await tester.pump();
      expect(find.byKey(const Key('floating-nav-bar')), findsOneWidget);
    });
  });
}

class _FakeAuthController extends AuthController {
  _FakeAuthController(String role) : super() {
    state = AuthStateAuthenticated(
      userId: 'u1',
      role: role,
      name: 'Test',
    );
  }
}
