// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_cursor_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetSyncCursorRecordCollection on Isar {
  IsarCollection<SyncCursorRecord> get syncCursorRecords => this.collection();
}

const SyncCursorRecordSchema = CollectionSchema(
  name: r'SyncCursorRecord',
  id: -3080938458615543600,
  properties: {
    r'entityType': PropertySchema(
      id: 0,
      name: r'entityType',
      type: IsarType.string,
    ),
    r'lastPulledAt': PropertySchema(
      id: 1,
      name: r'lastPulledAt',
      type: IsarType.dateTime,
    ),
    r'updatedAt': PropertySchema(
      id: 2,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _syncCursorRecordEstimateSize,
  serialize: _syncCursorRecordSerialize,
  deserialize: _syncCursorRecordDeserialize,
  deserializeProp: _syncCursorRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'entityType': IndexSchema(
      id: -5109706325448941117,
      name: r'entityType',
      unique: true,
      replace: true,
      properties: [
        IndexPropertySchema(
          name: r'entityType',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _syncCursorRecordGetId,
  getLinks: _syncCursorRecordGetLinks,
  attach: _syncCursorRecordAttach,
  version: '3.1.0+1',
);

int _syncCursorRecordEstimateSize(
  SyncCursorRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.entityType.length * 3;
  return bytesCount;
}

void _syncCursorRecordSerialize(
  SyncCursorRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.entityType);
  writer.writeDateTime(offsets[1], object.lastPulledAt);
  writer.writeDateTime(offsets[2], object.updatedAt);
}

SyncCursorRecord _syncCursorRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = SyncCursorRecord();
  object.entityType = reader.readString(offsets[0]);
  object.id = id;
  object.lastPulledAt = reader.readDateTime(offsets[1]);
  object.updatedAt = reader.readDateTime(offsets[2]);
  return object;
}

P _syncCursorRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readDateTime(offset)) as P;
    case 2:
      return (reader.readDateTime(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _syncCursorRecordGetId(SyncCursorRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _syncCursorRecordGetLinks(SyncCursorRecord object) {
  return [];
}

void _syncCursorRecordAttach(
    IsarCollection<dynamic> col, Id id, SyncCursorRecord object) {
  object.id = id;
}

extension SyncCursorRecordByIndex on IsarCollection<SyncCursorRecord> {
  Future<SyncCursorRecord?> getByEntityType(String entityType) {
    return getByIndex(r'entityType', [entityType]);
  }

  SyncCursorRecord? getByEntityTypeSync(String entityType) {
    return getByIndexSync(r'entityType', [entityType]);
  }

  Future<bool> deleteByEntityType(String entityType) {
    return deleteByIndex(r'entityType', [entityType]);
  }

  bool deleteByEntityTypeSync(String entityType) {
    return deleteByIndexSync(r'entityType', [entityType]);
  }

  Future<List<SyncCursorRecord?>> getAllByEntityType(
      List<String> entityTypeValues) {
    final values = entityTypeValues.map((e) => [e]).toList();
    return getAllByIndex(r'entityType', values);
  }

  List<SyncCursorRecord?> getAllByEntityTypeSync(
      List<String> entityTypeValues) {
    final values = entityTypeValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'entityType', values);
  }

  Future<int> deleteAllByEntityType(List<String> entityTypeValues) {
    final values = entityTypeValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'entityType', values);
  }

  int deleteAllByEntityTypeSync(List<String> entityTypeValues) {
    final values = entityTypeValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'entityType', values);
  }

  Future<Id> putByEntityType(SyncCursorRecord object) {
    return putByIndex(r'entityType', object);
  }

  Id putByEntityTypeSync(SyncCursorRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'entityType', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByEntityType(List<SyncCursorRecord> objects) {
    return putAllByIndex(r'entityType', objects);
  }

  List<Id> putAllByEntityTypeSync(List<SyncCursorRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'entityType', objects, saveLinks: saveLinks);
  }
}

extension SyncCursorRecordQueryWhereSort
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QWhere> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension SyncCursorRecordQueryWhere
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QWhereClause> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause>
      entityTypeEqualTo(String entityType) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'entityType',
        value: [entityType],
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterWhereClause>
      entityTypeNotEqualTo(String entityType) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'entityType',
              lower: [],
              upper: [entityType],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'entityType',
              lower: [entityType],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'entityType',
              lower: [entityType],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'entityType',
              lower: [],
              upper: [entityType],
              includeUpper: false,
            ));
      }
    });
  }
}

extension SyncCursorRecordQueryFilter
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QFilterCondition> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      entityTypeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'entityType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      entityTypeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'entityType',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      entityTypeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'entityType',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      entityTypeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'entityType',
        value: '',
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      lastPulledAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastPulledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      lastPulledAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastPulledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      lastPulledAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastPulledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      lastPulledAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastPulledAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      updatedAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      updatedAtGreaterThan(
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      updatedAtLessThan(
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

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterFilterCondition>
      updatedAtBetween(
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

extension SyncCursorRecordQueryObject
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QFilterCondition> {}

extension SyncCursorRecordQueryLinks
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QFilterCondition> {}

extension SyncCursorRecordQuerySortBy
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QSortBy> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByEntityType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByEntityTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.desc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByLastPulledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPulledAt', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByLastPulledAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPulledAt', Sort.desc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension SyncCursorRecordQuerySortThenBy
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QSortThenBy> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByEntityType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByEntityTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'entityType', Sort.desc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByLastPulledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPulledAt', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByLastPulledAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPulledAt', Sort.desc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QAfterSortBy>
      thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension SyncCursorRecordQueryWhereDistinct
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QDistinct> {
  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QDistinct>
      distinctByEntityType({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'entityType', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QDistinct>
      distinctByLastPulledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastPulledAt');
    });
  }

  QueryBuilder<SyncCursorRecord, SyncCursorRecord, QDistinct>
      distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension SyncCursorRecordQueryProperty
    on QueryBuilder<SyncCursorRecord, SyncCursorRecord, QQueryProperty> {
  QueryBuilder<SyncCursorRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<SyncCursorRecord, String, QQueryOperations>
      entityTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'entityType');
    });
  }

  QueryBuilder<SyncCursorRecord, DateTime, QQueryOperations>
      lastPulledAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastPulledAt');
    });
  }

  QueryBuilder<SyncCursorRecord, DateTime, QQueryOperations>
      updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
