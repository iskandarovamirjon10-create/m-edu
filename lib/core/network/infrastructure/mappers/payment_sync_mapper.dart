import 'package:isar/isar.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Payment sinxronlash mapper'i.
///
/// Push: `pendingSync == true` yozuvlar. Pull (PHASE 1): [localState]/
/// [applyRemote] orqali remote o'zgarishlar qo'llanadi.
///
/// To'lovlar moliyaviy yozuvlar — conflict jimgina yo'qotilmaydi: versiya
/// ziddiyati [SyncEngine] tomonidan deterministik hal qilinadi va
/// `SyncConflictRecord`'da audit qilinadi (contract §7).
class PaymentSyncMapper implements SyncEntityMapper {
  final Isar _db;

  PaymentSyncMapper(this._db);

  @override
  String get entityType => 'payment';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records =
        await _db.paymentRecords.filter().pendingSyncEqualTo(true).findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.paymentId,
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.paymentDate,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.paymentRecords
          .filter()
          .paymentIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.paymentRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.paymentRecords
        .filter()
        .paymentIdEqualTo(entityId)
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
        final record = await _db.paymentRecords
            .filter()
            .paymentIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.paymentRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      // paymentId unique indeksi — find → id copy → put (REPLACE).
      final existing = await _db.paymentRecords
          .filter()
          .paymentIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? PaymentRecord();
      record
        ..paymentId = remote.entityId
        ..studentIdentityId = payload['studentIdentityId'] as String? ?? ''
        ..studentName = payload['studentName'] as String?
        ..groupId = payload['groupId'] as String?
        ..groupName = payload['groupName'] as String?
        ..amount = payload['amount'] as int? ?? 0
        ..paymentType = payload['paymentType'] as String? ?? ''
        ..status = payload['status'] as String? ?? 'paid'
        ..receiptNumber = payload['receiptNumber'] as String?
        ..paymentDate = DateTime.tryParse(
                payload['paymentDate'] as String? ?? '') ??
            (existing?.paymentDate ?? DateTime.now())
        ..dueDate = DateTime.tryParse(payload['dueDate'] as String? ?? '')
        ..billingPeriod = payload['billingPeriod'] as String?
        ..discountAmount = payload['discountAmount'] as int? ?? 0
        ..discountReason = payload['discountReason'] as String?
        ..lateFee = payload['lateFee'] as int? ?? 0
        ..notes = payload['notes'] as String?
        ..receivedBy = payload['receivedBy'] as String?
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.paymentRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(PaymentRecord r) => {
        'paymentId': r.paymentId,
        'studentIdentityId': r.studentIdentityId,
        'studentName': r.studentName,
        'groupId': r.groupId,
        'groupName': r.groupName,
        'amount': r.amount,
        'paymentType': r.paymentType,
        'status': r.status,
        'receiptNumber': r.receiptNumber,
        'paymentDate': r.paymentDate.toIso8601String(),
        'dueDate': r.dueDate?.toIso8601String(),
        'billingPeriod': r.billingPeriod,
        'discountAmount': r.discountAmount,
        'discountReason': r.discountReason,
        'lateFee': r.lateFee,
        'notes': r.notes,
        'receivedBy': r.receivedBy,
        'syncVersion': r.syncVersion,
      };
}
