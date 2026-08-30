import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/biometric_service.dart';
import '../../../../core/auth/google_auth_service.dart';
import '../../../../core/auth/local_auth_store.dart';
import '../../../../core/auth/login_throttle.dart';
import '../../../../core/auth/session_manager.dart';
import '../../../../core/services/app_logger.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../../settings/infrastructure/services/secure_settings_store.dart';

/// Auth holati.
sealed class AuthState {
  const AuthState();
}

class AuthStateInitial extends AuthState {
  const AuthStateInitial();
}

class AuthStateLoading extends AuthState {
  const AuthStateLoading();
}

class AuthStateAuthenticated extends AuthState {
  final String userId;
  final String role;
  final String name;
  final String? email;
  final String? photoUrl;
  const AuthStateAuthenticated({
    required this.userId,
    required this.role,
    required this.name,
    this.email,
    this.photoUrl,
  });
}

class AuthStateUnauthenticated extends AuthState {
  const AuthStateUnauthenticated();
}

class AuthStateError extends AuthState {
  final String message;
  const AuthStateError({required this.message});
}

/// Sessiya boshqaruvi.
///
/// Autentifikatsiya offline (server hali ulanmagan) — hisoblar qurilmaning
/// shifrlangan xotirasida ([LocalAuthStore]) saqlanadi va login shu yerga
/// qarshi tekshiriladi. Soxta/yolg'on email bilan kirib bo'lmaydi.
/// Sessiya xotirada saqlanadi — ilova qayta ochilganda
/// foydalanuvchi qayta login qilishi shart emas.
/// P0-01 FIX: Email validatsiya regex — to'g'ri email formatini tekshiradi.
final _emailRegex = RegExp(
  r"^[a-zA-Z0-9.!#\$%&'*+/=?^_`{|}~-]+@"
  r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
  r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
);

/// P0-01 FIX: Parol kuchini tekshiradi.
/// Kamida 1 ta katta harf, 1 ta kichik harf, 1 ta raqam.
bool _isStrongPassword(String password) {
  if (password.length < 8) return false;
  final hasUpper = password.contains(RegExp(r'[A-Z]'));
  final hasLower = password.contains(RegExp(r'[a-z]'));
  final hasDigit = password.contains(RegExp(r'[0-9]'));
  return hasUpper && hasLower && hasDigit;
}

class AuthController extends StateNotifier<AuthState> {
  final SessionManager _sessionManager = SessionManager();
  final LocalAuthStore _authStore = LocalAuthStore();
  final SecureSettingsStore _secureStore = SecureSettingsStore();

  /// Brute-force himoyasi (transformation mission Phase 9): progressiv
  /// blokirovka + vaqtinchalik lockout.
  ///
  /// P1-002 FIX: Holat FlutterSecureStorage'da saqlanadi — app qayta
  /// ishga tushganda ham blokirovka holati saqlanadi.
  final LoginThrottle _loginThrottle = LoginThrottle();

  AuthController() : super(const AuthStateInitial()) {
    // P1-002: Saqlangan throttle holatini yuklash (app restart'dan
    // keyin ham muvaffaqiyatsiz urinishlar hisobini saqlab qolish).
    unawaited(_loginThrottle.loadPersistedState());
  }

  /// Hisob uchun barqaror (deterministik) user ID.
  ///
  /// Avval `user-<millis>` ishlatilardi — har safar login'da yangi ID
  /// paydo bo'lardi (bir hisobning turli ID'lari). Endi ID email'dan
  /// SHA-256 bilan hosil qilinadi: bir hisob har doim bir xil ID'ga ega
  /// (sessiya uchun barqaror identifikator, hash qaytarilmaydi).
  static String _userIdFor(String email) {
    final digest = sha256.convert(
      utf8.encode(email.trim().toLowerCase()),
    );
    return 'user-${digest.toString().substring(0, 16)}';
  }

  /// Ilova boshlanganda — mavjud sessiyani tekshirish.
  ///
  /// Sessiya faqat email [LocalAuthStore]'da ro'yxatdan o'tgan bo'lsa
  /// tiklanadi. Aks holda eski soxta sessiya (avvalgi mock login'dan
  /// qolgan "Google Foydalanuvchi" kabi) tozalanadi va foydalanuvchi
  /// haqiqiy kirishga yo'naltiriladi.
  Future<void> appStarted() async {
    state = const AuthStateLoading();
    try {
      // Mavjud sessiyani tekshirish.
      final hasSession = await _sessionManager.hasActiveSession();
      if (!mounted) return;
      if (hasSession) {
        final session = await _sessionManager.loadSession();
        if (!mounted) return;
        if (session != null) {
          final account = await _authStore.findByEmail(session.email);
          if (!mounted) return;
          if (account != null) {
            // PHASE E (FAIL CLOSED): faol bo'lmagan hisob sessiyasini
            // tiklab bo'lmaydi — sessiya tozalanadi (deaktivatsiya
            // qilingan foydalanuvchi kirishda davom etolmaydi).
            if (!account.canLogin) {
              AppLogger.info('Inactive account session cleared');
              await _sessionManager.clearSession();
              if (!mounted) return;
              await Future<void>.delayed(const Duration(milliseconds: 100));
              if (!mounted) return;
              state = const AuthStateUnauthenticated();
              return;
            }
            state = AuthStateAuthenticated(
              userId: session.userId,
              role: session.role,
              name: session.displayName,
              email: session.email,
              photoUrl: session.photoUrl,
            );
            return;
          }
          // Legacy/soxta sessiya — tozalaymiz.
          AppLogger.info('Invalid session found, clearing');
          await _sessionManager.clearSession();
          if (!mounted) return;
        }
      }
    } catch (e) {
      AppLogger.warning('Session check error: ${e.runtimeType}');
    }
    // P1-04 FIX: Sessiya yo'q yoki xato — darhol login sahifasiga yo'naltirish.
    // Artificial 100ms delay olib tashlandi — u splash ekran "flash"iga
    // sabab bo'lardi (auth state aniqlangandan keyin kechikish seziladi).
    if (!mounted) return;
    state = const AuthStateUnauthenticated();
  }

  /// Email/Parol bilan kirish.
  ///
  /// Faqat shu qurilmada [LocalAuthStore]'da ro'yxatdan o'tgan hisoblar
  /// kirishi mumkin — yolg'on/soxta email bilan kirib bo'lmaydi.
  ///
  /// XAVFSIZLIK (transformation mission Phase 9):
  /// - brute-force: ketma-ket xatolar → [LoginThrottle] bloklaydi;
  /// - email enumeration: "hisob topilmadi" vs "parol xato" FARQLANMAYDI;
  /// - raw exception foydalanuvchiga ko'rsatilmaydi (log'da diagnostika).
  Future<void> login(String email, String password) async {
    state = const AuthStateLoading();
    try {
      // P0-01 FIX: Email validatsiyasi — noto'g'ri format bilan kirish mumkin emas.
      if (email.trim().isEmpty || !_emailRegex.hasMatch(email.trim())) {
        state = const AuthStateError(
          message: 'To\'g\'ri email manzilini kiriting',
        );
        return;
      }
      if (password.isEmpty) {
        state = const AuthStateError(
          message: 'Parolni kiriting',
        );
        return;
      }

      final throttleKey = email.trim().toLowerCase();
      final gate = _loginThrottle.check(throttleKey);
      if (!gate.allowed) {
        state = AuthStateError(
          message: 'Ko\'p marta noto\'g\'ri urinish. '
              '${max(1, gate.retryAfter!.inSeconds)} soniyadan keyin '
              'qayta urinib ko\'ring.',
        );
        return;
      }

      final account = await _authStore.authenticate(
        email: email,
        password: password,
      );
      if (!mounted) return;
      if (account == null) {
        // Brute-force hisobi + UMUMIY xabar (email enumeration yo'q:
        // "hisob topilmadi" vs "parol xato" farqlanmaydi).
        _loginThrottle.recordFailure(throttleKey);
        state = const AuthStateError(
          message: 'Email yoki parol noto\'g\'ri',
        );
        return;
      }

      // PHASE E (FAIL CLOSED): inactive/suspended/archived hisob — DENY.
      // Bu foydalanuvchi xatosi emas — brute-force hisobiga kirmaydi.
      if (!account.canLogin) {
        state = const AuthStateError(
          message: 'Hisob faol emas — administrator bilan bog\'laning',
        );
        return;
      }

      final displayName =
          account.name.isEmpty ? email.split('@').first : account.name;
      final userId = _userIdFor(account.email);

      // AUDIT P2-01 (RBAC): rol hisobdan olinadi — hardcode qilinmaydi.
      // Noma'lum rol ('unknown') keyin actorRoleProvider'da DENY beradi.
      await _sessionManager.saveSession(UserSession(
        userId: userId,
        email: account.email,
        displayName: displayName,
        role: account.role,
      ));
      if (!mounted) return;
      // Biometrik kirish uchun oxirgi hisobni eslab qolamiz.
      await _secureStore.writeLastEmail(account.email);
      if (!mounted) return;
      await _loginThrottle.recordSuccess(throttleKey);
      if (!mounted) return;

      state = AuthStateAuthenticated(
        userId: userId,
        role: account.role,
        name: displayName,
        email: account.email,
      );
    } catch (e) {
      // Raw exception foydalanuvchiga OQMAYDI (diagnostika log'da).
      AppLogger.warning('Login error (internal): ${e.runtimeType}');
      if (!mounted) return;
      state = const AuthStateError(
        message: 'Kirishda xatolik yuz berdi. Qaytadan urinib ko\'ring.',
      );
    }
  }

  /// Biometrik (barmoq izi / Face ID) bilan tez kirish.
  ///
  /// Avval qurilma biometrikasi tasdiqlanadi, so'ng oxirgi kirgan hisob
  /// qayta tiklanadi. Agar biometrik sozlanmagan yoki oxirgi hisob yo'q
  /// bo'lsa — xato holati qaytariladi (foydalanuvchi parol bilan kiradi).
  Future<void> loginWithBiometric() async {
    state = const AuthStateLoading();
    try {
      final ok = await BiometricService.authenticate();
      if (!mounted) return;
      if (!ok) {
        state = const AuthStateError(
          message: 'Biometrik tasdiqlanmadi — parol bilan kiring',
        );
        return;
      }

      final lastEmail = await _secureStore.readLastEmail();
      if (!mounted) return;
      if (lastEmail == null || lastEmail.isEmpty) {
        state = const AuthStateError(
          message: "Biometrik kirish uchun avval hisob bilan kiring",
        );
        return;
      }

      final account = await _authStore.findByEmail(lastEmail);
      if (!mounted) return;
      if (account == null) {
        state = const AuthStateError(
          message: 'Hisob topilmadi — parol bilan qaytadan kiring',
        );
        return;
      }

      // PHASE E (FAIL CLOSED): inactive hisob biometrik bilan ham
      // kira olmaydi.
      if (!account.canLogin) {
        state = const AuthStateError(
          message: 'Hisob faol emas — administrator bilan bog\'laning',
        );
        return;
      }

      final displayName =
          account.name.isEmpty ? lastEmail.split('@').first : account.name;
      final userId = _userIdFor(account.email);

      // AUDIT P2-01 (RBAC): rol hisobdan olinadi — hardcode qilinmaydi.
      await _sessionManager.saveSession(UserSession(
        userId: userId,
        email: account.email,
        displayName: displayName,
        role: account.role,
      ));
      if (!mounted) return;

      state = AuthStateAuthenticated(
        userId: userId,
        role: account.role,
        name: displayName,
        email: account.email,
      );
    } catch (e) {
      AppLogger.warning('Biometric login error (internal): ${e.runtimeType}');
      if (!mounted) return;
      state = const AuthStateError(
        message: 'Biometrik kirishda xatolik yuz berdi. Parol bilan kiring.',
      );
    }
  }

  /// Ro'yxatdan o'tish.
  ///
  /// Hisob [LocalAuthStore]'ga saqlanadi; shu email bilan keyin kirish mumkin.
  Future<void> register(String email, String password, String name) async {
    state = const AuthStateLoading();
    try {
      // P0-01 FIX: Email validatsiyasi — to'g'ri format tekshiriladi.
      final trimmedEmail = email.trim();
      if (trimmedEmail.isEmpty || !_emailRegex.hasMatch(trimmedEmail)) {
        state = const AuthStateError(
          message: 'To\'g\'ri email manzilini kiriting',
        );
        return;
      }

      // P0-01 FIX: Parol kuchini tekshirish — kamida 8 ta belgi,
      // 1 ta katta harf, 1 ta kichik harf, 1 ta raqam.
      if (password.length < 8) {
        state = const AuthStateError(
          message: 'Parol kamida 8 ta belgi bo\'lishi kerak',
        );
        return;
      }
      if (!_isStrongPassword(password)) {
        state = const AuthStateError(
          message: 'Parol kamida 1 ta katta harf, 1 ta kichik harf '
              'va 1 ta raqam ichishi kerak',
        );
        return;
      }

      // P0-01 FIX: Ism bo'sh bo'lishi mumkin emas.
      if (name.trim().isEmpty) {
        state = const AuthStateError(
          message: 'Ismni kiriting',
        );
        return;
      }

      // AUDIT P2-01 (RBAC): birinchi hisob — super_admin (egasi), keyingi
      // hisoblar — 'unknown' (ruxsatsiz). Rol hisobdan olinadi.
      final account = await _authStore.register(
        email: email,
        name: name,
        password: password,
      );
      if (!mounted) return;
      if (account == null) {
        state = const AuthStateError(
          message: 'Bu email allaqachon ro\'yxatdan o\'tgan — kiring',
        );
        return;
      }

      final userId = _userIdFor(account.email);

      await _sessionManager.saveSession(UserSession(
        userId: userId,
        email: account.email,
        displayName: account.name,
        role: account.role,
      ));
      if (!mounted) return;
      // Biometrik kirish uchun oxirgi hisobni eslab qolamiz.
      await _secureStore.writeLastEmail(account.email);
      if (!mounted) return;

      state = AuthStateAuthenticated(
        userId: userId,
        role: account.role,
        name: account.name,
        email: account.email,
      );
    } catch (e) {
      AppLogger.warning('Registration error (internal): ${e.runtimeType}');
      if (!mounted) return;
      state = const AuthStateError(
        message:
            'Ro\'yxatdan o\'tishda xatolik yuz berdi. Qaytadan urinib ko\'ring.',
      );
    }
  }

  /// Google Sign-In orqali kirish.
  ///
  /// Google OAuth → Firebase Auth → M-EDU session. Agar Google hisobi
  /// lokal LocalAuthStore'da mavjud bo'lsa — shu hisob sessioni ishlatiladi.
  /// Aks holda yangi lokal hisob yaratiladi (birinchi Google login).
  Future<void> loginWithGoogle(GoogleAuthService googleService) async {
    state = const AuthStateLoading();
    try {
      final result = await googleService.signIn();
      if (!mounted) return;

      switch (result) {
        case GoogleAuthCancelled():
          state = const AuthStateUnauthenticated();
          return;
        case GoogleAuthError():
          state = AuthStateError(message: result.message);
          return;
        case GoogleAuthSuccess():
          // Google email must match a local account.
          final account = await _authStore.findByEmail(result.email);
          if (!mounted) return;

          if (account == null) {
            // Google email not registered locally — cannot login.
            // This is a SECURITY constraint: Google auth authenticates
            // the user with Google, but M-EDU authorization requires
            // a local account with a role.
            state = const AuthStateError(
              message: 'Bu Google hisobi tizimda ro\'yxatdan o\'tmagan '
                  '— administrator bilan bog\'laning',
            );
            return;
          }

          // PHASE E (FAIL CLOSED): inactive/suspended/archived — DENY.
          if (!account.canLogin) {
            state = const AuthStateError(
              message: 'Hisob faol emas — administrator bilan bog\'laning',
            );
            return;
          }

          final displayName =
              account.name.isEmpty ? result.displayName : account.name;
          final userId = _userIdFor(account.email);

          // AUDIT P2-01 (RBAC): rol hisobdan olinadi — hardcode qilinmaydi.
          await _sessionManager.saveSession(UserSession(
            userId: userId,
            email: account.email,
            displayName: displayName,
            role: account.role,
            photoUrl: result.photoUrl,
          ));
          if (!mounted) return;
          await _secureStore.writeLastEmail(account.email);
          if (!mounted) return;

          state = AuthStateAuthenticated(
            userId: userId,
            role: account.role,
            name: displayName,
            email: account.email,
            photoUrl: result.photoUrl,
          );
          return;
      }
    } catch (e) {
      AppLogger.warning('Google login error (internal): ${e.runtimeType}');
      if (!mounted) return;
      state = const AuthStateError(
        message: 'Google kirishda xatolik yuz berdi. Qaytadan urinib ko\'ring.',
      );
    }
  }

  /// Chiqish.
  ///
  /// P0-01 FIX: Google/Firebase session ham tozalanadi — aks holda
  /// Google session davom etadi va keyingi Google Sign-In avtomatik
  /// kirishga olib keladi (security vulnerability).
  Future<void> logout({GoogleAuthService? googleService}) async {
    state = const AuthStateLoading();
    // Google/Firebase session tozalash — xato bo'lsa ham davom etamiz
    // (session tozalash muhimroq).
    if (googleService != null) {
      try {
        await googleService.signOut();
      } catch (e) {
        AppLogger.warning(
            'Google sign-out error (logout continues): ${e.runtimeType}');
      }
    }
    await _sessionManager.clearSession();
    if (!mounted) return;
    state = const AuthStateUnauthenticated();
  }

  /// Biometrik kirish qo'llab-quvvatlanadimi?
  ///
  /// Qurilmada biometrik mavjud VA foydalanuvchi uni sozlamalardan
  /// yoqgan bo'lsa — `true`.
  Future<bool> canUseBiometricLogin() async {
    final enabled = await _secureStore.isBiometricEnabled();
    if (!enabled) return false;
    final available = await BiometricService.isAvailable();
    if (!available) return false;
    return await _secureStore.readLastEmail() != null;
  }
}

/// Router redirect uchun global auth holat.
///
/// [AuthController] holati o'zgarganda bu [ValueNotifier] ham yangilanadi —
/// GoRouter `refreshListenable` orqali redirect qoidalarini qayta
/// baholaydi (auth guard). StateNotifier'ning `state` maydoni protected
/// bo'lgani uchun router'ga to'g'ridan-to'g'ri controller uzatilmaydi.
final authStateNotifier = ValueNotifier<AuthState>(const AuthStateInitial());

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  final controller = AuthController()..appStarted();
  final removeListener = controller.addListener((state) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      authStateNotifier.value = state;
    });
  });
  ref.onDispose(() {
    removeListener();
  });
  return controller;
});

/// Biometrik tez kirish mavjudligi (Settings'da yoqilgan + qurilmada bor).
///
/// autoDispose — login sahifasi har ochilganda qayta tekshiriladi:
/// foydalanuvchi Settings'da biometrikni yoqib, chiqib, qayta kirsa,
/// tugma paydo bo'ladi (eskirgan cached qiymat ko'rinmaydi).
final biometricLoginAvailableProvider = FutureProvider.autoDispose<bool>((ref) {
  return ref.watch(authControllerProvider.notifier).canUseBiometricLogin();
});

/// Qurilmada mavjud biometrik turlari (Face ID / barmoq izi / iris).
///
/// Login tugmasi va sozlamalarda mos ikonka/label tanlash uchun
/// ishlatiladi. autoDispose — har safar yangilanadi.
final biometricTypesProvider = FutureProvider.autoDispose<List<dynamic>>(
    (ref) => BiometricService.availableTypes());

/// Joriy foydalanuvchi ma'lumotlarini olish uchun convenience provider.
final currentUserProvider = Provider<AuthStateAuthenticated?>((ref) {
  final authState = ref.watch(authControllerProvider);
  if (authState is AuthStateAuthenticated) {
    return authState;
  }
  return null;
});

/// Joriy foydalanuvchining roli (RBAC — §32).
///
/// Command'lar (application layer) shu orqali ruxsatni tekshiradi:
/// `Permissions.require(actorRole, ...)`.
///
/// AUDIT P1-04 (FAIL CLOSED, spec §14): Sessiya'da rol bo'lmasa yoki
/// noma'lum bo'lsa — `UserRole.unknown` qaytariladi (hech qanday
/// ruxsatga ega emas). Ilgari `UserRole.admin` qaytarilardi — noma'lum
/// foydalanuvchi admin bo'lib qolardi (fail-OPEN).
final actorRoleProvider = Provider<UserRole>((ref) {
  final authState = ref.watch(authControllerProvider);
  if (authState is AuthStateAuthenticated) {
    // AUDIT P2-03: wire format ('super_admin') ↔ enum nomi ('superAdmin')
    // farqini hisobga oladi. `byName` emas — noma'lum → unknown (fail-closed).
    return UserRole.fromWire(authState.role);
  }
  return UserRole.unknown;
});
