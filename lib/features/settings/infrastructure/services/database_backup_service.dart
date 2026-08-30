import 'dart:io';

import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/database/backup_collections.dart';
import '../../../../core/error/failures.dart';
import 'backup_codec.dart';

/// To'liq baza zaxira nusxasi (backup) va qayta tiklash (restore).
///
/// A7/E6 (audit-fix): 
/// - Barcha persistent kolleksiyalar [BackupCollections] YAGONA registry
///   orqali zaxiralanadi/tiklanadi — qo'lda saqlanadigan ro'yxatlar yo'q
///   (yangi kolleksiya qo'shilsa jimgina to'liqsiz backup bo'lib qolmasdi).
/// - Yozuv metadata + checksum bilan o'raladi (SHA-256) va yozilgandan
///   KEYIN qayta o'qib verify qilinadi.
/// - Restore qilishdan OLDIN joriy holat avtomatik backup qilinadi —
///   restore muvaffaqiyatsiz bo'lsa ham eski ma'lumot yo'qolmaydi.
/// - Qayta tiklash BIR writeTxn ichida (clear + import) — qisman holat
///   qoldirilmaydi.
class DatabaseBackupService {
  final Isar _db;

  DatabaseBackupService(this._db);

  /// Barcha kolleksiyalarni bitta JSON faylga zaxiralaydi va fayl
  /// manzilini qaytaradi.
  ///
  /// §19-20: yozuv metadata + checksum bilan o'raladi (SHA-256) va
  /// yozilgandan KEYIN qayta o'qib verify qilinadi. Verify o'tmasa
  /// [BackupFailure] tashlanadi — "zaxira yaratildi" degan yolg'on
  /// xabar yo'q.
  Future<String> createBackup() async {
    final dir = await getApplicationSupportDirectory();
    final backupDir = Directory('${dir.path}/backups');
    if (!await backupDir.exists()) {
      await backupDir.create(recursive: true);
    }

    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
    final backupFile =
        File('${backupDir.path}/m_edu_backup_$timestamp.json');

    // A7/E6: registry orqali — barcha persistent kolleksiyalar.
    final collections = <String, dynamic>{};
    for (final spec in BackupCollections.all) {
      collections[spec.key] =
          await spec.accessor(_db).where().exportJson();
    }

    final raw = BackupCodec.encode(
      collections: collections,
      appVersion: AppConstants.appVersion,
    );
    await backupFile.writeAsString(raw);

    // Yozilgandan keyin verify: fayl qayta o'qiladi va checksum
    // tekshiriladi — disk'ga yozish muvaffaqiyatsiz bo'lsa ham
    // foydalanuvchi xabardor qilinadi (§20).
    final verification = await verifyBackup(backupFile.path);
    if (!verification.isValid) {
      throw BackupFailure(
        'Zaxira tekshiruvdan o\'tmedi: ${verification.error}',
      );
    }

    return backupFile.path;
  }

  /// Zaxira faylini o'qib, decode + checksum + schema mosligini tekshiradi.
  Future<BackupVerification> verifyBackup(String backupPath) async {
    try {
      final file = File(backupPath);
      if (!await file.exists()) {
        return const BackupVerification(
          isValid: false,
          error: 'Zaxira fayli topilmadi',
        );
      }
      final raw = await file.readAsString();
      return BackupCodec.verify(
        raw,
        currentSchemaVersion: backupSchemaVersion,
      );
    } on FileSystemException catch (e) {
      return BackupVerification(isValid: false, error: 'Fayl xatosi: ${e.message}');
    }
  }

  /// Zaxira faylidan barcha ma'lumotlarni tiklaydi.
  ///
  /// §21: select → decode+checksum+schema tekshiruvi → joriy holatni
  /// auto-backup qilish → transaction'da tozalash+import → verify.
  /// Restore faqat fayl to'liq tekshiruvdan o'tgan bo'lsa boshlanadi.
  Future<void> restoreBackup(String backupPath) async {
    final file = File(backupPath);
    if (!await file.exists()) {
      throw const BackupFailure('Backup fayli topilmadi');
    }

    final raw = await file.readAsString();
    final envelope = BackupCodec.decode(raw);
    if (envelope == null) {
      throw const BackupFailure(
        'Backup fayli buzilgan yoki noto\'g\'ri formatda — restore bekor qilindi',
      );
    }
    if (envelope.schemaVersion > backupSchemaVersion) {
      throw BackupFailure(
        'Backup yangiroq schema bilan yaratilgan — ilovani yangilang '
        '(schema: ${envelope.schemaVersion})',
      );
    }

    // Restore oldidan joriy holatni avtomatik zaxiralash (safety §21).
    await createBackup();

    // AUDIT P2-02 (ATOMIC): barcha tozalash VA import bitta writeTxn ichida.
    // Agar biron import xato bersa — BUTUN transaction rollback bo'ladi va
    // eski ma'lumot saqlanib qoladi (restore fail bo'lsa old data qoladi).
    final collections = envelope.collections;
    await _db.writeTxn(() async {
      // Registry'dagi barcha kolleksiyalarni tozalash.
      for (final spec in BackupCollections.all) {
        await spec.accessor(_db).clear();
      }
      // Registry'dagi barcha kolleksiyalarni import qilish.
      for (final spec in BackupCollections.all) {
        await spec.accessor(_db)
            .importJson(_listOf(collections[spec.key]));
      }
    });

    // Restore'dan keyingi verify: yozuvlar soni backup'dagiga teng bo'lishi
    // kerak (partial restore holati qoldirilmaydi — §21).
    for (final entry in envelope.recordCounts.entries) {
      BackupCollectionSpec? spec;
      for (final s in BackupCollections.all) {
        if (s.key == entry.key) {
          spec = s;
          break;
        }
      }
      if (spec == null) continue;
      final actual = await spec.accessor(_db).count();
      if (actual != entry.value) {
        throw BackupFailure(
          'Restore tekshiruvdan o\'tmadi: ${entry.key} '
          '(kutilgan: ${entry.value}, topildi: $actual)',
        );
      }
    }
  }

  List<Map<String, dynamic>> _listOf(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map<String, dynamic>>()
        .toList();
  }
}
