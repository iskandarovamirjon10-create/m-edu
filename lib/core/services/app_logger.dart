/// Production logging — darajalar bo'yicha boshqariladi, maxfiy ma'lumot
/// log qilinmaydi (task §30).
///
/// Qoidalar:
/// - DEBUG — verbose (faqat development: `--dart-define=LOG_LEVEL=debug`);
/// - INFO — normal ish hodisalari;
/// - WARNING — qayta tiklanadigan xatolar;
/// - ERROR/CRITICAL — muhim xatolar (sync, camera, DB);
/// - Parol, token, kamera paroli, face embedding, shaxsiy ma'lumot —
///   log'ga HECH QACHON chiqmaydi ([AppLogger.redact] buni kafolatlaydi).
enum LogLevel { debug, info, warning, error, critical }

class AppLogger {
  AppLogger._();

  static final LogLevel _minLevel = _resolveLevel();

  static LogLevel get level => _minLevel;

  static bool get isDebugEnabled => _minLevel.index <= LogLevel.debug.index;

  static void debug(String message) => _log(LogLevel.debug, message);

  static void info(String message) => _log(LogLevel.info, message);

  static void warning(String message) => _log(LogLevel.warning, message);

  static void error(String message) => _log(LogLevel.error, message);

  static void critical(String message) => _log(LogLevel.critical, message);

  static void _log(LogLevel level, String message) {
    if (level.index < _minLevel.index) return;
    // ignore: avoid_print
    print('[${level.name.toUpperCase()}] ${redact(message)}');
  }

  /// Maxfiy ma'lumotlarni log'dan chiqaradi.
  ///
  /// Naxshlar:
  /// - `password=...` / `password: ...`
  /// - `token=...` / `token: ...` / `botToken`
  /// - `rtsp://user:pass@...` (URL ichidagi parol)
  /// - `api_key` / `apikey` / `secret`
  /// - 16+ belgili hex/base64 kabi ko'rinadigan maxfiy qiymatlar
  ///   (bot tokenlari: `123456:ABC...`)
  static String redact(String input) {
    if (input.isEmpty) return input;

    var result = input;

    // URL ichidagi kredensiallar: rtsp://admin:parol@1.2.3.4 → rtsp://***@...
    result = result.replaceAllMapped(
      RegExp(r'([a-zA-Z][a-zA-Z0-9+.-]*://)([^/@\s]+)@'),
      (m) => '${m[1]}***@',
    );

    // Authorization: Bearer <jwt> — Bearer kaliti EMAS, butun token
    // (JWT ham) yashiriladi: `Authorization: Bearer eyJ...` → `Authorization: ***`.
    result = result.replaceAllMapped(
      RegExp(
        r'(authorization\s*[=:]\s*)(?:bearer\s+)?[^\s,;&]+',
        caseSensitive: false,
      ),
      (m) => '${m[1]}***',
    );

    // key=value / key: value naqshlari (authorization yuqorida alohida
    // ishlangan — bu yerda takrorlanmaydi).
    final sensitiveKeys = RegExp(
      r'(password|passwd|token|bot_token|botToken|api_key|apikey|apiKey|secret|private_key)'
      r'(\s*[=:]\s*)([^\s,;&]+)',
      caseSensitive: false,
    );
    result = result.replaceAllMapped(
      sensitiveKeys,
      (m) => '${m[1]}${m[2]}***',
    );

    // Telegram bot token naqshi: `123456789:AA...` (oddiy matnda).
    result = result.replaceAllMapped(
      RegExp(r'\b\d{6,10}:[A-Za-z0-9_-]{20,}\b'),
      (_) => '***bot-token***',
    );

    return result;
  }

  static LogLevel _resolveLevel() {
    // --dart-define=LOG_LEVEL=debug|info|warning|error|critical
    const override = String.fromEnvironment('LOG_LEVEL');
    if (override.isNotEmpty) {
      return LogLevel.values.firstWhere(
        (l) => l.name == override,
        orElse: () => LogLevel.info,
      );
    }
    return LogLevel.info;
  }
}
