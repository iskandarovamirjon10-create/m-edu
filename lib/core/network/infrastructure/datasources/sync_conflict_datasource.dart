import 'package:isar/isar.dart';

import '../models/sync_conflict_record.dart';

/// Konflikt audit datasource — deterministic hal qilingan divergensiyalar
/// metadata'sini saqlaydi (sync contract §7, §11 — payload YO'Q).
class SyncConflictDataSource {
  final Isar _db;

  SyncConflictDataSource(this._db);

  Future<void> record({
    required String entityType,
    required String entityId,
    required int localVersion,
    required int remoteVersion,
    required String winner,
    required String direction,
    required String localDeviceId,
    required String remoteDeviceId,
  }) {
    return _db.writeTxn(() async {
      await _db.syncConflictRecords.put(
        SyncConflictRecord()
          ..entityType = entityType
          ..entityId = entityId
          ..localVersion = localVersion
          ..remoteVersion = remoteVersion
          ..winner = winner
          ..direction = direction
          ..localDeviceId = localDeviceId
          ..remoteDeviceId = remoteDeviceId
          ..occurredAt = DateTime.now(),
      );
    });
  }

  Future<List<SyncConflictRecord>> findAll() {
    return _db.syncConflictRecords.where().findAll();
  }
}
