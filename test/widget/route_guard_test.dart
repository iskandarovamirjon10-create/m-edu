import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:m_edu/core/auth/google_auth_service.dart';
import 'package:m_edu/core/router/access_denied_page.dart';
import 'package:m_edu/core/router/app_router.dart';
import 'package:m_edu/features/auth/presentation/pages/login_page.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/auth/presentation/providers/google_auth_provider.dart';
import 'package:m_edu/features/dashboard/presentation/pages/more_page.dart';
import 'package:m_edu/features/gamification/presentation/pages/gamification_page.dart';

import '../helpers/secure_storage_mock.dart';

/// PHASE D — authorization-aware routing testlari.
///
/// Himoyalangan marshrut:
/// - Unauthenticated → /login
/// - Authenticated + ruxsatsiz rol → AccessDeniedPage
/// - Authenticated + ruxsatli rol → sahifa
void main() {
  setUp(() {
    mockSecureStorageChannel();
    secureStorageMock.clear();
  });

  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  AuthState authFor(String? role) {
    if (role == null) return const AuthStateUnauthenticated();
    return AuthStateAuthenticated(
      userId: 'u1',
      role: role,
      name: 'Test',
    );
  }

  Widget buildApp(GoRouter router, AuthState state) {
    return ProviderScope(
      overrides: [
        // Real controller appStarted()'da storage'ga uriladi — fake.
        authControllerProvider.overrideWith((ref) => _FakeAuthController(state)),
        // Firebase.initialized bo'lmagan test muhitida GoogleSignIn button
        // FirebaseException tashlaydi — no-op mock bilan to'xtatamiz.
        googleAuthProvider.overrideWithValue(const _NoOpGoogleAuthService()),
        googleAuthControllerProvider.overrideWith((ref) => _FakeGoogleAuthController()),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  Future<void> pumpAndGo(
    WidgetTester tester,
    String? role, // null = unauthenticated
    String location,
  ) async {
    final state = authFor(role);
    authStateNotifier.value = state;
    final router = AppRouter.create();
    await tester.pumpWidget(buildApp(router, state));
    await tester.pump();
    router.go(location);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('1. unauthenticated user /finance ga kira olmaydi → login',
      (tester) async {
    await pumpAndGo(tester, null, '/finance');
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(AccessDeniedPage), findsNothing);
  });

  // AUDIT P2-03: matritsa bo'yicha teacher financeView/reportsView GA EGA
  // (ko'rish), lekin financeCreate (to'lov qabul qilish) YO'Q. Route guard
  // financeCreate talab qiladigan /payments/new ni DENY qiladi.
  testWidgets('2. teacher /payments/new ga kira olmaydi → AccessDenied',
      (tester) async {
    await pumpAndGo(tester, 'teacher', '/payments/new');
    expect(find.byType(AccessDeniedPage), findsOneWidget);
    expect(find.text('Ruxsat yo\'q'), findsOneWidget);
  });

  testWidgets('3. teacher /groups ga kira olmaydi → AccessDenied',
      (tester) async {
    await pumpAndGo(tester, 'teacher', '/groups');
    expect(find.byType(AccessDeniedPage), findsOneWidget);
  });

  testWidgets(
      '4. unknown /settings ga kira olmaydi → AccessDenied (fail-closed)',
      (tester) async {
    await pumpAndGo(tester, 'unknown', '/settings');
    expect(find.byType(AccessDeniedPage), findsOneWidget);
  });

  testWidgets('5. admin /finance ga kiradi → FinancePage (ALLOW)',
      (tester) async {
    await pumpAndGo(tester, 'admin', '/finance');
    expect(find.byType(AccessDeniedPage), findsNothing);
    expect(find.byType(LoginPage), findsNothing);
  });

  testWidgets('6. teacher /more ga kiradi → MorePage (ALLOW)', (tester) async {
    await pumpAndGo(tester, 'teacher', '/more');
    expect(find.byType(AccessDeniedPage), findsNothing);
    expect(find.byType(MorePage), findsOneWidget);
  });

  // Gamification sahifasi moliyaviy agregatlardan (yig'ilgan summa, to'lov
  // soni) ball hisoblagani uchun financeView talab qiladi. Staff'da yo'q.
  testWidgets('7. staff /gamification ga kira olmaydi → AccessDenied',
      (tester) async {
    await pumpAndGo(tester, 'staff', '/gamification');
    expect(find.byType(AccessDeniedPage), findsOneWidget);
  });

  testWidgets('8. admin /gamification ga kiradi → GamificationPage (ALLOW)',
      (tester) async {
    await pumpAndGo(tester, 'admin', '/gamification');
    expect(find.byType(AccessDeniedPage), findsNothing);
    expect(find.byType(GamificationPage), findsOneWidget);
  });
}

/// Berilgan holatda turuvchi fake auth controller (RBAC testlari uchun).
class _FakeAuthController extends AuthController {
  _FakeAuthController(AuthState state) : super() {
    this.state = state;
  }
}

class _FakeGoogleAuthController extends GoogleAuthController {
  _FakeGoogleAuthController() : super(const _NoOpGoogleAuthService());
  @override
  Future<GoogleAuthResult> signIn() async => const GoogleAuthError(message: 'mock', code: 'TEST');
}

class _NoOpGoogleAuthService implements GoogleAuthService {
  const _NoOpGoogleAuthService();
  @override
  Future<GoogleAuthResult> signIn() async => const GoogleAuthError(message: 'mock', code: 'TEST');
  @override
  Future<void> signOut() async {}  @override
  bool get isSignedIn => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
