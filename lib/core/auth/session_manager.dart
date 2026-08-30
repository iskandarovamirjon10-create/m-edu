import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/app_logger.dart';

/// Foydalanuvchi sessiya ma'lumotlari.
class UserSession {
  final String userId;
  final String email;
  final String displayName;
  final String? photoUrl;
  final String role;
  final String? token;

  const UserSession({
    required this.userId,
    required this.email,
    required this.displayName,
    this.photoUrl,
    // AUDIT P2-01 (FAIL CLOSED): rol berilmagan bo'lsa — 'unknown'
    // (hech qanday ruxsat yo'q). Ilgari 'admin' default edi — bu fail-OPEN.
    this.role = 'unknown',
    this.token,
  });

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'email': email,
        'displayName': displayName,
        'photoUrl': photoUrl,
        'role': role,
        'token': token,
      };

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
        userId: json['userId'] as String,
        email: json['email'] as String,
        displayName: json['displayName'] as String,
        photoUrl: json['photoUrl'] as String?,
        // FAIL CLOSED: rol yo'q bo'lsa — unknown (admin emas!).
        role: json['role'] as String? ?? 'unknown',
        token: json['token'] as String?,
      );
}

/// Sessiya boshqaruvchi — token va foydalanuvchi ma'lumotlarini
/// xotirada saqlaydi.
class SessionManager {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _keyUserId = 'user_id';
  static const _keyEmail = 'user_email';
  static const _keyDisplayName = 'user_display_name';
  static const _keyPhotoUrl = 'user_photo_url';
  static const _keyRole = 'user_role';
  static const _keyToken = 'auth_token';
  static const _keyIsLoggedIn = 'is_logged_in';
  static const _keyCreatedAt = 'session_created_at';

  /// Offline sessiya yaroqlilik muddati (PHASE E): 30 kun.
  ///
  /// Sessiya 30 kundan eski bo'lsa — muddati o'tgan hisoblanadi va
  /// foydalanuvchi qayta login qilishi kerak.
  static const Duration sessionMaxAge = Duration(days: 30);

  /// Sessiya mavjudligini tekshirish.
  Future<bool> hasActiveSession() async {
    try {
      final isLoggedIn = await _storage.read(key: _keyIsLoggedIn);
      return isLoggedIn == 'true';
    } catch (e) {
      return false;
    }
  }

  /// Sessiyani saqlash.
  Future<void> saveSession(UserSession session) async {
    try {
      await _storage.write(key: _keyUserId, value: session.userId);
      await _storage.write(key: _keyEmail, value: session.email);
      await _storage.write(key: _keyDisplayName, value: session.displayName);
      await _storage.write(key: _keyPhotoUrl, value: session.photoUrl ?? '');
      await _storage.write(key: _keyRole, value: session.role);
      await _storage.write(key: _keyToken, value: session.token ?? '');
      await _storage.write(key: _keyIsLoggedIn, value: 'true');
      await _storage.write(
          key: _keyCreatedAt, value: DateTime.now().toIso8601String());
    } catch (e) {
      AppLogger.warning('Session save error: ${e.runtimeType}');
    }
  }

  /// Sessiyani o'qish.
  Future<UserSession?> loadSession() async {
    try {
      final isLoggedIn = await _storage.read(key: _keyIsLoggedIn);
      if (isLoggedIn != 'true') return null;

      final userId = await _storage.read(key: _keyUserId);
      final email = await _storage.read(key: _keyEmail);
      final displayName = await _storage.read(key: _keyDisplayName);
      final photoUrl = await _storage.read(key: _keyPhotoUrl);
      final role = await _storage.read(key: _keyRole);
      final token = await _storage.read(key: _keyToken);

      if (userId == null || email == null) return null;

      // PHASE E: 30 kunlik sessiya muddati — eskirgan sessiya DENY.
      // Eski sessiyalarda createdAt yo'q — ular yangi deb hisoblanadi
      // (migratsiya: foydalanuvchi sezmaydi).
      final createdAtRaw = await _storage.read(key: _keyCreatedAt);
      final createdAt = DateTime.tryParse(createdAtRaw ?? '');
      if (createdAt != null &&
          DateTime.now().difference(createdAt) > sessionMaxAge) {
        AppLogger.info('Session expired — clearing');
        await clearSession();
        return null;
      }

      return UserSession(
        userId: userId,
        email: email,
        displayName: displayName ?? email,
        photoUrl: photoUrl?.isNotEmpty == true ? photoUrl : null,
        // FAIL CLOSED: omborda rol yo'q bo'lsa — unknown (admin emas!).
        role: role ?? 'unknown',
        token: token,
      );
    } catch (e) {
      return null;
    }
  }

  /// Sessiyani o'chirish (chiqish).
  ///
  /// P1-03 FIX: Har bir kalit alohida try-catch bilan — bitta kalit
  /// xatosi qolganlarini tozalashga to'sqinlik qilmaydi. Eng muhimi:
  /// `_keyIsLoggedIn` oxirida `false` qo'yiladi — xatolik bo'lsa ham
  /// sessiya effective ravishda bekor qilinadi (fail-closed).
  Future<void> clearSession() async {
    final keys = [
      _keyUserId,
      _keyEmail,
      _keyDisplayName,
      _keyPhotoUrl,
      _keyRole,
      _keyToken,
      _keyCreatedAt,
    ];
    for (final key in keys) {
      try {
        await _storage.delete(key: key);
      } catch (e) {
        AppLogger.warning('Session clear error ($key): ${e.runtimeType}');
      }
    }
    // Oxirgi qadam: sessiyani noaktiv qilish — bu qator xatosiz
    // bajarilishi kerak (fail-closed).
    try {
      await _storage.write(key: _keyIsLoggedIn, value: 'false');
    } catch (e) {
      AppLogger.warning('Session flag clear error: ${e.runtimeType}');
    }
  }

  /// Login/password change -> sessiya invalidiyatsiya.
  ///
  /// Namuna:
  /// - Parol o'zgartirildi
  /// - Login nafaqat parol bilan, biometrik bilan bo'lsa ham tozalanadi
  ///   (identity toko da o'zgarish bo'lmasdan ham katta xavfsizlik xavfi bar).
  ///
  /// Fail-closed: invalidatsiya amalga oshilishi kerak — xato bo'lsa ham
  /// ilova ochiq bo'lmasligi kerak.
  Future<void> invalidateSessionOnCredentialChange() async {
    // 1) Sessiyani o'chirish (to'liq).
    await clearSession();
    // 2) SecureStorage'da mavjud umumiylashtirilgan sessiya kalitlarini
    //    [SecureSettingsStore] uchun o'rnatilishi kerak.
    try {
      await _storage.delete(key: 'm_edu_secure_session_token');
    } catch (e) {
      AppLogger.warning('Session token clear error: ${e.runtimeType}');
    }
  }
}
