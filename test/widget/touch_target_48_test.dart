import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/theme/app_density.dart';
import 'package:m_edu/shared/design_system/app/app_button.dart';

/// C-38 — 48x48dp touch target (Design Constitution v4.0 §G/§AC INVARIANT).
///
/// Touch platformalarda interaktiv nazorat >=48dp; desktop density
/// rejimlari o'zgarmaydi (v4.0 §F density — desktop konsepti).
void main() {
  Widget wrap(Widget child,
      {TargetPlatform platform = TargetPlatform.android}) {
    return MaterialApp(
      theme: ThemeData(platform: platform),
      home: Scaffold(body: Center(child: child)),
    );
  }

  double buttonHeight(WidgetTester tester) =>
      tester.getSize(find.byType(FilledButton)).height;

  test('AppDensity.minTouchTarget = 48', () {
    expect(AppDensity.minTouchTarget, 48);
  });

  group('AppButton - Android (touch)', () {
    testWidgets('sm button height >= 48dp', (tester) async {
      await tester.pumpWidget(wrap(
        AppButton(size: AppButtonSize.sm, label: 'Qidirish'),
      ));
      expect(buttonHeight(tester), greaterThanOrEqualTo(48));
    });

    testWidgets('md button height >= 48dp', (tester) async {
      await tester.pumpWidget(wrap(
        AppButton(label: 'Talaba qoshish'),
      ));
      expect(buttonHeight(tester), greaterThanOrEqualTo(48));
    });

    testWidgets('compact density still floors at 48dp', (tester) async {
      await tester.pumpWidget(AppDensityScope(
        density: AppDensity.compact,
        child: wrap(AppButton(label: 'Saqlash')),
      ));
      expect(buttonHeight(tester), greaterThanOrEqualTo(48));
    });
  });

  group('AppButton - Desktop (density preserved)', () {
    testWidgets('sm button stays compact (<48)', (tester) async {
      await tester.pumpWidget(wrap(
        AppButton(size: AppButtonSize.sm, label: 'Qidirish'),
        platform: TargetPlatform.linux,
      ));
      expect(buttonHeight(tester), lessThan(48));
    });

    testWidgets('md button keeps desktop density (<48, no floor)',
        (tester) async {
      await tester.pumpWidget(wrap(
        AppButton(label: 'Saqlash'),
        platform: TargetPlatform.linux,
      ));
      // Desktop: 48dp floor qo'llanmaydi (v4.0 §F density — desktop
      // konsepti); Material adaptive visualDensity yanada siqadi (40).
      expect(buttonHeight(tester), lessThan(48));
    });
  });
}
