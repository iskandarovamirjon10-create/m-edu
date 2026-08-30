import '../../domain/entities/telegram_linking_token.dart';
import '../../domain/repositories/telegram_linking_token_repository.dart';
import '../datasources/isar_telegram_linking_token_datasource.dart';
import '../models/telegram_linking_token_record.dart';

/// Telegram bog'lash tokenlari repository'sining Isar implementatsiyasi.
class TelegramLinkingTokenRepositoryImpl
    implements TelegramLinkingTokenRepository {
  final IsarTelegramLinkingTokenDataSource _datasource;

  TelegramLinkingTokenRepositoryImpl(this._datasource);

  @override
  Future<TelegramLinkingToken> save(TelegramLinkingToken token) async {
    final record = _toRecord(token);
    await _datasource.put(record);
    return _toEntity(record);
  }

  @override
  Future<TelegramLinkingToken?> findByToken(String token) async {
    final record = await _datasource.findByToken(token);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<TelegramLinkingToken?> findLatestByParent(
    String identityId,
  ) async {
    final record = await _datasource.findLatestByParent(identityId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<void> markUsed(
    String token, {
    required String telegramChatId,
    String? telegramUsername,
  }) async {
    final record = await _datasource.findByToken(token);
    if (record == null) return;

    record.used = true;
    record.usedAt = DateTime.now();
    record.telegramChatId = telegramChatId;
    record.telegramUsername = telegramUsername;
    await _datasource.put(record);
  }

  @override
  Future<int> cleanupExpired() => _datasource.cleanupExpired();

  TelegramLinkingTokenRecord _toRecord(TelegramLinkingToken entity) {
    return TelegramLinkingTokenRecord()
      ..id = entity.token.hashCode.abs() % 9007199254740991
      ..token = entity.token
      ..identityId = entity.identityId
      ..studentIdentityId = entity.studentIdentityId
      ..createdAt = entity.createdAt
      ..expiresAt = entity.expiresAt
      ..used = entity.used
      ..usedAt = entity.usedAt
      ..telegramChatId = entity.telegramChatId
      ..telegramUsername = entity.telegramUsername;
  }

  TelegramLinkingToken _toEntity(TelegramLinkingTokenRecord record) {
    return TelegramLinkingToken(
      token: record.token,
      identityId: record.identityId,
      studentIdentityId: record.studentIdentityId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      used: record.used,
      usedAt: record.usedAt,
      telegramChatId: record.telegramChatId,
      telegramUsername: record.telegramUsername,
    );
  }
}
