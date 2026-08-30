import 'package:isar/isar.dart';

part 'sync_conflict_record.g.dart';

/// Deterministik hal qilingan sync konflikti — AUDIT yozuvi (metadata only).
///
/// Sync contract §7: har bir qo'llangan divergence (teng versiya, turli
/// qurilmalar) jimgina yo'qolmaydi — kim g'olib, qaysi versiyalar, qaysi
/// qurilmalar, qachon — hammasi shu yozuvda saqlanadi. Hech qachon payload
/// yoki biometrik ma'lumot saqlanmaydi (contract §11).
///
/// QURILMA-LOKAL audit — cloud'ga sinxronlanmaydi.
@collection
class SyncConflictRecord {
  Id id = Isar.autoIncrement;

  late String entityType;

  late String entityId;

  /// Lokal (qurilma) versiyasi — yo'qotilgan tomon.
  late int localVersion;

  /// Remote versiyasi — g'olib tomon.
  late int remoteVersion;

  /// G'olib: 'local' | 'remote'.
  late String winner;

  /// Qaysi tomonda aniqlandi: 'push' | 'pull'.
  late String direction;

  late String localDeviceId;

  late String remoteDeviceId;

  late DateTime occurredAt;
}
