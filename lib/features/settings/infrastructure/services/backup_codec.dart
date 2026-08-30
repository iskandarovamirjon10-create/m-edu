import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Backup fayl formatining joriy versiyasi (§60 versioning).
const int backupFormatVersion = 2;

/// Schema (kolleksiyalar to'plami) versiyasi.
///
/// Yangi Isar kolleksiyasi qo'shilganda oshiriladi — restore paytida
/// eski backup bilan yangi schema mos kelmasa foydalanuvchi ogohlantiriladi
/// (destructive restore oldi olinadi).
///
/// v24: gradeRecords, attendanceSessionRecords, leadRecords,
/// leadActivityRecords, signedQrNonceRecords qo'shildi (25 kolleksiya).
/// v25: A7/E6 — canonical registry ([BackupCollections]) orqali
/// recognitionAttemptRecords + syncOperationRecords qo'shildi (29
/// kolleksiya; DeviceInfoRecord ataylab tashqarida — qurilmaga xos).
const int backupSchemaVersion = 25;

/// Backup fayl konvertining ochilgan (decoded) ko'rinishi.
class BackupEnvelope {
  final String createdAt;
  final String appVersion;
  final int formatVersion;
  final int schemaVersion;
  final Map<String, int> recordCounts;
  final String checksum;
  final Map<String, dynamic> collections;

  const BackupEnvelope({
    required this.createdAt,
    required this.appVersion,
    required this.formatVersion,
    required this.schemaVersion,
    required this.recordCounts,
    required this.checksum,
    required this.collections,
  });
}

/// Backup verification natijasi (§20: "Backup yaratildi" degani yetarli emas).
class BackupVerification {
  final bool isValid;
  final String? error;
  final int recordCount;

  const BackupVerification({
    required this.isValid,
    this.error,
    this.recordCount = 0,
  });
}

/// Backup JSON fayli bilan ishlaydigan PURE kodc (§19-21).
///
/// - Metadata: `createdAt`, `appVersion`, `formatVersion`, `schemaVersion`,
///   `recordCounts`, `checksum`.
/// - Checksum: SHA-256 (payload ustida) — fayl buzilgan/`o'zgartirilgan`
///   bo'lsa restore oldidan aniqlanadi.
///
/// Bu sinf hech qanday Isar/path_provider'ga bog'liq emas — alohida
/// unit-test qilinadi.
class BackupCodec {
  const BackupCodec._();

  /// Payload JSON'ining SHA-256 checksum'i.
  static String computeChecksum(String payloadJson) {
    return sha256.convert(utf8.encode(payloadJson)).toString();
  }

  /// Kolleksiyalarni metadata + checksum bilan JSON'ga o'raydi.
  static String encode({
    required Map<String, dynamic> collections,
    required String appVersion,
    int formatVersion = backupFormatVersion,
    int schemaVersion = backupSchemaVersion,
  }) {
    final recordCounts = <String, int>{
      for (final entry in collections.entries)
        entry.key: _recordCountOf(entry.value),
    };
    final metadata = <String, dynamic>{
      'createdAt': DateTime.now().toIso8601String(),
      'appVersion': appVersion,
      'formatVersion': formatVersion,
      'schemaVersion': schemaVersion,
      'recordCounts': recordCounts,
    };
    final payload = jsonEncode({
      ...metadata,
      'collections': collections,
    });
    final checksum = computeChecksum(payload);
    final envelope = {
      '_meta': {...metadata, 'checksum': checksum},
      'collections': collections,
    };
    return jsonEncode(envelope);
  }

  /// Faylni decode qiladi va checksum + format versiyasini tekshiradi.
  ///
  /// Noto'g'ri format / buzilgan checksum → `null`.
  static BackupEnvelope? decode(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      final meta = decoded['_meta'];
      final collections = decoded['collections'];
      if (meta is! Map<String, dynamic> || collections is! Map<String, dynamic>) {
        return null;
      }
      if (meta['formatVersion'] != backupFormatVersion) return null;

      // Checksum tekshiruvi: payload = metadata (checksumsiz) + collections.
      final payload = jsonEncode({
        'createdAt': meta['createdAt'],
        'appVersion': meta['appVersion'],
        'formatVersion': meta['formatVersion'],
        'schemaVersion': meta['schemaVersion'],
        'recordCounts': meta['recordCounts'],
        'collections': collections,
      });
      if (computeChecksum(payload) != meta['checksum']) return null;

      return BackupEnvelope(
        createdAt: meta['createdAt'] as String,
        appVersion: (meta['appVersion'] as String?) ?? 'unknown',
        formatVersion: meta['formatVersion'] as int,
        schemaVersion: meta['schemaVersion'] as int,
        recordCounts: (meta['recordCounts'] as Map<String, dynamic>)
            .map((k, v) => MapEntry(k, v as int)),
        checksum: meta['checksum'] as String,
        collections: collections,
      );
    } catch (_) {
      return null;
    }
  }

  /// Faylni to'liq verify qiladi: decode + schema mosligi + yozuvlar soni.
  static BackupVerification verify(
    String raw, {
    required int currentSchemaVersion,
  }) {
    final envelope = decode(raw);
    if (envelope == null) {
      return const BackupVerification(
        isValid: false,
        error: 'Backup fayli buzilgan yoki noto\'g\'ri formatda',
      );
    }
    if (envelope.schemaVersion > currentSchemaVersion) {
      return BackupVerification(
        isValid: false,
        error: 'Backup yangiroq schema bilan yaratilgan — '
            'ilovani yangilang',
      );
    }
    final total = envelope.recordCounts.values.fold<int>(0, (a, b) => a + b);
    return BackupVerification(isValid: true, recordCount: total);
  }

  static int _recordCountOf(Object? value) {
    if (value is List) return value.length;
    return 0;
  }
}
