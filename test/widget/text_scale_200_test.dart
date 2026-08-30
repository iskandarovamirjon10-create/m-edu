import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/shared/design_system/app/app_bottom_navigation.dart';
import 'package:m_edu/shared/design_system/app/app_button.dart';

/// C-39 — 200% text scaling (Design Constitution v4.0 §AC: text usable at
/// 200% without clipping; §J: reflow, no ellipsis where meaning is lost).
///
/// 200% da P0-tegilgan interaktiv primitivlarda overflow bo'lmasligi
/// tekshiriladi (sahifalar scroll/reflow asosida ishlaydi).
void main() {
  testWidgets('AppButton 200% scale — overflow yo\\x27q', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: Column(children: [
            AppButton(label: 'Talaba qo\\x27shish', onPressed: () {}),
            AppButton(
              type: AppButtonType.destructive,
              label: 'O\\x27chirish',
              onPressed: () {},
            ),
            AppButton(
              type: AppButtonType.secondary,
              label: 'Yangi to\\x27lov qo\\x27shish',
              onPressed: () {},
            ),
          ]),
        ),
      ),
    ));

    // 2.0 scale haqiqatan qo'llanganini tasdiqlash.
    final media = MediaQuery.of(tester.element(find.byType(Scaffold)));
    expect(media.textScaler.scale(16), 32);

    expect(tester.takeException(), isNull);
  });

  testWidgets('AppBottomNavigationBar 200% scale — overflow yo\\x27q',
      (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    const destinations = [
      AppNavDestination(
          icon: Icons.home, activeIcon: Icons.home, label: 'Bosh sahifa'),
      AppNavDestination(
          icon: Icons.people,
          activeIcon: Icons.people,
          label: "O\\x27quvchilar"),
      AppNavDestination(
          icon: Icons.event, activeIcon: Icons.event, label: 'Davomat'),
      AppNavDestination(
          icon: Icons.payments,
          activeIcon: Icons.payments,
          label: 'To\\x27lovlar'),
      AppNavDestination(
          icon: Icons.more_horiz,
          activeIcon: Icons.more_horiz,
          label: 'Boshqa'),
    ];

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: const SizedBox(),
        bottomNavigationBar: AppBottomNavigationBar(
          currentIndex: 0,
          destinations: destinations,
          onDestinationSelected: (_) {},
        ),
      ),
    ));

    expect(tester.takeException(), isNull);
    // Itemlar hali ham bosiladigan (≥48dp) — label 200% da ham.
    final navSize = tester.getSize(find.byType(AppBottomNavigationBar));
    expect(navSize.height, greaterThanOrEqualTo(48));
  });
}
