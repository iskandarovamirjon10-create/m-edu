import 'package:isar/isar.dart';
import '../../domain/entities/telegram_report_delivery.dart';
import '../../domain/repositories/telegram_report_delivery_repository.dart';
import '../datasources/isar_telegram_report_delivery_datasource.dart';
import '../models/telegram_report_delivery_record.dart';

/// Telegram yetkazish tarixi repository'sining Isar implementatsiyasi.
class TelegramReportDeliveryRepositoryImpl
    implements TelegramReportDeliveryRepository {
  final IsarTelegramReportDeliveryDataSource _datasource;

  TelegramReportDeliveryRepositoryImpl(this._datasource);

  @override
  Future<TelegramReportDelivery> save(TelegramReportDelivery delivery) async {
    final record = _toRecord(delivery);
    await _datasource.put(record);
    return _toEntity(record);
  }

  @override
  Future<TelegramReportDelivery> update(TelegramReportDelivery delivery) async {
    final record = _toRecord(delivery);
    await _datasource.put(record);
    return _toEntity(record);
  }

  @override
  Future<TelegramReportDelivery?> findByParentAndPeriod(
    String parentId,
    String period,
  ) async {
    final record = await _datasource.findByParentAndPeriod(parentId, period);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<TelegramReportDelivery>> fetchByParent(String parentId) async {
    final records = await _datasource.fetchByParent(parentId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<TelegramReportDelivery>> fetchAll({int limit = 100}) async {
    final records = await _datasource.fetchAll(limit: limit);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<TelegramReportDelivery>> fetchPending() async {
    final records = await _datasource.fetchPending();
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<TelegramReportDelivery>> fetchRetryable() async {
    final records = await _datasource.fetchRetryable();
    return records.map(_toEntity).toList();
  }

  @override
  Future<bool> isAlreadySent(String parentId, String period) async {
    final record = await _datasource.findByParentAndPeriod(parentId, period);
    return record != null && record.status == 'sent';
  }

  @override
  Future<bool> isPending(String parentId, String period) async {
    final record = await _datasource.findByParentAndPeriod(parentId, period);
    return record != null && record.status == 'pending';
  }

  TelegramReportDeliveryRecord _toRecord(TelegramReportDelivery entity) {
    return TelegramReportDeliveryRecord()
      ..id = entity.id ?? Isar.autoIncrement
      ..parentId = entity.parentId
      ..studentIdentityId = entity.studentIdentityId
      ..telegramChatId = entity.telegramChatId
      ..period = entity.period
      ..status = entity.status.name
      ..telegramMessageId = entity.telegramMessageId
      ..attemptCount = entity.attemptCount
      ..createdAt = entity.createdAt
      ..updatedAt = entity.updatedAt
      ..sentAt = entity.sentAt
      ..errorCode = entity.errorCode
      ..errorMessage = entity.errorMessage;
  }

  TelegramReportDelivery _toEntity(TelegramReportDeliveryRecord record) {
    final status = TelegramDeliveryStatus.values.firstWhere(
      (s) => s.name == record.status,
      orElse: () => TelegramDeliveryStatus.failed,
    );

    return TelegramReportDelivery(
      id: record.id,
      parentId: record.parentId,
      studentIdentityId: record.studentIdentityId,
      telegramChatId: record.telegramChatId,
      period: record.period,
      status: status,
      telegramMessageId: record.telegramMessageId,
      attemptCount: record.attemptCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sentAt: record.sentAt,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
    );
  }
}
