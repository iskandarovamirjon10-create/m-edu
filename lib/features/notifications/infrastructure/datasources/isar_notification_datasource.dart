import 'package:isar/isar.dart';

import '../models/notification_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarNotificationDataSource {
  final Isar _db;

  IsarNotificationDataSource(this._db);

  Future<NotificationRecord> insert(NotificationRecord record) async {
    return _db.writeTxn(() async {
      await _db.notificationRecords.put(record);
      return record;
    });
  }

  Future<NotificationRecord?> findById(String notificationId) {
    return _db.notificationRecords
        .filter()
        .notificationIdEqualTo(notificationId)
        .findFirst();
  }

  Future<List<NotificationRecord>> findAll() {
    return _db.notificationRecords
        .where()
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<List<NotificationRecord>> findUnread() {
    return _db.notificationRecords
        .filter()
        .statusEqualTo('unread')
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<List<NotificationRecord>> findByTarget(String identityId) {
    return _db.notificationRecords
        .filter()
        .targetIdentityIdEqualTo(identityId)
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<List<NotificationRecord>> findByType(String type) {
    return _db.notificationRecords
        .filter()
        .typeEqualTo(type)
        .sortByCreatedAtDesc()
        .findAll();
  }

  Future<int> countUnread({String? targetIdentityId}) async {
    final all = await _db.notificationRecords
        .filter()
        .statusEqualTo('unread')
        .findAll();

    if (targetIdentityId != null) {
      return all
          .where((n) => n.targetIdentityId == targetIdentityId)
          .length;
    }
    return all.length;
  }

  Future<int> cleanupOld(int daysToKeep) async {
    final cutoff = DateTime.now().subtract(Duration(days: daysToKeep));
    final oldRecords = await _db.notificationRecords
        .filter()
        .createdAtLessThan(cutoff)
        .findAll();

    return _db.writeTxn(() async {
      int count = 0;
      for (final record in oldRecords) {
        await _db.notificationRecords.delete(record.id);
        count++;
      }
      return count;
    });
  }
}
