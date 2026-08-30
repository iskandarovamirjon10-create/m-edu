/// Maxfiy kalitlar — build vaqtida --dart-define orqali in'ektsiya qilinadi.
///
/// Ishlatish:
///   flutter run --dart-define=GOOGLE_WEB_CLIENT_ID=xxx
///   flutter build apk --dart-define=GOOGLE_WEB_CLIENT_ID=xxx
///
/// .env fayllari .gitignore'da — repo'ga tushmaydi.
/// CI/CD: secrets orqali --dart-define beriladi.
///
/// Agar dart-define berilmasa — bo'sh qaytariladi (offline-first mode).
class AppSecrets {
  AppSecrets._();

  /// Google OAuth Web Client ID (google-services.json client_type: 3).
  /// Android/iOS Google Sign-In uchun talab qilinadi.
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue: '',
  );

  /// Firebase API Key (agar firebase_options.dart o'rniga ishlatilsa).
  static const String firebaseApiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: '',
  );

  /// Telegram Bot Token.
  static const String telegramBotToken = String.fromEnvironment(
    'TELEGRAM_BOT_TOKEN',
    defaultValue: '',
  );

  /// Telegram bot token mavjudmi?
  static bool get hasTelegramBot => telegramBotToken.isNotEmpty;

  /// Google client ID mavjudmi?
  static bool get hasGoogleClientId => googleWebClientId.isNotEmpty;
}
