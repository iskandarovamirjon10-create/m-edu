import 'package:isar/isar.dart';
import 'package:m_edu/features/attendance/infrastructure/datasources/isar_attendance_datasource.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import '../../sync_entity_mapper.dart';

/// Attendance sinxronlash mapper'i.
///
/// Attendance idempotent: (identityId + lessonId/sana) bo'yicha put —
/// takroriy yuborish duplicate yaratmaydi (remote'da ham putUpsert qoidasi).
///
/// Push: `pendingSync == true` yozuvlar. Pull (PHASE 1): [localState]/
/// [applyRemote] orqali remote o'zgarishlar qo'llanadi — merge semantikasi
/// (eng erta check-in, eng kech check-out) [IsarAttendanceDataSource.putUpsert]
/// orqali saqlanadi (contract §9 attendance maxsus qoidasi).
class AttendanceSyncMapper implements SyncEntityMapper {
  final Isar _db;

  AttendanceSyncMapper(this._db);

  @override
  String get entityType => 'attendance';

  @override
  Future<List<SyncEntity>> fetchPending() async {
    final records = await _db.attendanceRecords
        .filter()
        .pendingSyncEqualTo(true)
        .findAll();
    return records.map((r) {
      return SyncEntity(
        entityType: entityType,
        entityId: _entityIdOf(r),
        operationType: SyncOperationType.upsert,
        payload: _payloadOf(r),
        version: r.syncVersion,
        updatedAt: r.checkInAt ?? r.timestamp,
      );
    }).toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    // entityId deterministik: identityId:lesson — lokal yozuvni shu bo'yicha
    // topib, FAQAT O'SHA yozuvning pendingSync bayrog'ini o'chiramiz
    // (sibling yozuvlar tegilmaydi — contract: markSynced aniq operatsiyaga
    // tegishli).
    final lookup = _parseEntityId(entityId);
    if (lookup == null) return;
    await _db.writeTxn(() async {
      final record = await _findRecordByIdentity(lookup.identityId, lookup.lessonKey);
      if (record == null || !record.pendingSync) return;
      record.pendingSync = false;
      record.syncVersion = version;
      await _db.attendanceRecords.put(record);
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {
    // pendingSync=true qoladi — keyingi pass'da qayta uriniladi.
  }

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    final lookup = _parseEntityId(entityId);
    if (lookup == null) return null;
    final record = await _findRecordByIdentity(lookup.identityId, lookup.lessonKey);
    if (record == null) return null;
    return LocalEntityState(
      version: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }

  @override
  Future<void> applyRemote(RemoteEntity remote) async {
    // Tombstone: lokal yozuv o'chiriladi (contract §9).
    if (remote.deleted) {
      final lookup = _parseEntityId(remote.entityId);
      if (lookup == null) return;
      await _db.writeTxn(() async {
        final record =
            await _findRecordByIdentity(lookup.identityId, lookup.lessonKey);
        if (record != null) {
          await _db.attendanceRecords.delete(record.id);
        }
      });
      return;
    }

    final payload = remote.payload ?? const {};
    final attendanceDate =
        DateTime.tryParse(payload['attendanceDate'] as String? ?? '');
    final timestamp = DateTime.tryParse(payload['timestamp'] as String? ?? '');

    // Remote yozuvni qurib, merge semantikasi bilan qo'llaymiz (eng erta
    // check-in, eng kech check-out — putUpsert invariant, contract §9).
    final record = AttendanceRecord()
      ..identityId = remote.entityId.split(':').first
      ..timestamp = timestamp ?? DateTime.now()
      ..fullName = payload['fullName'] as String? ?? ''
      ..role = payload['role'] as String? ?? 'student'
      ..method = payload['method'] as String? ?? 'manual'
      ..confidence = (payload['confidence'] as num?)?.toDouble()
      ..source = payload['source'] as String?
      ..attendanceDate = attendanceDate
      ..lessonId = payload['lessonId'] as String?
      ..checkInAt = DateTime.tryParse(payload['checkInAt'] as String? ?? '')
      ..checkOutAt = DateTime.tryParse(payload['checkOutAt'] as String? ?? '')
      ..status = payload['status'] as String?
      ..isLegacyMerged = payload['isLegacyMerged'] as bool?
      ..syncVersion = remote.version
      ..pendingSync = false;

    // Merge: mavjud yozuv bilan birlashadi (check-in erta, check-out kech).
    await IsarAttendanceDataSource(_db).putUpsert(record);
  }

  /// entityId: `identityId:lessonId` yoki `identityId:day:YYYY-M-D`.
  static ({String identityId, String lessonKey})? _parseEntityId(
    String entityId,
  ) {
    final firstColon = entityId.indexOf(':');
    if (firstColon <= 0 || firstColon == entityId.length - 1) return null;
    return (
      identityId: entityId.substring(0, firstColon),
      lessonKey: entityId.substring(firstColon + 1),
    );
  }

  /// Lokal primary yozuvni (identityId, lessonKey) bo'yicha topadi.
  Future<AttendanceRecord?> _findRecordByIdentity(
    String identityId,
    String lessonKey,
  ) {
    final ds = IsarAttendanceDataSource(_db);
    if (lessonKey.startsWith('day:')) {
      final parts = lessonKey.substring(4).split('-');
      if (parts.length != 3) return Future.value(null);
      final date = DateTime(
        int.tryParse(parts[0]) ?? 0,
        int.tryParse(parts[1]) ?? 0,
        int.tryParse(parts[2]) ?? 0,
      );
      return ds.findByStudentAndDate(identityId, date);
    }
    return ds.findByStudentAndLesson(identityId, lessonKey);
  }

  /// Attendance uchun deterministik entity ID: (identityId + lessonId|sana).
  /// Bir xil yozuv boshqa qurilmada yozilsa ham bir xil ID — dublikat yo'q.
  static String _entityIdOf(AttendanceRecord r) {
    final date = r.attendanceDate ?? r.timestamp;
    final dateKey = '${date.year}-${date.month}-${date.day}';
    final lesson = r.lessonId?.isNotEmpty == true ? r.lessonId : 'day:$dateKey';
    return '${r.identityId}:$lesson';
  }

  static Map<String, dynamic> _payloadOf(AttendanceRecord r) => {
        'identityId': r.identityId,
        'fullName': r.fullName,
        'role': r.role,
        'attendanceDate': r.attendanceDate?.toIso8601String(),
        'timestamp': r.timestamp.toIso8601String(),
        'lessonId': r.lessonId,
        'checkInAt': r.checkInAt?.toIso8601String(),
        'checkOutAt': r.checkOutAt?.toIso8601String(),
        'method': r.method,
        'status': r.status,
        'confidence': r.confidence,
        'source': r.source,
        'isLegacyMerged': r.isLegacyMerged,
        'syncVersion': r.syncVersion,
      };
}
