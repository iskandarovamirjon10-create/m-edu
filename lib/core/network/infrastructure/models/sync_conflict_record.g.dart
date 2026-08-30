// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_conflict_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetSyncConflictRecordCollection on Isar {
  IsarCollection<SyncConflictRecord> get syncConflictRecords =>
      this.collection();
}

const SyncConflictRecordSchema = CollectionSchema(
  name: r'SyncConflictRecord',
  id: -6035372110509361303,
  properties: {
    r'direction': PropertySchema(
      id: 0,
      name: r'direction',
      type: IsarType.string,
    ),
    r'entityId': PropertySchema(
      id: 1,
      name: r'entityId',
      type: IsarType.string,
    ),
    r'entityType': PropertySchema(
      id: 2,
      name: r'entityType',
      type: IsarType.string,
    ),
    r'localDeviceId': PropertySchema(
      id: 3,
      name: r'localDeviceId',
      type: IsarType.string,
    ),
    r'localVersion': PropertySchema(
      id: 4,
      name: r'localVersion',
      type: IsarType.long,
    ),
    r'occurredAt': PropertySchema(
      id: 5,
      name: r'occurredAt',
      type: IsarType.dateTime,
    ),
    r'remoteDeviceId': PropertySchema(
      id: 6,
      name: r'remoteDeviceId',
      type: IsarType.string,
    ),
    r'remoteVersion': PropertySchema(
      id: 7,
      name: r'remoteVersion',
      type: IsarType.long,
    ),
    r'winner': PropertySchema(
      id: 8,
      name: r'winner',
      type: IsarType.string,
    )
  },
  estimateSize: _syncConflictRecordEstimateSize,
  serialize: _syncConflictRecordSerialize,
  deserialize: _syncConflictRecordDeserialize,
  deserializeProp: _syncConflictRecordDeserializeProp,
  idName: r'id',
  indexes: {},
  links: {},
  embeddedSchemas: {},
  getId: _syncConflictRecordGetId,
  getLinks: _syncConflictRecordGetLinks,
  attach: _syncConflictRecordAttach,
  version: '3.1.0+1',
);

int _syncConflictRecordEstimateSize(
  SyncConflictRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.direction.length * 3;
  bytesCount += 3 + object.entityId.length * 3;
  bytesCount += 3 + object.entityType.length * 3;
  bytesCount += 3 + object.localDeviceId.length * 3;
  bytesCount += 3 + object.remoteDeviceId.length * 3;
  bytesCount += 3 + object.winner.length * 3;
  return bytesCount;
}

void _syncConflictRecordSerialize(
  SyncConflictRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.direction);
  writer.writeString(offsets[1], object.entityId);
  writer.writeString(offsets[2], object.entityType);
  writer.writeString(offsets[3], object.localDeviceId);
  writer.writeLong(offsets[4], object.localVersion);
  writer.writeDateTime(offsets[5], object.occurredAt);
  writer.writeString(offsets[6], object.remoteDeviceId);
  writer.writeLong(offsets[7], object.remoteVersion);
  writer.writeString(offsets[8], object.winner);
}

SyncConflictRecord _syncConflictRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = SyncConflictRecord();
  object.direction = reader.readString(offsets[0]);
  object.entityId = reader.readString(offsets[1]);
  object.entityType = reader.readString(offsets[2]);
  object.id = id;
  object.localDeviceId = reader.readString(offsets[3]);
  object.localVersion = reader.readLong(offsets[4]);
  object.occurredAt = reader.readDateTime(offsets[5]);
  object.remoteDeviceId = reader.readString(offsets[6]);
  object.remoteVersion = reader.readLong(offsets[7]);
  object.winner = reader.readString(offsets[8]);
  return object;
}

P _syncConflictRecordDeserializeProp<P>(
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
      return (reader.readLong(offset)) as P;
    case 5:
      return (reader.readDateTime(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readLong(offset)) as P;
    case 8:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _syncConflictRecordGetId(SyncConflictRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _syncConflictRecordGetLinks(
    SyncConflictRecord object) {
  return [];
}

void _syncConflictRecordAttach(
    IsarCollection<dynamic> col, Id id, SyncConflictRecord object) {
  object.id = id;
}

extension SyncConflictRecordQueryWhereSort
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QWhere> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension SyncConflictRecordQueryWhere
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QWhereClause> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhereClause>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterWhereClause>
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
}

extension SyncConflictRecordQueryFilter
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QFilterCondition> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'direction',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'direction',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'direction',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'direction',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      directionIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'direction',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'entityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'entityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'entityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'entityId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'entityId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'entityType',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'entityType',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'entityType',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      entityTypeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'entityType',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'localDeviceId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'localDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'localDeviceId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'localDeviceId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localDeviceIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'localDeviceId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'localVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localVersionGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'localVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localVersionLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'localVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      localVersionBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'localVersion',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      occurredAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'occurredAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remoteDeviceId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'remoteDeviceId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'remoteDeviceId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteDeviceId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteDeviceIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'remoteDeviceId',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteVersionGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remoteVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteVersionLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remoteVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      remoteVersionBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remoteVersion',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'winner',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'winner',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'winner',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'winner',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterFilterCondition>
      winnerIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'winner',
        value: '',
      ));
    });
  }
}

extension SyncConflictRecordQueryObject
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QFilterCondition> {}

extension SyncConflictRecordQueryLinks
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QFilterCondition> {}

extension SyncConflictRecordQuerySortBy
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QSortBy> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByDirection() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'direction', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByDirectionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'direction', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByEntityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByEntityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByEntityType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByEntityTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByLocalDeviceId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localDeviceId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByLocalDeviceIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localDeviceId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByLocalVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localVersion', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByLocalVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localVersion', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByOccurredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByRemoteDeviceId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteDeviceId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByRemoteDeviceIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteDeviceId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByRemoteVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteVersion', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByRemoteVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteVersion', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByWinner() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'winner', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      sortByWinnerDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'winner', Sort.desc);
    });
  }
}

extension SyncConflictRecordQuerySortThenBy
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QSortThenBy> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByDirection() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'direction', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByDirectionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'direction', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByEntityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByEntityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByEntityType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByEntityTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByLocalDeviceId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localDeviceId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByLocalDeviceIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localDeviceId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByLocalVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localVersion', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByLocalVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localVersion', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByOccurredAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'occurredAt', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByRemoteDeviceId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteDeviceId', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByRemoteDeviceIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteDeviceId', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByRemoteVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteVersion', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByRemoteVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteVersion', Sort.desc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByWinner() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'winner', Sort.asc);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QAfterSortBy>
      thenByWinnerDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'winner', Sort.desc);
    });
  }
}

extension SyncConflictRecordQueryWhereDistinct
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct> {
  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByDirection({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'direction', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByEntityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'entityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByEntityType({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'entityType', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByLocalDeviceId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'localDeviceId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByLocalVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'localVersion');
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByOccurredAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'occurredAt');
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByRemoteDeviceId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remoteDeviceId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByRemoteVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remoteVersion');
    });
  }

  QueryBuilder<SyncConflictRecord, SyncConflictRecord, QDistinct>
      distinctByWinner({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'winner', caseSensitive: caseSensitive);
    });
  }
}

extension SyncConflictRecordQueryProperty
    on QueryBuilder<SyncConflictRecord, SyncConflictRecord, QQueryProperty> {
  QueryBuilder<SyncConflictRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations>
      directionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'direction');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations>
      entityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'entityId');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations>
      entityTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'entityType');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations>
      localDeviceIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'localDeviceId');
    });
  }

  QueryBuilder<SyncConflictRecord, int, QQueryOperations>
      localVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'localVersion');
    });
  }

  QueryBuilder<SyncConflictRecord, DateTime, QQueryOperations>
      occurredAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'occurredAt');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations>
      remoteDeviceIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remoteDeviceId');
    });
  }

  QueryBuilder<SyncConflictRecord, int, QQueryOperations>
      remoteVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remoteVersion');
    });
  }

  QueryBuilder<SyncConflictRecord, String, QQueryOperations> winnerProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'winner');
    });
  }
}
