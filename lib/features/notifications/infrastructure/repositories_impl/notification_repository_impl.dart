import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/notification.dart';
import '../../domain/repositories/notification_repository.dart';
import '../datasources/isar_notification_datasource.dart';
import '../models/notification_record.dart';

/// `NotificationRepository` interfeysining Isar asosidagi implementatsiyasi.
class NotificationRepositoryImpl implements NotificationRepository {
  final IsarNotificationDataSource _datasource;

  NotificationRepositoryImpl(this._datasource);

  @override
  Future<AppNotification> save(AppNotification notification) async {
    final record = _toRecord(notification);
    final saved = await _datasource.insert(record);
    // Fresh write — record valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<AppNotification> update(AppNotification notification) async {
    final record = _toRecord(notification);
    final saved = await _datasource.insert(record);
    return _toEntity(saved)!;
  }

  @override
  Future<AppNotification?> fetchById(String notificationId) async {
    final record = await _datasource.findById(notificationId);
    // Corrupt yozuv → null (crash yo'q, spec §7).
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<AppNotification>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi.
    return records.map(_toEntity).whereType<AppNotification>().toList();
  }

  @override
  Future<List<AppNotification>> fetchUnread() async {
    final records = await _datasource.findUnread();
    return records.map(_toEntity).whereType<AppNotification>().toList();
  }

  @override
  Future<List<AppNotification>> fetchByTarget(String identityId) async {
    final records = await _datasource.findByTarget(identityId);
    return records.map(_toEntity).whereType<AppNotification>().toList();
  }

  @override
  Future<List<AppNotification>> fetchByType(NotificationType type) async {
    final records = await _datasource.findByType(type.name);
    return records.map(_toEntity).whereType<AppNotification>().toList();
  }

  @override
  Future<AppNotification> markAsRead(String notificationId) async {
    final record = await _datasource.findById(notificationId);
    if (record == null) throw Exception('Bildirishnoma topilmadi');

    record.status = 'read';
    record.readAt = DateTime.now();

    final updated = await _datasource.insert(record);
    return _toEntity(updated)!;
  }

  @override
  Future<void> markAllAsRead({String? targetIdentityId}) async {
    final records = targetIdentityId != null
        ? await _datasource.findByTarget(targetIdentityId)
        : await _datasource.findAll();

    for (final record in records.where((r) => r.status == 'unread')) {
      record.status = 'read';
      record.readAt = DateTime.now();
      await _datasource.insert(record);
    }
  }

  @override
  Future<int> countUnread({String? targetIdentityId}) {
    return _datasource.countUnread(targetIdentityId: targetIdentityId);
  }

  @override
  Future<AppNotification> archive(String notificationId) async {
    final record = await _datasource.findById(notificationId);
    if (record == null) throw Exception('Bildirishnoma topilmadi');

    record.status = 'archived';

    final updated = await _datasource.insert(record);
    return _toEntity(updated)!;
  }

  @override
  Future<int> cleanupOld({int daysToKeep = 30}) {
    return _datasource.cleanupOld(daysToKeep);
  }

  /// Eski yozuvlar (field yo'q paytdagilar) uchun xavfsiz default.
  static DeliveryState _deliveryStateOf(String? value) {
    if (value == null) return DeliveryState.queued;
    for (final state in DeliveryState.values) {
      if (state.name == value) return state;
    }
    return DeliveryState.queued;
  }

  NotificationRecord _toRecord(AppNotification notification) {
    return NotificationRecord()
      ..notificationId = notification.notificationId
      ..type = notification.type.name
      ..title = notification.title
      ..body = notification.body
      ..status = notification.status.name
      ..targetIdentityId = notification.targetIdentityId
      ..relatedId = notification.relatedId
      ..channel = notification.channel.name
      ..delivered = notification.delivered
      ..deliveryState = notification.deliveryState.name
      ..createdAt = notification.createdAt
      ..readAt = notification.readAt
      ..deliveredAt = notification.deliveredAt;
  }

  /// [AppNotification]'ga xavfsiz o'giradi — corrupt enum yozuv
  /// o'tkazib yuboriladi (crash YO'Q, spec §7, §17).
  AppNotification? _toEntity(NotificationRecord record) {
    final type = tryEnumByName(NotificationType.values, record.type);
    final status = tryEnumByName(NotificationStatus.values, record.status);
    final channel = tryEnumByName(DeliveryChannel.values, record.channel);
    if (type == null || status == null || channel == null) return null;
    return AppNotification(
      notificationId: record.notificationId,
      type: type,
      title: record.title,
      body: record.body,
      status: status,
      targetIdentityId: record.targetIdentityId,
      relatedId: record.relatedId,
      channel: channel,
      delivered: record.delivered,
      deliveryState: _deliveryStateOf(record.deliveryState),
      createdAt: record.createdAt,
      readAt: record.readAt,
      deliveredAt: record.deliveredAt,
    );
  }
}
