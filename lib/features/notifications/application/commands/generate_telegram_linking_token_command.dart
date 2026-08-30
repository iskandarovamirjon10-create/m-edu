import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../../settings/domain/repositories/settings_repository.dart';
import '../../domain/entities/telegram_linking_token.dart';
import '../../domain/repositories/telegram_linking_token_repository.dart';
import '../../infrastructure/services/telegram_service.dart';

/// Telegram bog'lash tokeni yaratish natijasi.
class GenerateLinkingTokenResult {
  /// Yaratilgan token.
  final TelegramLinkingToken token;

  /// Token formatida ko'rsatish uchun (qisqa).
  final String displayToken;

  const GenerateLinkingTokenResult({
    required this.token,
    required this.displayToken,
  });
}

/// Ota-ona uchun bir marta ishlatiladigan Telegram bog'lash tokeni yaratadi.
///
/// Token yaratilgandan keyin ota-ona botga `/start <token>` yozadi.
/// Bot tokeni tekshirib, Telegram chat ID'sini bog'laydi.
class GenerateTelegramLinkingTokenCommand {
  final TelegramLinkingTokenRepository _tokenRepository;
  final SettingsRepository _settingsRepository;
  final TelegramService _telegramService;

  /// RBAC (AUDIT P2-02): Telegram sozlamalari.
  final UserRole actorRole;

  GenerateTelegramLinkingTokenCommand({
    required TelegramLinkingTokenRepository tokenRepository,
    required SettingsRepository settingsRepository,
    required TelegramService telegramService,
    this.actorRole = UserRole.unknown,
  })  : _tokenRepository = tokenRepository,
        _settingsRepository = settingsRepository,
        _telegramService = telegramService;

  Future<GenerateLinkingTokenResult> execute({
    required String identityId,
    required String studentIdentityId,
  }) async {
    Permissions.require(actorRole, AppPermission.telegramConfigure);

    // Bot tokeni mavjudligini tekshirish.
    final settings = await _settingsRepository.getSettings();
    final token = settings.telegramBotToken?.trim() ?? '';
    if (token.isEmpty) {
      throw const ValidationFailure(
        'Telegram bot token kiritilmagan — Settings → Telegram',
      );
    }

    // Bot tokeni to'g'riligini tekshirish (real API so'rovi).
    final botValid = await _telegramService.verifyBotToken(token);
    if (!botValid) {
      throw const ValidationFailure(
        'Telegram bot tokeni noto\'g\'ri — BotFather dan yangi oling',
      );
    }

    // Eski ishlatilmagan tokenlarni tozalash.
    await _tokenRepository.cleanupExpired();

    // Yangi token yaratish (128 ta tasodifiy belgi).
    final random = Random.secure();
    final tokenChars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    final linkingToken = List.generate(
      128,
      (_) => tokenChars[random.nextInt(tokenChars.length)],
    ).join();

    final now = DateTime.now();
    final linkingTokenEntity = TelegramLinkingToken(
      token: linkingToken,
      identityId: identityId,
      studentIdentityId: studentIdentityId,
      createdAt: now,
      expiresAt: now.add(const Duration(hours: 24)),
    );

    final saved = await _tokenRepository.save(linkingTokenEntity);

    return GenerateLinkingTokenResult(
      token: saved,
      displayToken: linkingToken,
    );
  }
}
