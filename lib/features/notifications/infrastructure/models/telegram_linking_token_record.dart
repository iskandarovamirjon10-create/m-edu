import 'package:isar/isar.dart';

part 'telegram_linking_token_record.g.dart';

/// Telegram bog'lash tokeni — Isar'da saqlanadigan ko'rinish.
///
/// Bir marta ishlatiladigan token: ota-ona botga /start TOKEN yozadi,
/// tizim tokeni tekshirib, Telegram chat ID'sini bog'laydi.
@collection
class TelegramLinkingTokenRecord {
  Id id = Isar.autoIncrement;

  /// Token matni (unique).
  @Index(unique: true, replace: false)
  late String token;

  /// Bog'lanishi kerak bo'lgan ota-ona identity ID'si.
  @Index()
  late String identityId;

  /// Bog'lanishi kerak bo'lgan talaba identity ID'si.
  late String studentIdentityId;

  /// Token yaratilgan sana.
  late DateTime createdAt;

  /// Token muddati tugash sanasi.
  late DateTime expiresAt;

  /// Token ishlatildimi.
  late bool used;

  /// Ishlatilgan sana.
  DateTime? usedAt;

  /// Telegram chat ID (ishlatilgandan keyin to'ldiriladi).
  String? telegramChatId;

  /// Telegram foydalanuvchi nomi.
  String? telegramUsername;
}
