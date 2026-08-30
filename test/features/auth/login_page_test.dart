import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/auth/presentation/pages/login_page.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/auth/presentation/providers/google_auth_provider.dart';
import 'package:m_edu/core/auth/google_auth_service.dart';

import '../../helpers/secure_storage_mock.dart';

/// LoginPage widget testlari.
///
/// Google Sign-In tugmasi Firebase.initialized bo'lmagan test muhitida
/// FirebaseException tashlaydi — shuning uchun Google auth providerlari
/// no-op mock bilan override qilinadi.
///
/// LoginPage'da cheksiz animatsiyalar (breathing logo, aurora background)
/// mavjud — `pumpAndSettle` ishlatilmaydi, `pump(Duration)` ishlatiladi.
void main() {
  setUp(() {
    mockSecureStorageChannel();
    secureStorageMock.clear();
  });

  tearDown(() {
    authStateNotifier.value = const AuthStateInitial();
  });

  /// LoginPage'ni test muhitida quradi.
  Widget buildLoginPage({AuthState? initialState}) {
    final state = initialState ?? const AuthStateUnauthenticated();
    authStateNotifier.value = state;
    return ProviderScope(
      overrides: [
        authControllerProvider.overrideWith((ref) {
          return _FakeAuthController(state);
        }),
        // Google auth — Firebase dependency yo'q no-op mock.
        googleAuthProvider.overrideWithValue(_NoOpGoogleAuthService()),
        googleAuthControllerProvider.overrideWith((ref) {
          return _FakeGoogleAuthController();
        }),
      ],
      child: const MaterialApp(home: LoginPage()),
    );
  }

  /// LoginPage'da cheksiz animatsiyalar mavjud — pumpAndSettle timeout
      /// beradi. Shuning uchun bir nechta pump() bilan yetarli frame'ni
      /// kutamiz.
  Future<void> pumpLogin(WidgetTester tester) async {
    await tester.pumpWidget(buildLoginPage());
    // Breathing logo + aurora — 3-4 frame yetarli.
    await tester.pump(const Duration(milliseconds: 200));
  }

  testWidgets('login form has email and password fields', (tester) async {
    await pumpLogin(tester);
    expect(find.byType(TextFormField), findsNWidgets(2));
  });

  testWidgets('M-Edu branding is displayed', (tester) async {
    await pumpLogin(tester);
    expect(find.text('M-Edu'), findsOneWidget);
  });

  testWidgets('error state shows error message', (tester) async {
    await tester.pumpWidget(
      buildLoginPage(
        initialState: const AuthStateError(
          message: 'Test xato xabari',
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Test xato xabari'), findsOneWidget);
  });

  testWidgets('loading state does not crash', (tester) async {
    await tester.pumpWidget(
      buildLoginPage(
        initialState: const AuthStateLoading(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets('register text buttons are present', (tester) async {
    await pumpLogin(tester);
    expect(find.byType(TextButton), findsWidgets);
  });

  testWidgets('Google Sign-In section is displayed', (tester) async {
    await pumpLogin(tester);
    expect(find.text('OR'), findsOneWidget);
  });
}

/// Fake auth controller that doesn't trigger storage access.
class _FakeAuthController extends AuthController {
  _FakeAuthController(AuthState state) : super() {
    this.state = state;
  }
}

/// Fake Google auth controller that doesn't touch Firebase.
class _FakeGoogleAuthController extends GoogleAuthController {
  _FakeGoogleAuthController()
      : super(_NoOpGoogleAuthService());

  @override
  Future<GoogleAuthResult> signIn() async {
    return const GoogleAuthError(
      message: 'Google Sign-In not available in tests',
      code: 'TEST_MOCK',
    );
  }
}

/// No-op Google auth service for testing.
///
/// Firebase/Google dependency yo'q — `signIn`/`signOut` no-op.
/// `implements` ishlatiladi (extends emas) — parent constructor
/// Firebase.initialized talab qiladi, test muhitida mavjud emas.
class _NoOpGoogleAuthService implements GoogleAuthService {
  const _NoOpGoogleAuthService();

  @override
  Future<GoogleAuthResult> signIn() async {
    return const GoogleAuthError(
      message: 'Not available in tests',
      code: 'TEST_MOCK',
    );
  }

  @override
  Future<void> signOut() async {}

  @override
  bool get isSignedIn => false;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
