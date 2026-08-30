import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/dashboard/presentation/pages/more_page.dart';

/// PHASE C (UX) — More sahifasi ruxsatsiz bo'limlarni yashirishi.
///
/// Security command'lar ichida (mustaqil); bu test UI ko'rinishini
/// tekshiradi — ruxsatsiz foydalanuvchi moliya/sozlamalar yozuvlarini
/// ko'rmasligi kerak. Viewport baland qilinadi — lazy sliverlar ham
/// quriladi (yashiringan yozuv "built emas" xatosidan farq qiladi).
void main() {
  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  Widget buildApp(String role) {
    return ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(
          (ref) => _FakeAuthController(role),
        ),
      ],
      child: const MaterialApp(home: MorePage()),
    );
  }

  void useTallViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 2800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  testWidgets('teacher moliya amallari va sozlamalarni ko\'rmaydi',
      (tester) async {
    useTallViewport(tester);
    await tester.pumpWidget(buildApp('teacher'));
    await tester.pumpAndSettle();

    // Teacher: financeView BOR (ko'rish), financeCreate YO'Q (amal).
    expect(find.text('Moliya'), findsOneWidget);
    expect(find.text("To'lov qabul qilish"), findsNothing);
    expect(find.text('Xarajat'), findsNothing);

    // Teacher: teachersView/groupsView YO'Q, settingsView YO'Q.
    expect(find.text("O'qituvchilar"), findsNothing);
    expect(find.text('Guruhlar'), findsNothing);
    expect(find.text('Sozlamalar'), findsNothing);
    expect(find.text('Foydalanuvchilar'), findsNothing);

    // Teacher uchun ochiq: Face ID (faceIdUse), QR (attendanceCreate).
    expect(find.text('Face ID'), findsOneWidget);
    expect(find.text('QR skaner'), findsOneWidget);
    expect(find.text('Bildirishnomalar'), findsOneWidget);
  });

  testWidgets('admin moliya va sozlamalarni ko\'radi', (tester) async {
    useTallViewport(tester);
    await tester.pumpWidget(buildApp('admin'));
    await tester.pumpAndSettle();

    expect(find.text('Moliya'), findsOneWidget);
    expect(find.text("To'lov qabul qilish"), findsOneWidget);
    expect(find.text('Sozlamalar'), findsOneWidget);
    expect(find.text('Foydalanuvchilar'), findsOneWidget);
    expect(find.text('Face ID'), findsOneWidget);
  });

  testWidgets('staff gamification/ballarni ko\'rmaydi (financeView gating)',
      (tester) async {
    useTallViewport(tester);
    await tester.pumpWidget(buildApp('staff'));
    await tester.pumpAndSettle();

    // Gamification — moliyaviy agregatlardan hisoblanadi → staff'ga yo'q.
    expect(find.text('O\'yinlashtirish'), findsNothing);
    // Staff'da ochiq qolganlar (UX fail-closed bo'lsa ham).
    expect(find.text('Face ID'), findsNothing);
    expect(find.text('Bildirishnomalar'), findsOneWidget);
  });

  testWidgets('unknown role deyarli hech narsa ko\'rmaydi (fail-closed UX)',
      (tester) async {
    useTallViewport(tester);
    await tester.pumpWidget(buildApp('unknown'));
    await tester.pumpAndSettle();

    expect(find.text('Moliya'), findsNothing);
    expect(find.text('Hisobotlar'), findsNothing);
    expect(find.text('Sozlamalar'), findsNothing);
    expect(find.text('Face ID'), findsNothing);
    expect(find.text('Zaxira nusxa'), findsNothing);
    expect(find.text('Guruhlar'), findsNothing);
    // Permission talab qilmaydigan yozuv (bildirishnomalar) qoladi.
    expect(find.text('Bildirishnomalar'), findsOneWidget);
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
