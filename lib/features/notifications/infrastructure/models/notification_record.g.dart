// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetNotificationRecordCollection on Isar {
  IsarCollection<NotificationRecord> get notificationRecords =>
      this.collection();
}

const NotificationRecordSchema = CollectionSchema(
  name: r'NotificationRecord',
  id: -8063810141512427725,
  properties: {
    r'body': PropertySchema(
      id: 0,
      name: r'body',
      type: IsarType.string,
    ),
    r'channel': PropertySchema(
      id: 1,
      name: r'channel',
      type: IsarType.string,
    ),
    r'createdAt': PropertySchema(
      id: 2,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'delivered': PropertySchema(
      id: 3,
      name: r'delivered',
      type: IsarType.bool,
    ),
    r'deliveredAt': PropertySchema(
      id: 4,
      name: r'deliveredAt',
      type: IsarType.dateTime,
    ),
    r'deliveryState': PropertySchema(
      id: 5,
      name: r'deliveryState',
      type: IsarType.string,
    ),
    r'notificationId': PropertySchema(
      id: 6,
      name: r'notificationId',
      type: IsarType.string,
    ),
    r'readAt': PropertySchema(
      id: 7,
      name: r'readAt',
      type: IsarType.dateTime,
    ),
    r'relatedId': PropertySchema(
      id: 8,
      name: r'relatedId',
      type: IsarType.string,
    ),
    r'status': PropertySchema(
      id: 9,
      name: r'status',
      type: IsarType.string,
    ),
    r'targetIdentityId': PropertySchema(
      id: 10,
      name: r'targetIdentityId',
      type: IsarType.string,
    ),
    r'title': PropertySchema(
      id: 11,
      name: r'title',
      type: IsarType.string,
    ),
    r'type': PropertySchema(
      id: 12,
      name: r'type',
      type: IsarType.string,
    )
  },
  estimateSize: _notificationRecordEstimateSize,
  serialize: _notificationRecordSerialize,
  deserialize: _notificationRecordDeserialize,
  deserializeProp: _notificationRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'notificationId': IndexSchema(
      id: 1533036797414670656,
      name: r'notificationId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'notificationId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'status': IndexSchema(
      id: -107785170620420283,
      name: r'status',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'status',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'createdAt': IndexSchema(
      id: -3433535483987302584,
      name: r'createdAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'createdAt',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _notificationRecordGetId,
  getLinks: _notificationRecordGetLinks,
  attach: _notificationRecordAttach,
  version: '3.1.0+1',
);

int _notificationRecordEstimateSize(
  NotificationRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.body.length * 3;
  bytesCount += 3 + object.channel.length * 3;
  {
    final value = object.deliveryState;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.notificationId.length * 3;
  {
    final value = object.relatedId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.status.length * 3;
  {
    final value = object.targetIdentityId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.title.length * 3;
  bytesCount += 3 + object.type.length * 3;
  return bytesCount;
}

void _notificationRecordSerialize(
  NotificationRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.body);
  writer.writeString(offsets[1], object.channel);
  writer.writeDateTime(offsets[2], object.createdAt);
  writer.writeBool(offsets[3], object.delivered);
  writer.writeDateTime(offsets[4], object.deliveredAt);
  writer.writeString(offsets[5], object.deliveryState);
  writer.writeString(offsets[6], object.notificationId);
  writer.writeDateTime(offsets[7], object.readAt);
  writer.writeString(offsets[8], object.relatedId);
  writer.writeString(offsets[9], object.status);
  writer.writeString(offsets[10], object.targetIdentityId);
  writer.writeString(offsets[11], object.title);
  writer.writeString(offsets[12], object.type);
}

NotificationRecord _notificationRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = NotificationRecord();
  object.body = reader.readString(offsets[0]);
  object.channel = reader.readString(offsets[1]);
  object.createdAt = reader.readDateTime(offsets[2]);
  object.delivered = reader.readBool(offsets[3]);
  object.deliveredAt = reader.readDateTimeOrNull(offsets[4]);
  object.deliveryState = reader.readStringOrNull(offsets[5]);
  object.id = id;
  object.notificationId = reader.readString(offsets[6]);
  object.readAt = reader.readDateTimeOrNull(offsets[7]);
  object.relatedId = reader.readStringOrNull(offsets[8]);
  object.status = reader.readString(offsets[9]);
  object.targetIdentityId = reader.readStringOrNull(offsets[10]);
  object.title = reader.readString(offsets[11]);
  object.type = reader.readString(offsets[12]);
  return object;
}

P _notificationRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (reader.readDateTime(offset)) as P;
    case 3:
      return (reader.readBool(offset)) as P;
    case 4:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 5:
      return (reader.readStringOrNull(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 8:
      return (reader.readStringOrNull(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (reader.readStringOrNull(offset)) as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _notificationRecordGetId(NotificationRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _notificationRecordGetLinks(
    NotificationRecord object) {
  return [];
}

void _notificationRecordAttach(
    IsarCollection<dynamic> col, Id id, NotificationRecord object) {
  object.id = id;
}

extension NotificationRecordByIndex on IsarCollection<NotificationRecord> {
  Future<NotificationRecord?> getByNotificationId(String notificationId) {
    return getByIndex(r'notificationId', [notificationId]);
  }

  NotificationRecord? getByNotificationIdSync(String notificationId) {
    return getByIndexSync(r'notificationId', [notificationId]);
  }

  Future<bool> deleteByNotificationId(String notificationId) {
    return deleteByIndex(r'notificationId', [notificationId]);
  }

  bool deleteByNotificationIdSync(String notificationId) {
    return deleteByIndexSync(r'notificationId', [notificationId]);
  }

  Future<List<NotificationRecord?>> getAllByNotificationId(
      List<String> notificationIdValues) {
    final values = notificationIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'notificationId', values);
  }

  List<NotificationRecord?> getAllByNotificationIdSync(
      List<String> notificationIdValues) {
    final values = notificationIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'notificationId', values);
  }

  Future<int> deleteAllByNotificationId(List<String> notificationIdValues) {
    final values = notificationIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'notificationId', values);
  }

  int deleteAllByNotificationIdSync(List<String> notificationIdValues) {
    final values = notificationIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'notificationId', values);
  }

  Future<Id> putByNotificationId(NotificationRecord object) {
    return putByIndex(r'notificationId', object);
  }

  Id putByNotificationIdSync(NotificationRecord object,
      {bool saveLinks = true}) {
    return putByIndexSync(r'notificationId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByNotificationId(List<NotificationRecord> objects) {
    return putAllByIndex(r'notificationId', objects);
  }

  List<Id> putAllByNotificationIdSync(List<NotificationRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'notificationId', objects, saveLinks: saveLinks);
  }
}

extension NotificationRecordQueryWhereSort
    on QueryBuilder<NotificationRecord, NotificationRecord, QWhere> {
  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhere>
      anyCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'createdAt'),
      );
    });
  }
}

extension NotificationRecordQueryWhere
    on QueryBuilder<NotificationRecord, NotificationRecord, QWhereClause> {
  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      idNotEqualTo(Id id) {
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      idBetween(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      notificationIdEqualTo(String notificationId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'notificationId',
        value: [notificationId],
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      notificationIdNotEqualTo(String notificationId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'notificationId',
              lower: [],
              upper: [notificationId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'notificationId',
              lower: [notificationId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'notificationId',
              lower: [notificationId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'notificationId',
              lower: [],
              upper: [notificationId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      statusEqualTo(String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      statusNotEqualTo(String status) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'status',
              lower: [],
              upper: [status],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'status',
              lower: [status],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'status',
              lower: [status],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'status',
              lower: [],
              upper: [status],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      createdAtEqualTo(DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'createdAt',
        value: [createdAt],
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      createdAtNotEqualTo(DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [],
              upper: [createdAt],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [createdAt],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [createdAt],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [],
              upper: [createdAt],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      createdAtGreaterThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [createdAt],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      createdAtLessThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [],
        upper: [createdAt],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterWhereClause>
      createdAtBetween(
    DateTime lowerCreatedAt,
    DateTime upperCreatedAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [lowerCreatedAt],
        includeLower: includeLower,
        upper: [upperCreatedAt],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension NotificationRecordQueryFilter
    on QueryBuilder<NotificationRecord, NotificationRecord, QFilterCondition> {
  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'body',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'body',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'body',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'body',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      bodyIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'body',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'channel',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'channel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'channel',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'channel',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      channelIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'channel',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      createdAtGreaterThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      createdAtLessThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      createdAtBetween(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'delivered',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'deliveredAt',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'deliveredAt',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'deliveredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'deliveredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'deliveredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveredAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'deliveredAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'deliveryState',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'deliveryState',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'deliveryState',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'deliveryState',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'deliveryState',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'deliveryState',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      deliveryStateIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'deliveryState',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      idGreaterThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      idLessThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      idBetween(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'notificationId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'notificationId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'notificationId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notificationId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      notificationIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notificationId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'readAt',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'readAt',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'readAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'readAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'readAt',
        value: value,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      readAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'readAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'relatedId',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'relatedId',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'relatedId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'relatedId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'relatedId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'relatedId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      relatedIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'relatedId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusEqualTo(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusGreaterThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusLessThan(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusBetween(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusStartsWith(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusEndsWith(
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

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'targetIdentityId',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'targetIdentityId',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'targetIdentityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'targetIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'targetIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      targetIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'targetIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'title',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'title',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'title',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      titleIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'title',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'type',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'type',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'type',
        value: '',
      ));
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterFilterCondition>
      typeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'type',
        value: '',
      ));
    });
  }
}

extension NotificationRecordQueryObject
    on QueryBuilder<NotificationRecord, NotificationRecord, QFilterCondition> {}

extension NotificationRecordQueryLinks
    on QueryBuilder<NotificationRecord, NotificationRecord, QFilterCondition> {}

extension NotificationRecordQuerySortBy
    on QueryBuilder<NotificationRecord, NotificationRecord, QSortBy> {
  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByBody() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'body', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByBodyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'body', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByChannel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'channel', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByChannelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'channel', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDelivered() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'delivered', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDeliveredDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'delivered', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDeliveredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveredAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDeliveredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveredAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDeliveryState() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveryState', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByDeliveryStateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveryState', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByNotificationId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByNotificationIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByReadAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'readAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByReadAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'readAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByRelatedId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'relatedId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByRelatedIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'relatedId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByTargetIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetIdentityId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByTargetIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetIdentityId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByTitleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      sortByTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.desc);
    });
  }
}

extension NotificationRecordQuerySortThenBy
    on QueryBuilder<NotificationRecord, NotificationRecord, QSortThenBy> {
  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByBody() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'body', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByBodyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'body', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByChannel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'channel', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByChannelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'channel', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDelivered() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'delivered', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDeliveredDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'delivered', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDeliveredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveredAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDeliveredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveredAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDeliveryState() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveryState', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByDeliveryStateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deliveryState', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByNotificationId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByNotificationIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByReadAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'readAt', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByReadAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'readAt', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByRelatedId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'relatedId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByRelatedIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'relatedId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByTargetIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetIdentityId', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByTargetIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetIdentityId', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByTitleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.desc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.asc);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QAfterSortBy>
      thenByTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.desc);
    });
  }
}

extension NotificationRecordQueryWhereDistinct
    on QueryBuilder<NotificationRecord, NotificationRecord, QDistinct> {
  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByBody({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'body', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByChannel({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'channel', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByDelivered() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'delivered');
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByDeliveredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'deliveredAt');
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByDeliveryState({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'deliveryState',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByNotificationId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notificationId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByReadAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'readAt');
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByRelatedId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'relatedId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByStatus({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByTargetIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'targetIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByTitle({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'title', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<NotificationRecord, NotificationRecord, QDistinct>
      distinctByType({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'type', caseSensitive: caseSensitive);
    });
  }
}

extension NotificationRecordQueryProperty
    on QueryBuilder<NotificationRecord, NotificationRecord, QQueryProperty> {
  QueryBuilder<NotificationRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations> bodyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'body');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations> channelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'channel');
    });
  }

  QueryBuilder<NotificationRecord, DateTime, QQueryOperations>
      createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<NotificationRecord, bool, QQueryOperations> deliveredProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'delivered');
    });
  }

  QueryBuilder<NotificationRecord, DateTime?, QQueryOperations>
      deliveredAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'deliveredAt');
    });
  }

  QueryBuilder<NotificationRecord, String?, QQueryOperations>
      deliveryStateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'deliveryState');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations>
      notificationIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notificationId');
    });
  }

  QueryBuilder<NotificationRecord, DateTime?, QQueryOperations>
      readAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'readAt');
    });
  }

  QueryBuilder<NotificationRecord, String?, QQueryOperations>
      relatedIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'relatedId');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<NotificationRecord, String?, QQueryOperations>
      targetIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'targetIdentityId');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations> titleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'title');
    });
  }

  QueryBuilder<NotificationRecord, String, QQueryOperations> typeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'type');
    });
  }
}
