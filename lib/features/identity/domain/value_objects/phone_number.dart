/// Telefon raqami value object'i — normalizatsiya va tekshirish.
///
/// Faqat raqamli belgilarni qoldiradi; xalqaro formatni (+998...)
/// qo'llab-quvvatlaydi. Identity dedup (spec §3) uchun asos bo'ladi.
class PhoneNumber {
  final String raw;
  final String normalized;

  const PhoneNumber._({required this.raw, required this.normalized});

  static const int _minDigits = 9;
  static const int _maxDigits = 15;

  factory PhoneNumber.validate(String raw) {
    final cleaned = raw.trim().replaceAll(RegExp(r'[\s\-()]'), '');
    final digits = cleaned.replaceAll(RegExp(r'[^0-9+]'), '');
    final digitOnly = digits.replaceAll('+', '');

    if (digitOnly.length < _minDigits || digitOnly.length > _maxDigits) {
      throw FormatException(
        'Telefon raqami $raw uzunligi noto\'g\'ri '
        '(${digitOnly.length} ta raqam, kamida $_minDigits talab qilinadi)',
      );
    }
    if (digits.startsWith('00')) {
      throw const FormatException(
        'Telefon raqami 00 bilan boshlamasligi kerak, + ishlating',
      );
    }
    return PhoneNumber._(raw: raw.trim(), normalized: digits);
  }

  /// Dedup/qidiruv uchun raqamsiz kanonik ko'rinish (masalan `998901234567`).
  String get canonical => normalized.replaceAll('+', '');

  @override
  String toString() => normalized;

  @override
  bool operator ==(Object other) =>
      other is PhoneNumber && other.canonical == canonical;

  @override
  int get hashCode => canonical.hashCode;
}
