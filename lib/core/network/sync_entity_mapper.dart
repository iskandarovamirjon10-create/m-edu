import 'domain/remote_data_sink.dart';
import 'domain/sync_operation.dart';

/// Lokal entity holati — pull conflict resolution uchun (sync contract §7).
class LocalEntityState {
  final int version;

  /// Lokal o'zgarish hali cloud'ga yuborilmaganmi (pendingSync).
  final bool pendingSync;

  const LocalEntityState({required this.version, required this.pendingSync});
}

/// Feature'ning sinxronlanadigan yozuvlari bilan sync engine o'rtasidagi
/// ko'prik.
///
/// Har bir entity turi (identity, student, attendance, payment, ...) bitta
/// mapper ro'yxatdan o'tkazadi. Mapper Isar'dagi `pendingSync == true`
/// yozuvlarni topadi, [SyncEntity] ko'rinishida beradi va natijaga qarab
/// `markSynced` / `markSyncFailed` chaqiradi.
///
/// PHASE 1 (sync contract §5-7): mapper endi ikki yo'nalishli —
/// [fetchPending] (push) va [localState]/[applyRemote] (pull).
///
/// Infrastruktura qatlamida — domain/application hech qachon Isar'ga
/// bog'lanmaydi.
abstract class SyncEntityMapper {
  /// Entity turi nomi (Firestore collection nomi bilan mos).
  String get entityType;

  /// Hali sinxronlanmagan (pendingSync == true) yozuvlar.
  Future<List<SyncEntity>> fetchPending();

  /// Muvaffaqiyatli sinxronlashdan so'ng lokal bayroqni o'chiradi.
  Future<void> markSynced(String entityId, int version);

  /// Muvaffaqiyatsizlikdan so'ng lokal bayroqni qoldiradi (keyingi pass'da
  /// qayta uriniladi). [permanent] — doimiy xato (validation).
  Future<void> markSyncFailed(String entityId, String error,
      {bool permanent = false});

  /// Pull: lokal entity holati — conflict resolution uchun (contract §7).
  ///
  /// [entityId] deterministik entity ID (push'dagi bilan bir xil).
  /// Yozuv mavjud bo'lmasa — null (remote qo'llanadi).
  Future<LocalEntityState?> localState(String entityId);

  /// Pull: remote entity'ni lokal bazaga qo'llaydi.
  ///
  /// [remote.deleted] (tombstone) — lokal yozuv o'chiriladi (contract §9).
  /// Aks holda upsert: lokal yozuv remote holatiga keltiriladi,
  /// `syncVersion = remote.version`, `pendingSync = false`.
  /// CHAQIRUV SHARTI: engine conflict resolution'da remote g'olib bo'lganda
  /// chaqiradi (contract §7) — mapper o'zi versiya solishtirmaydi.
  Future<void> applyRemote(RemoteEntity remote);
}
