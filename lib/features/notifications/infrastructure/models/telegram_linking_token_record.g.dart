// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_linking_token_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetTelegramLinkingTokenRecordCollection on Isar {
  IsarCollection<TelegramLinkingTokenRecord> get telegramLinkingTokenRecords =>
      this.collection();
}

const TelegramLinkingTokenRecordSchema = CollectionSchema(
  name: r'TelegramLinkingTokenRecord',
  id: 8477789907969165328,
  properties: {
    r'createdAt': PropertySchema(
      id: 0,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'expiresAt': PropertySchema(
      id: 1,
      name: r'expiresAt',
      type: IsarType.dateTime,
    ),
    r'identityId': PropertySchema(
      id: 2,
      name: r'identityId',
      type: IsarType.string,
    ),
    r'studentIdentityId': PropertySchema(
      id: 3,
      name: r'studentIdentityId',
      type: IsarType.string,
    ),
    r'telegramChatId': PropertySchema(
      id: 4,
      name: r'telegramChatId',
      type: IsarType.string,
    ),
    r'telegramUsername': PropertySchema(
      id: 5,
      name: r'telegramUsername',
      type: IsarType.string,
    ),
    r'token': PropertySchema(
      id: 6,
      name: r'token',
      type: IsarType.string,
    ),
    r'used': PropertySchema(
      id: 7,
      name: r'used',
      type: IsarType.bool,
    ),
    r'usedAt': PropertySchema(
      id: 8,
      name: r'usedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _telegramLinkingTokenRecordEstimateSize,
  serialize: _telegramLinkingTokenRecordSerialize,
  deserialize: _telegramLinkingTokenRecordDeserialize,
  deserializeProp: _telegramLinkingTokenRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'token': IndexSchema(
      id: -5898650166254967271,
      name: r'token',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'token',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'identityId': IndexSchema(
      id: 1738616051568895492,
      name: r'identityId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'identityId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _telegramLinkingTokenRecordGetId,
  getLinks: _telegramLinkingTokenRecordGetLinks,
  attach: _telegramLinkingTokenRecordAttach,
  version: '3.1.0+1',
);

int _telegramLinkingTokenRecordEstimateSize(
  TelegramLinkingTokenRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.identityId.length * 3;
  bytesCount += 3 + object.studentIdentityId.length * 3;
  {
    final value = object.telegramChatId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.telegramUsername;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.token.length * 3;
  return bytesCount;
}

void _telegramLinkingTokenRecordSerialize(
  TelegramLinkingTokenRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDateTime(offsets[0], object.createdAt);
  writer.writeDateTime(offsets[1], object.expiresAt);
  writer.writeString(offsets[2], object.identityId);
  writer.writeString(offsets[3], object.studentIdentityId);
  writer.writeString(offsets[4], object.telegramChatId);
  writer.writeString(offsets[5], object.telegramUsername);
  writer.writeString(offsets[6], object.token);
  writer.writeBool(offsets[7], object.used);
  writer.writeDateTime(offsets[8], object.usedAt);
}

TelegramLinkingTokenRecord _telegramLinkingTokenRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = TelegramLinkingTokenRecord();
  object.createdAt = reader.readDateTime(offsets[0]);
  object.expiresAt = reader.readDateTime(offsets[1]);
  object.id = id;
  object.identityId = reader.readString(offsets[2]);
  object.studentIdentityId = reader.readString(offsets[3]);
  object.telegramChatId = reader.readStringOrNull(offsets[4]);
  object.telegramUsername = reader.readStringOrNull(offsets[5]);
  object.token = reader.readString(offsets[6]);
  object.used = reader.readBool(offsets[7]);
  object.usedAt = reader.readDateTimeOrNull(offsets[8]);
  return object;
}

P _telegramLinkingTokenRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDateTime(offset)) as P;
    case 1:
      return (reader.readDateTime(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readStringOrNull(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readBool(offset)) as P;
    case 8:
      return (reader.readDateTimeOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _telegramLinkingTokenRecordGetId(TelegramLinkingTokenRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _telegramLinkingTokenRecordGetLinks(
    TelegramLinkingTokenRecord object) {
  return [];
}

void _telegramLinkingTokenRecordAttach(
    IsarCollection<dynamic> col, Id id, TelegramLinkingTokenRecord object) {
  object.id = id;
}

extension TelegramLinkingTokenRecordByIndex
    on IsarCollection<TelegramLinkingTokenRecord> {
  Future<TelegramLinkingTokenRecord?> getByToken(String token) {
    return getByIndex(r'token', [token]);
  }

  TelegramLinkingTokenRecord? getByTokenSync(String token) {
    return getByIndexSync(r'token', [token]);
  }

  Future<bool> deleteByToken(String token) {
    return deleteByIndex(r'token', [token]);
  }

  bool deleteByTokenSync(String token) {
    return deleteByIndexSync(r'token', [token]);
  }

  Future<List<TelegramLinkingTokenRecord?>> getAllByToken(
      List<String> tokenValues) {
    final values = tokenValues.map((e) => [e]).toList();
    return getAllByIndex(r'token', values);
  }

  List<TelegramLinkingTokenRecord?> getAllByTokenSync(
      List<String> tokenValues) {
    final values = tokenValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'token', values);
  }

  Future<int> deleteAllByToken(List<String> tokenValues) {
    final values = tokenValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'token', values);
  }

  int deleteAllByTokenSync(List<String> tokenValues) {
    final values = tokenValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'token', values);
  }

  Future<Id> putByToken(TelegramLinkingTokenRecord object) {
    return putByIndex(r'token', object);
  }

  Id putByTokenSync(TelegramLinkingTokenRecord object,
      {bool saveLinks = true}) {
    return putByIndexSync(r'token', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByToken(List<TelegramLinkingTokenRecord> objects) {
    return putAllByIndex(r'token', objects);
  }

  List<Id> putAllByTokenSync(List<TelegramLinkingTokenRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'token', objects, saveLinks: saveLinks);
  }
}

extension TelegramLinkingTokenRecordQueryWhereSort on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QWhere> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension TelegramLinkingTokenRecordQueryWhere on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QWhereClause> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> tokenEqualTo(String token) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'token',
        value: [token],
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> tokenNotEqualTo(String token) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'token',
              lower: [],
              upper: [token],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'token',
              lower: [token],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'token',
              lower: [token],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'token',
              lower: [],
              upper: [token],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> identityIdEqualTo(String identityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'identityId',
        value: [identityId],
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterWhereClause> identityIdNotEqualTo(String identityId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'identityId',
              lower: [],
              upper: [identityId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'identityId',
              lower: [identityId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'identityId',
              lower: [identityId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'identityId',
              lower: [],
              upper: [identityId],
              includeUpper: false,
            ));
      }
    });
  }
}

extension TelegramLinkingTokenRecordQueryFilter on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QFilterCondition> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> createdAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> createdAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> createdAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'createdAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> expiresAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'expiresAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> expiresAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'expiresAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> expiresAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'expiresAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> expiresAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'expiresAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'id',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'identityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      identityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      identityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'identityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> identityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentIdentityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      studentIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      studentIdentityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> studentIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'telegramChatId',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'telegramChatId',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'telegramChatId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      telegramChatIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'telegramChatId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      telegramChatIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'telegramChatId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramChatId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramChatIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'telegramChatId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'telegramUsername',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'telegramUsername',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'telegramUsername',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      telegramUsernameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'telegramUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      telegramUsernameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'telegramUsername',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramUsername',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> telegramUsernameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'telegramUsername',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'token',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      tokenContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'token',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
          QAfterFilterCondition>
      tokenMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'token',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'token',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> tokenIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'token',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'used',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'usedAt',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'usedAt',
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterFilterCondition> usedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'usedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension TelegramLinkingTokenRecordQueryObject on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QFilterCondition> {}

extension TelegramLinkingTokenRecordQueryLinks on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QFilterCondition> {}

extension TelegramLinkingTokenRecordQuerySortBy on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QSortBy> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByExpiresAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'expiresAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByExpiresAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'expiresAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByTelegramChatId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByTelegramChatIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByTelegramUsername() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramUsername', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByTelegramUsernameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramUsername', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByToken() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'token', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByTokenDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'token', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'used', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByUsedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'used', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> sortByUsedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.desc);
    });
  }
}

extension TelegramLinkingTokenRecordQuerySortThenBy on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QSortThenBy> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByExpiresAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'expiresAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByExpiresAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'expiresAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByTelegramChatId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByTelegramChatIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByTelegramUsername() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramUsername', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByTelegramUsernameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramUsername', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByToken() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'token', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByTokenDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'token', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'used', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByUsedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'used', Sort.desc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QAfterSortBy> thenByUsedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.desc);
    });
  }
}

extension TelegramLinkingTokenRecordQueryWhereDistinct on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QDistinct> {
  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByExpiresAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'expiresAt');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'identityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByStudentIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByTelegramChatId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramChatId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByTelegramUsername({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramUsername',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByToken({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'token', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'used');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, TelegramLinkingTokenRecord,
      QDistinct> distinctByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'usedAt');
    });
  }
}

extension TelegramLinkingTokenRecordQueryProperty on QueryBuilder<
    TelegramLinkingTokenRecord, TelegramLinkingTokenRecord, QQueryProperty> {
  QueryBuilder<TelegramLinkingTokenRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, DateTime, QQueryOperations>
      createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, DateTime, QQueryOperations>
      expiresAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'expiresAt');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, String, QQueryOperations>
      identityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'identityId');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, String, QQueryOperations>
      studentIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentIdentityId');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, String?, QQueryOperations>
      telegramChatIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramChatId');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, String?, QQueryOperations>
      telegramUsernameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramUsername');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, String, QQueryOperations>
      tokenProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'token');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, bool, QQueryOperations>
      usedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'used');
    });
  }

  QueryBuilder<TelegramLinkingTokenRecord, DateTime?, QQueryOperations>
      usedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'usedAt');
    });
  }
}
