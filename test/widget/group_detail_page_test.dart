import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:m_edu/core/router/app_router.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/groups/presentation/pages/create_group_page.dart';
import 'package:m_edu/features/groups/presentation/pages/group_detail_page.dart';
import 'package:m_edu/features/groups/presentation/providers/group_providers.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/presentation/providers/identity_providers.dart';
import 'package:m_edu/features/scheduling/domain/entities/room.dart';
import 'package:m_edu/features/scheduling/presentation/providers/schedule_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/presentation/providers/settings_providers.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/students/presentation/providers/student_providers.dart';

/// Regression test (C-xx): guruh kartasiga bosilganda `/groups/:groupId`
/// yo'li tafsilot sahifasini ochadi — ilgari bu yo'l router'da mavjud
/// emas edi va "Sahifa topilmadi / no routes for location: /groups/GRP-..."
/// xatosi chiqardi.
void main() {
  setUp(() {
    // Router'ning auth guard'idan o'tish: redirect `authStateNotifier`'ni
    // o'qiydi, shuning uchun to'g'ridan-to'g'ri o'rnatamiz.
    authStateNotifier.value = const AuthStateAuthenticated(
      userId: 'test-user',
      role: 'admin',
      name: 'Test Admin',
    );
  });

  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  Widget buildApp(GoRouter router, Group? group) {
    return ProviderScope(
      overrides: [
        // Real AppRouter ishlatiladi — faqat ma'lumot provider'lari fake.
        // authControllerProvider ham fake — test muhitida SplashPage
        // session/plugin'larga urilib `Unauthenticated` holatga o'tib
        // redirect'ni buzmasligi uchun.
        authControllerProvider.overrideWith((ref) => _FakeAuthController()),
        groupDetailProvider.overrideWith((ref, groupId) async => group),
        studentsByGroupProvider.overrideWith(
          (ref, groupId) async => const <Student>[],
        ),
        identityListProvider.overrideWith((ref) async => const <Identity>[]),
        // Guruh yaratish sahifasi uchun (static route priority testi).
        subjectListProvider.overrideWith((ref) async => const <Subject>[]),
        teachersListProvider.overrideWith((ref) async => const <Identity>[]),
        roomListProvider.overrideWith((ref) async => const <Room>[]),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  /// Router'ni chizadi va kerakli sahifaga o'tadi.
  ///
  /// Avvalgi frame'da SplashPage (cheksiz CircularProgressIndicator)
  /// bor — `pumpAndSettle` u bilan hech qachon tinchlamaydi, shuning
  /// uchun birinchi `pump`'dan so'ng darhol navigatsiya qilamiz.
  Future<void> pumpAndNavigate(
    WidgetTester tester,
    GoRouter router,
    Group? group,
    String location,
  ) async {
    await tester.pumpWidget(buildApp(router, group));
    await tester.pump();
    router.go(location);
    await tester.pumpAndSettle();
  }

  Group buildGroup() {
    return const Group(
      groupId: 'GRP-20260809-4662',
      name: 'Matematika-101',
      code: 'MATH-101',
      capacity: 20,
      currentSize: 5,
      subject: 'Matematika',
      monthlyFee: 250000,
    );
  }

  testWidgets(
      "guruh tafsilot sahifasi ochiladi — 'Sahifa topilmadi' yo'q (regression)",
      (tester) async {
    final router = AppRouter.create();
    await pumpAndNavigate(
      tester,
      router,
      buildGroup(),
      '/groups/GRP-20260809-4662',
    );

    expect(find.text('Sahifa topilmadi'), findsNothing);
    expect(find.byType(GroupDetailPage), findsOneWidget);
    expect(find.text('Matematika-101'), findsOneWidget);
    // P1.5: guruh sahifasiga Davomat kartasi qo'shildi — a'zolar bo'limi
    // endi viewport fold ostida (lazy ListView). Unga scroll qilamiz.
    await tester.scrollUntilVisible(
      find.text("A'zolar"),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text("A'zolar"), findsOneWidget);
  });

  testWidgets("mavjud bo'lmagan guruh 'Guruh topilmadi' ko'rsatadi",
      (tester) async {
    final router = AppRouter.create();
    await pumpAndNavigate(tester, router, null, '/groups/GRP-NOT-FOUND');

    expect(find.text('Guruh topilmadi'), findsOneWidget);
    expect(find.text('Sahifa topilmadi'), findsNothing);
  });

  testWidgets("guruhni tahrirlash sahifasi forma'ni to'ldiradi",
      (tester) async {
    final router = AppRouter.create();
    await pumpAndNavigate(
      tester,
      router,
      buildGroup(),
      '/groups/GRP-20260809-4662/edit',
    );

    // Edit rejimida forma mavjud guruh ma'lumotlari bilan to'ldiriladi
    // (prefill build fazasidan tashqarida ishlaydi — crash bo'lmaydi).
    expect(find.text('Guruhni tahrirlash'), findsOneWidget);
    expect(find.text('Matematika-101'), findsOneWidget);
    expect(find.text('MATH-101'), findsOneWidget);
    expect(find.text('Sahifa topilmadi'), findsNothing);
  });

  testWidgets(
      "'/groups/create' static route ':groupId' bilan ziddiyatga kirmaydi",
      (tester) async {
    final router = AppRouter.create();
    await pumpAndNavigate(tester, router, buildGroup(), '/groups/create');

    expect(find.byType(CreateGroupPage), findsOneWidget);
    expect(find.text('Sahifa topilmadi'), findsNothing);
  });
}

/// Auth holatini Authenticated'da ushlab turadigan fake controller.
///
/// [AuthController]'dan meros — provider turi (`StateNotifierProvider<AuthController, AuthState>`)
/// aniq sinfni talab qiladi. `appStarted()` chaqirilmaydi, shuning uchun testda
/// session/plugin'larga urilmaydi.
class _FakeAuthController extends AuthController {
  _FakeAuthController() : super() {
    state = const AuthStateAuthenticated(
      userId: 'test-user',
      role: 'admin',
      name: 'Test Admin',
    );
  }
}
