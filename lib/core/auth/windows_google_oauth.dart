import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../services/app_logger.dart';

/// Windows browser-based Google OAuth result.
sealed class WindowsOAuthResult {
  const WindowsOAuthResult();
}

class WindowsOAuthSuccess extends WindowsOAuthResult {
  final String idToken;
  final String accessToken;
  const WindowsOAuthSuccess({required this.idToken, required this.accessToken});
}

class WindowsOAuthCancelled extends WindowsOAuthResult {
  const WindowsOAuthCancelled();
}

class WindowsOAuthError extends WindowsOAuthResult {
  final String message;
  final String? code;
  const WindowsOAuthError({required this.message, this.code});
}

/// Windows browser-based Google OAuth implementation.
///
/// Flow:
/// 1. Start local HTTP server on random port
/// 2. Open Google OAuth consent screen in browser
/// 3. User authenticates → Google redirects to localhost:PORT/callback?code=...&state=...
/// 4. Extract authorization code AND verify `state` matches (CSRF protection)
/// 5. Exchange code for tokens via Google token endpoint
/// 6. Return id_token + access_token for Firebase credential creation
///
/// Security:
/// - Uses random `state` parameter (per-request) to prevent CSRF (verified on callback)
/// - Tokens are returned transiently, never stored
/// - Local server is shut down after single use
/// - No client secrets shipped (public client flow)
class WindowsGoogleOAuth {
  /// Cryptographically-secure random state parameter for CSRF protection
  /// (generated per request, validated on callback).
  ///
  /// Stored on the local callback server's [HttpServer] instance via the
  /// `defaultResponseHeaders` mechanism is not used here — instead we
  /// capture the expected state in a closure when opening the server and
  /// validate it when the first request arrives.
  static String _generateState() {
    final r = Random.secure();
    final bytes = List<int>.generate(32, (_) => r.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '');
  }

  /// Perform browser-based Google OAuth on Windows.
  ///
  /// [webClientId] — Google OAuth 2.0 web client ID (from Google Cloud Console).
  /// [port] — Local callback server port (0 = random).
  static Future<WindowsOAuthResult> signIn({
    required String webClientId,
    int port = 0,
  }) async {
    HttpServer? server;
    try {
      // 1) Bind local HTTP server.
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
      final actualPort = server.port;

      // 2) Build Google OAuth authorization URL with a per-request
      //    cryptographic state (CSRF protection).
      final expectedState = _generateState();
      final redirectUri = 'http://localhost:$actualPort/callback';
      final scopes = ['email', 'profile', 'openid'].join(' ');
      final authUrl = Uri.https('accounts.google.com', '/o/oauth2/v2/auth', {
        'client_id': webClientId,
        'redirect_uri': redirectUri,
        'response_type': 'code',
        'scope': scopes,
        'state': expectedState,
        'access_type': 'offline',
        'prompt': 'select_account',
      });

      // 3) Open browser for Google consent.
      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await server.close(force: true);
        return const WindowsOAuthError(
          message: 'Brauzer ochilmadi',
          code: 'LAUNCH_FAILED',
        );
      }

      // 4) Wait for Google callback (max 2 minutes).
      final request = await server.first.timeout(
        const Duration(minutes: 2),
        onTimeout: () {
          throw TimeoutException('Auth timeout — brauzerda tasdiqlanmadi');
        },
      );

      final uri = request.uri;
      final code = uri.queryParameters['code'];
      final error = uri.queryParameters['error'];
      final receivedState = uri.queryParameters['state'];

      // Send success/denial response to browser.
      if (code != null && receivedState == expectedState) {
        request.response
          ..statusCode = 200
          ..headers.contentType = ContentType.html
          ..write('<html><body><h2>M-Edu kirish muvaffaqiyatli!</h2>'
              '<p>Brauzerni yopishingiz mumkin.</p></body></html>');
        await request.response.close();
      } else if (code != null) {
        // State mismatch: potential CSRF — refuse the code.
        request.response
          ..statusCode = 400
          ..headers.contentType = ContentType.html
          ..write('<html><body><h2>Autentifikatsiya xavfsizlik tekshiruvidan o\'tmadi</h2>'
              '</body></html>');
        await request.response.close();
        await server.close(force: true);
        server = null;
        return const WindowsOAuthError(
          message:
              'Autentifikatsiya xavfsizlik tekshiruvidan o\'tmadi — qaytadan urinib ko\'ring',
          code: 'STATE_MISMATCH',
        );
      } else {
        request.response
          ..statusCode = 400
          ..headers.contentType = ContentType.html
          ..write('<html><body><h2>Autentifikatsiya bekor qilindi</h2>'
              '</body></html>');
        await request.response.close();
      }
      await server.close(force: true);
      server = null;

      if (error == 'access_denied' || error == 'interaction_required') {
        return const WindowsOAuthCancelled();
      }
      if (error != null) {
        return WindowsOAuthError(
          message: _googleErrorMessage(error),
          code: error,
        );
      }
      if (code == null) {
        return const WindowsOAuthError(
          message: 'Autentifikatsiya xatosi — kod olinmadi',
          code: 'NO_CODE',
        );
      }

      // 5) Exchange authorization code for tokens.
      return await _exchangeCode(code, webClientId, redirectUri);
    } on TimeoutException {
      await server?.close(force: true);
      return const WindowsOAuthError(
        message: 'Autentifikatsiya vaqti tugadi — qaytadan urinib ko\'ring',
        code: 'TIMEOUT',
      );
    } catch (e) {
      await server?.close(force: true);
      AppLogger.warning('Windows OAuth error: ${e.runtimeType}');
      return WindowsOAuthError(
        message: 'Google kirishda xatolik yuz berdi',
        code: 'UNKNOWN',
      );
    }
  }

  /// Exchange authorization code for id_token + access_token.
  static Future<WindowsOAuthResult> _exchangeCode(
    String code,
    String webClientId,
    String redirectUri,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('https://oauth2.googleapis.com/token'),
        body: {
          'code': code,
          'client_id': webClientId,
          'redirect_uri': redirectUri,
          'grant_type': 'authorization_code',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final idToken = data['id_token'] as String?;
        final accessToken = data['access_token'] as String?;

        if (idToken != null && accessToken != null) {
          return WindowsOAuthSuccess(
            idToken: idToken,
            accessToken: accessToken,
          );
        }
        return const WindowsOAuthError(
          message: 'Google token olinmadi — qaytadan urinib ko\'ring',
          code: 'TOKEN_MISSING',
        );
      }

      final errorData = jsonDecode(response.body) as Map<String, dynamic>;
      final errorDesc =
          errorData['error_description'] as String? ?? response.body;
      AppLogger.warning('Token exchange failed: $errorDesc');
      return WindowsOAuthError(
        message: 'Google kirishda xatolik — qaytadan urinib ko\'ring',
        code: 'TOKEN_EXCHANGE_FAILED',
      );
    } catch (e) {
      AppLogger.warning('Token exchange error: ${e.runtimeType}');
      return WindowsOAuthError(
        message: 'Tarmoq xatosi — ulanishni tekshiring',
        code: 'NETWORK_ERROR',
      );
    }
  }

  static String _googleErrorMessage(String code) => switch (code) {
        'access_denied' => 'Kirish bekor qilindi',
        'interaction_required' => 'Brauzerda tasdiqlanmadi',
        'invalid_request' => 'So\'rov noto\'g\'ri — administrator bilan bog\'laning',
        'server_error' => 'Google server xatosi — biroz kutib qayta urinib ko\'ring',
        'temporarily_unavailable' => 'Google hizmati vaqtincha mavjud emas',
        _ => 'Autentifikatsiya xatosi',
      };
}

/// Platform-aware Google auth check.
bool get isWindowsOAuthSupported => Platform.isWindows;
