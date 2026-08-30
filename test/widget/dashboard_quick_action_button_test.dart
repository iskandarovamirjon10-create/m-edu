import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/dashboard/presentation/widgets/dashboard_widgets.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: Center(child: child),
      ),
    );
  }

  group('DashboardQuickActionButton', () {
    testWidgets('bosilganda onTap chaqiriladi', (tester) async {
      var tapped = false;
      await tester.pumpWidget(wrap(
        DashboardQuickActionButton(
          icon: Icons.add,
          label: 'Yangi',
          color: Colors.blue,
          onTap: () => tapped = true,
        ),
      ));

      await tester.tap(find.byType(DashboardQuickActionButton));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });

    testWidgets('desktop hover — tugma kattalashadi (premium effekt)',
        (tester) async {
      await tester.pumpWidget(wrap(
        DashboardQuickActionButton(
          icon: Icons.add,
          label: 'Yangi',
          color: Colors.blue,
          onTap: () {},
        ),
      ));

      // Boshlang'ich holat: scale 1.0.
      AnimatedScale scaleOf() =>
          tester.widget<AnimatedScale>(find.byType(AnimatedScale));
      expect(scaleOf().scale, 1.0);

      // Sichqoncha kursorni tugma ustiga olib boramiz.
      final gesture =
          await tester.createGesture(kind: PointerDeviceKind.mouse);
      await gesture.addPointer(location: Offset.zero);
      addTearDown(gesture.removePointer);
      await tester.pump();

      await gesture.moveTo(
        tester.getCenter(find.byType(DashboardQuickActionButton)),
      );
      await tester.pumpAndSettle();

      // Hover'da scale 1.03 bo'ladi (animatsiya tugagach).
      expect(scaleOf().scale, 1.03);

      // Kursorni olib ketamiz — holat qaytadi.
      await gesture.moveTo(Offset.zero);
      await tester.pumpAndSettle();
      expect(scaleOf().scale, 1.0);
    });

    testWidgets("touch qurilmada hover effekti yo'q", (tester) async {
      // Default (touch) ko'rinishda hech qanday mouse hodisasi yuborilmaydi —
      // tugma normal holatda qoladi va tap ishlaydi.
      var tapped = false;
      await tester.pumpWidget(wrap(
        DashboardQuickActionButton(
          icon: Icons.add,
          label: 'Yangi',
          color: Colors.blue,
          onTap: () => tapped = true,
        ),
      ));

      final scale =
          tester.widget<AnimatedScale>(find.byType(AnimatedScale));
      expect(scale.scale, 1.0);

      await tester.tap(find.byType(DashboardQuickActionButton));
      await tester.pump();
      expect(tapped, isTrue);
    });
  });
}
