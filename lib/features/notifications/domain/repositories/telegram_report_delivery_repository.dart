import '../entities/telegram_report_delivery.dart';

/// Telegram hisobot yetkazish tarixi uchun repository interfeysi.
abstract class TelegramReportDeliveryRepository {
  /// Yangi yetkazish yozuvini saqlaydi.
  Future<TelegramReportDelivery> save(TelegramReportDelivery delivery);

  /// Yetkazish yozuvini yangilaydi.
  Future<TelegramReportDelivery> update(TelegramReportDelivery delivery);

  /// Berilgan ota-ona + oy uchun yetkazish yozuvini topadi.
  Future<TelegramReportDelivery?> findByParentAndPeriod(
    String parentId,
    String period,
  );

  /// Berilgan ota-ona uchun barcha yetkazish yozuvlarini qaytaradi.
  Future<List<TelegramReportDelivery>> fetchByParent(String parentId);

  /// Barcha yetkazish yozuvlarini qaytaradi (oxirgisidan boshlab).
  Future<List<TelegramReportDelivery>> fetchAll({int limit = 100});

  /// Navbatdagi (pending) yozuvlarni qaytaradi.
  Future<List<TelegramReportDelivery>> fetchPending();

  /// Muvaffaqiyatsiz (failed) va qayta urinish mumkin bo'lgan yozuvlarni qaytaradi.
  Future<List<TelegramReportDelivery>> fetchRetryable();

  /// Berilgan ota-ona + oy uchun yuborilganmi?
  Future<bool> isAlreadySent(String parentId, String period);

  /// Berilgan ota-ona + oy uchun navbatdami?
  Future<bool> isPending(String parentId, String period);
}
