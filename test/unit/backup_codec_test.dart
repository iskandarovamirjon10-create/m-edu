import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/infrastructure/services/backup_codec.dart';

void main() {
  const collections = <String, dynamic>{
    'studentRecords': [
      {'identityId': 'M-EDU-2026-000001'},
      {'identityId': 'M-EDU-2026-000002'},
    ],
    'attendanceRecords': [
      {'identityId': 'M-EDU-2026-000001', 'status': 'present'},
    ],
    'settingsRecords': <Map<String, dynamic>>[],
  };

  group('BackupCodec encode/decode (§19-21)', () {
    test('encode → decode round-trip kolleksiya va yozuvlar sonini saqlaydi',
        () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
      );

      final envelope = BackupCodec.decode(raw);
      expect(envelope, isNotNull);
      expect(envelope!.appVersion, '1.0.0');
      expect(envelope.formatVersion, backupFormatVersion);
      expect(envelope.schemaVersion, backupSchemaVersion);
      expect(envelope.recordCounts['studentRecords'], 2);
      expect(envelope.recordCounts['attendanceRecords'], 1);
      expect(envelope.recordCounts['settingsRecords'], 0);
      expect(envelope.collections.keys, collections.keys);
    });

    test('checksum deterministik va payloadga bog\'liq', () {
      const payload = '{"a":1}';
      expect(BackupCodec.computeChecksum(payload),
          BackupCodec.computeChecksum(payload));
      expect(BackupCodec.computeChecksum(payload),
          isNot(BackupCodec.computeChecksum('{"a":2}')));
    });

    test('fayl buzilgan (tampered) bo\'lsa decode null qaytaradi (§20)', () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
      );
      // Checksum'ni saqlab, kolleksiyaga yashirin yozuv qo'shamiz.
      final tampered = raw.replaceFirst(
        '"identityId":"M-EDU-2026-000002"',
        '"identityId":"M-EDU-2026-000003"',
      );
      expect(BackupCodec.decode(tampered), isNull);
    });

    test('noto\'g\'ri formatVersion reject qilinadi', () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
        formatVersion: backupFormatVersion + 5,
      );
      expect(BackupCodec.decode(raw), isNull);
    });

    test('buzilgan JSON decode qilinmaydi', () {
      expect(BackupCodec.decode('{not-json'), isNull);
      expect(BackupCodec.decode(''), isNull);
      expect(BackupCodec.decode('[]'), isNull);
    });
  });

  group('BackupCodec.verify (§20)', () {
    test('haqiqiy backup verify\'dan o\'tadi va yozuvlar sonini qaytaradi', () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
      );
      final result = BackupCodec.verify(
        raw,
        currentSchemaVersion: backupSchemaVersion,
      );
      expect(result.isValid, isTrue);
      expect(result.recordCount, 3);
      expect(result.error, isNull);
    });

    test('yangiroq schemaVersion bilan yaratilgan backup reject qilinadi', () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
        schemaVersion: backupSchemaVersion + 1,
      );
      final result = BackupCodec.verify(
        raw,
        currentSchemaVersion: backupSchemaVersion,
      );
      expect(result.isValid, isFalse);
      expect(result.error, contains('yangiroq schema'));
    });

    test('buzilgan backup verify qilinmaydi', () {
      final result = BackupCodec.verify(
        'garbage',
        currentSchemaVersion: backupSchemaVersion,
      );
      expect(result.isValid, isFalse);
      expect(result.error, isNotNull);
    });

    test('eski (past) schemaVersion mos keladi — downgrade xavfsiz', () {
      final raw = BackupCodec.encode(
        collections: collections,
        appVersion: '1.0.0',
        schemaVersion: backupSchemaVersion - 1,
      );
      final result = BackupCodec.verify(
        raw,
        currentSchemaVersion: backupSchemaVersion,
      );
      expect(result.isValid, isTrue);
    });
  });
}
