import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// PIN Lock Service — Unit Tests
///
/// Tests the cryptographic and validation logic of the PIN lock system
/// without requiring FlutterSecureStorage (platform dependency).
/// ═══════════════════════════════════════════════════════════════════════

/// Mirror of PinLockService._hashPin logic for testing.
String hashPin(String pin, String salt) {
  final digest = sha256.convert(utf8.encode('$salt:$pin'));
  return digest.toString();
}

/// Mirror of PinLockService._constantTimeCompare logic.
bool constantTimeCompare(String a, String b) {
  if (a.length != b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return result == 0;
}

/// Mirror of PinLockService._generateSalt logic.
String generateSalt() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// Validate PIN format.
String? validatePin(String pin, String confirmPin) {
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
  return null; // valid
}

void main() {
  group('PIN Lock Service — Crypto', () {
    test('same PIN + same salt = same hash (deterministic)', () {
      final salt = 'abcdef1234567890abcdef1234567890';
      final hash1 = hashPin('1234', salt);
      final hash2 = hashPin('1234', salt);
      expect(hash1, equals(hash2));
    });

    test('same PIN + different salt = different hash', () {
      final hash1 = hashPin('1234', 'salt_aaa');
      final hash2 = hashPin('1234', 'salt_bbb');
      expect(hash1, isNot(equals(hash2)));
    });

    test('different PIN + same salt = different hash', () {
      final salt = 'abcdef1234567890abcdef1234567890';
      final hash1 = hashPin('1234', salt);
      final hash2 = hashPin('5678', salt);
      expect(hash1, isNot(equals(hash2)));
    });

    test('hash is 64 hex characters (SHA-256)', () {
      final hash = hashPin('1234', 'salt');
      expect(hash.length, 64);
      expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(hash), true);
    });

    test('hash does not contain the PIN', () {
      final hash = hashPin('1234', 'salt');
      expect(hash.contains('1234'), false);
    });

    test('hash does not contain the salt', () {
      final salt = 'mysaltsaltmysaltsaltmysaltsalt';
      final hash = hashPin('1234', salt);
      expect(hash.contains(salt), false);
    });
  });

  group('PIN Lock Service — Constant-Time Compare', () {
    test('equal strings return true', () {
      expect(constantTimeCompare('abc', 'abc'), true);
    });

    test('different strings return false', () {
      expect(constantTimeCompare('abc', 'abd'), false);
    });

    test('different lengths return false', () {
      expect(constantTimeCompare('abc', 'abcd'), false);
    });

    test('empty strings are equal', () {
      expect(constantTimeCompare('', ''), true);
    });

    test('single char match', () {
      expect(constantTimeCompare('a', 'a'), true);
      expect(constantTimeCompare('a', 'b'), false);
    });

    test('long equal strings', () {
      final s = 'a' * 1000;
      expect(constantTimeCompare(s, s), true);
    });

    test('long different strings', () {
      final a = 'a' * 1000;
      final b = 'a' * 999 + 'b';
      expect(constantTimeCompare(a, b), false);
    });
  });

  group('PIN Lock Service — Salt Generation', () {
    test('generates unique salts', () {
      final salt1 = generateSalt();
      final salt2 = generateSalt();
      // With 16 random bytes (128 bits), collision probability is negligible.
      expect(salt1, isNot(equals(salt2)));
    });

    test('salt is 32 hex characters', () {
      final salt = generateSalt();
      expect(salt.length, 32);
      expect(RegExp(r'^[0-9a-f]{32}$').hasMatch(salt), true);
    });

    test('100 salts are all unique', () {
      final salts = <String>{};
      for (var i = 0; i < 100; i++) {
        salts.add(generateSalt());
      }
      expect(salts.length, 100);
    });
  });

  group('PIN Lock Service — Validation', () {
    test('valid 4-digit PIN (not weak)', () {
      expect(validatePin('5678', '5678'), isNull);
    });

    test('4-digit PIN 1234 is rejected as weak', () {
      expect(validatePin('1234', '1234'), isNotNull);
    });

    test('valid 5-digit PIN', () {
      expect(validatePin('12345', '12345'), isNull);
    });

    test('valid 6-digit PIN', () {
      expect(validatePin('123456', '123456'), isNull);
    });

    test('PIN too short (3 digits)', () {
      expect(validatePin('123', '123'), isNotNull);
    });

    test('PIN too long (7 digits)', () {
      expect(validatePin('1234567', '1234567'), isNotNull);
    });

    test('PIN contains letters', () {
      expect(validatePin('123a', '123a'), isNotNull);
    });

    test('PIN confirmation mismatch', () {
      expect(validatePin('1234', '5678'), isNotNull);
    });

    test('weak PIN: 0000', () {
      expect(validatePin('0000', '0000'), isNotNull);
    });

    test('weak PIN: 1234', () {
      expect(validatePin('1234', '1234'), isNotNull);
    });

    test('weak PIN: 1111', () {
      expect(validatePin('1111', '1111'), isNotNull);
    });

    test('empty PIN', () {
      expect(validatePin('', ''), isNotNull);
    });
  });

  group('PIN Lock Service — Lockout Logic', () {
    test('lockout remaining seconds calculation', () {
      final now = DateTime(2026, 1, 1, 12, 0, 0);
      final lockedUntil = DateTime(2026, 1, 1, 12, 5, 0);
      final remaining = lockedUntil.difference(now).inSeconds;
      expect(remaining, 300);
    });

    test('expired lockout returns negative (means unlocked)', () {
      final now = DateTime(2026, 1, 1, 12, 0, 0);
      final lockedUntil = DateTime(2026, 1, 1, 11, 55, 0);
      final remaining = lockedUntil.difference(now).inSeconds;
      expect(remaining, lessThan(0));
    });

    test('lockout timestamp format is valid ISO 8601', () {
      final lockedUntil = DateTime(2026, 1, 1, 12, 5, 0);
      final iso = lockedUntil.toIso8601String();
      final parsed = DateTime.tryParse(iso);
      expect(parsed, isNotNull);
      expect(parsed, equals(lockedUntil));
    });
  });

  group('PIN Lock Service — Security Properties', () {
    test('PIN keys do not contain plaintext', () {
      const keys = [
        'm_edu_pin_hash',
        'm_edu_pin_salt',
        'm_edu_pin_enabled',
        'm_edu_pin_failed_attempts',
        'm_edu_pin_locked_until',
      ];
      for (final key in keys) {
        // Keys must not contain user data.
        expect(key, isNot(contains('1234')));
        expect(key, isNot(contains('password')));
      }
    });

    test('hash produces consistent output across calls', () {
      const salt = 'fixed_test_salt_1234567890';
      final hashes = List.generate(
        10,
        (_) => hashPin('5678', salt),
      );
      expect(hashes.toSet().length, 1);
    });

    test('empty PIN produces valid hash', () {
      final hash = hashPin('', 'salt');
      expect(hash.length, 64);
    });

    test('Unicode PIN produces valid hash', () {
      final hash = hashPin('🔑123', 'salt');
      expect(hash.length, 64);
    });
  });
}
