import 'package:equatable/equatable.dart';

/// Telegram bog'lash tokeni — ota-ona Telegram botga /start TOKEN yozib
/// o'zini tizimga bog'laydi. Token bir marta ishlatiladi va muddati tugaydi.
class TelegramLinkingToken extends Equatable {
  /// Token matni (128 ta tasodifiy alifbo-raqam belgisi).
  final String token;

  /// Bog'lanishi kerak bo'lgan ota-ona/vasiy identity ID'si.
  final String identityId;

  /// Bog'lanishi kerak bo'lgan talaba identity ID'si (ota-ona qaysi
  /// bola uchun bog'lanayotganini aniqlash uchun).
  final String studentIdentityId;

  /// Token yaratilgan sana.
  final DateTime createdAt;

  /// Token muddati tugash sanasi (default: 24 soat).
  final DateTime expiresAt;

  /// Token ishlatildimi (bir marta).
  final bool used;

  /// Ishlatilgan sana (agar ishlatilgan bo'lsa).
  final DateTime? usedAt;

  /// Telegram chat ID (ishlatilgandan keyin to'ldiriladi).
  final String? telegramChatId;

  /// Telegram foydalanuvchi nomi (ishlatilgandan keyin to'ldiriladi).
  final String? telegramUsername;

  const TelegramLinkingToken({
    required this.token,
    required this.identityId,
    required this.studentIdentityId,
    required this.createdAt,
    required this.expiresAt,
    this.used = false,
    this.usedAt,
    this.telegramChatId,
    this.telegramUsername,
  });

  /// Token hali ishlatilmagan va muddati tugamaganmi?
  bool get isValid => !used && DateTime.now().isBefore(expiresAt);

  /// Token muddati tugaganmi?
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  @override
  List<Object?> get props => [
        token,
        identityId,
        studentIdentityId,
        createdAt,
        expiresAt,
        used,
        usedAt,
        telegramChatId,
        telegramUsername,
      ];
}
