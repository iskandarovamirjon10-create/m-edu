import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/remote_data_sink.dart';
import '../../domain/sync_operation.dart';
import 'firebase_bootstrap.dart';

/// Firestore asosidagi real cloud sink (BIDIRECTIONAL, sync contract §4-7).
///
/// Data model (Firestore):
/// ```text
/// sync/{entityType}/items/{entityId}
///   {
///     data: { ...payload },        // tombstone'da null
///     version: int,                // serverVersion (monotonik, LWW)
///     updatedByDevice: str,        // oxirgi yozgan qurilma
///     updatedAt: timestamp,        // server timestamp (pull cursor)
///     deleted: bool                // tombstone (contract §9)
///   }
/// ```
///
/// Conflict strategy (contract §7, deterministik):
/// - Client versiyasi remote'dan eski bo'lsa — conflict.
/// - TENG versiya + turli qurilma — kattaroq `updatedByDevice` g'olib
///   (soat ishonchsiz — deviceId deterministik tie-break).
/// - Aks holda yozish davom etadi (LWW).
///
/// [isConfigured] — Firebase haqiqiy sozlangan bo'lsagina true. Aks holda
/// sync engine hech narsa yubormaydi (offline-first).
class FirestoreRemoteDataSink implements RemoteDataSink {
  FirebaseFirestore? _firestore;

  FirestoreRemoteDataSink();

  @override
  bool get isConfigured {
    if (!FirebaseBootstrap.isFirebaseConfigured) return false;
    _firestore ??= FirebaseFirestore.instance;
    return true;
  }

  @override
  String get name => 'firestore';

  @override
  Future<RemoteWriteResult> put({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
  }) async {
    final firestore = _ensure();
    final doc = firestore.collection('sync').doc(entityType).collection('items').doc(entityId);

    try {
      return await firestore.runTransaction((txn) async {
        final snapshot = await txn.get(doc);
        if (snapshot.exists) {
          final remoteVersion = (snapshot.data()?['version'] as num?)?.toInt() ?? 0;
          if (version < remoteVersion) {
            return RemoteWriteResult.conflicted(remoteVersion);
          }
          // TENG versiya: deterministik tie-break — kattaroq deviceId g'olib
          // (contract §7). Soatlar ishonchsiz, deviceId har doim solishtiriladi.
          if (version == remoteVersion) {
            final remoteDevice =
                (snapshot.data()?['updatedByDevice'] as String?) ?? '';
            if (remoteDevice.isNotEmpty && remoteDevice.compareTo(deviceId) > 0) {
              return RemoteWriteResult.conflicted(remoteVersion);
            }
          }
        }
        txn.set(doc, {
          'data': payload,
          'version': version,
          'updatedByDevice': deviceId,
          'updatedAt': FieldValue.serverTimestamp(),
          'deleted': false,
        });
        return RemoteWriteResult.ok;
      });
    } on FirebaseException catch (e) {
      // Validation ko'rinishidagi xatolar doimiy deb belgilanadi.
      return RemoteWriteResult.failure(
        'Firestore: ${e.message}',
        permanent: e.code.startsWith('permission') || e.code == 'invalid-argument',
      );
    } catch (e) {
      // Network va boshqa xatolar — vaqtinchalik (qayta uriniladi).
      return RemoteWriteResult.failure('Firestore put xatosi: $e');
    }
  }

  @override
  Future<RemoteWriteResult> delete({
    required String entityType,
    required String entityId,
    required int version,
    required String deviceId,
  }) async {
    final firestore = _ensure();
    final doc =
        firestore.collection('sync').doc(entityType).collection('items').doc(entityId);
    try {
      // TOMBSTONE (contract §9): dokument fizik o'chirilmaydi — `deleted`
      // belgisi bilan yoziladi, pull boshqa qurilmalarga o'chirishni
      // yetkazadi. Versiya tekshiruvi saqlanadi (eski delete yo'qolmaydi).
      return await firestore.runTransaction((txn) async {
        final snapshot = await txn.get(doc);
        if (snapshot.exists) {
          final remoteVersion = (snapshot.data()?['version'] as num?)?.toInt() ?? 0;
          if (version < remoteVersion) {
            return RemoteWriteResult.conflicted(remoteVersion);
          }
          if (version == remoteVersion) {
            final remoteDevice =
                (snapshot.data()?['updatedByDevice'] as String?) ?? '';
            if (remoteDevice.isNotEmpty && remoteDevice.compareTo(deviceId) > 0) {
              return RemoteWriteResult.conflicted(remoteVersion);
            }
          }
        }
        txn.set(doc, {
          'deleted': true,
          'version': version,
          'updatedByDevice': deviceId,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        return RemoteWriteResult.ok;
      });
    } catch (e) {
      return RemoteWriteResult.failure('Firestore delete xatosi: $e');
    }
  }

  @override
  Future<List<RemoteEntity>> fetchChanged({
    required String entityType,
    required DateTime since,
    required int limit,
  }) async {
    final firestore = _ensure();
    // Cursor: server timestamp — soat og'ishiga bog'liq emas (contract §5).
    final query = firestore
        .collection('sync')
        .doc(entityType)
        .collection('items')
        .where('updatedAt', isGreaterThan: since)
        .orderBy('updatedAt')
        .limit(limit);
    final snapshot = await query.get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      final updatedAt =
          (data['updatedAt'] as Timestamp?)?.toDate() ?? since;
      final deleted = data['deleted'] == true;
      final payload = data['data'];
      return RemoteEntity(
        entityType: entityType,
        entityId: doc.id,
        payload: deleted || payload is! Map
            ? null
            : Map<String, dynamic>.from(payload),
        version: (data['version'] as num?)?.toInt() ?? 0,
        updatedAt: updatedAt,
        updatedByDeviceId: (data['updatedByDevice'] as String?) ?? '',
        deleted: deleted,
      );
    }).toList();
  }

  FirebaseFirestore _ensure() {
    if (!isConfigured) {
      throw StateError('Firestore sozlanmagan — isConfigured=false');
    }
    return _firestore!;
  }
}
