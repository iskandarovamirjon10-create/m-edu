import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:m_edu/features/dashboard/presentation/widgets/home_alert_center.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/presentation/providers/payment_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/presentation/providers/settings_providers.dart';

import '../helpers/fake_repositories.dart';

/// Alert Center testi — REAL sozlamalar/DB holatidan keladigan
/// ogohlantirishlar (Phase 4). Fake success yo'q: faqat haqiqiy holat.
void main() {
  Widget wrap(List<Override> overrides, Widget child) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: child),
        ),
      ),
    );
  }

  /// Shell branch'lariga go() qiladigan alert'lar uchun minimal router —
  /// haqiqiy route'larning stub'lari bilan. Faqat navigatsiya tekshiriladi.
  GoRouter routerWith(Widget alertCenter) {
    return GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => Scaffold(body: alertCenter),
        ),
        GoRoute(
          path: '/settings',
          builder: (_, __) =>
              const Scaffold(body: Center(child: Text('SETTINGS'))),
        ),
        GoRoute(
          path: '/payments/debts',
          builder: (_, __) =>
              const Scaffold(body: Center(child: Text('DEBTS'))),
        ),
      ],
    );
  }

  group('HomeAlertCenter', () {
    testWidgets("hammasi soz bo'lsa — blok ko'rsatilmaydi (0 yolg'on alert)",
        (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          telegramEnabled: true,
          lastBackupDate: DateTime(2026, 8, 1), // backup qilingan
          printerName: 'HP LaserJet',
        ),
      );

      await tester.pumpWidget(wrap(
        [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(
            FakePaymentRepository(), // qarz yo'q
          ),
        ],
        const HomeAlertCenter(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Diqqat talab'), findsNothing);
      expect(find.text('Kamera sozlanmagan'), findsNothing);
      expect(find.text('Telegram ulanmagan'), findsNothing);
    });

    testWidgets("kamera sozlanmagan — 'Kamera sozlanmagan' alert (yolg'on emas)",
        (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: const AppSettings(
          hikvisionEnabled: false, // kamera o'chirilgan
          telegramEnabled: true,
          printerName: 'HP LaserJet',
        ),
      );

      await tester.pumpWidget(wrap(
        [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(
            FakePaymentRepository(),
          ),
        ],
        const HomeAlertCenter(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Diqqat talab'), findsOneWidget);
      expect(find.text('Kamera sozlanmagan'), findsOneWidget);
    });

    testWidgets(
        "kamera yoqilgan, IP bo'sh — 'Kamera IP kiritilmagan' alert (review #4)",
        (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: const AppSettings(
          hikvisionEnabled: true, // yoqilgan
          hikvisionIp: null, // lekin IP yo'q
          telegramEnabled: true,
          printerName: 'HP LaserJet',
        ),
      );

      await tester.pumpWidget(wrap(
        [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(
            FakePaymentRepository(),
          ),
        ],
        const HomeAlertCenter(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Kamera IP kiritilmagan'), findsOneWidget);
    });

    testWidgets("telegram o'chiq + backup yo'q + printer yo'q — 3 ta alert",
        (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          telegramEnabled: false, // telegram o'chiq
          printerName: null, // printer yo'q
        ),
      );

      await tester.pumpWidget(wrap(
        [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(
            FakePaymentRepository(),
          ),
        ],
        const HomeAlertCenter(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Telegram ulanmagan'), findsOneWidget);
      expect(find.text('Backup qilinmagan'), findsOneWidget);
      expect(find.text('Printer sozlanmagan'), findsOneWidget);
    });

    testWidgets("ochiq qarzdorlik — real DB'dan alert", (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: const AppSettings(
          hikvisionEnabled: true,
          hikvisionIp: '192.168.1.64',
          telegramEnabled: true,
          printerName: 'HP LaserJet',
        ),
      );
      final paymentRepo = FakePaymentRepository(debts: [
        Debt(
          debtId: 'DEBT-1',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 8, 1),
          totalAmount: 300000,
          remainingAmount: 300000,
          billingPeriod: '2026-08',
        ),
        Debt(
          debtId: 'DEBT-2',
          studentIdentityId: 'M-EDU-2026-000002',
          studentName: 'Bekzod Karimov',
          dueDate: DateTime(2026, 8, 1),
          totalAmount: 150000,
          remainingAmount: 100000,
          billingPeriod: '2026-08',
        ),
      ]);

      await tester.pumpWidget(wrap(
        [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(paymentRepo),
        ],
        const HomeAlertCenter(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('2 ta ochiq qarzdorlik'), findsOneWidget);
      expect(find.text('Qarzdor talabalar ro\'yxatini ko\'ring'), findsOneWidget);
    });

    testWidgets(
        "alert bosilganda haqiqiy route ochiladi — go('/settings') (review #1)",
        (tester) async {
      final settingsRepo = FakeSettingsRepository(
        settings: const AppSettings(
          hikvisionEnabled: false, // kamera alerti chiqadi
          telegramEnabled: true,
          printerName: 'HP LaserJet',
        ),
      );

      await tester.pumpWidget(ProviderScope(
        overrides: [
          settingsRepositoryProvider.overrideWithValue(settingsRepo),
          paymentRepositoryProvider.overrideWithValue(FakePaymentRepository()),
        ],
        child: MaterialApp.router(routerConfig: routerWith(const HomeAlertCenter())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Kamera sozlanmagan'), findsOneWidget);

      // Alert row'ni bosamiz → shell branch'iga go() → SETTINGS stub ochiladi.
      await tester.tap(find.text('Kamera sozlanmagan'));
      await tester.pumpAndSettle();

      expect(find.text('SETTINGS'), findsOneWidget);
    });
  });
}
