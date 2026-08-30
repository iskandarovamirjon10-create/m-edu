import 'package:isar/isar.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Group sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull: [localState]/[applyRemote]
/// orqali remote o'zgarishlar qo'llanadi.
///
/// Group — tashkilot tuzilmasining asosiy birligi: guruh, o'qituvchi,
/// xona, fan, to'lov stavkasi — barchasi shu yozuvga bog'liq.
class GroupSyncMapper implements SyncEntityMapper {
  final Isar _db;

  GroupSyncMapper(this._db);

  @override
  String get entityType => 'group';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.groupRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.groupId,
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
      final record = await _db.groupRecords
          .filter()
          .groupIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.groupRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.groupRecords
        .filter()
        .groupIdEqualTo(entityId)
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
        final record = await _db.groupRecords
            .filter()
            .groupIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.groupRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      final existing = await _db.groupRecords
          .filter()
          .groupIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? GroupRecord();
      record
        ..groupId = remote.entityId
        ..name = payload['name'] as String? ?? (existing?.name ?? '')
        ..code = payload['code'] as String?
        ..capacity = payload['capacity'] as int? ?? (existing?.capacity ?? 0)
        ..currentSize =
            payload['currentSize'] as int? ?? (existing?.currentSize ?? 0)
        ..teacherId = payload['teacherId'] as String?
        ..teacherName = payload['teacherName'] as String?
        ..roomId = payload['roomId'] as String?
        ..roomName = payload['roomName'] as String?
        ..subject = payload['subject'] as String?
        ..academicYear = payload['academicYear'] as String?
        ..monthlyFee =
            payload['monthlyFee'] as int? ?? (existing?.monthlyFee ?? 0)
        ..status = payload['status'] as String? ??
            (existing?.status ?? 'active')
        ..startDate =
            DateTime.tryParse(payload['startDate'] as String? ?? '')
        ..endDate = DateTime.tryParse(payload['endDate'] as String? ?? '')
        ..daysOfWeekJson = payload['daysOfWeekJson'] as String?
        ..startTime = payload['startTime'] as String?
        ..endTime = payload['endTime'] as String?
        ..notes = payload['notes'] as String?
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.groupRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(GroupRecord r) => {
        'groupId': r.groupId,
        'name': r.name,
        'code': r.code,
        'capacity': r.capacity,
        'currentSize': r.currentSize,
        'teacherId': r.teacherId,
        'teacherName': r.teacherName,
        'roomId': r.roomId,
        'roomName': r.roomName,
        'subject': r.subject,
        'academicYear': r.academicYear,
        'monthlyFee': r.monthlyFee,
        'status': r.status,
        'startDate': r.startDate?.toIso8601String(),
        'endDate': r.endDate?.toIso8601String(),
        'daysOfWeekJson': r.daysOfWeekJson,
        'startTime': r.startTime,
        'endTime': r.endTime,
        'notes': r.notes,
        'syncVersion': r.syncVersion,
      };
}
