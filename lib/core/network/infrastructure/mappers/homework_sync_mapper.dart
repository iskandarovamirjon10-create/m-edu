import 'package:isar/isar.dart';
import 'package:m_edu/features/homework/infrastructure/models/homework_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Homework sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull: [localState]/[applyRemote]
/// orqali remote o'zgarishlar qo'llanadi.
///
/// Vazifalar guruhga tayinlangan — bajarilishi / bajarilmasligi
/// o'quvchiga bog'liq. isCompleted statusi offline holatda
/// o'zgarishi mumkin — conflict'da versiya hal qiladi.
class HomeworkSyncMapper implements SyncEntityMapper {
  final Isar _db;

  HomeworkSyncMapper(this._db);

  @override
  String get entityType => 'homework';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.homeworkRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.homeworkId,
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.createdAt,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.homeworkRecords
          .filter()
          .homeworkIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.homeworkRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.homeworkRecords
        .filter()
        .homeworkIdEqualTo(entityId)
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
        final record = await _db.homeworkRecords
            .filter()
            .homeworkIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.homeworkRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      final existing = await _db.homeworkRecords
          .filter()
          .homeworkIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? HomeworkRecord();
      record
        ..homeworkId = remote.entityId
        ..groupId = payload['groupId'] as String? ??
            (existing?.groupId ?? '')
        ..groupName = payload['groupName'] as String?
        ..subjectName =
            payload['subjectName'] as String? ?? (existing?.subjectName ?? '')
        ..title = payload['title'] as String? ?? (existing?.title ?? '')
        ..description =
            payload['description'] as String? ?? (existing?.description ?? '')
        ..dueDate = DateTime.tryParse(payload['dueDate'] as String? ?? '') ??
            (existing?.dueDate ?? DateTime.now())
        ..createdBy = payload['createdBy'] as String?
        ..createdByName = payload['createdByName'] as String?
        ..isCompleted = payload['isCompleted'] as bool? ??
            (existing?.isCompleted ?? false)
        ..createdAt = DateTime.tryParse(
                payload['createdAt'] as String? ?? '') ??
            (existing?.createdAt ?? DateTime.now())
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.homeworkRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(HomeworkRecord r) => {
        'homeworkId': r.homeworkId,
        'groupId': r.groupId,
        'groupName': r.groupName,
        'subjectName': r.subjectName,
        'title': r.title,
        'description': r.description,
        'dueDate': r.dueDate.toIso8601String(),
        'createdBy': r.createdBy,
        'createdByName': r.createdByName,
        'isCompleted': r.isCompleted,
        'createdAt': r.createdAt.toIso8601String(),
        'syncVersion': r.syncVersion,
      };
}
