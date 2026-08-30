import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/network/domain/remote_data_sink.dart';
import 'package:m_edu/core/network/domain/sync_operation.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_conflict_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_cursor_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_operation_datasource.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_conflict_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_cursor_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_operation_record.dart';
import 'package:m_edu/core/network/sync_engine.dart';
import 'package:m_edu/core/network/sync_entity_mapper.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

/// In-memory remote sink — real cloud'ni taqlid qiladi (test uchun).
/// Konfiguratsiya: [failNext] — keyingi yuborishda xato, [remoteVersion]
/// — conflict simulyatsiyasi.
class _FakeRemoteSink implements RemoteDataSink {
  final Map<String, Map<String, dynamic>> store = {};
  final List<String> writes = [];
  final List<String> deletes = [];

  bool configured = true;
  bool failNext = false;
  bool permanentFailNext = false;
  int remoteVersion = 0;
  int? conflictOnVersion; // client versiyasi shunga teng bo'lsa conflict

  @override
  bool get isConfigured => configured;

  @override
  String get name => 'fake';

  @override
  Future<RemoteWriteResult> put({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
  }) async {
    if (failNext) {
      failNext = false;
      return RemoteWriteResult.failure('network down');
    }
    if (permanentFailNext) {
      permanentFailNext = false;
      return RemoteWriteResult.failure('invalid data', permanent: true);
    }
    if (conflictOnVersion != null && version < conflictOnVersion!) {
      return RemoteWriteResult.conflicted(conflictOnVersion!);
    }
    final key = '$entityType:$entityId';
    store[key] = {
      ...payload,
      '_version': version,
      '_deviceId': deviceId,
    };
    writes.add(key);
    return RemoteWriteResult.ok;
  }

  @override
  Future<RemoteWriteResult> delete({
    required String entityType,
    required String entityId,
    required int version,
    required String deviceId,
  }) async {
    final key = '$entityType:$entityId';
    store.remove(key);
    deletes.add(key);
    return RemoteWriteResult.ok;
  }

  @override
  Future<List<RemoteEntity>> fetchChanged({
    required String entityType,
    required DateTime since,
    required int limit,
  }) async {
    return const [];
  }
}

/// Mapper uchun in-memory pending ro'yxati — Isar'da haqiqiy record'lar
/// bilan ishlaydi (IdentityRecord/StudentRecord).
class _RecordBasedMapper implements SyncEntityMapper {
  _RecordBasedMapper(this._db, {required this.entityType});

  final Isar _db;
  @override
  final String entityType;

  @override
  Future<List<SyncEntity>> fetchPending() async {
    if (entityType == 'identity') {
      final records =
          await _db.identityRecords.filter().pendingSyncEqualTo(true).findAll();
      return records
          .map((r) => SyncEntity(
                entityType: entityType,
                entityId: r.identityId,
                operationType: SyncOperationType.upsert,
                payload: {'identityId': r.identityId, 'firstName': r.firstName},
                version: r.syncVersion,
                updatedAt: r.createdAt,
              ))
          .toList();
    }
    final records =
        await _db.studentRecords.filter().pendingSyncEqualTo(true).findAll();
    return records
        .map((r) => SyncEntity(
              entityType: entityType,
              entityId: r.identityId,
              operationType: SyncOperationType.upsert,
              payload: {'identityId': r.identityId, 'studentNumber': r.studentNumber},
              version: r.syncVersion,
              updatedAt: r.enrolledAt,
            ))
        .toList();
  }

  @override
  Future<void> markSynced(String entityId, int version) async {
    await _db.writeTxn(() async {
      if (entityType == 'identity') {
        final r = await _db.identityRecords
            .filter()
            .identityIdEqualTo(entityId)
            .findFirst();
        if (r != null) {
          r.pendingSync = false;
          r.syncVersion = version;
          await _db.identityRecords.put(r);
        }
      } else {
        final r = await _db.studentRecords
            .filter()
            .identityIdEqualTo(entityId)
            .findFirst();
        if (r != null) {
          r.pendingSync = false;
          r.syncVersion = version;
          await _db.studentRecords.put(r);
        }
      }
    });
  }

  @override
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false}) async {}

  @override
  Future<LocalEntityState?> localState(String entityId) async {
    if (entityType == 'identity') {
      final r = await _db.identityRecords
          .filter()
          .identityIdEqualTo(entityId)
          .findFirst();
      return r == null
          ? null
          : LocalEntityState(version: r.syncVersion, pendingSync: r.pendingSync);
    }
    final r = await _db.studentRecords
        .filter()
        .identityIdEqualTo(entityId)
        .findFirst();
    return r == null
        ? null
        : LocalEntityState(version: r.syncVersion, pendingSync: r.pendingSync);
  }

  @override
  Future<void> applyRemote(RemoteEntity remote) async {
    // Pull testlari boshqa faylda (bidirectional_sync_test) — bu yerda no-op.
  }
}

void main() {
  late Directory tempDir;
  late Isar isar;
  late SyncOperationDataSource queue;
  late SyncCursorDataSource cursorDs;
  late SyncConflictDataSource conflictDs;
  late _FakeRemoteSink remote;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_sync');
    isar = await Isar.open(
      [
        IdentityRecordSchema,
        StudentRecordSchema,
        SyncOperationRecordSchema,
        SyncCursorRecordSchema,
        SyncConflictRecordSchema,
      ],
      directory: tempDir.path,
    );
    queue = SyncOperationDataSource(isar);
    cursorDs = SyncCursorDataSource(isar);
    conflictDs = SyncConflictDataSource(isar);
    remote = _FakeRemoteSink();
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  SyncEngine engine({
    int maxRetries = 3,
    int backoffBase = 2,
    int batchLimit = 100,
    String deviceId = 'device-A',
  }) {
    return SyncEngine(
      remote: remote,
      queue: queue,
      cursorDataSource: cursorDs,
      conflictDataSource: conflictDs,
      mappers: [
        _RecordBasedMapper(isar, entityType: 'identity'),
        _RecordBasedMapper(isar, entityType: 'student'),
      ],
      deviceId: deviceId,
      maxRetries: maxRetries,
      backoffBaseSeconds: backoffBase,
      batchLimit: batchLimit,
    );
  }

  Future<void> addIdentity(String id, {int version = 1, bool pending = true}) {
    return isar.writeTxn(() async {
      // Unique identityId indeksi — mavjud bo'lsa yangilaymiz (repo qoidasi).
      final existing = await isar.identityRecords
          .filter()
          .identityIdEqualTo(id)
          .findFirst();
      final record = existing ?? IdentityRecord();
      record
        ..identityId = id
        ..firstName = 'Ali'
        ..lastName = 'Valiyev'
        ..role = 'student'
        ..status = 'active'
        ..qrSeed = 'seed-$id'
        ..createdAt = DateTime(2026, 8, 1)
        ..syncVersion = version
        ..pendingSync = pending;
      await isar.identityRecords.put(record);
    });
  }

  Future<void> addStudent(String id, {int version = 1, bool pending = true}) {
    return isar.writeTxn(() async {
      final existing = await isar.studentRecords
          .filter()
          .identityIdEqualTo(id)
          .findFirst();
      final record = existing ?? StudentRecord();
      record
        ..identityId = id
        ..studentNumber = 1
        ..studentStatus = 'active'
        ..transferStatus = 'none'
        ..paymentStatus = true
        ..totalPaid = 0
        ..enrolledAt = DateTime(2026, 8, 1)
        ..syncVersion = version
        ..pendingSync = pending;
      await isar.studentRecords.put(record);
    });
  }

  group('SyncEngine — offline queue', () {
    test('sync yuborilmaydi (isEnabled=false) — offline-first, hech narsa buzilmaydi', () async {
      remote.configured = false;
      await addIdentity('M-EDU-2026-000001');

      final result = await engine().processOnce();

      expect(result.attempted, 0);
      expect(remote.writes, isEmpty);
      // Yozuv pending bo'lib qoladi — keyin sync uchun tayyor.
      final records =
          await isar.identityRecords.filter().pendingSyncEqualTo(true).findAll();
      expect(records.length, 1);
    });

    test('muvaffaqiyatli sync: pending → remote\'da yozuv, lokal bayroq o\'chadi, queue tozalanadi', () async {
      await addIdentity('M-EDU-2026-000001');
      await addStudent('M-EDU-2026-000001');

      final result = await engine().processOnce();

      expect(result.synced, 2);
      expect(result.failed, 0);
      expect(remote.store.keys, containsAll(['identity:M-EDU-2026-000001', 'student:M-EDU-2026-000001']));
      expect(remote.store['identity:M-EDU-2026-000001']?['_deviceId'], 'device-A');
      // Lokal bayroq o'chdi.
      final pending = await isar.identityRecords
          .filter()
          .pendingSyncEqualTo(true)
          .findAll();
      expect(pending, isEmpty);
      // Queue bo'sh.
      expect(await queue.pendingCount(), 0);
    });

    test('network xato → failed + exponential backoff (keyingi pass\'da yuborilmaydi)', () async {
      await addIdentity('M-EDU-2026-000001');
      remote.failNext = true;

      final first = await engine().processOnce();
      expect(first.failed, 1);
      // Backoff tufayli darhol qayta yuborilmaydi.
      final second = await engine().processOnce();
      expect(second.attempted, 0);
      // Yozuv pending bo'lib qolgan.
      final pending = await isar.identityRecords
          .filter()
          .pendingSyncEqualTo(true)
          .findAll();
      expect(pending.length, 1);
    });

    test('backoff muddati yetganda qayta uriniladi (nextRetryAt dan keyin)', () async {
      await addIdentity('M-EDU-2026-000001');
      remote.failNext = true;
      await engine(backoffBase: 0).processOnce(); // retry 1: nextRetryAt ~ now+0

      final retry = await engine(backoffBase: 0).processOnce();
      expect(retry.synced, 1);
      expect(remote.store.containsKey('identity:M-EDU-2026-000001'), isTrue);
    });

    test('retry limit tugagach → permanent (avtomatik qayta urinilmaydi)', () async {
      await addIdentity('M-EDU-2026-000001');
      remote.failNext = true;

      // maxRetries=1: birinchi urinish fails, retryCount 1 >= 1 → permanent.
      final result = await engine(maxRetries: 1, backoffBase: 0).processOnce();

      expect(result.permanent, 1);
      final blocked = await queue.blockedOperations();
      expect(blocked.length, 1);
      expect(blocked.single.syncStatus, 'permanent');
    });

    test('validation (doimiy) xato → permanent, DO NOT RETRY FOREVER', () async {
      await addIdentity('M-EDU-2026-000001');
      remote.permanentFailNext = true;

      final result = await engine().processOnce();

      expect(result.permanent, 1);
      // Keyingi pass'da qayta urinilmaydi.
      final again = await engine().processOnce();
      expect(again.attempted, 0);
    });

    test('versiya ziddiyati → conflict holati, yozuv jimgina yo\'qolmaydi', () async {
      await addIdentity('M-EDU-2026-000001', version: 1);
      remote.conflictOnVersion = 5; // remote allaqachon v5 da

      final result = await engine().processOnce();

      expect(result.conflicts, 1);
      final blocked = await queue.blockedOperations();
      expect(blocked.single.syncStatus, 'conflict');
      expect(blocked.single.remoteVersion, 5);
      // Remote'dagi mavjud ma'lumot buzilmadi.
      expect(remote.store.containsKey('identity:M-EDU-2026-000001'), isFalse);
    });
  });

  group('SyncEngine — dedup va multi-device', () {
    test('bitta yozuv ikki marta enqueue bo\'lsa ham bitta operatsiya (dedup)', () async {
      await addIdentity('M-EDU-2026-000001', version: 1);
      await addIdentity('M-EDU-2026-000001', version: 2, pending: true);

      // Ikkala pass ham bitta operatsiya yuboradi — remote'da bitta yozuv.
      await engine().processOnce();
      final second = await engine().processOnce();

      expect(second.attempted, 0);
      expect(remote.writes.length, 1);
    });

    test('ikki qurilma bir xil student qo\'shsa — duplicate emas, idempotent put', () async {
      await addIdentity('M-EDU-2026-000001');
      final engineA = engine(deviceId: 'device-A');
      await engineA.processOnce();

      // B qurilmasi ham xuddi shu identity'ni yozdi (offline vaqtda).
      await addIdentity('M-EDU-2026-000001', version: 2, pending: true);
      final engineB = engine(deviceId: 'device-B');
      final resultB = await engineB.processOnce();

      // Remote'da bitta identity yozuvi — yangilangan (idempotent put).
      expect(
        remote.store.keys.where((k) => k.startsWith('identity:')).length,
        1,
      );
      expect(resultB.synced, 1);
    });

    test('batch limit: 100 ta yozuvdan ko\'pi bir pass\'da yuborilmaydi', () async {
      for (var i = 1; i <= 5; i++) {
        await addIdentity('M-EDU-2026-${i.toString().padLeft(6, '0')}');
      }

      final result = await engine(batchLimit: 3).processOnce();

      expect(result.synced, 3);
      expect(remote.writes.length, 3);
      // Qolganlari keyingi pass'da.
      final again = await engine(batchLimit: 3).processOnce();
      expect(again.synced, 2);
    });
  });

  group('SyncEngine — qurilma qulashi recovery (inFlight)', () {
    Future<void> leaveStaleInFlight({
      String entityId = 'M-EDU-2026-000001',
      int version = 1,
      Duration age = const Duration(minutes: 5),
    }) async {
      // Sync o'rtasida "qulash" simulyatsiyasi: yozuv queue'da inFlight
      // holatida qoladi (markInFlight chaqirilgan, push tugamagan).
      await queue.enqueue(
        entityType: 'identity',
        entityId: entityId,
        operationType: SyncOperationType.upsert,
        payload: {'identityId': entityId, 'firstName': 'Ali'},
        version: version,
        deviceId: 'device-A',
      );
      final ops = await isar.syncOperationRecords.where().findAll();
      await queue.markInFlight(ops.single.operationId);
      // App o'ldirilgan — yozuv "eski" bo'lib qoladi (qayta ishga tushish).
      await isar.writeTxn(() async {
        final op = await isar.syncOperationRecords.where().findFirst();
        op!.updatedAt = DateTime.now().subtract(age);
        await isar.syncOperationRecords.put(op);
      });
    }

    test('sync paytida app o\'ldirilsa (inFlight qolib ketsa) — qayta ishga tushganda yozuv yuboriladi', () async {
      await addIdentity('M-EDU-2026-000001');
      await leaveStaleInFlight();

      // Qayta ishga tushish: yangi engine, stale inFlight yozuv qayta
      // yuboriladi — mutation cloud'ga yetadi (jim yo'qolish YO'Q).
      final result = await engine().processOnce();

      expect(result.synced, 1);
      expect(
        remote.store.containsKey('identity:M-EDU-2026-000001'),
        isTrue,
      );
      expect(await queue.pendingCount(), 0);
    });

    test('qolib ketgan inFlight yozuv bitta pass\'da bitta marta yuboriladi (duplicate yo\'q)', () async {
      await addIdentity('M-EDU-2026-000001');
      await leaveStaleInFlight(age: const Duration(seconds: 5));

      // Yoshi qancha bo'lmasin — pass boshidagi har qanday inFlight yozuv
      // to'xtatilgan deb hisoblanadi va AYNI shu pass'da BIR marta yuboriladi.
      final result = await engine().processOnce();

      expect(result.synced, 1);
      expect(remote.writes.length, 1); // duplicate push YO'Q
      expect(await queue.pendingCount(), 0);
    });

    test('stale inFlight yozuv retry limitga bo\'ysunadi (doimiy qayta urinish yo\'q)', () async {
      await addIdentity('M-EDU-2026-000001');
      await leaveStaleInFlight();
      remote.failNext = true;

      // maxRetries=1: qayta urinish xato bersa → permanent (DO NOT RETRY
      // FOREVER) — inFlight recovery ham retry siyosatiga bo'ysunadi.
      final result = await engine(maxRetries: 1, backoffBase: 0).processOnce();

      expect(result.permanent, 1);
      final blocked = await queue.blockedOperations();
      expect(blocked.single.syncStatus, 'permanent');
    });
  });

  group('SyncOperationDataSource — queue determinizmi', () {
    test('deterministik operationId: ikki marta enqueue → bitta yozuv yangilanadi', () async {
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'X',
        operationType: SyncOperationType.upsert,
        payload: {'v': 1},
        version: 1,
        deviceId: 'd1',
      );
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'X',
        operationType: SyncOperationType.upsert,
        payload: {'v': 2},
        version: 2,
        deviceId: 'd1',
      );

      final ops = await isar.syncOperationRecords.where().findAll();
      expect(ops.length, 1);
      expect(jsonDecode(ops.single.payload)['v'], 2);
      expect(ops.single.version, 2);
    });

    test('resetInFlightToPending: qolib ketgan inFlight yozuv pending\'ga qaytadi (crash recovery)', () async {
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'X',
        operationType: SyncOperationType.upsert,
        payload: {'v': 1},
        version: 1,
        deviceId: 'd1',
      );
      final ops = await isar.syncOperationRecords.where().findAll();
      await queue.markInFlight(ops.single.operationId);
      // MarkInFlight dan keyin qayta o'qiladi — holat inFlight bo'ldi.
      final afterMark = await isar.syncOperationRecords.where().findFirst();
      expect(afterMark!.syncStatus, 'inFlight');

      // Qayta ishga tushish — yangi pass: inFlight → pending.
      await queue.resetInFlightToPending();
      final recovered = await isar.syncOperationRecords.where().findFirst();
      expect(recovered!.syncStatus, 'pending');
      expect(recovered.nextRetryAt, isNull);
      // Endi dueOperations uni qaytaradi — yozuv hech qachon "yopishib" qolmaydi.
      expect((await queue.dueOperations()).length, 1);
    });

    test('permanent holatdagi yozuv yangi lokal o\'zgarish bilan pending bo\'ladi', () async {
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'X',
        operationType: SyncOperationType.upsert,
        payload: {'v': 1},
        version: 1,
        deviceId: 'd1',
      );
      final ops = await isar.syncOperationRecords.where().findAll();
      await queue.markPermanent(ops.single.operationId, 'invalid');
      expect((await queue.blockedOperations()).length, 1);

      // Yangi lokal o'zgarish → yana pending.
      await queue.enqueue(
        entityType: 'identity',
        entityId: 'X',
        operationType: SyncOperationType.upsert,
        payload: {'v': 2},
        version: 2,
        deviceId: 'd1',
      );
      expect(await queue.pendingCount(), 1);
      expect(await queue.blockedOperations(), isEmpty);
    });
  });
}
