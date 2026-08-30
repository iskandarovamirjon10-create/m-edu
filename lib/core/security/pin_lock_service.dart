import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import '../services/app_logger.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// PIN LOCK SERVICE — Production-Quality Application PIN Protection
///
/// Requirements:
/// - PIN creation with confirmation
/// - Secure local storage (SHA-256 salted hash in FlutterSecureStorage)
/// - Lock screen / unlock flow
/// - Failed attempts handling with cooldown/throttle
/// - App lifecycle re-lock
/// - No plaintext PIN storage
/// - No PIN in logs
/// - Secure comparison
/// ═══════════════════════════════════════════════════════════════════════
class PinLockService {
  PinLockService({
    FlutterSecureStorage? storage,
    int maxAttempts = 5,
    Duration cooldownDuration = const Duration(minutes: 5),
    DateTime Function()? clock,
  })  : _storage = storage ?? const FlutterSecureStorage(),
        _maxAttempts = maxAttempts,
        _cooldownDuration = cooldownDuration,
        _clock = clock ?? DateTime.now;

  final FlutterSecureStorage _storage;
  final int _maxAttempts;
  final Duration _cooldownDuration;
  final DateTime Function() _clock;

  static const _keyPinHash = 'm_edu_pin_hash';
  static const _keyPinSalt = 'm_edu_pin_salt';
  static const _keyPinEnabled = 'm_edu_pin_enabled';
  static const _keyFailedAttempts = 'm_edu_pin_failed_attempts';
  static const _keyLockedUntil = 'm_edu_pin_locked_until';

  // ─── PIN Setup ────────────────────────────────────────────────────

  /// Whether PIN lock is currently enabled.
  Future<bool> isEnabled() async {
    try {
      final value = await _storage.read(key: _keyPinEnabled);
      return value == 'true';
    } catch (_) {
      return false;
    }
  }

  /// Set a new PIN. [pin] must be 4-6 digits, [confirmPin] must match.
  /// Returns null on success or an error message.
  Future<String?> setPin(String pin, String confirmPin) async {
    if (pin.length < 4 || pin.length > 6) {
      return 'PIN 4-6 raqamdan iborat bo\'lishi kerak';
    }
    if (!RegExp(r'^\d+$').hasMatch(pin)) {
      return 'PIN faqat raqamlardan iborat bo\'lishi kerak';
    }
    if (pin != confirmPin) {
      return 'PIN mos kelmaydi';
    }
    if (pin == '0000' || pin == '1234' || pin == '1111') {
      return 'Oddiy PIN tanlamang';
    }

    try {
      final salt = _generateSalt();
      final hash = _hashPin(pin, salt);

      await _storage.write(key: _keyPinSalt, value: salt);
      await _storage.write(key: _keyPinHash, value: hash);
      await _storage.write(key: _keyPinEnabled, value: 'true');

      // Reset failure state when setting new PIN.
      await _storage.delete(key: _keyFailedAttempts);
      await _storage.delete(key: _keyLockedUntil);

      return null; // success
    } catch (e) {
      AppLogger.warning('PIN set failed: ${e.runtimeType}');
      return 'PIN saqlashda xatolik';
    }
  }

  /// Verify PIN against stored hash.
  /// Returns true if correct, false otherwise.
  Future<bool> verify(String pin) async {
    try {
      // Check lockout.
      final lockedUntil = await _getLockedUntil();
      if (lockedUntil != null && _clock().isBefore(lockedUntil)) {
        return false;
      }

      final storedHash = await _storage.read(key: _keyPinHash);
      final salt = await _storage.read(key: _keyPinSalt);
      if (storedHash == null || salt == null) return false;

      final inputHash = _hashPin(pin, salt);
      final correct = _constantTimeCompare(inputHash, storedHash);

      if (correct) {
        await _resetFailures();
      } else {
        await _recordFailure();
      }

      return correct;
    } catch (e) {
      AppLogger.warning('PIN verify failed: ${e.runtimeType}');
      return false;
    }
  }

  /// Disable PIN lock. Requires the current PIN for verification first.
  Future<String?> disable(String pin) async {
    final correct = await verify(pin);
    if (!correct) return 'Noto\'g\'ri PIN';

    try {
      await _storage.delete(key: _keyPinHash);
      await _storage.delete(key: _keyPinSalt);
      await _storage.write(key: _keyPinEnabled, value: 'false');
      await _resetFailures();
      return null;
    } catch (e) {
      return 'PIN o\'chirishda xatolik';
    }
  }

  /// Change PIN from old to new.
  Future<String?> changePin(
      String oldPin, String newPin, String confirmPin) async {
    final correct = await verify(oldPin);
    if (!correct) return 'Joriy PIN noto\'g\'ri';
    return setPin(newPin, confirmPin);
  }

  // ─── Throttle / Lockout ───────────────────────────────────────────

  /// Seconds remaining in lockout, or 0 if not locked.
  Future<int> lockoutRemainingSeconds() async {
    final lockedUntil = await _getLockedUntil();
    if (lockedUntil == null) return 0;
    final remaining = lockedUntil.difference(_clock()).inSeconds;
    return remaining > 0 ? remaining : 0;
  }

  /// Current failed attempt count (for UI feedback).
  Future<int> failedAttemptCount() async {
    try {
      final raw = await _storage.read(key: _keyFailedAttempts);
      return int.tryParse(raw ?? '') ?? 0;
    } catch (_) {
      return 0;
    }
  }

  Future<void> _recordFailure() async {
    try {
      final count = await failedAttemptCount();
      final newCount = count + 1;
      await _storage.write(key: _keyFailedAttempts, value: '$newCount');

      if (newCount >= _maxAttempts) {
        final lockedUntil = _clock().add(_cooldownDuration);
        await _storage.write(
          key: _keyLockedUntil,
          value: lockedUntil.toIso8601String(),
        );
      }
    } catch (_) {
      // Storage error — fail open for lockout (but don't skip PIN verify).
    }
  }

  Future<void> _resetFailures() async {
    try {
      await _storage.delete(key: _keyFailedAttempts);
      await _storage.delete(key: _keyLockedUntil);
    } catch (_) {}
  }

  Future<DateTime?> _getLockedUntil() async {
    try {
      final raw = await _storage.read(key: _keyLockedUntil);
      if (raw == null) return null;
      return DateTime.tryParse(raw);
    } catch (_) {
      return null;
    }
  }

  // ─── Crypto Helpers ───────────────────────────────────────────────

  /// Generate a random 16-byte hex salt.
  String _generateSalt() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// SHA-256 hash of PIN + salt.
  String _hashPin(String pin, String salt) {
    final digest = sha256.convert(utf8.encode('$salt:$pin'));
    return digest.toString();
  }

  /// Constant-time string comparison to prevent timing attacks.
  bool _constantTimeCompare(String a, String b) {
    if (a.length != b.length) return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }
}
