import 'package:isar/isar.dart';

part 'telegram_report_delivery_record.g.dart';

/// Telegram hisobot yetkazish yozuvi — Isar'da saqlanadigan ko'rinish.
///
/// Har bir ota-ona + oy uchun bitta yozuv. Takroriy yuborishni
/// oldini olish uchun (parentId + period) unique.
@collection
class TelegramReportDeliveryRecord {
  Id id = Isar.autoIncrement;

  /// Yuborilgan ota-ona identity ID'si.
  @Index()
  late String parentId;

  /// Talaba identity ID'si.
  late String studentIdentityId;

  /// Telegram chat ID.
  late String telegramChatId;

  /// Hisobot davri ("2026-08" ko'rinishida).
  @Index(unique: true, replace: false)
  late String period;

  /// Yetkazish holati (pending/sending/sent/failed).
  late String status;

  /// Telegram API'dan kelgan xabar ID'si.
  int? telegramMessageId;

  /// Urinishlar soni.
  late int attemptCount;

  /// Yaratilgan sana.
  late DateTime createdAt;

  /// Oxirgi yangilanish sanasi.
  late DateTime updatedAt;

  /// Yuborilgan sana.
  DateTime? sentAt;

  /// Oxirgi xato kodi.
  String? errorCode;

  /// Oxirgi xato matni.
  String? errorMessage;
}
