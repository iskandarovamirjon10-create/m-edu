import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/google_auth_service.dart';

/// Google authentication state.
sealed class GoogleAuthUiState {
  const GoogleAuthUiState();
}

class GoogleAuthIdle extends GoogleAuthUiState {
  const GoogleAuthIdle();
}

class GoogleAuthLoading extends GoogleAuthUiState {
  const GoogleAuthLoading();
}

class GoogleAuthSuccessState extends GoogleAuthUiState {
  final String email;
  final String displayName;
  final String? photoUrl;

  const GoogleAuthSuccessState({
    required this.email,
    required this.displayName,
    this.photoUrl,
  });
}

class GoogleAuthErrorState extends GoogleAuthUiState {
  final String message;

  const GoogleAuthErrorState({required this.message});
}

class GoogleAuthCancelledState extends GoogleAuthUiState {
  const GoogleAuthCancelledState();
}

/// Google auth service provider.
final googleAuthProvider = Provider<GoogleAuthService>((ref) {
  return GoogleAuthService();
});

/// Google auth UI state controller.
class GoogleAuthController extends StateNotifier<GoogleAuthUiState> {
  final GoogleAuthService _service;

  GoogleAuthController(this._service) : super(const GoogleAuthIdle());

  /// Perform Google Sign-In.
  ///
  /// Returns the result so the caller (AuthController) can create the
  /// application session. This controller only manages the UI state of
  /// the Google sign-in button/flow.
  Future<GoogleAuthResult> signIn() async {
    state = const GoogleAuthLoading();
    final result = await _service.signIn();
    switch (result) {
      case GoogleAuthSuccess():
        state = GoogleAuthSuccessState(
          email: result.email,
          displayName: result.displayName,
          photoUrl: result.photoUrl,
        );
      case GoogleAuthCancelled():
        state = const GoogleAuthCancelledState();
      case GoogleAuthError():
        state = GoogleAuthErrorState(message: result.message);
    }
    return result;
  }

  /// Reset to idle state.
  void reset() {
    state = const GoogleAuthIdle();
  }
}

final googleAuthControllerProvider =
    StateNotifierProvider<GoogleAuthController, GoogleAuthUiState>((ref) {
  return GoogleAuthController(ref.watch(googleAuthProvider));
});
