import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/theme/app_density.dart';
import 'package:m_edu/core/theme/app_motion.dart';
import 'package:m_edu/core/theme/app_responsive.dart';
import 'package:m_edu/shared/design_system/app/app_avatar.dart';
import 'package:m_edu/shared/design_system/app/app_dialog.dart';
import 'package:m_edu/shared/design_system/app/app_empty_state.dart';
import 'package:m_edu/shared/design_system/app/app_section_header.dart';
import 'package:m_edu/shared/design_system/app/app_toast.dart';

/// Design System 4.0 — yangi tizim komponentlari testlari:
/// AppMotion, AppDensity, AppBreakpoint, AppToast, AppAvatar,
/// AppSectionHeader, AppEmptyState, AppErrorState, AppDialog, AppSheet.
void main() {
  Widget wrap(Widget child) => MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: child),
        ),
      );

  // ─── AppMotion (§28-37) ───────────────────────────────────────────────
  group('AppMotion', () {
    test('tokenlar aniqlangan va tartiblangan', () {
      expect(AppMotion.micro < AppMotion.fast, isTrue);
      expect(AppMotion.fast < AppMotion.normal, isTrue);
      expect(AppMotion.normal < AppMotion.page, isTrue);
      expect(AppMotion.pressedScale < 1.0, isTrue);
    });

    testWidgets('reduced motion yoqilganda zero duration qaytaradi (§37)',
        (tester) async {
      late Duration captured;
      await tester.pumpWidget(MaterialApp(
        builder: (context, child) {
          // MediaQuery accessibility xususiyati orqali disableAnimations.
          final data = MediaQuery.of(context).copyWith(
            disableAnimations: true,
          );
          return MediaQuery(
            data: data,
            child: Builder(builder: (context) {
              captured = context.appMotion.normal;
              return const SizedBox();
            }),
          );
        },
        home: const SizedBox(),
      ));

      expect(captured, Duration.zero);
    });
  });

  // ─── AppDensity (§9) ──────────────────────────────────────────────────
  group('AppDensity', () {
    test('wire round-trip: comfortable default', () {
      expect(AppDensity.fromWire('compact'), AppDensity.compact);
      expect(AppDensity.fromWire('comfortable'), AppDensity.comfortable);
      expect(AppDensity.fromWire('spacious'), AppDensity.spacious);
      // Noma'lum qiymat — fail-safe comfortable.
      expect(AppDensity.fromWire('huge'), AppDensity.comfortable);
      expect(AppDensity.fromWire(null), AppDensity.comfortable);
    });

    test('spatial qadamlar: compact < comfortable < spacious', () {
      expect(AppDensity.compact.rowHeight < AppDensity.comfortable.rowHeight,
          isTrue);
      expect(
          AppDensity.comfortable.rowHeight < AppDensity.spacious.rowHeight,
          isTrue);
    });

    testWidgets('scope context.appDensity orqali o\\x27qiladi', (tester) async {
      AppDensity? read;
      await tester.pumpWidget(MaterialApp(
        home: AppDensityScope(
          density: AppDensity.spacious,
          child: Builder(builder: (context) {
            read = context.appDensity;
            return const SizedBox();
          }),
        ),
      ));

      expect(read, AppDensity.spacious);
    });

    testWidgets('scope bo\\x27lmasa default comfortable', (tester) async {
      AppDensity? read;
      await tester.pumpWidget(MaterialApp(
        home: Builder(builder: (context) {
          read = context.appDensity;
          return const SizedBox();
        }),
      ));

      expect(read, AppDensity.comfortable);
    });
  });

  // ─── AppBreakpoint (§10) ──────────────────────────────────────────────
  group('AppBreakpoint', () {
    test('fromWidth chegaralari aniq', () {
      expect(AppBreakpoint.fromWidth(375), AppBreakpoint.compact);
      expect(AppBreakpoint.fromWidth(768), AppBreakpoint.tablet);
      expect(AppBreakpoint.fromWidth(1024), AppBreakpoint.desktop);
      expect(AppBreakpoint.fromWidth(1600), AppBreakpoint.wideDesktop);
    });

    test('desktop qoidalari: sidebar visible, mobile: bottom nav', () {
      expect(AppBreakpoint.compact.sidebar, AppSidebarBehavior.bottomNavigation);
      expect(AppBreakpoint.tablet.sidebar, AppSidebarBehavior.collapsible);
      expect(AppBreakpoint.desktop.sidebar, AppSidebarBehavior.visible);
      expect(AppBreakpoint.desktop.isDesktop, isTrue);
      expect(AppBreakpoint.compact.isDesktop, isFalse);
    });

    test('grid: wide desktop kontent kengligi cheklanadi', () {
      expect(AppBreakpoint.wideDesktop.contentMaxWidth, 1600);
      expect(AppBreakpoint.desktop.columnCount, 12);
      expect(AppBreakpoint.compact.columnCount, 4);
    });
  });

  // ─── AppToast (§24) ───────────────────────────────────────────────────
  group('AppToast', () {
    testWidgets('success tone — matn va ikon ko\\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(
        Builder(builder: (context) => const SizedBox()),
      ));

      final ctx = tester.element(find.byType(SizedBox));
      AppToast.show(ctx, message: 'Saqlangan', tone: AppToastTone.success);

      // SnackBar kirish animatsiyasi tugashini kutamiz.
      await tester.pumpAndSettle();
      expect(find.text('Saqlangan'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      // Timer tugatiladi.
      await tester.pump(const Duration(seconds: 5));
    });

    testWidgets('action — bosilganda onAction chaqiriladi', (tester) async {
      await tester.pumpWidget(wrap(
        Builder(builder: (context) => const SizedBox()),
      ));

      var acted = false;
      final ctx = tester.element(find.byType(SizedBox));
      AppToast.show(
        ctx,
        message: "O'chirilsinmi?",
        tone: AppToastTone.warning,
        actionLabel: "O'chirish",
        onAction: () => acted = true,
      );

      // SnackBar kirish animatsiyasi tugashini kutamiz (action tappable).
      await tester.pumpAndSettle();
      await tester.tap(find.text("O'chirish"));
      await tester.pump();
      expect(acted, isTrue);
      await tester.pump(const Duration(seconds: 5));
    });
  });

  // ─── AppAvatar (§43) ──────────────────────────────────────────────────
  group('AppAvatar', () {
    testWidgets('initials ko\\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(const AppAvatar(
        initials: 'Ali Valiyev',
        size: 48,
      )));

      expect(find.text('AL'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('fallback ikon — initials bo\\x27lmasa', (tester) async {
      await tester.pumpWidget(wrap(const AppAvatar(size: 48)));

      expect(find.byIcon(Icons.person_rounded), findsOneWidget);
    });

    testWidgets('image provider xato bo\\x27lsa initials fallback', (tester) async {
      await tester.pumpWidget(wrap(const AppAvatar(
        initials: 'JT',
        image: NetworkImage('https://invalid.invalid/x.png'),
      )));

      // Xato yuz berganda initials ko'rinadi (errorBuilder).
      await tester.pumpAndSettle();
      expect(find.text('JT'), findsOneWidget);
    });
  });

  // ─── AppSectionHeader (§48) ───────────────────────────────────────────
  group('AppSectionHeader', () {
    testWidgets('title/subtitle/action render qilinadi', (tester) async {
      await tester.pumpWidget(wrap(AppSectionHeader(
        title: 'O\\x27quvchilar',
        subtitle: '12 faol',
        action: const Icon(Icons.add),
      )));

      expect(find.text('O\\x27quvchilar'), findsOneWidget);
      expect(find.text('12 faol'), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
    });
  });

  // ─── AppEmptyState / AppErrorState (§26-27) ───────────────────────────
  group('AppEmptyState', () {
    testWidgets('WHAT/WHY/ACTION qatlamlari ko\\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(AppEmptyState(
        icon: Icons.people_outline,
        title: "Hali o'quvchi yo'q",
        subtitle: 'Birinchi o\\x27quvchingizni qo\\x27shing',
        action: const Text('Qo\\x27shish'),
      )));

      expect(find.text("Hali o'quvchi yo'q"), findsOneWidget);
      expect(find.text('Birinchi o\\x27quvchingizni qo\\x27shing'), findsOneWidget);
      expect(find.text('Qo\\x27shish'), findsOneWidget);
    });
  });

  group('AppErrorState', () {
    testWidgets('nima bo\\x27ldi + keyin nima qilish ko\\x27rsatiladi', (tester) async {
      var retried = false;
      await tester.pumpWidget(wrap(AppErrorState(
        title: 'Yuklab bo\\x27lmadi',
        subtitle: 'Tarmoq aloqasini tekshirib qayta urinib ko\\x27ring',
        retryLabel: 'Qayta urinish',
        onRetry: () => retried = true,
      )));

      expect(find.text('Yuklab bo\\x27lmadi'), findsOneWidget);
      expect(
          find.text('Tarmoq aloqasini tekshirib qayta urinib ko\\x27ring'),
          findsOneWidget);

      await tester.tap(find.text('Qayta urinish'));
      expect(retried, isTrue);
    });
  });

  // ─── AppDialog / AppSheet (§22-23) ────────────────────────────────────
  group('AppDialog', () {
    testWidgets('title va confirm bosilganda onConfirm chaqiriladi',
        (tester) async {
      var confirmed = false;
      await tester.pumpWidget(wrap(
        Builder(
          builder: (context) => TextButton(
            onPressed: () {
              AppDialog.show(
                context,
                title: 'O\\x27chirish',
                content: const Text('Rostdan ham o\\x27chirilsinmi?'),
                confirmLabel: 'O\\x27chirish',
                cancelLabel: 'Bekor qilish',
                onConfirm: () => confirmed = true,
              );
            },
            child: const Text('Ochish'),
          ),
        ),
      ));

      await tester.tap(find.text('Ochish'));
      await tester.pumpAndSettle();
      expect(find.text('Rostdan ham o\\x27chirilsinmi?'), findsOneWidget);

      await tester.tap(find.text('O\\x27chirish').last);
      await tester.pumpAndSettle();
      expect(confirmed, isTrue);
    });
  });

  group('AppSheet', () {
    testWidgets('title va kontent ko\\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(
        Builder(
          builder: (context) => TextButton(
            onPressed: () {
              AppSheet.show(
                context,
                title: 'Tanlang',
                builder: (ctx) => const Text('Variant A'),
              );
            },
            child: const Text('Ochish'),
          ),
        ),
      ));

      await tester.tap(find.text('Ochish'));
      await tester.pumpAndSettle();
      expect(find.text('Tanlang'), findsOneWidget);
      expect(find.text('Variant A'), findsOneWidget);
    });
  });
}
