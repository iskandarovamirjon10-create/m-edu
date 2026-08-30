import 'package:isar/isar.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Identity (master data) sinxronlash mapper'i.
///
/// Push: faqat `pendingSync == true` yozuvlarni yuboradi. `photoPath` kabi
/// lokal fayl yo'llari bulutga yuborilmaydi (privacy, §4.4).
///
/// Pull (PHASE 1, contract §5-7): [localState]/[applyRemote] orqali remote
/// o'zgarishlar lokal bazaga qo'llanadi. `photoPath` bulutda yo'q — mavjud
/// lokal qiymat saqlanib qoladi (o'chirilmaydi).
class IdentitySyncMapper implements SyncEntityMapper {
  final Isar _db;

  IdentitySyncMapper(this._db);

  @override
  String get entityType => 'identity';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records = await _db.identityRecords
        .filter()
        .pendingSyncEqualTo(true)
        .findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: r.identityId,
        operationType: r.status == 'deleted'
            ? SyncOperationType.delete
            : SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.updatedAt ?? r.createdAt,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      final record = await _db.identityRecords
          .filter()
          .identityIdEqualTo(entityId)
          .findFirst();
      if (record == null) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.identityRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // Yozuv pendingSync=true bo'lib qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final record = await _db.identityRecords
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
        final record = await _db.identityRecords
            .filter()
            .identityIdEqualTo(remote.entityId)
            .findFirst();
        if (record != null) {
          await _db.identityRecords.delete(record.id);
        }
        return;
      }

      final payload = remote.payload ?? const {};
      // Unique identityId indeksi — mavjud bo'lsa REPLACE qilamiz (repo
      // qoidasi: find → id copy → put).
      final existing = await _db.identityRecords
          .filter()
          .identityIdEqualTo(remote.entityId)
          .findFirst();

      final record = existing ?? IdentityRecord();
      record
        ..identityId = remote.entityId
        ..firstName = payload['firstName'] as String? ??
            (existing?.firstName ?? '')
        ..lastName = payload['lastName'] as String? ??
            (existing?.lastName ?? '')
        ..middleName = payload['middleName'] as String?
        ..role = payload['role'] as String? ?? (existing?.role ?? 'unknown')
        ..status = payload['status'] as String? ?? (existing?.status ?? 'active')
        ..phone = payload['phone'] as String?
        ..email = payload['email'] as String?
        // photoPath bulutda yo'q — mavjud lokal qiymat saqlanadi (privacy).
        ..qrSeed = payload['qrSeed'] as String? ?? (existing?.qrSeed ?? '')
        ..createdAt = DateTime.tryParse(
                payload['createdAt'] as String? ?? '') ??
            (existing?.createdAt ?? DateTime.now())
        ..updatedAt = DateTime.tryParse(payload['updatedAt'] as String? ?? '')
        // Remote holat qo'llandi — pending tozalanadi (contract §5-6).
        ..syncVersion = remote.version
        ..pendingSync = false;

      await _db.identityRecords.put(record);
    });
  }

  static Map<String, dynamic> _payloadOf(IdentityRecord r) => {
        'identityId': r.identityId,
        'firstName': r.firstName,
        'lastName': r.lastName,
        'middleName': r.middleName,
        'role': r.role,
        'status': r.status,
        'phone': r.phone,
        'email': r.email,
        'qrSeed': r.qrSeed,
        'createdAt': r.createdAt.toIso8601String(),
        'updatedAt': r.updatedAt?.toIso8601String(),
        'syncVersion': r.syncVersion,
      };
}
