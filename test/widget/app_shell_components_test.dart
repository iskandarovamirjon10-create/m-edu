import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show SemanticsFlag;
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/shared/design_system/app/app_bottom_navigation.dart';
import 'package:m_edu/shared/design_system/app/app_page_header.dart';
import 'package:m_edu/shared/design_system/app/app_shell_top_bar.dart';
import 'package:m_edu/shared/design_system/app/app_sidebar.dart';

/// PHASE D — navigatsiya komponentlari uchun widget testlar.
void main() {
  Future<void> pump(WidgetTester tester, Widget child) async {
    // Scaffold — Material ancestor (PopupMenuButton/InkWell talablari).
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: child)));
    await tester.pumpAndSettle();
  }

  group('AppBottomNavigationBar', () {
    const destinations = [
      AppNavDestination(
        icon: Icons.home_outlined,
        activeIcon: Icons.home_rounded,
        label: 'Bosh sahifa',
      ),
      AppNavDestination(
        icon: Icons.people_outline,
        activeIcon: Icons.people_rounded,
        label: "O'quvchilar",
      ),
    ];

    testWidgets('barcha label va iconlar ko\'rinadi', (tester) async {
      await pump(
        tester,
        AppBottomNavigationBar(
          currentIndex: 0,
          destinations: destinations,
          onDestinationSelected: (_) {},
        ),
      );

      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text("O'quvchilar"), findsOneWidget);
      // Faol tab (index 0) — filled icon, qolgani outline (§28).
      expect(find.byIcon(Icons.home_rounded), findsOneWidget);
      expect(find.byIcon(Icons.people_outline), findsOneWidget);
    });

    testWidgets('faol element semantics selected holatini ko\'rsatadi (§29)',
        (tester) async {
      final handle = tester.ensureSemantics();
      await pump(
        tester,
        AppBottomNavigationBar(
          currentIndex: 0,
          destinations: destinations,
          onDestinationSelected: (_) {},
        ),
      );

      final selected = tester.getSemantics(find.text('Bosh sahifa'));
      // ignore: deprecated_member_use
      expect(selected.hasFlag(SemanticsFlag.isSelected), isTrue);
      // ignore: deprecated_member_use
      expect(selected.hasFlag(SemanticsFlag.isButton), isTrue);

      final unselected = tester.getSemantics(find.text("O'quvchilar"));
      // ignore: deprecated_member_use
      expect(unselected.hasFlag(SemanticsFlag.isSelected), isFalse);
      handle.dispose();
    });

    testWidgets('bosilganda onDestinationSelected(index) chaqiriladi',
        (tester) async {
      final tapped = <int>[];
      await pump(
        tester,
        AppBottomNavigationBar(
          currentIndex: 0,
          destinations: destinations,
          onDestinationSelected: tapped.add,
        ),
      );

      await tester.tap(find.text("O'quvchilar"));
      expect(tapped, [1]);
    });

    testWidgets('FIXED GEOMETRY: icon o\'lchami selected/unselected bir xil (§4)',
        (tester) async {
      await pump(
        tester,
        AppBottomNavigationBar(
          currentIndex: 0,
          destinations: destinations,
          onDestinationSelected: (_) {},
        ),
      );

      // Har qanday holatda icon o'lchami o'zgarmaydi (sakrash yo'q).
      final icons = tester.widgetList<Icon>(find.descendant(
        of: find.byKey(const Key('floating-nav-bar')),
        matching: find.byType(Icon),
      ));
      expect(icons.length, 2);
      for (final icon in icons) {
        expect(icon.size, 22);
      }
    });
  });

  group('AppSidebar', () {
    AppSidebarDestination dest(
      int i,
      String label,
      IconData icon,
      IconData active,
    ) =>
        AppSidebarDestination(
          label: label,
          icon: icon,
          activeIcon: active,
          branchIndex: i,
        );

    testWidgets('brand va bo\'limlar ko\'rinadi', (tester) async {
      await pump(
        tester,
        AppSidebar(
          currentIndex: 0,
          primary: [
            dest(0, 'Bosh sahifa', Icons.home_outlined, Icons.home_rounded),
            dest(1, "O'quvchilar", Icons.people_outline, Icons.people_rounded),
          ],
          secondary: [
            dest(5, 'Moliya', Icons.account_balance_wallet_outlined,
                Icons.account_balance_wallet_rounded),
          ],
          utility: [
            dest(4, "Ko'proq", Icons.grid_view_outlined, Icons.grid_view_rounded),
          ],
          onDestinationSelected: (_) {},
          onLogout: () {},
        ),
      );

      expect(find.text('M-Edu'), findsOneWidget);
      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text("O'quvchilar"), findsOneWidget);
      expect(find.text('Moliya'), findsOneWidget);
      expect(find.text("Ko'proq"), findsOneWidget);
      expect(find.text('Profil'), findsOneWidget);
    });

    testWidgets('collapse: label yashirinadi, tooltip paydo bo\'ladi (§13)',
        (tester) async {
      await pump(
        tester,
        AppSidebar(
          currentIndex: 0,
          primary: [
            dest(0, 'Bosh sahifa', Icons.home_outlined, Icons.home_rounded),
          ],
          secondary: const [],
          utility: const [],
          onDestinationSelected: (_) {},
          onLogout: () {},
        ),
      );

      // Expanded — label ko'rinadi (interaktiv).
      expect(find.text('Bosh sahifa').hitTestable(), findsOneWidget);

      // Collapse.
      await tester.tap(find.text("Yig'ish"));
      await tester.pumpAndSettle();

      // Collapsed — label endi interaktiv EMAS (yashiringan), tooltip bor.
      expect(find.text('Bosh sahifa').hitTestable(), findsNothing);
      expect(find.byTooltip('Bosh sahifa'), findsOneWidget);

      // Expand.
      await tester.tap(find.byTooltip('Kengaytirish'));
      await tester.pumpAndSettle();
      expect(find.text('Bosh sahifa').hitTestable(), findsOneWidget);
    });

    testWidgets('bo\'lim bosilganda branch indeksi chaqiriladi', (tester) async {
      final selected = <int>[];
      await pump(
        tester,
        AppSidebar(
          currentIndex: 0,
          primary: [
            dest(0, 'Bosh sahifa', Icons.home_outlined, Icons.home_rounded),
            dest(1, "O'quvchilar", Icons.people_outline, Icons.people_rounded),
          ],
          secondary: const [],
          utility: const [],
          onDestinationSelected: selected.add,
          onLogout: () {},
        ),
      );

      await tester.tap(find.text("O'quvchilar"));
      expect(selected, [1]);
    });

    testWidgets('collapsed profil menyusi ochiladi (tap regressiyasi)',
        (tester) async {
      var loggedOut = false;
      await pump(
        tester,
        AppSidebar(
          currentIndex: 0,
          primary: [
            dest(0, 'Bosh sahifa', Icons.home_outlined, Icons.home_rounded),
          ],
          secondary: const [],
          utility: const [],
          onDestinationSelected: (_) {},
          onLogout: () => loggedOut = true,
        ),
      );

      // Collapse qilamiz.
      await tester.tap(find.text("Yig'ish"));
      await tester.pumpAndSettle();

      // Profil ikonkasi — ichki no-op InkWell tap'ni yutmasligi kerak:
      // menyu ochilib, Chiqish tanlanadi. Ikkala qatlam ham daraxtda —
      // faol (collapsed) qatlamning ikonkasi hitTestable.
      await tester.tap(find.byIcon(Icons.person_outline_rounded).hitTestable());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chiqish'));
      await tester.pumpAndSettle();
      expect(loggedOut, isTrue);
    });

    testWidgets('faol bo\'lim selected semantikasiga ega (§29)', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(
        tester,
        AppSidebar(
          currentIndex: 1,
          primary: [
            dest(0, 'Bosh sahifa', Icons.home_outlined, Icons.home_rounded),
            dest(1, "O'quvchilar", Icons.people_outline, Icons.people_rounded),
          ],
          secondary: const [],
          utility: const [],
          onDestinationSelected: (_) {},
          onLogout: () {},
        ),
      );

      expect(
        tester
            .getSemantics(find.text("O'quvchilar"))
            // ignore: deprecated_member_use
            .hasFlag(SemanticsFlag.isSelected),
        isTrue,
      );
      handle.dispose();
    });
  });

  group('AppPageHeader', () {
    testWidgets('title/subtitle/actions render qilinadi (§16)', (tester) async {
      await pump(
        tester,
        AppPageHeader(
          title: 'O\'quvchilar',
          subtitle: '12 faol',
          actions: [
            IconButton(
              icon: const Icon(Icons.person_add_alt_1),
              onPressed: () {},
            ),
          ],
        ),
      );

      expect(find.text("O'quvchilar"), findsOneWidget);
      expect(find.text('12 faol'), findsOneWidget);
      expect(find.byIcon(Icons.person_add_alt_1), findsOneWidget);
    });

    testWidgets('showBack — back tugmasi ko\'rinadi', (tester) async {
      await pump(
        tester,
        const AppPageHeader(title: 'Profil', showBack: true),
      );

      expect(find.byType(IconButton), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
    });
  });

  group('AppShellTopBar', () {
    testWidgets('breadcrumb crumbs ko\'rsatiladi', (tester) async {
      await pump(
        tester,
        AppShellTopBar(
          crumbs: const ['Sozlamalar', 'Foydalanuvchilar'],
          onLogout: () {},
          onNotificationsTap: () {},
        ),
      );

      expect(find.text('Sozlamalar'), findsOneWidget);
      expect(find.text('Foydalanuvchilar'), findsOneWidget);
    });

    testWidgets('notifications tugmasi callback chaqiradi', (tester) async {
      var tapped = false;
      await pump(
        tester,
        AppShellTopBar(
          crumbs: const ['Bosh sahifa'],
          onLogout: () {},
          onNotificationsTap: () => tapped = true,
        ),
      );

      await tester.tap(find.byIcon(Icons.notifications_none_rounded));
      expect(tapped, isTrue);
    });

    testWidgets('profil menyusidan chiqish chaqiriladi', (tester) async {
      var loggedOut = false;
      await pump(
        tester,
        AppShellTopBar(
          crumbs: const ['Bosh sahifa'],
          onLogout: () => loggedOut = true,
          onNotificationsTap: () {},
        ),
      );

      await tester.tap(find.byIcon(Icons.person_rounded));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chiqish'));
      await tester.pumpAndSettle();
      expect(loggedOut, isTrue);
    });
  });
}
