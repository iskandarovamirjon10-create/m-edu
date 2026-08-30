import 'package:isar/isar.dart';

import '../models/telegram_linking_token_record.dart';

/// Telegram bog'lash tokenlari uchun Isar datasource.
class IsarTelegramLinkingTokenDataSource {
  final Isar _db;

  IsarTelegramLinkingTokenDataSource(this._db);

  Future<void> put(TelegramLinkingTokenRecord record) {
    return _db.writeTxn(() => _db.telegramLinkingTokenRecords.put(record));
  }

  Future<TelegramLinkingTokenRecord?> findByToken(String token) {
    return _db.telegramLinkingTokenRecords
        .filter()
        .tokenEqualTo(token)
        .findFirst();
  }

  Future<TelegramLinkingTokenRecord?> findLatestByParent(
    String identityId,
  ) {
    return _db.telegramLinkingTokenRecords
        .filter()
        .identityIdEqualTo(identityId)
        .sortByCreatedAtDesc()
        .findFirst();
  }

  Future<int> cleanupExpired() async {
    final now = DateTime.now();
    final expired = await _db.telegramLinkingTokenRecords
        .filter()
        .expiresAtLessThan(now)
        .findAll();

    if (expired.isEmpty) return 0;

    await _db.writeTxn(() async {
      final ids = expired.map((r) => r.id).toList();
      await _db.telegramLinkingTokenRecords.deleteAll(ids);
    });
    return expired.length;
  }
}
