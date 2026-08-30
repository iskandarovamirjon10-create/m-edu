import 'package:isar/isar.dart';

import '../models/telegram_report_delivery_record.dart';

/// Telegram yetkazish yozuvlari uchun Isar datasource.
class IsarTelegramReportDeliveryDataSource {
  final Isar _db;

  IsarTelegramReportDeliveryDataSource(this._db);

  Future<void> put(TelegramReportDeliveryRecord record) {
    return _db.writeTxn(() => _db.telegramReportDeliveryRecords.put(record));
  }

  Future<TelegramReportDeliveryRecord?> findByParentAndPeriod(
    String parentId,
    String period,
  ) {
    return _db.telegramReportDeliveryRecords
        .filter()
        .parentIdEqualTo(parentId)
        .periodEqualTo(period)
        .findFirst();
  }

  Future<List<TelegramReportDeliveryRecord>> fetchByParent(
    String parentId,
  ) {
    return _db.telegramReportDeliveryRecords
        .filter()
        .parentIdEqualTo(parentId)
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<List<TelegramReportDeliveryRecord>> fetchAll({int limit = 100}) {
    return _db.telegramReportDeliveryRecords
        .where()
        .sortByCreatedAtDesc()
        .limit(limit)
        .findAll();
  }

  Future<List<TelegramReportDeliveryRecord>> fetchPending() {
    return _db.telegramReportDeliveryRecords
        .filter()
        .statusEqualTo('pending')
        .findAll();
  }

  Future<List<TelegramReportDeliveryRecord>> fetchRetryable() {
    return _db.telegramReportDeliveryRecords
        .filter()
        .statusEqualTo('failed')
        .attemptCountLessThan(5)
        .findAll();
  }
}
