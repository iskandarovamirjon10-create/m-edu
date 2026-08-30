import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/network/domain/remote_data_sink.dart';
import 'package:m_edu/core/network/domain/sync_operation.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_conflict_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_cursor_datasource.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_operation_datasource.dart';
import 'package:m_edu/core/network/infrastructure/mappers/identity_sync_mapper.dart';
import 'package:m_edu/core/network/infrastructure/mappers/student_sync_mapper.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_conflict_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_cursor_record.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_operation_record.dart';
import 'package:m_edu/core/network/sync_engine.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// BIDIRECTIONAL SYNC — ikki qurilma (sync contract PHASE 1, §5-7)
///
/// Real cloud'ni taqlid qiluvchi SHARED in-memory sink orqali ikkita
/// mustaqil qurilma (alohida Isar DB + alohida cursor) birgalikda ishlaydi:
///   Device A → push → cloud → pull → Device B
///
/// Kafolatlar (contract Appendix):
/// 1. A yaratgan student → B pull orqali oladi (bootstrap + incremental).
/// 2. A tahrirlagan student → B yangilangan holatni oladi.
/// 3. Ikkala qurilma oflayn tahrir qilsa → deterministik g'olib, konflikt
///    auditda, jim overwrite YO'Q.
/// 4. Teng-versiya yozuvlar → deviceId tie-break, konflikt qayd etiladi.
/// 5. O'chirish (tombstone) → pull orqali B'ga yetadi.
/// 6. Takroriy pull idempotent — cursor monotonik o'sadi.
/// ═══════════════════════════════════════════════════════════════════════

/// Firestore semantikasini taqlid qiluvchi SHARED sink (ikkala qurilma uchun).
///
/// - [updatedAt] har yozuvda monotonik o'sadi (server vaqti taqlidi) —
///   pull cursor tartibi deterministik bo'ladi.
/// - Konflikt: eski versiya → conflict; teng versiya → kattaroq deviceId
///   g'olib (contract §7 — sink tomonda ham xuddi shu qoida).
/// - delete → tombstone (`deleted: true`) — dokument o'chirilmaydi.
class SharedRemoteSink implements RemoteDataSink {
  // ignore: library_private_types_in_public_api
  final Map<String, _RemoteDoc> store = {};
  final List<String> writes = [];
  final List<String> deletes = [];

  DateTime _clock = DateTime(2026, 8, 1, 9, 0, 0);

  bool configured = true;

  @override
  bool get isConfigured => configured;

  @override
  String get name => 'shared-fake';

  String _key(String entityType, String entityId) => '$entityType:$entityId';

  @override
  Future<RemoteWriteResult> put({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
  }) async {
    final key = _key(entityType, entityId);
    final existing = store[key];
    if (existing != null) {
      if (version < existing.version) {
        return RemoteWriteResult.conflicted(existing.version);
      }
      if (version == existing.version &&
          existing.updatedByDeviceId.isNotEmpty &&
          existing.updatedByDeviceId.compareTo(deviceId) > 0) {
        return RemoteWriteResult.conflicted(existing.version);
      }
    }
    _clock = _clock.add(const Duration(seconds: 1));
    store[key] = _RemoteDoc(
      data: payload,
      version: version,
      updatedByDeviceId: deviceId,
      updatedAt: _clock,
      deleted: false,
    );
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
    final key = _key(entityType, entityId);
    final existing = store[key];
    if (existing != null) {
      if (version < existing.version) {
        return RemoteWriteResult.conflicted(existing.version);
      }
      if (version == existing.version &&
          existing.updatedByDeviceId.isNotEmpty &&
          existing.updatedByDeviceId.compareTo(deviceId) > 0) {
        return RemoteWriteResult.conflicted(existing.version);
      }
    }
    _clock = _clock.add(const Duration(seconds: 1));
    // TOMBSTONE: dokument saqlanadi, deleted=true (contract §9).
    store[key] = _RemoteDoc(
      data: null,
      version: version,
      updatedByDeviceId: deviceId,
      updatedAt: _clock,
      deleted: true,
    );
    deletes.add(key);
    return RemoteWriteResult.ok;
  }

  @override
  Future<List<RemoteEntity>> fetchChanged({
    required String entityType,
    required DateTime since,
    required int limit,
  }) async {
    final docs = store.entries
        .where((e) =>
            e.key.startsWith('$entityType:') && e.value.updatedAt.isAfter(since))
        .map((e) => RemoteEntity(
              entityType: entityType,
              entityId: e.key.substring(entityType.length + 1),
              payload: e.value.data,
              version: e.value.version,
              updatedAt: e.value.updatedAt,
              updatedByDeviceId: e.value.updatedByDeviceId,
              deleted: e.value.deleted,
            ))
        .toList()
      ..sort((a, b) => a.updatedAt.compareTo(b.updatedAt));
    return docs.take(limit).toList();
  }
}

class _RemoteDoc {
  final Map<String, dynamic>? data;
  final int version;
  final String updatedByDeviceId;
  final DateTime updatedAt;
  final bool deleted;

  const _RemoteDoc({
    required this.data,
    required this.version,
    required this.updatedByDeviceId,
    required this.updatedAt,
    required this.deleted,
  });
}

/// Bitta "qurilma" — alohida Isar DB + cursor + queue + engine.
class _Device {
  final Isar isar;
  final SyncEngine engine;
  final String deviceId;
  final SyncConflictDataSource conflictDs;

  _Device({
    required this.isar,
    required this.engine,
    required this.deviceId,
    required this.conflictDs,
  });

  Future<void> addIdentity(
    String id, {
    int version = 1,
    bool pending = true,
    String firstName = 'Ali',
  }) {
    return isar.writeTxn(() async {
      final existing = await isar.identityRecords
          .filter()
          .identityIdEqualTo(id)
          .findFirst();
      final record = existing ?? IdentityRecord();
      record
        ..identityId = id
        ..firstName = firstName
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

  Future<void> addStudent(
    String id, {
    int version = 1,
    bool pending = true,
    int studentNumber = 1,
  }) {
    return isar.writeTxn(() async {
      final existing = await isar.studentRecords
          .filter()
          .identityIdEqualTo(id)
          .findFirst();
      final record = existing ?? StudentRecord();
      record
        ..identityId = id
        ..studentNumber = studentNumber
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

  Future<void> setFirstName(String id, String name,
      {required int version}) async {
    await isar.writeTxn(() async {
      final record = await isar.identityRecords
          .filter()
          .identityIdEqualTo(id)
          .findFirst();
      if (record == null) fail('Identity topilmadi: $id');
      record
        ..firstName = name
        ..syncVersion = version
        ..pendingSync = true;
      await isar.identityRecords.put(record);
    });
  }

  Future<int> identityVersion(String id) async {
    final r = await isar.identityRecords
        .filter()
        .identityIdEqualTo(id)
        .findFirst();
    return r?.syncVersion ?? 0;
  }

  Future<String?> identityName(String id) async {
    final r = await isar.identityRecords
        .filter()
        .identityIdEqualTo(id)
        .findFirst();
    return r?.firstName;
  }

  Future<List<SyncConflictRecord>> conflicts() => conflictDs.findAll();

  Future<void> close() => isar.close();
}

Future<_Device> _openDevice(
  SharedRemoteSink remote,
  String deviceId,
  Directory dir,
) async {
  // Isar name process-global singleton — har bir qurilma o'z name'iga ega
  // (bir xil name bilan ikkinchi ochilish "Instance has already been opened").
  final isar = await Isar.open(
    [
      IdentityRecordSchema,
      StudentRecordSchema,
      SyncOperationRecordSchema,
      SyncCursorRecordSchema,
      SyncConflictRecordSchema,
    ],
    name: 'm_edu_bidir_${deviceId}_${dir.path.hashCode.abs()}',
    directory: dir.path,
  );
  final conflictDs = SyncConflictDataSource(isar);
  final engine = SyncEngine(
    remote: remote,
    queue: SyncOperationDataSource(isar),
    cursorDataSource: SyncCursorDataSource(isar),
    conflictDataSource: conflictDs,
    mappers: [IdentitySyncMapper(isar), StudentSyncMapper(isar)],
    deviceId: deviceId,
    backoffBaseSeconds: 0,
    maxRetries: 3,
  );
  return _Device(isar: isar, engine: engine, deviceId: deviceId, conflictDs: conflictDs);
}

void main() {
  late Directory tempDir;
  late SharedRemoteSink remote;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_bidir_sync');
    remote = SharedRemoteSink();
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('Bidirectional sync — ikki qurilma', () {
    test('A student yaratadi → sync → B pull orqali oladi (bootstrap)', () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      // Device A: student + identity yaratdi.
      await deviceA.addIdentity('M-EDU-2026-000001');
      await deviceA.addStudent('M-EDU-2026-000001');

      // A sinxronladi (push).
      final resultA = await deviceA.engine.processOnce();
      expect(resultA.synced, 2);
      expect(resultA.pulled, 0);

      // B sinxronladi — remote o'zgarishlarni pull orqali oldi (bootstrap:
      // B'da cursor yo'q → epoch'dan boshlab hammasini oladi).
      final resultB = await deviceB.engine.processOnce();
      expect(resultB.pulled, 2);

      // B'da student + identity mavjud.
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');
      expect(
        await deviceB.isar.studentRecords
            .filter()
            .identityIdEqualTo('M-EDU-2026-000001')
            .count(),
        1,
      );

      // B'da qo'llangan yozuvlar pending EMAS (syncVersion remote bilan teng).
      final applied = await deviceB.isar.identityRecords
          .filter()
          .identityIdEqualTo('M-EDU-2026-000001')
          .findFirst();
      expect(applied!.pendingSync, isFalse);
      expect(applied.syncVersion, 1);

      await deviceA.close();
      await deviceB.close();
    });

    test('A tahrirlaydi → sync → B yangilangan holatni oladi (incremental)', () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      await deviceA.addIdentity('M-EDU-2026-000001', version: 1);
      await deviceA.engine.processOnce();

      // B birinchi marta sync — boshlang'ich holatni oldi.
      await deviceB.engine.processOnce();
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');

      // A tahrirladi (v2).
      await deviceA.setFirstName('M-EDU-2026-000001', 'Bobur', version: 2);
      final resultA = await deviceA.engine.processOnce();
      expect(resultA.synced, 1);

      // B pull — yangilanishni oldi (cursor v1 dan v2 ga o'tdi).
      final resultB = await deviceB.engine.processOnce();
      expect(resultB.pulled, 1);
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Bobur');
      expect(await deviceB.identityVersion('M-EDU-2026-000001'), 2);

      await deviceA.close();
      await deviceB.close();
    });

    test("Bootstrap: yangi qurilma B — remote'da mavjud hamma yozuvni oladi", () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      // A: 3 ta identity (turli vaqtlarda, turli versiyalarda) yaratdi.
      for (var i = 1; i <= 3; i++) {
        final id = 'M-EDU-2026-${i.toString().padLeft(6, '0')}';
        await deviceA.addIdentity(id, version: i);
        await deviceA.engine.processOnce();
      }

      // B butunlay yangi — bootstrap'da HAMMASINI oladi (cursor yo'q).
      final result = await deviceB.engine.processOnce();
      expect(result.pulled, 3);
      expect(
        await deviceB.isar.identityRecords.where().count(),
        3,
      );

      await deviceA.close();
      await deviceB.close();
    });

    test("Ikki qurilma oflayn tahrir → deterministik g'olib + konflikt audit", () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      // Ikkala qurilmada ham asos: v1 'Ali'.
      await deviceA.addIdentity('M-EDU-2026-000001', version: 1, pending: true);
      await deviceA.engine.processOnce();
      await deviceB.engine.processOnce();
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');

      // IKKALA qurilma oflayn tahrir qildi (bir xil versiya 2).
      await deviceA.setFirstName('M-EDU-2026-000001', 'A-tahrir', version: 2);
      await deviceB.setFirstName('M-EDU-2026-000001', 'B-tahrir', version: 2);

      // B birinchi bo'lib reconnect qildi — v2 ni push qildi (store bo'sh,
      // B g'olib deb yoziladi).
      final resultB = await deviceB.engine.processOnce();
      expect(resultB.synced, 1);

      // A ham push qilmoqchi — sink teng versiyada (v2 == v2) deviceId
      // tie-break: remote'da 'device-B' yozgani uchun ('device-B' >
      // 'device-A') A konflikt oladi — JIM OVERWRITE YO'Q. Xuddi shu
      // pass'da A pull'da remote g'olib (B) holatini qo'llaydi.
      final resultA = await deviceA.engine.processOnce();
      expect(resultA.conflicts, greaterThanOrEqualTo(1));
      expect(resultA.pulled, greaterThanOrEqualTo(1));

      // IKKALA qurilma oxirida BIR XIL deterministik holatda — B g'olib.
      await deviceB.engine.processOnce();
      expect(await deviceA.identityName('M-EDU-2026-000001'), 'B-tahrir');
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'B-tahrir');

      // Keyingi pull — yangi ma'lumot yo'q (idempotent).
      final idlePull = await deviceA.engine.processOnce();
      expect(idlePull.pulled, 0);

      // Konflikt audit qayd etilgan (A tomonda — yutqazgan tomon).
      final conflictsA = await deviceA.conflicts();
      expect(conflictsA, isNotEmpty);
      expect(conflictsA.any((c) => c.winner == 'remote'), isTrue);
      expect(conflictsA.first.entityId, 'M-EDU-2026-000001');
      expect(conflictsA.first.localVersion, 2);
      expect(conflictsA.first.remoteVersion, 2);

      await deviceA.close();
      await deviceB.close();
    });

    test("Tombstone: A o'chiradi → B pull orqali o'chirishni oladi", () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      await deviceA.addIdentity('M-EDU-2026-000001');
      await deviceA.engine.processOnce();
      await deviceB.engine.processOnce();
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');

      // A o'chirishni tombstone sifatida yozadi (delete + v2).
      await deviceA.isar.writeTxn(() async {
        final record = await deviceA.isar.identityRecords
            .filter()
            .identityIdEqualTo('M-EDU-2026-000001')
            .findFirst();
        record!
          ..status = 'deleted'
          ..syncVersion = 2
          ..pendingSync = true;
        await deviceA.isar.identityRecords.put(record);
      });
      final resultA = await deviceA.engine.processOnce();
      expect(resultA.synced, 1);

      // B pull — tombstone'ni ko'radi, lokal yozuvni o'chiradi.
      final resultB = await deviceB.engine.processOnce();
      expect(resultB.pulled, 1);
      final remaining = await deviceB.isar.identityRecords
          .filter()
          .identityIdEqualTo('M-EDU-2026-000001')
          .findFirst();
      expect(remaining, isNull);

      await deviceA.close();
      await deviceB.close();
    });

    test("Teng-versiya konflikt: sink tie-break (kattaroq deviceId g'olib)", () async {
      // Sink darajasida (push): ikki qurilma BIR XIL versiya yozsa,
      // kattaroq deviceId g'olib — jimgina overwrite YO'Q (contract §7).
      final first = await remote.put(
        entityType: 'identity',
        entityId: 'M-EDU-2026-000001',
        operationType: SyncOperationType.upsert,
        payload: {'identityId': 'M-EDU-2026-000001', 'firstName': 'A'},
        version: 2,
        deviceId: 'device-A',
      );
      expect(first.success, isTrue);

      // B (kattaroq deviceId) bir xil versiyada yozadi → g'olib.
      final second = await remote.put(
        entityType: 'identity',
        entityId: 'M-EDU-2026-000001',
        operationType: SyncOperationType.upsert,
        payload: {'identityId': 'M-EDU-2026-000001', 'firstName': 'B'},
        version: 2,
        deviceId: 'device-B',
      );
      expect(second.success, isTrue);

      // A (kichikroq deviceId) bir xil versiyada qayta yozsa → CONFLICT.
      final conflict = await remote.put(
        entityType: 'identity',
        entityId: 'M-EDU-2026-000001',
        operationType: SyncOperationType.upsert,
        payload: {'identityId': 'M-EDU-2026-000001', 'firstName': 'A2'},
        version: 2,
        deviceId: 'device-A',
      );
      expect(conflict.success, isFalse);
      expect(conflict.conflict, isTrue);
      expect(conflict.remoteVersion, 2);

      // Remote holat: B g'olib (B ning firstName saqlanadi).
      final doc = remote.store['identity:M-EDU-2026-000001'];
      expect(doc, isNotNull);
      expect(doc!.data?['firstName'], 'B');
    });

    test('Pull network xato → keyingi pass qayta urinadi (cursor o\'zgarmaydi)', () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      await deviceA.addIdentity('M-EDU-2026-000001');
      await deviceA.engine.processOnce();

      // Cloud sozlanmagan (offline) — pull bajarilmaydi, cursor o'zgarmaydi
      // (offline-first: isEnabled=false → butun pass no-op).
      remote.configured = false;
      final offlinePass = await deviceB.engine.processOnce();
      expect(offlinePass.pulled, 0);
      expect(await deviceB.identityName('M-EDU-2026-000001'), isNull);

      // Qayta ulangan — cursor hali epoch'da (bootstrap) — yozuv keladi.
      remote.configured = true;
      final retryPull = await deviceB.engine.processOnce();
      expect(retryPull.pulled, 1);
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');

      await deviceA.close();
      await deviceB.close();
    });

    test("Cursor idempotent: takroriy pull qayta qo'llamaydi", () async {
      final dirA = Directory('${tempDir.path}/A')..createSync();
      final dirB = Directory('${tempDir.path}/B')..createSync();
      final deviceA = await _openDevice(remote, 'device-A', dirA);
      final deviceB = await _openDevice(remote, 'device-B', dirB);

      await deviceA.addIdentity('M-EDU-2026-000001');
      await deviceA.engine.processOnce();

      await deviceB.engine.processOnce();
      final secondPull = await deviceB.engine.processOnce();
      final thirdPull = await deviceB.engine.processOnce();

      // Yangi ma'lumot yo'q — takroriy pull hech narsa qo'llamaydi.
      expect(secondPull.pulled, 0);
      expect(thirdPull.pulled, 0);
      expect(await deviceB.identityName('M-EDU-2026-000001'), 'Ali');

      // Cursor monotonik saqlanadi.
      final cursor = await deviceB.isar.syncCursorRecords
          .filter()
          .entityTypeEqualTo('identity')
          .findFirst();
      expect(cursor, isNotNull);
      expect(cursor!.lastPulledAt.isAfter(DateTime(2026, 1, 1)), isTrue);

      await deviceA.close();
      await deviceB.close();
    });
  });
}
