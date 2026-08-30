// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audit_log_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetAuditLogRecordCollection on Isar {
  IsarCollection<AuditLogRecord> get auditLogRecords => this.collection();
}

const AuditLogRecordSchema = CollectionSchema(
  name: r'AuditLogRecord',
  id: 7421306069688056010,
  properties: {
    r'action': PropertySchema(
      id: 0,
      name: r'action',
      type: IsarType.string,
    ),
    r'actorName': PropertySchema(
      id: 1,
      name: r'actorName',
      type: IsarType.string,
    ),
    r'actorUserId': PropertySchema(
      id: 2,
      name: r'actorUserId',
      type: IsarType.string,
    ),
    r'auditId': PropertySchema(
      id: 3,
      name: r'auditId',
      type: IsarType.string,
    ),
    r'details': PropertySchema(
      id: 4,
      name: r'details',
      type: IsarType.string,
    ),
    r'occurredAt': PropertySchema(
      id: 5,
      name: r'occurredAt',
      type: IsarType.dateTime,
    ),
    r'result': PropertySchema(
      id: 6,
      name: r'result',
      type: IsarType.string,
    ),
    r'targetId': PropertySchema(
      id: 7,
      name: r'targetId',
      type: IsarType.string,
    ),
    r'targetType': PropertySchema(
      id: 8,
      name: r'targetType',
      type: IsarType.string,
    )
  },
  estimateSize: _auditLogRecordEstimateSize,
  serialize: _auditLogRecordSerialize,
  deserialize: _auditLogRecordDeserialize,
  deserializeProp: _auditLogRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'auditId': IndexSchema(
      id: -3483194984144368544,
      name: r'auditId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'auditId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'occurredAt': IndexSchema(
      id: 1229694562040044173,
      name: r'occurredAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'occurredAt',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _auditLogRecordGetId,
  getLinks: _auditLogRecordGetLinks,
  attach: _auditLogRecordAttach,
  version: '3.1.0+1',
);

int _auditLogRecordEstimateSize(
  AuditLogRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.action.length * 3;
  bytesCount += 3 + object.actorName.length * 3;
  bytesCount += 3 + object.actorUserId.length * 3;
  bytesCount += 3 + object.auditId.length * 3;
  {
    final value = object.details;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.result.length * 3;
  bytesCount += 3 + object.targetId.length * 3;
  bytesCount += 3 + object.targetType.length * 3;
  return bytesCount;
}

void _auditLogRecordSerialize(
  AuditLogRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.action);
  writer.writeString(offsets[1], object.actorName);
  writer.writeString(offsets[2], object.actorUserId);
  writer.writeString(offsets[3], object.auditId);
  writer.writeString(offsets[4], object.details);
  writer.writeDateTime(offsets[5], object.occurredAt);
  writer.writeString(offsets[6], object.result);
  writer.writeString(offsets[7], object.targetId);
  writer.writeString(offsets[8], object.targetType);
}

AuditLogRecord _auditLogRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = AuditLogRecord();
  object.action = reader.readString(offsets[0]);
  object.actorName = reader.readString(offsets[1]);
  object.actorUserId = reader.readString(offsets[2]);
  object.auditId = reader.readString(offsets[3]);
  object.details = reader.readStringOrNull(offsets[4]);
  object.id = id;
  object.occurredAt = reader.readDateTime(offsets[5]);
  object.result = reader.readString(offsets[6]);
  object.targetId = reader.readString(offsets[7]);
  object.targetType = reader.readString(offsets[8]);
  return object;
}

P _auditLogRecordDeserializeProp<P>(
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
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readDateTime(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _auditLogRecordGetId(AuditLogRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _auditLogRecordGetLinks(AuditLogRecord object) {
  return [];
}

void _auditLogRecordAttach(
    IsarCollection<dynamic> col, Id id, AuditLogRecord object) {
  object.id = id;
}

extension AuditLogRecordByIndex on IsarCollection<AuditLogRecord> {
  Future<AuditLogRecord?> getByAuditId(String auditId) {
    return getByIndex(r'auditId', [auditId]);
  }

  AuditLogRecord? getByAuditIdSync(String auditId) {
    return getByIndexSync(r'auditId', [auditId]);
  }

  Future<bool> deleteByAuditId(String auditId) {
    return deleteByIndex(r'auditId', [auditId]);
  }

  bool deleteByAuditIdSync(String auditId) {
    return deleteByIndexSync(r'auditId', [auditId]);
  }

  Future<List<AuditLogRecord?>> getAllByAuditId(List<String> auditIdValues) {
    final values = auditIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'auditId', values);
  }

  List<AuditLogRecord?> getAllByAuditIdSync(List<String> auditIdValues) {
    final values = auditIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'auditId', values);
  }

  Future<int> deleteAllByAuditId(List<String> auditIdValues) {
    final values = auditIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'auditId', values);
  }

  int deleteAllByAuditIdSync(List<String> auditIdValues) {
    final values = auditIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'auditId', values);
  }

  Future<Id> putByAuditId(AuditLogRecord object) {
    return putByIndex(r'auditId', object);
  }

  Id putByAuditIdSync(AuditLogRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'auditId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByAuditId(List<AuditLogRecord> objects) {
    return putAllByIndex(r'auditId', objects);
  }

  List<Id> putAllByAuditIdSync(List<AuditLogRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'auditId', objects, saveLinks: saveLinks);
  }
}

extension AuditLogRecordQueryWhereSort
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QWhere> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhere> anyOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'occurredAt'),
      );
    });
  }
}

extension AuditLogRecordQueryWhere
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QWhereClause> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause> idNotEqualTo(
      Id id) {
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

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      auditIdEqualTo(String auditId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'auditId',
        value: [auditId],
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      auditIdNotEqualTo(String auditId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'auditId',
              lower: [],
              upper: [auditId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'auditId',
              lower: [auditId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'auditId',
              lower: [auditId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'auditId',
              lower: [],
              upper: [auditId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      occurredAtEqualTo(DateTime occurredAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'occurredAt',
        value: [occurredAt],
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      occurredAtNotEqualTo(DateTime occurredAt) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'occurredAt',
              lower: [],
              upper: [occurredAt],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'occurredAt',
              lower: [occurredAt],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'occurredAt',
              lower: [occurredAt],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'occurredAt',
              lower: [],
              upper: [occurredAt],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      occurredAtGreaterThan(
    DateTime occurredAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'occurredAt',
        lower: [occurredAt],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      occurredAtLessThan(
    DateTime occurredAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'occurredAt',
        lower: [],
        upper: [occurredAt],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterWhereClause>
      occurredAtBetween(
    DateTime lowerOccurredAt,
    DateTime upperOccurredAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'occurredAt',
        lower: [lowerOccurredAt],
        includeLower: includeLower,
        upper: [upperOccurredAt],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension AuditLogRecordQueryFilter
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QFilterCondition> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'action',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'action',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'action',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'action',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actionIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'action',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'actorName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'actorName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'actorName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'actorName',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'actorName',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'actorUserId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'actorUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'actorUserId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'actorUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      actorUserIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'actorUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'auditId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'auditId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'auditId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'auditId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      auditIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'auditId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'details',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'details',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'details',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'details',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'details',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'details',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      detailsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'details',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
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

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
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

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      occurredAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'occurredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      occurredAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'occurredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      occurredAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'occurredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      occurredAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'occurredAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'result',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'result',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'result',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'result',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      resultIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'result',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'targetId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'targetId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'targetId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'targetId',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'targetType',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'targetType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'targetType',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'targetType',
        value: '',
      ));
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterFilterCondition>
      targetTypeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'targetType',
        value: '',
      ));
    });
  }
}

extension AuditLogRecordQueryObject
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QFilterCondition> {}

extension AuditLogRecordQueryLinks
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QFilterCondition> {}

extension AuditLogRecordQuerySortBy
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QSortBy> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByAction() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'action', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByActionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'action', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByActorName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorName', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByActorNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorName', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByActorUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorUserId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByActorUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorUserId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByAuditId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'auditId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByAuditIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'auditId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByDetails() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'details', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByDetailsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'details', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByOccurredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByResult() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'result', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByResultDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'result', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> sortByTargetId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByTargetIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByTargetType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetType', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      sortByTargetTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetType', Sort.desc);
    });
  }
}

extension AuditLogRecordQuerySortThenBy
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QSortThenBy> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByAction() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'action', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByActionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'action', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByActorName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorName', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByActorNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorName', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByActorUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorUserId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByActorUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'actorUserId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByAuditId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'auditId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByAuditIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'auditId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByDetails() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'details', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByDetailsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'details', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByOccurredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByResult() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'result', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByResultDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'result', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy> thenByTargetId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetId', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByTargetIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetId', Sort.desc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByTargetType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetType', Sort.asc);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QAfterSortBy>
      thenByTargetTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'targetType', Sort.desc);
    });
  }
}

extension AuditLogRecordQueryWhereDistinct
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> {
  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByAction(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'action', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByActorName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'actorName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByActorUserId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'actorUserId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByAuditId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'auditId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByDetails(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'details', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct>
      distinctByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'occurredAt');
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByResult(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'result', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByTargetId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'targetId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<AuditLogRecord, AuditLogRecord, QDistinct> distinctByTargetType(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'targetType', caseSensitive: caseSensitive);
    });
  }
}

extension AuditLogRecordQueryProperty
    on QueryBuilder<AuditLogRecord, AuditLogRecord, QQueryProperty> {
  QueryBuilder<AuditLogRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> actionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'action');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> actorNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'actorName');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> actorUserIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'actorUserId');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> auditIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'auditId');
    });
  }

  QueryBuilder<AuditLogRecord, String?, QQueryOperations> detailsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'details');
    });
  }

  QueryBuilder<AuditLogRecord, DateTime, QQueryOperations>
      occurredAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'occurredAt');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> resultProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'result');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> targetIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'targetId');
    });
  }

  QueryBuilder<AuditLogRecord, String, QQueryOperations> targetTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'targetType');
    });
  }
}
