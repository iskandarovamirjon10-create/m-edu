/// Sinxronlash operatsiyasi turi.
enum SyncOperationType {
  /// Idempotent upsert (put) — remote'da mavjud bo'lmasa yaratadi,
  /// bo'lsa versiya tekshiruvi bilan yangilaydi.
  upsert,
  delete;

  static SyncOperationType fromName(String name) =>
      values.firstWhere((v) => v.name == name, orElse: () => upsert);
}

/// Sinxronlash holati.
///
/// - [pending] — navbatda, hali yuborilmagan;
/// - [inFlight] — hozir yuborilmoqda;
/// - [synced] — muvaffaqiyatli, olib tashlanadi;
/// - [failed] — vaqtinchalik xato (network) — backoff bilan qayta uriniladi;
/// - [permanent] — doimiy xato (validation) — avtomatik qayta urinilmaydi;
/// - [conflict] — versiya ziddiyati — qayta ko'rib chiqish kerak.
enum SyncStatus {
  pending,
  inFlight,
  synced,
  failed,
  permanent,
  conflict;

  static SyncStatus fromName(String name) =>
      values.firstWhere((v) => v.name == name, orElse: () => pending);
}

/// Remote'ga yuboriladigan bitta sinxronlanadigan yozuv.
class SyncEntity {
  final String entityType;
  final String entityId;
  final SyncOperationType operationType;
  final Map<String, dynamic> payload;
  final int version;
  final DateTime updatedAt;

  const SyncEntity({
    required this.entityType,
    required this.entityId,
    required this.operationType,
    required this.payload,
    required this.version,
    required this.updatedAt,
  });
}

/// Remote yozish natijasi.
class RemoteWriteResult {
  final bool success;

  /// Doimiy xato (validation) — qayta urinish foydasiz.
  final bool permanentFailure;

  /// Versiya ziddiyati — ma'lumotni jimgina yo'qotmaslik uchun belgilanadi.
  final bool conflict;

  final String? error;

  /// Remote'ning joriy (eng yangi) versiyasi — conflict hal qilish uchun.
  final int? remoteVersion;

  const RemoteWriteResult({
    required this.success,
    this.permanentFailure = false,
    this.conflict = false,
    this.error,
    this.remoteVersion,
  });

  static const RemoteWriteResult ok = RemoteWriteResult(success: true);

  factory RemoteWriteResult.failure(String message,
          {bool permanent = false}) =>
      RemoteWriteResult(success: false, permanentFailure: permanent, error: message);

  factory RemoteWriteResult.conflicted(int remoteVersion) =>
      RemoteWriteResult(
        success: false,
        conflict: true,
        remoteVersion: remoteVersion,
        error: 'Versiya ziddiyati (remote v$remoteVersion)',
      );
}
