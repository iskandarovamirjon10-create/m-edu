import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/auth/google_auth_service.dart';
import 'package:m_edu/core/router/access_denied_page.dart';
import 'package:m_edu/core/router/app_router.dart';
import 'package:m_edu/core/router/not_found_page.dart';
import 'package:m_edu/features/auth/presentation/pages/login_page.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/auth/presentation/providers/google_auth_provider.dart';
import 'package:m_edu/features/dashboard/presentation/pages/more_page.dart';

import '../helpers/secure_storage_mock.dart';

/// PHASE D — DEEP LINK + GLOBAL ERROR (brief §8, §24).
///
/// • Noma'lum marshrut → professional 404 (NotFoundPage).
/// • Semantic deep link → to'g'ri branch'da ochiladi (shell yashaydi).
/// • Ruxsatsiz deep link → AccessDenied (route guard).
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

  Future<void> pumpWithAuth(
    WidgetTester tester,
    String? role,
    String location,
  ) async {
    final state = authFor(role);
    authStateNotifier.value = state;
    final router = AppRouter.create();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FakeAuthController(state),
          ),
          googleAuthProvider.overrideWithValue(const _NoOpGoogleAuthService()),
          googleAuthControllerProvider.overrideWith((ref) => _FakeGoogleAuthController()),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    router.go(location);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  testWidgets('1. noma\'lum marshrut → 404 NotFoundPage (§24)',
      (tester) async {
    await pumpWithAuth(tester, 'admin', '/nonexistent-page');

    expect(find.byType(NotFoundPage), findsOneWidget);
    expect(find.text('Sahifa topilmadi'), findsWidgets);
  });

  testWidgets('2. semantic deep link /more → shell ichida MorePage (§8)',
      (tester) async {
    await pumpWithAuth(tester, 'admin', '/more');

    // Deep link to'g'ri branch'da ochiladi — shell yashab qoladi
    // (pastki navigatsiya hali ham ko'rinadi).
    expect(find.byType(MorePage), findsOneWidget);
    expect(find.byKey(const Key('floating-nav-bar')), findsOneWidget);
  });

  testWidgets('3. ruxsatsiz deep link /groups (teacher) → AccessDenied (§9)',
      (tester) async {
    await pumpWithAuth(tester, 'teacher', '/groups');

    expect(find.byType(AccessDeniedPage), findsOneWidget);
    expect(find.text('Ruxsat yo\'q'), findsOneWidget);
  });

  testWidgets('4. autentifikatsiyasiz deep link → login (auth guard)',
      (tester) async {
    await pumpWithAuth(tester, null, '/finance');

    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(AccessDeniedPage), findsNothing);
    expect(find.byType(NotFoundPage), findsNothing);
  });
}


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
