import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/services/app_logger.dart';

void main() {
  group('AppLogger.redact — maxfiy ma\'lumot log\'ga chiqmaydi', () {
    test('password=... qiymati yashiriladi', () {
      expect(AppLogger.redact('login password=superSecret123'), isNot(contains('superSecret123')));
      expect(AppLogger.redact('login password=superSecret123'), contains('***'));
    });

    test('token: ... qiymati yashiriladi', () {
      expect(AppLogger.redact('token: abcdef123456'), isNot(contains('abcdef123456')));
    });

    test('Telegram bot token naqshi yashiriladi (123456789:AA...)', () {
      const msg = 'sendMessage bot 123456789:AAHk2jF9xQwErTyUiOpAsDfGhJkLzXcVbN';
      final redacted = AppLogger.redact(msg);
      expect(redacted, isNot(contains('123456789:AAHk2jF9xQwErTyUiOpAsDfGhJkLzXcVbN')));
      expect(redacted, contains('bot-token'));
    });

    test('rtsp URL ichidagi parol yashiriladi', () {
      const url = 'rtsp://admin:MySecretPass@192.168.1.64:554/Streaming/Channels/101';
      final redacted = AppLogger.redact(url);
      expect(redacted, isNot(contains('MySecretPass')));
      expect(redacted, contains('rtsp://***@'));
      // IP manzil ko'rinib qoladi (maxfiy emas — diagnostika uchun kerak).
      expect(redacted, contains('192.168.1.64'));
    });

    test('api_key/secret/authorization naqshlari yashiriladi', () {
      expect(AppLogger.redact('api_key=AIzaSyABC123'), isNot(contains('AIzaSyABC123')));
      expect(AppLogger.redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9'), isNot(contains('eyJhbGciOiJIUzI1NiJ9')));
    });

    test('oddiy ma\'lumotlar o\'zgarishsiz qoladi (no false positive)', () {
      const normal = 'Student qoshildi: Ali Valiyev (M-EDU-2026-000001)';
      expect(AppLogger.redact(normal), normal);
    });

    test('bo\'sh matn xavfsiz', () {
      expect(AppLogger.redact(''), '');
    });
  });

  group('AppLogger — darajalar', () {
    test('daraja qiymatlari tartiblangan (debug < info < ... < critical)', () {
      expect(LogLevel.debug.index, lessThan(LogLevel.info.index));
      expect(LogLevel.info.index, lessThan(LogLevel.warning.index));
      expect(LogLevel.warning.index, lessThan(LogLevel.error.index));
      expect(LogLevel.error.index, lessThan(LogLevel.critical.index));
    });
  });
}
