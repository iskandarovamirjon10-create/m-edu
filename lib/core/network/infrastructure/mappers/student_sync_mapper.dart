import 'package:isar/isar.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Student sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull (PHASE 1): [localState]/
/// [applyRemote] orqali remote o'zgarishlar qo'llanadi. Payload'da yo'q
/// lokal maydonlar (academicYear, notes, completedAt, transferToGroupId,
/// lastPaymentDate) mavjud lokal qiymatda saqlanadi.
class StudentSyncMapper implements SyncEntityMapper {
  final Isar _db;

  StudentSyncMapper(this._db);

  @override
  String get entityType => 'student';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.studentRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.identityId,
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.assignedAt ?? r.enrolledAt,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.studentRecords
          .filter()
          .identityIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.studentRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.studentRecords
        .filter()
        .identityIdEqualTo(entityId)
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
        final record = await _db.studentRecords
            .filter()
            .identityIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.studentRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      // identityId unique indeksi — find → id copy → put (REPLACE).
      final existing = await _db.studentRecords
          .filter()
          .identityIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? StudentRecord();
      record
        ..identityId = remote.entityId
        ..studentNumber =
            payload['studentNumber'] as int? ?? (existing?.studentNumber ?? 0)
        ..groupId = payload['groupId'] as String?
        ..groupName = payload['groupName'] as String?
        ..studentStatus = payload['studentStatus'] as String? ??
            (existing?.studentStatus ?? 'active')
        ..transferStatus = payload['transferStatus'] as String? ??
            (existing?.transferStatus ?? 'none')
        ..paymentStatus =
            payload['paymentStatus'] as bool? ?? (existing?.paymentStatus ?? false)
        ..totalPaid = payload['totalPaid'] as int? ?? (existing?.totalPaid ?? 0)
        ..parentName = payload['parentName'] as String?
        ..parentPhone = payload['parentPhone'] as String?
        ..parentTelegramId = payload['parentTelegramId'] as String?
        ..enrolledAt = DateTime.tryParse(
                payload['enrolledAt'] as String? ?? '') ??
            (existing?.enrolledAt ?? DateTime.now())
        ..assignedAt = DateTime.tryParse(payload['assignedAt'] as String? ?? '')
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.studentRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(StudentRecord r) => {
        'identityId': r.identityId,
        'studentNumber': r.studentNumber,
        'groupId': r.groupId,
        'groupName': r.groupName,
        'studentStatus': r.studentStatus,
        'transferStatus': r.transferStatus,
        'paymentStatus': r.paymentStatus,
        'totalPaid': r.totalPaid,
        'parentName': r.parentName,
        'parentPhone': r.parentPhone,
        'parentTelegramId': r.parentTelegramId,
        'enrolledAt': r.enrolledAt.toIso8601String(),
        'assignedAt': r.assignedAt?.toIso8601String(),
        'syncVersion': r.syncVersion,
      };
}
