import 'dart:math';

import '../../../../core/utils/ulid.dart';

/// Real ID raqami uchun value object.
///
/// Format: `M-EDU-{yil}-{ULID}` masalan `M-EDU-2026-01J9X2K3M4N5P6Q7R8S9T0V1W2`.
///
/// A2/E2 (multi-device): ID'lar ENDI qurilmaviy ketma-ket hisoblagichdan
/// EMAS — har bir ID global yagona ULID'ga asoslanadi (48-bit vaqt +
/// 80-bit kriptografik tasodifiylik). Ikki qurilma bir vaqtda ro'yxatdan
/// o'tkazsa ham ID to'qnashmaydi (sync'da entity collision yo'q).
///
/// Yil ID'da saqlanadi — inson o'qiy oladigan kontekst (eski format
/// `M-EDU-{yil}-{000000}` qurilmaviy counter tufayli xavfli edi).
class RealId {
  static const String prefix = 'M-EDU';

  final String value;
  final int year;

  const RealId._({required this.value, required this.year});

  /// Global yagona (ULID asosidagi) ID generatsiya qiladi.
  ///
  /// [now] — testlarda deterministik chiqish uchun. [random] — testlarda
  /// takrorlanuvchi chiqish uchun (default kriptografik `Random.secure`).
  factory RealId.generate({DateTime? now, Random? random}) {
    final y = (now ?? DateTime.now()).year;
    if (y < 2000 || y > 2100) {
      throw ArgumentError.value(y, 'year', 'Yil diapazondan tashqarida');
    }
    final ulid = Ulid.generate(now: now, random: random);
    return RealId._(value: '$prefix-$y-$ulid', year: y);
  }

  /// Mavjud string'ni tekshirib, RealId'ga aylantiradi.
  /// Noto'g'ri formatda bo'lsa `FormatException` tashlaydi.
  factory RealId.parse(String raw) {
    // ULID: 26 belgi Crockford base32 (0-9, A-Z minus I,L,O,U).
    final pattern = RegExp(r'^M-EDU-(\d{4})-([0-9A-HJKMNP-TV-Z]{26})$');
    final match = pattern.firstMatch(raw.trim());
    if (match == null) {
      throw FormatException('Noto\'g\'ri RealId formati: $raw');
    }
    final year = int.parse(match.group(1)!);
    return RealId._(value: raw.trim(), year: year);
  }

  @override
  String toString() => value;

  @override
  bool operator ==(Object other) => other is RealId && other.value == value;

  @override
  int get hashCode => value.hashCode;
}
