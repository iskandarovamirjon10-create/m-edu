import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';

import '../helpers/test_helpers.dart';

void main() {
  Future<void> pumpShell(WidgetTester tester, GoRouter router) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // AUDIT P2-03: MorePage ruxsatga qarab bo'limlarni yashiradi —
          // testlar bo'limlar ko'rinishi uchun admin aktorni beradi.
          authControllerProvider.overrideWith(
            (ref) => _FakeAuthController('admin'),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('MainShellPage (pastki navigatsiya)', () {
    testWidgets('mobil: 4 ta bo\'lim ko\'rinadi (contract §9.2)', (tester) async {
      await pumpShell(tester, buildTestShellRouter());

      // Contract §9.2 (Android nav): Dashboard, O'quvchilar, Davomat, Barchasi.
      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text("O'quvchilar"), findsOneWidget);
      expect(find.text('Davomat'), findsOneWidget);
      expect(find.text("Barchasi"), findsOneWidget);

      // Guruhlar, Jadval, Ko'proq — pastki panelda EMAS.
      expect(find.text('Guruhlar'), findsNothing);
      expect(find.text('Jadval'), findsNothing);
      expect(find.text("Ko'proq"), findsNothing);
    });

    testWidgets('tab almashganda sahifa almashtiriladi (state saqlanadi)',
        (tester) async {
      await pumpShell(tester, buildTestShellRouter());

      expect(find.text('DASHBOARD'), findsOneWidget);

      // O'quvchilar tab'iga o'tish.
      await tester.tap(find.text("O'quvchilar"));
      await tester.pumpAndSettle();
      expect(find.text('STUDENTS'), findsOneWidget);

      // Davomat tab'iga o'tish.
      await tester.tap(find.text('Davomat'));
      await tester.pumpAndSettle();
      expect(find.text('ATTENDANCE'), findsOneWidget);

      // Bosh sahifaga qaytish.
      await tester.tap(find.text('Bosh sahifa'));
      await tester.pumpAndSettle();
      expect(find.text('DASHBOARD'), findsOneWidget);
    });

    testWidgets("yashirin branch'lar (Hisobotlar) Barchasi sheet orqali ochiladi",
        (tester) async {
      await pumpShell(tester, buildTestShellRouter(initialLocation: '/reports'));

      // Hisobotlar yashirin branch — pastki panelda 4 tab qoladi.
      expect(find.text('REPORTS'), findsOneWidget);
      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text("Barchasi"), findsOneWidget);
    });

    testWidgets('Guruhlar sahifasi desktop sidebar orqali ochiladi', (tester) async {
      await pumpShell(tester, buildTestShellRouter(initialLocation: '/groups'));

      // Guruhlar — mobil bottom nav'da yo'q, lekin route ochiladi.
      expect(find.text('GROUPS'), findsOneWidget);
    });

    testWidgets('Barchasi tab\'i bottom sheet ochadi', (tester) async {
      await pumpShell(tester, buildTestShellRouter());

      await tester.tap(find.text("Barchasi"));
      await tester.pumpAndSettle();

      // Bottom sheet elementlari ko'rinadi.
      expect(find.text('Guruhlar'), findsOneWidget);
      expect(find.text("O'qituvchilar"), findsOneWidget);
    });
  });

  group('MainShellPage (desktop shell: sidebar + topbar)', () {
    testWidgets('keng ekranda sidebar va topbar ko\'rinadi, bottom bar yo\'q',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await pumpShell(tester, buildTestShellRouter());

      // Sidebar'da bo'limlar ko'rinadi (topbar breadcrumb'ida ham bo'lishi
      // mumkin — findsWidgets).
      expect(find.text('Bosh sahifa'), findsWidgets);
      expect(find.text("O'quvchilar"), findsWidgets);
      expect(find.text('Davomat'), findsWidgets);
      expect(find.text('Jadval'), findsWidgets);

      // Desktop: sidebar + topbar mavjud, suzuvchi bottom bar mavjud EMAS.
      expect(find.byKey(const Key('desktop-nav-rail')), findsOneWidget);
      expect(find.byKey(const Key('app-shell-top-bar')), findsOneWidget);
      expect(find.byKey(const Key('floating-nav-bar')), findsNothing);
    });

    testWidgets('desktop sidebar: Moliya/Hisobotlar/Guruhlar bo\'limlari ko\'rinadi',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await pumpShell(tester, buildTestShellRouter());

      // Desktop information density (brief §3): moliya/hisobotlar/guruhlar
      // to'g'ridan-to'g'ri sidebar'da.
      expect(find.text('Moliya'), findsOneWidget);
      expect(find.text('Hisobotlar'), findsOneWidget);
      expect(find.text('Guruhlar'), findsOneWidget);
    });

    testWidgets('rail orqali tab almashish ishlaydi', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await pumpShell(tester, buildTestShellRouter());

      await tester.tap(find.text('Jadval').first);
      await tester.pumpAndSettle();
      expect(find.text('SCHEDULE'), findsOneWidget);
    });
  });

  group('MorePage (Ko\'proq sahifasi)', () {
    testWidgets('bo\'limlar va elementlar ko\'rinadi', (tester) async {
      await pumpShell(
        tester,
        buildTestShellRouter(initialLocation: '/more'),
      );

      // Yuqoridagi bo'limlar — darhol ko'rinadi.
      expect(find.text('Moliya'), findsOneWidget);
      expect(find.text('Hisobotlar'), findsOneWidget);
      expect(find.text('Hisobotlar markazi'), findsOneWidget);
      expect(find.text("To'lovlar"), findsOneWidget);
      expect(find.text('Qarzdorlik'), findsOneWidget);

      // Pastki bo'limlar — scroll orqali ko'rinadigan qilamiz.
      final scrollable = find.byType(Scrollable).first;
      for (final label in [
        'Boshqaruv',
        'Ulanishlar',
        'Face ID',
        'Zaxira nusxa',
        'Fanlar',
        'Foydalanuvchilar',
        'Tizim',
        'Sozlamalar',
      ]) {
        await tester.scrollUntilVisible(
          find.text(label),
          200,
          scrollable: scrollable,
        );
        await tester.pumpAndSettle();
        expect(find.text(label), findsWidgets);
      }
    });

    testWidgets('Moliya elementiga bosilganda /finance ochiladi',
        (tester) async {
      await pumpShell(
        tester,
        buildTestShellRouter(initialLocation: '/more'),
      );

      await tester.tap(find.text("To'lovlar"));
      await tester.pumpAndSettle();

      // Yashirin branch ochildi — finance sahifa ko'rinadi.
      expect(find.text('FINANCE'), findsOneWidget);
    });

    testWidgets("yashirin branch'da (Moliya) Barchasi sheet ishlaydi",
        (tester) async {
      await pumpShell(tester, buildTestShellRouter(initialLocation: '/finance'));

      // Yashirin branch ochilgan — /finance sahifasi ko'rinadi.
      expect(find.text('FINANCE'), findsOneWidget);

      // Pastki panel 4 ta tab'ni ko'rsatadi.
      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text("Barchasi"), findsOneWidget);
      expect(find.text("O'quvchilar"), findsOneWidget);

      // Barchasi tab'iga bosish bottom sheet ochadi.
      await tester.tap(find.text("Barchasi"));
      await tester.pumpAndSettle();
      expect(find.text('Moliya'), findsOneWidget);
    });
  });
}

/// MorePage ruxsatga qarab bo'limlarni ko'rsatishi uchun admin aktor.
class _FakeAuthController extends AuthController {
  _FakeAuthController(String role) : super() {
    state = AuthStateAuthenticated(
      userId: 'u1',
      role: role,
      name: 'Test',
    );
  }
}
