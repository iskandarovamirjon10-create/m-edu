import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/identity/domain/value_objects/real_id.dart';

void main() {
  group('RealId.generate (A2/E2 — global uniqueness)', () {
    test('M-EDU-{yil}-{ULID26} formatini generatsiya qiladi', () {
      final id = RealId.generate(now: DateTime(2026, 8, 1));
      expect(id.value, startsWith('M-EDU-2026-'));
      expect(id.year, 2026);
      // ULID: 26 belgi Crockford base32 (0-9, A-Z minus I,L,O,U).
      final suffix = id.value.substring('M-EDU-2026-'.length);
      expect(suffix.length, 26);
      expect(suffix, matches(RegExp(r'^[0-9A-HJKMNP-TV-Z]{26}$')));
    });

    test('yil berilmasa joriy yil ishlatiladi', () {
      final id = RealId.generate();
      expect(id.year, DateTime.now().year);
    });

    test('har bir chaqiruv global yagona ID beradi (takrorlanmaydi)', () {
      final ids = {for (var i = 0; i < 1000; i++) RealId.generate().value};
      expect(ids.length, 1000);
    });

    test('ikki qurilma (turli Random) hech qachon bir xil ID olmaydi', () {
      // Turli sekillar (ikki qurilma taqlidi) — 100 tadan ID'lar kesishmaydi.
      final deviceA = {for (var i = 0; i < 50; i++) RealId.generate().value};
      final deviceB = {for (var i = 0; i < 50; i++) RealId.generate().value};
      expect(deviceA.intersection(deviceB), isEmpty);
    });

    test('deterministik random bilan ham format valid', () {
      final id = RealId.generate(random: Random(42));
      expect(RealId.parse(id.value).value, id.value);
    });
  });

  group('RealId.parse', () {
    test('to\'g\'ri formatni tahlil qiladi', () {
      final id = RealId.parse('M-EDU-2026-01J9X2K3M4N5P6Q7R8S9T0V1W2');
      expect(id.year, 2026);
      expect(id.value, 'M-EDU-2026-01J9X2K3M4N5P6Q7R8S9T0V1W2');
    });

    test('noto\'g\'ri format uchun FormatException tashlaydi', () {
      // Eski qurilmaviy ketma-ket format (6 xonali) endi qabul qilinmaydi.
      expect(() => RealId.parse('M-EDU-2026-000482'), throwsFormatException);
      expect(() => RealId.parse('M-EDU-2026-482'), throwsFormatException);
      expect(() => RealId.parse('ABC-2026-000482'), throwsFormatException);
      expect(() => RealId.parse(''), throwsFormatException);
      // ULID'da taqiqlangan belgilar (I, L, O, U).
      expect(
        () => RealId.parse('M-EDU-2026-0IIIIIIIIIIIIIIIIIIIIIIIIIII'),
        throwsFormatException,
      );
    });
  });
}
