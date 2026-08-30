import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:google_sign_in/google_sign_in.dart';

import '../constants/secrets.dart';
import '../services/app_logger.dart';
import 'windows_google_oauth.dart';

/// Google authentication result.
sealed class GoogleAuthResult {
  const GoogleAuthResult();
}

/// Successful Google authentication.
class GoogleAuthSuccess extends GoogleAuthResult {
  final String email;
  final String displayName;
  final String? photoUrl;
  final String firebaseUid;
  final String? idToken;

  const GoogleAuthSuccess({
    required this.email,
    required this.displayName,
    this.photoUrl,
    required this.firebaseUid,
    this.idToken,
  });
}

/// User cancelled the Google Sign-In flow.
class GoogleAuthCancelled extends GoogleAuthResult {
  const GoogleAuthCancelled();
}

/// Google Sign-In failed due to a recoverable error.
class GoogleAuthError extends GoogleAuthResult {
  final String message;
  final String? code;

  const GoogleAuthError({required this.message, this.code});
}

/// Google authentication service — wraps google_sign_in + firebase_auth.
///
/// Produces a Firebase-authenticated user that can be linked to M-EDU
/// application identity. Does NOT manage M-EDU sessions — that is
/// the responsibility of AuthController.
///
/// Security:
/// - Never logs OAuth tokens, ID tokens, or refresh tokens.
/// - Never hardcodes client IDs.
/// - Requires network for initial authentication (offline not supported).
class GoogleAuthService {
  final GoogleSignIn _googleSignIn;
  final fb.FirebaseAuth? _firebaseAuthOverride;
  fb.FirebaseAuth? _firebaseAuth;

  /// Lazily resolved FirebaseAuth instance — eagerly accessing
  /// `FirebaseAuth.instance` before `Firebase.initializeApp()` triggers
  /// `[core/no-app]` in offline-first mode (no Firebase config).
  fb.FirebaseAuth get _auth {
    if (_firebaseAuth != null) return _firebaseAuth!;
    _firebaseAuth = _firebaseAuthOverride ?? fb.FirebaseAuth.instance;
    return _firebaseAuth!;
  }

  /// Web client ID — build vaqtida --dart-define=GOOGLE_WEB_CLIENT_ID=... orqali beriladi.
  /// Agar berilmasa, google_sign_in v6+ xato beradi (lekin ilova ishlaydi).
  static String get _webClientId => AppSecrets.googleWebClientId;

  GoogleAuthService({
    GoogleSignIn? googleSignIn,
    fb.FirebaseAuth? firebaseAuth,
  })  : _googleSignIn = googleSignIn ??
            GoogleSignIn(
              scopes: ['email', 'profile'],
              serverClientId: _webClientId,
            ),
        _firebaseAuthOverride = firebaseAuth;

  /// Whether Google Sign-In is available on this platform.
  ///
  /// Google Sign-In is supported on Android, iOS, and web via google_sign_in
  /// plugin. Windows uses browser-based OAuth (separate implementation).
  static bool get isSupported => true; // Both mobile and Windows have auth paths

  /// Perform Google Sign-In and authenticate with Firebase.
  ///
  /// Platform dispatch:
  /// - Windows: browser-based OAuth via localhost callback server
  /// - Android/iOS: native Google Sign-In via google_sign_in plugin
  ///
  /// Returns [GoogleAuthSuccess] on success, [GoogleAuthCancelled] if user
  /// cancels, or [GoogleAuthError] on failure.
  Future<GoogleAuthResult> signIn() async {
    // Windows: browser-based OAuth flow
    if (Platform.isWindows) {
      return _signInWindows();
    }
    // Android/iOS: native google_sign_in plugin
    return _signInMobile();
  }

  /// Windows browser-based OAuth implementation.
  ///
  /// Opens Google consent screen in system browser, captures callback via
  /// local HTTP server, exchanges code for Firebase credential.
  Future<GoogleAuthResult> _signInWindows() async {
    try {
      final result = await WindowsGoogleOAuth.signIn(
        webClientId: _webClientId,
      );

      switch (result) {
        case WindowsOAuthSuccess(:final idToken, :final accessToken):
          // Create Firebase credential from tokens.
          final credential = fb.GoogleAuthProvider.credential(
            idToken: idToken,
            accessToken: accessToken,
          );
          final userCredential = await _auth.signInWithCredential(credential);
          final firebaseUser = userCredential.user;

          if (firebaseUser == null || firebaseUser.email == null) {
            return const GoogleAuthError(
              message: 'Firebase authentication failed — no user',
              code: 'FIREBASE_NO_USER',
            );
          }

          return GoogleAuthSuccess(
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName ??
                firebaseUser.email!.split('@').first,
            photoUrl: firebaseUser.photoURL,
            firebaseUid: firebaseUser.uid,
          );

        case WindowsOAuthCancelled():
          return const GoogleAuthCancelled();

        case WindowsOAuthError(:final message, :final code):
          return GoogleAuthError(message: message, code: code);
      }
    } on fb.FirebaseAuthException catch (e) {
      AppLogger.warning('Windows Google Auth: Firebase error (${e.code})');
      return GoogleAuthError(
        message: _firebaseAuthErrorMessage(e.code),
        code: e.code,
      );
    } catch (e) {
      AppLogger.warning('Windows Google Auth error: ${e.runtimeType}');
      return GoogleAuthError(
        message: 'Google kirishda xatolik yuz berdi',
        code: 'UNKNOWN',
      );
    }
  }

  /// Mobile (Android/iOS) Google Sign-In via google_sign_in plugin.
  Future<GoogleAuthResult> _signInMobile() async {
    try {
      // P0-02 FIX: GoogleSignIn ishlashi uchun serverClientId to'g'ri bo'lishi kerak.
      // Agar google-services.json'dagi SHA-1 fingerprint Firebase Console'da
      // ro'yxatdan o'tmagan bo'lsa, signIn() null qaytaradi yoki xato beradi.
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // null — foydalanuvchi bekor qildi YOKI konfiguratsiya xatosi.
        // Google Sign-In plugin'i konfiguratsiya xatosida ham null qaytarishi mumkin.
        return const GoogleAuthCancelled();
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      final accessToken = googleAuth.accessToken;

      if (idToken == null || accessToken == null) {
        await _googleSignIn.signOut();
        // P0-02 FIX: Aniq xato xabari — konfiguratsiya muammosini tushuntiradi.
        AppLogger.warning(
          'Google Auth: tokens null — serverClientId yoki '
          'SHA-1 fingerprint konfiguratsiyasini tekshiring',
        );
        return const GoogleAuthError(
          message: 'Google konfiguratsiya xatosi — administrator bilan bog\'laning',
          code: 'MISSING_TOKENS',
        );
      }

      final credential = fb.GoogleAuthProvider.credential(
        idToken: idToken,
        accessToken: accessToken,
      );

      final userCredential = await _auth.signInWithCredential(credential);
      final firebaseUser = userCredential.user;

      if (firebaseUser == null || firebaseUser.email == null) {
        await _googleSignIn.signOut();
        return const GoogleAuthError(
          message: 'Firebase autentifikatsiya xatosi — foydalanuvchi yaratilmadi',
          code: 'FIREBASE_NO_USER',
        );
      }

      return GoogleAuthSuccess(
        email: firebaseUser.email!,
        displayName:
            firebaseUser.displayName ?? firebaseUser.email!.split('@').first,
        photoUrl: firebaseUser.photoURL,
        firebaseUid: firebaseUser.uid,
      );
    } on fb.FirebaseAuthException catch (e) {
      AppLogger.warning('Mobile Google Auth: Firebase error (${e.code})');
      return GoogleAuthError(
        message: _firebaseAuthErrorMessage(e.code),
        code: e.code,
      );
    } catch (e) {
      // P0-02 FIX: Aniq xato xabari — xato turini ko'rsatadi.
      AppLogger.warning('Mobile Google Auth error: ${e.runtimeType}: $e');
      return GoogleAuthError(
        message: 'Google kirishda xatolik yuz berdi: '
            '${e.runtimeType}',
        code: 'UNKNOWN',
      );
    }
  }

  /// Sign out from both Google and Firebase.
  ///
  /// Windows: only Firebase signOut (no persistent google_sign_in session).
  /// Mobile: both google_sign_in + Firebase signOut.
  Future<void> signOut() async {
    try {
      if (Platform.isWindows) {
        await _auth.signOut();
      } else {
        await Future.wait([
          _googleSignIn.signOut(),
          _auth.signOut(),
        ]);
      }
    } catch (e) {
      AppLogger.warning('Google Sign-Out error: ${e.runtimeType}');
    }
  }

  /// Whether a Google user is currently signed in to Firebase.
  bool get isSignedIn => _auth.currentUser != null;

  /// Get the current Firebase user (if any).
  fb.User? get currentUser => _auth.currentUser;

  /// Listen to Firebase auth state changes.
  Stream<fb.User?> get authStateChanges => _auth.authStateChanges();

  /// Map Firebase auth error codes to user-friendly messages.
  String _firebaseAuthErrorMessage(String code) {
    return switch (code) {
      'user-disabled' => 'Hisob bloklangan — administrator bilan bog\'laning',
      'operation-not-allowed' => 'Google kirish sozlanmagan',
      'invalid-credential' => 'Google kirish xatosi — qaytadan urinib ko\'ring',
      'network-request-failed' => 'Tarmoq xatosi — ulanishni tekshiring',
      'too-many-requests' =>
        'Juda ko\'p urinish — biroz kutib qayta urinib ko\'ring',
      'user-not-found' => 'Hisob topilmadi',
      _ => 'Kirishda xatolik yuz berdi',
    };
  }
}
