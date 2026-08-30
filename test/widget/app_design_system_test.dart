import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/theme/app_colors.dart';
import 'package:m_edu/shared/design_system/app/app_button.dart';
import 'package:m_edu/shared/design_system/app/app_card.dart';
import 'package:m_edu/shared/design_system/app/app_metric_card.dart';
import 'package:m_edu/shared/design_system/app/app_status_chip.dart';

/// PHASE C — kanonik App komponentlari testlari.
///
/// Rang tekshiruvlari deterministik: MaterialApp'da AppColors extensioni
/// berilmagan — `context.appColors` [AppColors.light] ga tushadi.
void main() {
  Widget wrap(Widget child) => MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: child),
        ),
      );

  // ─── AppButton (brief §22 action hierarchy) ───────────────────────────
  group('AppButton', () {
    testWidgets('primary filled — label ko\x27rsatiladi va tap ishlaydi',
        (tester) async {
      var tapped = false;
      await tester.pumpWidget(wrap(AppButton(
        label: 'Talaba qo\x27shish',
        onPressed: () => tapped = true,
      )));

      expect(find.byType(FilledButton), findsOneWidget);
      expect(find.text('Talaba qo\x27shish'), findsOneWidget);

      await tester.tap(find.text('Talaba qo\x27shish'));
      expect(tapped, isTrue);
    });

    testWidgets('har bir type to\x27g\x27ri Material tugmasini ishlatadi',
        (tester) async {
      await tester.pumpWidget(wrap(Column(children: [
        AppButton(type: AppButtonType.primary, label: 'P'),
        AppButton(type: AppButtonType.secondary, label: 'S'),
        AppButton(type: AppButtonType.tertiary, label: 'T'),
        AppButton(type: AppButtonType.destructive, label: 'D'),
      ])));

      expect(
          find.byType(FilledButton), findsNWidgets(2)); // primary+destructive
      expect(find.byType(OutlinedButton), findsOneWidget); // secondary
      expect(find.byType(TextButton), findsOneWidget); // tertiary
    });

    testWidgets('disabled — onPressed null bo\x27lsa tap bloklanadi',
        (tester) async {
      var tapped = false;
      await tester.pumpWidget(wrap(AppButton(label: 'Yuborish')));
      await tester.tap(find.text('Yuborish'), warnIfMissed: false);
      expect(tapped, isFalse);
    });

    testWidgets('loading — spinner ko\x27rinadi va tap bloklanadi',
        (tester) async {
      var tapped = false;
      await tester.pumpWidget(wrap(AppButton(
        label: 'Saqlash',
        isLoading: true,
        onPressed: () => tapped = true,
      )));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.text('Saqlash'), warnIfMissed: false);
      expect(tapped, isFalse);
    });

    testWidgets('icon — label bilan birga ko\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(AppButton(
        label: 'Qidirish',
        icon: Icons.search,
      )));
      expect(find.byIcon(Icons.search), findsOneWidget);
    });
  });

  // ─── AppCard (brief §13 surface levels) ───────────────────────────────
  group('AppCard', () {
    testWidgets('child render va onTap ishlaydi', (tester) async {
      var tapped = false;
      await tester.pumpWidget(wrap(AppCard(
        onTap: () => tapped = true,
        child: const Text('Karta mazmuni'),
      )));

      expect(find.text('Karta mazmuni'), findsOneWidget);
      await tester.tap(find.text('Karta mazmuni'));
      expect(tapped, isTrue);
    });

    testWidgets('barcha elevation darajalari quriladi', (tester) async {
      await tester.pumpWidget(wrap(Column(children: [
        AppCard(child: const Text('flat')),
        AppCard(
            elevation: AppCardElevation.elevated,
            child: const Text('elevated')),
        AppCard(
            elevation: AppCardElevation.floating,
            child: const Text('floating')),
      ])));

      expect(find.text('flat'), findsOneWidget);
      expect(find.text('elevated'), findsOneWidget);
      expect(find.text('floating'), findsOneWidget);
    });
  });

  // ─── AppStatusChip (brief §10-12 semantic tone + §47) ─────────────────
  group('AppStatusChip', () {
    testWidgets('tone rangini ikon va matnga beradi', (tester) async {
      await tester.pumpWidget(wrap(AppStatusChip(
        tone: AppStatusTone.success,
        icon: Icons.check_circle,
        label: 'To\x27langan',
      )));

      expect(find.text('To\x27langan'), findsOneWidget);
      final icon = tester.widget<Icon>(find.byIcon(Icons.check_circle));
      expect(icon.color, AppColors.light.success);
    });

    testWidgets('barcha tone lar ko\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(Column(children: [
        for (final tone in AppStatusTone.values)
          AppStatusChip(tone: tone, icon: Icons.circle, label: tone.name),
      ])));

      for (final tone in AppStatusTone.values) {
        expect(find.text(tone.name), findsOneWidget);
      }
    });

    testWidgets('semantic qoida: success=yashil, error=qizil', (tester) async {
      await tester.pumpWidget(wrap(Column(children: [
        AppStatusChip(
            tone: AppStatusTone.success, icon: Icons.check, label: 'ok'),
        AppStatusChip(
            tone: AppStatusTone.error, icon: Icons.close, label: 'bad'),
      ])));

      final ok = tester.widget<Icon>(find.byIcon(Icons.check));
      final bad = tester.widget<Icon>(find.byIcon(Icons.close));
      expect(ok.color, AppColors.light.success);
      expect(bad.color, AppColors.light.error);
    });
  });

  // ─── AppMetricCard (brief §32) ────────────────────────────────────────
  group('AppMetricCard', () {
    testWidgets('label, value, unit, context ko\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(const AppMetricCard(
        label: 'Davomat',
        value: '91.8',
        unit: '%',
        contextLabel: '↑ 2.4% bu oy',
      )));

      expect(find.text('Davomat'), findsOneWidget);
      expect(find.text('91.8'), findsOneWidget);
      expect(find.text('%'), findsOneWidget);
      expect(find.text('↑ 2.4% bu oy'), findsOneWidget);
    });

    testWidgets('trend ikon va rangi ko\x27rsatiladi', (tester) async {
      await tester.pumpWidget(wrap(AppMetricCard(
        label: 'Daromad',
        value: '5 000 000',
        unit: 'so\x27m',
        trendIcon: Icons.trending_up,
        trendLabel: '+12% o\x27tgan oyga',
        trendColor: AppColors.light.success,
      )));

      final icon = tester.widget<Icon>(find.byIcon(Icons.trending_up));
      expect(icon.color, AppColors.light.success);
      expect(find.text('+12% o\x27tgan oyga'), findsOneWidget);
    });
  });
}
