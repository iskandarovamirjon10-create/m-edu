import 'dart:math';

/// ULID (Universally Unique Lexicographically Sortable Identifier).
///
/// Crockford base32 (no I, L, O, U): 48-bit millisecond timestamp +
/// 80-bit cryptographic randomness (26 chars). Timestamp prefix makes
/// values roughly time-ordered; the random component makes them globally
/// unique across devices — no device-local counter required (A2/E2).
///
/// Used for identity IDs (`M-EDU-{year}-{ULID}`) and payment receipts
/// (`REC-{ULID}`) so multi-device sync never collides on identifiers.
class Ulid {
  Ulid._();

  static const String _alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  /// To'liq 26-belgili ULID (48-bit vaqt + 80-bit tasodifiylik).
  ///
  /// [random] berilmasa `Random.secure()` ishlatiladi (kriptografik).
  static String generate({DateTime? now, Random? random}) {
    return _generate(now: now, random: random, length: 26);
  }

  /// Qisqa 16-belgili ULID (80-bit tasodifiylik) — receipt kabi
  /// kompakt display identifikatorlar uchun.
  ///
  /// 80 bit tasodifiylik bilan 10k yozuvda to'qnashuv ehtimoli ~1e-15 —
  /// amaliy jihatdan nol. (Vaqt komponenti olib tashlangan — tartib
  /// talab qilinmaydigan identifikatorlar uchun.)
  static String generateShort({Random? random}) {
    return _generate(random: random, length: 16);
  }

  static String _generate({
    DateTime? now,
    Random? random,
    required int length,
  }) {
    final rnd = random ?? Random.secure();

    if (length == 26) {
      // 48-bit timestamp → 10 ta base32 belgi (MSB-first).
      var ts = (now ?? DateTime.now()).millisecondsSinceEpoch;
      final tsChars = List<String>.filled(10, '0');
      for (var i = 9; i >= 0; i--) {
        tsChars[i] = _alphabet[ts & 31];
        ts >>= 5;
      }
      final randomChars =
          List.generate(16, (_) => _alphabet[rnd.nextInt(32)]).join();
      return tsChars.join() + randomChars;
    }

    return List.generate(length, (_) => _alphabet[rnd.nextInt(32)]).join();
  }
}
