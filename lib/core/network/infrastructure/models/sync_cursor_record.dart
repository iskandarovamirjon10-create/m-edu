import 'package:isar/isar.dart';

part 'sync_cursor_record.g.dart';

/// Har bir entityType uchun pull cursor (last-sync metadata).
///
/// Sync contract §5, §10: qurilma har bir entityType bo'yicha oxirgi
/// qo'llangan server vaqtini saqlaydi — keyingi pull shu vaqtdan keyingi
/// yozuvlarni oladi (incremental). Yangi qurilma (cursor yo'q) — bootstrap
/// (epoch'dan boshlab hammasini oladi).
///
/// QURILMA-LOKAL: cloud'ga sinxronlanmaydi; backup'da saqlanadi (restore
/// qilingan qurilma o'z watermark'idan davom etadi, contract §10).
@collection
class SyncCursorRecord {
  Id id = Isar.autoIncrement;

  /// Entity turi nomi (`identity`, `student`, `attendance`, `payment`).
  @Index(unique: true, replace: true)
  late String entityType;

  /// Oxirgi qo'llangan server vaqti (exclusive — undan keyingilar olinadi).
  late DateTime lastPulledAt;

  late DateTime updatedAt;
}
