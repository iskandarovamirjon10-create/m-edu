import 'sync_operation.dart';

/// Remote'dan o'qilgan bitta entity holati (pull natijasi).
///
/// Sync contract §4 (§5 pull) bo'yicha Firestore dokumentining mahalliy
/// ko'rinishi. [deleted] tombstone'ni bildiradi — pull tomonidan o'chirish
/// ham tarqatilishi uchun (contract §9).
class RemoteEntity {
  final String entityType;
  final String entityId;

  /// Entity payload — tombstone (deleted=true) bo'lsa null.
  final Map<String, dynamic>? payload;

  /// ServerVersion (remote'dagi `version`).
  final int version;

  /// Server timestamp — pull cursor shu qiymat bo'yicha yuritiladi.
  final DateTime updatedAt;

  /// Oxirgi yozgan qurilma (tie-break, contract §7).
  final String updatedByDeviceId;

  /// Tombstone belgisi — true bo'lsa mahalliy yozuv o'chirilishi kerak.
  final bool deleted;

  const RemoteEntity({
    required this.entityType,
    required this.entityId,
    required this.payload,
    required this.version,
    required this.updatedAt,
    required this.updatedByDeviceId,
    this.deleted = false,
  });
}

/// Bulut ma'lumot manbai uchun abstraksiya (Firestore, REST, ...).
///
/// Domain/infrastructure qatlamlari platformaga bog'lanmaydi — sync engine
/// faqat shu interfeys orqali ishlaydi. Amalga oshiruvchilar:
/// - [FirestoreRemoteDataSink] — Firebase sozlangan bo'lsa (real cloud);
/// - testlar uchun in-memory sink.
///
/// [isConfigured] false bo'lsa sync engine hech narsa yubormaydi — app
/// offline-first ishlashda davom etadi (degraded mode, hujjatlashtirilgan).
///
/// PHASE 1 (sync contract §5-6): sink endi ikki yo'nalishli — push
/// ([put]/[delete]) va pull ([fetchChanged]).
abstract class RemoteDataSink {
  /// Firebase/cloud sozlanganmi?
  bool get isConfigured;

  /// Diagnostic nomi (log/UI uchun).
  String get name;

  /// Yozuvni yaratadi/yangilaydi (idempotent put).
  ///
  /// [version] — client'dagi joriy versiya. Remote'da kattaroq versiya
  /// bo'lsa — [RemoteWriteResult.conflicted] qaytaradi (jim data loss yo'q).
  /// Teng versiyada [deviceId] tie-break (contract §7): remote g'olib bo'lsa
  /// — conflict, aks holda yozish davom etadi.
  Future<RemoteWriteResult> put({
    required String entityType,
    required String entityId,
    required SyncOperationType operationType,
    required Map<String, dynamic> payload,
    required int version,
    required String deviceId,
  });

  /// Yozuvni o'chiradi — TOMBSTONE yozadi (dokumentni fizik o'chirmaydi,
  /// contract §9): pull boshqa qurilmalarga o'chirishni yetkazadi.
  Future<RemoteWriteResult> delete({
    required String entityType,
    required String entityId,
    required int version,
    required String deviceId,
  });

  /// Pull: [since] (server vaqti) dan KEYIN o'zgargan yozuvlarni qaytaradi.
  ///
  /// Bootstrap uchun [since] = epoch (contract §5). Natija `updatedAt`
  /// bo'yicha o'sish tartibida, [limit] gacha. Cursor alohida saqlanadi —
  /// [SyncEngine] [SyncCursorDataSource] orqali yuritadi.
  Future<List<RemoteEntity>> fetchChanged({
    required String entityType,
    required DateTime since,
    required int limit,
  });
}
