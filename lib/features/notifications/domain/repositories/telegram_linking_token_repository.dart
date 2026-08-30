import '../entities/telegram_linking_token.dart';

/// Telegram bog'lash tokenlari uchun repository interfeysi.
abstract class TelegramLinkingTokenRepository {
  /// Yangi token saqlaydi.
  Future<TelegramLinkingToken> save(TelegramLinkingToken token);

  /// Token bo'yicha qidiradi.
  Future<TelegramLinkingToken?> findByToken(String token);

  /// Ota-ona identity ID'si bo'yicha eng so'nggi tokeni.
  Future<TelegramLinkingToken?> findLatestByParent(String identityId);

  /// Token ishlatildi deb belgilaydi (Telegram chat ID bilan).
  Future<void> markUsed(
    String token, {
    required String telegramChatId,
    String? telegramUsername,
  });

  /// Muddati tugagan tokenlarni tozalaydi.
  Future<int> cleanupExpired();
}
