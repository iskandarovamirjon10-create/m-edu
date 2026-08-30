import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/app_logger.dart';

/// Login urinishining ruxsat holati.
class LoginGateResult {
  final bool allowed;

  /// Bloklangan bo'lsa — qancha vaqtdan keyin qayta urinish mumkin.
  final Duration? retryAfter;

  const LoginGateResult.allow()
      : allowed = true,
        retryAfter = null;

  const LoginGateResult.locked(Duration this.retryAfter) : allowed = false;
}

/// Throttle holatini saqlash/witchish uchun abstrakt interfeys.
///
/// P1-002: Testlarda FlutterSecureStorage o'rniga mock ishlatish
/// mumkin bo'lishi uchun abstrakt qatlam.
abstract class ThrottleStorage {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String? value});
}

/// FlutterSecureStorage asosidagi amaliy saqlash.
class SecureThrottleStorage implements ThrottleStorage {
  final FlutterSecureStorage _inner;
  const SecureThrottleStorage([FlutterSecureStorage? inner])
      : _inner = inner ?? const FlutterSecureStorage();

  @override
  Future<String?> read({required String key}) => _inner.read(key: key);

  @override
  Future<void> write({required String key, required String? value}) =>
      _inner.write(key: key, value: value);
}

/// Brute-force himoyasi (transformation mission Phase 9).
///
/// Strategiya: ketma-ket muvaffaqiyatsiz urinishlar → progressiv kechikish →
/// vaqtinchalik blokirovka (lockout).
///
/// P1-002 FIX: Holat endi secure storage'da saqlanadi —
/// muvaffaqiyatsiz urinishlar, blok muddati va lockout holati app
/// qayta ishga tushgandan keyin ham saqlanadi.
///
/// Qoidalar:
/// - [maxFailures] dan kam muvaffaqiyatsiz urinish → ruxsat;
/// - [maxFailures] ga yetganda → [lockoutDuration] blok;
/// - blok tugagach yana [maxFailures] urinish mavjud;
/// - [window] ichida yangi muvaffaqiyatsizlik bo'lmasa — hisob tozalanadi;
/// - muvaffaqiyatli kirish → hisob tozalanadi;
/// - app qayta ishga tushganda → saqlangan holat yuklanadi;
/// - buzilgan saqlangan holat → xavfsiz (default qiymatlar qo'llaniladi);
/// - hech qachon parol/plaintext saqlanmaydi.
///
/// Testlar uchun soatni [clock] orqali in'ektsiya qilish mumkin.
/// [storage] parametri testlarda mock qilinishi mumkin.
class LoginThrottle {
  LoginThrottle({
    this.maxFailures = 5,
    this.lockoutDuration = const Duration(minutes: 5),
    this.window = const Duration(minutes: 15),
    DateTime Function()? clock,
    ThrottleStorage? storage,
  })  : _now = clock ?? DateTime.now,
        _storage = storage ?? SecureThrottleStorage();

  final int maxFailures;
  final Duration lockoutDuration;
  final Duration window;
  final DateTime Function() _now;
  final ThrottleStorage _storage;

  static const _storageKey = 'm_edu_login_throttle_v1';

  final Map<String, _AttemptState> _states = {};

  /// Saqlangan holatni yuklash (app ishga tushganda).
  /// Buzilgan ma'lumot xavfsiz — default qiymatlar qo'llaniladi.
  Future<void> loadPersistedState() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw == null || raw.isEmpty) return;

      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final now = _now();

      for (final entry in decoded.entries) {
        final data = entry.value as Map<String, dynamic>;
        final state = _AttemptState();

        state.failures = (data['failures'] as num?)?.toInt() ?? 0;

        final lastFailureStr = data['lastFailureAt'] as String?;
        state.lastFailureAt = DateTime.tryParse(lastFailureStr ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);

        final lockedUntilStr = data['lockedUntil'] as String?;
        state.lockedUntil = DateTime.tryParse(lockedUntilStr ?? '');

        // Blok muddati o'tgan bo'lsa — holatni tozalash.
        if (state.lockedUntil != null && now.isAfter(state.lockedUntil!)) {
          continue; // Blok tugagan — saqlanmaydi
        }

        // Oyna tugagan bo'lsa — holatni tozalash.
        if (now.difference(state.lastFailureAt) > window) {
          continue;
        }

        _states[entry.key] = state;
      }
    } catch (e) {
      // Buzilgan saqlangan holat — xavfsiz (hech narsa qilmaymiz).
      AppLogger.warning('LoginThrottle: state load error: ${e.runtimeType}');
    }
  }

  /// Joriy holatni saqlash.
  Future<void> _persistState() async {
    try {
      final data = <String, dynamic>{};
      for (final entry in _states.entries) {
        data[entry.key] = {
          'failures': entry.value.failures,
          'lastFailureAt': entry.value.lastFailureAt.toIso8601String(),
          'lockedUntil': entry.value.lockedUntil?.toIso8601String(),
        };
      }
      await _storage.write(
        key: _storageKey,
        value: jsonEncode(data),
      );
    } catch (e) {
      // P1-01 FIX: Saqlash xatosi — blokirovka saqlanmasa ham ilova ishlaydi
      // (keyingi kirishda qayta bloklanadi). Xato turini log qilamiz.
      AppLogger.warning(
          'LoginThrottle: persist failed (${e.runtimeType}) — next login may re-throttle');
    }
  }

  /// Login urinishidan OLDIN chaqiriladi.
  LoginGateResult check(String key) {
    final state = _states[key];
    if (state == null) return const LoginGateResult.allow();
    final now = _now();

    // Faol blokirovka bormi?
    if (state.lockedUntil != null && now.isBefore(state.lockedUntil!)) {
      return LoginGateResult.locked(state.lockedUntil!.difference(now));
    }
    // Blok tugagan — hisobni yangilaymiz.
    if (state.lockedUntil != null) {
      _states.remove(key);
      return const LoginGateResult.allow();
    }
    // Oyna ichida yetarlicha xato bo'lganmi?
    if (state.failures >= maxFailures) {
      state.lockedUntil = now.add(lockoutDuration);
      state.lastFailureAt = now;
      return LoginGateResult.locked(lockoutDuration);
    }
    return const LoginGateResult.allow();
  }

  /// Muvaffaqiyatsiz urinish — hisob oshadi, [maxFailures] ga yetganda blok.
  void recordFailure(String key) {
    final now = _now();
    final state = _states.putIfAbsent(key, _AttemptState.new);

    // Oyna tugagan — hisobni qaytadan boshlaymiz.
    if (now.difference(state.lastFailureAt) > window) {
      state.failures = 0;
      state.lockedUntil = null;
    }
    state.failures += 1;
    state.lastFailureAt = now;

    if (state.failures >= maxFailures) {
      state.lockedUntil = now.add(lockoutDuration);
    }

    _persistState();
  }

  /// Muvaffaqiyatli kirish — hisob tozalanadi.
  Future<void> recordSuccess(String key) async {
    _states.remove(key);
    await _persistState();
  }

  /// Joriy hisobdagi muvaffaqiyatsiz urinishlar soni (tashxis/test uchun).
  int failureCount(String key) {
    final state = _states[key];
    if (state == null) return 0;
    final now = _now();
    if (now.difference(state.lastFailureAt) > window) return 0;
    return state.failures;
  }
}

class _AttemptState {
  int failures = 0;
  DateTime lastFailureAt = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime? lockedUntil;
}
