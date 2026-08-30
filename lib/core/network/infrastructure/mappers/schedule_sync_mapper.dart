import 'package:isar/isar.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Schedule sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull: [localState]/[applyRemote]
/// orqali remote o'zgarishlar qo'llanadi.
///
/// Dars jadvali — guruh, o'qituvchi, xona, kun, vaqt, fan.
/// Offline'da o'zgarishlar qilinsa, sinxronlashda versiya ziddiyati
/// audit qilinadi.
class ScheduleSyncMapper implements SyncEntityMapper {
  final Isar _db;

  ScheduleSyncMapper(this._db);

  @override
  String get entityType => 'schedule';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.scheduleRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.scheduleId,
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.startDate ?? DateTime.now(),
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.scheduleRecords
          .filter()
          .scheduleIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.scheduleRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.scheduleRecords
        .filter()
        .scheduleIdEqualTo(entityId)
        .findFirst();
    if (record == null) return null;
    return LocalEntityState(
      version: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }

  @override
  Future<void> applyRemote(RemoteEntity remote) async {
    await _db.writeTxn(() async {
      // Tombstone: lokal yozuv o'chiriladi (contract §9).
      if (remote.deleted) {
        final record = await _db.scheduleRecords
            .filter()
            .scheduleIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.scheduleRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      final existing = await _db.scheduleRecords
          .filter()
          .scheduleIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? ScheduleRecord();
      record
        ..scheduleId = remote.entityId
        ..groupId = payload['groupId'] as String? ??
            (existing?.groupId ?? '')
        ..groupName = payload['groupName'] as String?
        ..teacherId =
            payload['teacherId'] as String? ?? (existing?.teacherId ?? '')
        ..teacherName = payload['teacherName'] as String?
        ..roomId = payload['roomId'] as String? ?? (existing?.roomId ?? '')
        ..roomName = payload['roomName'] as String?
        ..dayOfWeek = payload['dayOfWeek'] as int? ??
            (existing?.dayOfWeek ?? 1)
        ..startTime =
            payload['startTime'] as String? ?? (existing?.startTime ?? '09:00')
        ..endTime =
            payload['endTime'] as String? ?? (existing?.endTime ?? '10:00')
        ..subject = payload['subject'] as String?
        ..status = payload['status'] as String? ??
            (existing?.status ?? 'active')
        ..specificDate =
            DateTime.tryParse(payload['specificDate'] as String? ?? '')
        ..startDate =
            DateTime.tryParse(payload['startDate'] as String? ?? '')
        ..endDate = DateTime.tryParse(payload['endDate'] as String? ?? '')
        ..notes = payload['notes'] as String?
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.scheduleRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(ScheduleRecord r) => {
        'scheduleId': r.scheduleId,
        'groupId': r.groupId,
        'groupName': r.groupName,
        'teacherId': r.teacherId,
        'teacherName': r.teacherName,
        'roomId': r.roomId,
        'roomName': r.roomName,
        'dayOfWeek': r.dayOfWeek,
        'startTime': r.startTime,
        'endTime': r.endTime,
        'subject': r.subject,
        'status': r.status,
        'specificDate': r.specificDate?.toIso8601String(),
        'startDate': r.startDate?.toIso8601String(),
        'endDate': r.endDate?.toIso8601String(),
        'notes': r.notes,
        'syncVersion': r.syncVersion,
      };
}
