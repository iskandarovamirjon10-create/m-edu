import 'package:isar/isar.dart';
import 'package:m_edu/features/grades/infrastructure/models/grade_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Grade sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull: [localState]/[applyRemote]
/// orqali remote o'zgarishlar qo'llanadi.
///
/// Baholar o'quvchining akademik yutuqlarini aks ettiradi — 5-ballik
/// tizimda (2..5). Conflict hal qilinsa ham bahoning original qiymati
/// muhim — versiya ziddiyati audit qilinadi.
class GradeSyncMapper implements SyncEntityMapper {
  final Isar _db;

  GradeSyncMapper(this._db);

  @override
  String get entityType => 'grade';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.gradeRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.gradeId,
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.date,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.gradeRecords
          .filter()
          .gradeIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.gradeRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.gradeRecords
        .filter()
        .gradeIdEqualTo(entityId)
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
        final record = await _db.gradeRecords
            .filter()
            .gradeIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.gradeRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      final existing = await _db.gradeRecords
          .filter()
          .gradeIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? GradeRecord();
      record
        ..gradeId = remote.entityId
        ..studentIdentityId =
            payload['studentIdentityId'] as String? ?? (existing?.studentIdentityId ?? '')
        ..studentName =
            payload['studentName'] as String? ?? (existing?.studentName ?? '')
        ..groupId = payload['groupId'] as String?
        ..groupName = payload['groupName'] as String?
        ..subjectId =
            payload['subjectId'] as String? ?? (existing?.subjectId ?? '')
        ..subjectName =
            payload['subjectName'] as String? ?? (existing?.subjectName ?? '')
        ..value = payload['value'] as int? ?? (existing?.value ?? 3)
        ..comment = payload['comment'] as String?
        ..date = DateTime.tryParse(payload['date'] as String? ?? '') ??
            (existing?.date ?? DateTime.now())
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.gradeRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(GradeRecord r) => {
        'gradeId': r.gradeId,
        'studentIdentityId': r.studentIdentityId,
        'studentName': r.studentName,
        'groupId': r.groupId,
        'groupName': r.groupName,
        'subjectId': r.subjectId,
        'subjectName': r.subjectName,
        'value': r.value,
        'comment': r.comment,
        'date': r.date.toIso8601String(),
        'syncVersion': r.syncVersion,
      };
}
