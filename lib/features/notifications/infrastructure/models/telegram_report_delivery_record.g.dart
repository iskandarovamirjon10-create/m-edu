// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_report_delivery_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetTelegramReportDeliveryRecordCollection on Isar {
  IsarCollection<TelegramReportDeliveryRecord>
      get telegramReportDeliveryRecords => this.collection();
}

const TelegramReportDeliveryRecordSchema = CollectionSchema(
  name: r'TelegramReportDeliveryRecord',
  id: 779214710416034243,
  properties: {
    r'attemptCount': PropertySchema(
      id: 0,
      name: r'attemptCount',
      type: IsarType.long,
    ),
    r'createdAt': PropertySchema(
      id: 1,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'errorCode': PropertySchema(
      id: 2,
      name: r'errorCode',
      type: IsarType.string,
    ),
    r'errorMessage': PropertySchema(
      id: 3,
      name: r'errorMessage',
      type: IsarType.string,
    ),
    r'parentId': PropertySchema(
      id: 4,
      name: r'parentId',
      type: IsarType.string,
    ),
    r'period': PropertySchema(
      id: 5,
      name: r'period',
      type: IsarType.string,
    ),
    r'sentAt': PropertySchema(
      id: 6,
      name: r'sentAt',
      type: IsarType.dateTime,
    ),
    r'status': PropertySchema(
      id: 7,
      name: r'status',
      type: IsarType.string,
    ),
    r'studentIdentityId': PropertySchema(
      id: 8,
      name: r'studentIdentityId',
      type: IsarType.string,
    ),
    r'telegramChatId': PropertySchema(
      id: 9,
      name: r'telegramChatId',
      type: IsarType.string,
    ),
    r'telegramMessageId': PropertySchema(
      id: 10,
      name: r'telegramMessageId',
      type: IsarType.long,
    ),
    r'updatedAt': PropertySchema(
      id: 11,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _telegramReportDeliveryRecordEstimateSize,
  serialize: _telegramReportDeliveryRecordSerialize,
  deserialize: _telegramReportDeliveryRecordDeserialize,
  deserializeProp: _telegramReportDeliveryRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'parentId': IndexSchema(
      id: -809199838039056779,
      name: r'parentId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'parentId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'period': IndexSchema(
      id: -1253107732758621689,
      name: r'period',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'period',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _telegramReportDeliveryRecordGetId,
  getLinks: _telegramReportDeliveryRecordGetLinks,
  attach: _telegramReportDeliveryRecordAttach,
  version: '3.1.0+1',
);

int _telegramReportDeliveryRecordEstimateSize(
  TelegramReportDeliveryRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.errorCode;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.errorMessage;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.parentId.length * 3;
  bytesCount += 3 + object.period.length * 3;
  bytesCount += 3 + object.status.length * 3;
  bytesCount += 3 + object.studentIdentityId.length * 3;
  bytesCount += 3 + object.telegramChatId.length * 3;
  return bytesCount;
}

void _telegramReportDeliveryRecordSerialize(
  TelegramReportDeliveryRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeLong(offsets[0], object.attemptCount);
  writer.writeDateTime(offsets[1], object.createdAt);
  writer.writeString(offsets[2], object.errorCode);
  writer.writeString(offsets[3], object.errorMessage);
  writer.writeString(offsets[4], object.parentId);
  writer.writeString(offsets[5], object.period);
  writer.writeDateTime(offsets[6], object.sentAt);
  writer.writeString(offsets[7], object.status);
  writer.writeString(offsets[8], object.studentIdentityId);
  writer.writeString(offsets[9], object.telegramChatId);
  writer.writeLong(offsets[10], object.telegramMessageId);
  writer.writeDateTime(offsets[11], object.updatedAt);
}

TelegramReportDeliveryRecord _telegramReportDeliveryRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = TelegramReportDeliveryRecord();
  object.attemptCount = reader.readLong(offsets[0]);
  object.createdAt = reader.readDateTime(offsets[1]);
  object.errorCode = reader.readStringOrNull(offsets[2]);
  object.errorMessage = reader.readStringOrNull(offsets[3]);
  object.id = id;
  object.parentId = reader.readString(offsets[4]);
  object.period = reader.readString(offsets[5]);
  object.sentAt = reader.readDateTimeOrNull(offsets[6]);
  object.status = reader.readString(offsets[7]);
  object.studentIdentityId = reader.readString(offsets[8]);
  object.telegramChatId = reader.readString(offsets[9]);
  object.telegramMessageId = reader.readLongOrNull(offsets[10]);
  object.updatedAt = reader.readDateTime(offsets[11]);
  return object;
}

P _telegramReportDeliveryRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readLong(offset)) as P;
    case 1:
      return (reader.readDateTime(offset)) as P;
    case 2:
      return (reader.readStringOrNull(offset)) as P;
    case 3:
      return (reader.readStringOrNull(offset)) as P;
    case 4:
      return (reader.readString(offset)) as P;
    case 5:
      return (reader.readString(offset)) as P;
    case 6:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readString(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (reader.readLongOrNull(offset)) as P;
    case 11:
      return (reader.readDateTime(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _telegramReportDeliveryRecordGetId(TelegramReportDeliveryRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _telegramReportDeliveryRecordGetLinks(
    TelegramReportDeliveryRecord object) {
  return [];
}

void _telegramReportDeliveryRecordAttach(
    IsarCollection<dynamic> col, Id id, TelegramReportDeliveryRecord object) {
  object.id = id;
}

extension TelegramReportDeliveryRecordByIndex
    on IsarCollection<TelegramReportDeliveryRecord> {
  Future<TelegramReportDeliveryRecord?> getByPeriod(String period) {
    return getByIndex(r'period', [period]);
  }

  TelegramReportDeliveryRecord? getByPeriodSync(String period) {
    return getByIndexSync(r'period', [period]);
  }

  Future<bool> deleteByPeriod(String period) {
    return deleteByIndex(r'period', [period]);
  }

  bool deleteByPeriodSync(String period) {
    return deleteByIndexSync(r'period', [period]);
  }

  Future<List<TelegramReportDeliveryRecord?>> getAllByPeriod(
      List<String> periodValues) {
    final values = periodValues.map((e) => [e]).toList();
    return getAllByIndex(r'period', values);
  }

  List<TelegramReportDeliveryRecord?> getAllByPeriodSync(
      List<String> periodValues) {
    final values = periodValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'period', values);
  }

  Future<int> deleteAllByPeriod(List<String> periodValues) {
    final values = periodValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'period', values);
  }

  int deleteAllByPeriodSync(List<String> periodValues) {
    final values = periodValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'period', values);
  }

  Future<Id> putByPeriod(TelegramReportDeliveryRecord object) {
    return putByIndex(r'period', object);
  }

  Id putByPeriodSync(TelegramReportDeliveryRecord object,
      {bool saveLinks = true}) {
    return putByIndexSync(r'period', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByPeriod(List<TelegramReportDeliveryRecord> objects) {
    return putAllByIndex(r'period', objects);
  }

  List<Id> putAllByPeriodSync(List<TelegramReportDeliveryRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'period', objects, saveLinks: saveLinks);
  }
}

extension TelegramReportDeliveryRecordQueryWhereSort on QueryBuilder<
    TelegramReportDeliveryRecord, TelegramReportDeliveryRecord, QWhere> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension TelegramReportDeliveryRecordQueryWhere on QueryBuilder<
    TelegramReportDeliveryRecord, TelegramReportDeliveryRecord, QWhereClause> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> parentIdEqualTo(String parentId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'parentId',
        value: [parentId],
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> parentIdNotEqualTo(String parentId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'parentId',
              lower: [],
              upper: [parentId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'parentId',
              lower: [parentId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'parentId',
              lower: [parentId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'parentId',
              lower: [],
              upper: [parentId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> periodEqualTo(String period) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'period',
        value: [period],
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterWhereClause> periodNotEqualTo(String period) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'period',
              lower: [],
              upper: [period],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'period',
              lower: [period],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'period',
              lower: [period],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'period',
              lower: [],
              upper: [period],
              includeUpper: false,
            ));
      }
    });
  }
}

extension TelegramReportDeliveryRecordQueryFilter on QueryBuilder<
    TelegramReportDeliveryRecord,
    TelegramReportDeliveryRecord,
    QFilterCondition> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> attemptCountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'attemptCount',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> attemptCountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'attemptCount',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> attemptCountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'attemptCount',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> attemptCountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'attemptCount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'errorCode',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'errorCode',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'errorCode',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      errorCodeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'errorCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      errorCodeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'errorCode',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'errorCode',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorCodeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'errorCode',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'errorMessage',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'errorMessage',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'errorMessage',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      errorMessageContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'errorMessage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      errorMessageMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'errorMessage',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'errorMessage',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> errorMessageIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'errorMessage',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'parentId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      parentIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      parentIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'parentId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> parentIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'parentId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'period',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      periodContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'period',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      periodMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'period',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'period',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> periodIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'period',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'sentAt',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'sentAt',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'sentAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'sentAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'sentAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> sentAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'sentAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'status',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      statusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
          QAfterFilterCondition>
      statusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> studentIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> studentIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdEqualTo(
    String value, {
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdGreaterThan(
    String value, {
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdLessThan(
    String value, {
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdBetween(
    String lower,
    String upper, {
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
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

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramChatId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramChatIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'telegramChatId',
        value: '',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'telegramMessageId',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'telegramMessageId',
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramMessageId',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdGreaterThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'telegramMessageId',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdLessThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'telegramMessageId',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> telegramMessageIdBetween(
    int? lower,
    int? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'telegramMessageId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> updatedAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> updatedAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> updatedAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterFilterCondition> updatedAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'updatedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension TelegramReportDeliveryRecordQueryObject on QueryBuilder<
    TelegramReportDeliveryRecord,
    TelegramReportDeliveryRecord,
    QFilterCondition> {}

extension TelegramReportDeliveryRecordQueryLinks on QueryBuilder<
    TelegramReportDeliveryRecord,
    TelegramReportDeliveryRecord,
    QFilterCondition> {}

extension TelegramReportDeliveryRecordQuerySortBy on QueryBuilder<
    TelegramReportDeliveryRecord, TelegramReportDeliveryRecord, QSortBy> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByAttemptCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attemptCount', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByAttemptCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attemptCount', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByErrorCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorCode', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByErrorCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorCode', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByErrorMessage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorMessage', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByErrorMessageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorMessage', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByParentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByParentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'period', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'period', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortBySentAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sentAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortBySentAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sentAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByTelegramChatId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByTelegramChatIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByTelegramMessageId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramMessageId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByTelegramMessageIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramMessageId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension TelegramReportDeliveryRecordQuerySortThenBy on QueryBuilder<
    TelegramReportDeliveryRecord, TelegramReportDeliveryRecord, QSortThenBy> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByAttemptCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attemptCount', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByAttemptCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attemptCount', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByErrorCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorCode', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByErrorCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorCode', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByErrorMessage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorMessage', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByErrorMessageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'errorMessage', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByParentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByParentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'period', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'period', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenBySentAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sentAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenBySentAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sentAt', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByTelegramChatId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByTelegramChatIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramChatId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByTelegramMessageId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramMessageId', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByTelegramMessageIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramMessageId', Sort.desc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension TelegramReportDeliveryRecordQueryWhereDistinct on QueryBuilder<
    TelegramReportDeliveryRecord, TelegramReportDeliveryRecord, QDistinct> {
  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByAttemptCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'attemptCount');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByErrorCode({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'errorCode', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByErrorMessage({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'errorMessage', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByParentId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'parentId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByPeriod({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'period', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctBySentAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'sentAt');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByStatus({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByStudentIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByTelegramChatId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramChatId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByTelegramMessageId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramMessageId');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, TelegramReportDeliveryRecord,
      QDistinct> distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension TelegramReportDeliveryRecordQueryProperty on QueryBuilder<
    TelegramReportDeliveryRecord,
    TelegramReportDeliveryRecord,
    QQueryProperty> {
  QueryBuilder<TelegramReportDeliveryRecord, int, QQueryOperations>
      idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, int, QQueryOperations>
      attemptCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'attemptCount');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, DateTime, QQueryOperations>
      createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String?, QQueryOperations>
      errorCodeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'errorCode');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String?, QQueryOperations>
      errorMessageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'errorMessage');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String, QQueryOperations>
      parentIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'parentId');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String, QQueryOperations>
      periodProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'period');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, DateTime?, QQueryOperations>
      sentAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'sentAt');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String, QQueryOperations>
      statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String, QQueryOperations>
      studentIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentIdentityId');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, String, QQueryOperations>
      telegramChatIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramChatId');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, int?, QQueryOperations>
      telegramMessageIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramMessageId');
    });
  }

  QueryBuilder<TelegramReportDeliveryRecord, DateTime, QQueryOperations>
      updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
