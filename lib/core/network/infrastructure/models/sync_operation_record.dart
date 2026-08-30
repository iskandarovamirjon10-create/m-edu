import 'package:isar/isar.dart';

part 'sync_operation_record.g.dart';

/// Sync navbatidagi operatsiya — offline mutation queue (spec: SYNC).
///
/// Har bir lokal mutation uchun bitta yozuv:
/// - [operationId] — DETERMINISTIK: `{entityType}:{entityId}` — xuddi shu
///   yozuv qayta enqueue qilinsa YANGI yozuv emas, mavjudi yangilanadi
///   (duplicate sync event bo'lmaydi);
/// - [deviceId] — qaysi qurilmada yaratilgani (multi-device);
/// - [retryCount] / [nextRetryAt] — exponential backoff;
/// - [syncStatus] — pending/failed/permanent/conflict;
/// - [payload] — entity JSON (yuboriladigan ma'lumot).
@collection
class SyncOperationRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String operationId;

  late String entityType;

  late String entityId;

  /// SyncOperationType.name.
  late String operationType;

  late String payload;

  /// Entity versiyasi (conflict resolution).
  late int version;

  late String deviceId;

  @Index()
  late String syncStatus;

  late int retryCount;

  late DateTime createdAt;

  @Index()
  late DateTime updatedAt;

  DateTime? nextRetryAt;

  String? lastError;

  /// Remote'ning conflict'dagi versiyasi (hal qilish uchun).
  int? remoteVersion;
}
