import 'package:isar/isar.dart';

part 'notification_record.g.dart';

/// `AppNotification` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class NotificationRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String notificationId;

  late String type;

  late String title;

  late String body;

  @Index()
  late String status;

  String? targetIdentityId;

  String? relatedId;

  late String channel;

  late bool delivered;

  /// Yetkazish holati. Nullable — eski yozuvlarda maydon yo'q edi,
  /// mapping'da null 'queued' deb talqin qilinadi (migration-safe).
  String? deliveryState;

  @Index()
  late DateTime createdAt;

  DateTime? readAt;

  DateTime? deliveredAt;
}
