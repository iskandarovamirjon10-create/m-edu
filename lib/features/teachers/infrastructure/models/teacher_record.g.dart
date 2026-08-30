// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teacher_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetTeacherRecordCollection on Isar {
  IsarCollection<TeacherRecord> get teacherRecords => this.collection();
}

const TeacherRecordSchema = CollectionSchema(
  name: r'TeacherRecord',
  id: 2493506446448265481,
  properties: {
    r'assignedGroupIdsJson': PropertySchema(
      id: 0,
      name: r'assignedGroupIdsJson',
      type: IsarType.string,
    ),
    r'endDate': PropertySchema(
      id: 1,
      name: r'endDate',
      type: IsarType.dateTime,
    ),
    r'identityId': PropertySchema(
      id: 2,
      name: r'identityId',
      type: IsarType.string,
    ),
    r'maxWeeklyHours': PropertySchema(
      id: 3,
      name: r'maxWeeklyHours',
      type: IsarType.long,
    ),
    r'notes': PropertySchema(
      id: 4,
      name: r'notes',
      type: IsarType.string,
    ),
    r'pendingSync': PropertySchema(
      id: 5,
      name: r'pendingSync',
      type: IsarType.bool,
    ),
    r'salary': PropertySchema(
      id: 6,
      name: r'salary',
      type: IsarType.long,
    ),
    r'specialization': PropertySchema(
      id: 7,
      name: r'specialization',
      type: IsarType.string,
    ),
    r'startDate': PropertySchema(
      id: 8,
      name: r'startDate',
      type: IsarType.dateTime,
    ),
    r'status': PropertySchema(
      id: 9,
      name: r'status',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 10,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'teacherNumber': PropertySchema(
      id: 11,
      name: r'teacherNumber',
      type: IsarType.long,
    ),
    r'weeklyHours': PropertySchema(
      id: 12,
      name: r'weeklyHours',
      type: IsarType.long,
    )
  },
  estimateSize: _teacherRecordEstimateSize,
  serialize: _teacherRecordSerialize,
  deserialize: _teacherRecordDeserialize,
  deserializeProp: _teacherRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'identityId': IndexSchema(
      id: 1738616051568895492,
      name: r'identityId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'identityId',
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
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _teacherRecordGetId,
  getLinks: _teacherRecordGetLinks,
  attach: _teacherRecordAttach,
  version: '3.1.0+1',
);

int _teacherRecordEstimateSize(
  TeacherRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.assignedGroupIdsJson;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.identityId.length * 3;
  {
    final value = object.notes;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.specialization;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.status.length * 3;
  return bytesCount;
}

void _teacherRecordSerialize(
  TeacherRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.assignedGroupIdsJson);
  writer.writeDateTime(offsets[1], object.endDate);
  writer.writeString(offsets[2], object.identityId);
  writer.writeLong(offsets[3], object.maxWeeklyHours);
  writer.writeString(offsets[4], object.notes);
  writer.writeBool(offsets[5], object.pendingSync);
  writer.writeLong(offsets[6], object.salary);
  writer.writeString(offsets[7], object.specialization);
  writer.writeDateTime(offsets[8], object.startDate);
  writer.writeString(offsets[9], object.status);
  writer.writeLong(offsets[10], object.syncVersion);
  writer.writeLong(offsets[11], object.teacherNumber);
  writer.writeLong(offsets[12], object.weeklyHours);
}

TeacherRecord _teacherRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = TeacherRecord();
  object.assignedGroupIdsJson = reader.readStringOrNull(offsets[0]);
  object.endDate = reader.readDateTimeOrNull(offsets[1]);
  object.id = id;
  object.identityId = reader.readString(offsets[2]);
  object.maxWeeklyHours = reader.readLong(offsets[3]);
  object.notes = reader.readStringOrNull(offsets[4]);
  object.pendingSync = reader.readBool(offsets[5]);
  object.salary = reader.readLong(offsets[6]);
  object.specialization = reader.readStringOrNull(offsets[7]);
  object.startDate = reader.readDateTimeOrNull(offsets[8]);
  object.status = reader.readString(offsets[9]);
  object.syncVersion = reader.readLong(offsets[10]);
  object.teacherNumber = reader.readLong(offsets[11]);
  object.weeklyHours = reader.readLong(offsets[12]);
  return object;
}

P _teacherRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readStringOrNull(offset)) as P;
    case 1:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readBool(offset)) as P;
    case 6:
      return (reader.readLong(offset)) as P;
    case 7:
      return (reader.readStringOrNull(offset)) as P;
    case 8:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (reader.readLong(offset)) as P;
    case 11:
      return (reader.readLong(offset)) as P;
    case 12:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _teacherRecordGetId(TeacherRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _teacherRecordGetLinks(TeacherRecord object) {
  return [];
}

void _teacherRecordAttach(
    IsarCollection<dynamic> col, Id id, TeacherRecord object) {
  object.id = id;
}

extension TeacherRecordByIndex on IsarCollection<TeacherRecord> {
  Future<TeacherRecord?> getByIdentityId(String identityId) {
    return getByIndex(r'identityId', [identityId]);
  }

  TeacherRecord? getByIdentityIdSync(String identityId) {
    return getByIndexSync(r'identityId', [identityId]);
  }

  Future<bool> deleteByIdentityId(String identityId) {
    return deleteByIndex(r'identityId', [identityId]);
  }

  bool deleteByIdentityIdSync(String identityId) {
    return deleteByIndexSync(r'identityId', [identityId]);
  }

  Future<List<TeacherRecord?>> getAllByIdentityId(
      List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'identityId', values);
  }

  List<TeacherRecord?> getAllByIdentityIdSync(List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'identityId', values);
  }

  Future<int> deleteAllByIdentityId(List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'identityId', values);
  }

  int deleteAllByIdentityIdSync(List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'identityId', values);
  }

  Future<Id> putByIdentityId(TeacherRecord object) {
    return putByIndex(r'identityId', object);
  }

  Id putByIdentityIdSync(TeacherRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'identityId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByIdentityId(List<TeacherRecord> objects) {
    return putAllByIndex(r'identityId', objects);
  }

  List<Id> putAllByIdentityIdSync(List<TeacherRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'identityId', objects, saveLinks: saveLinks);
  }
}

extension TeacherRecordQueryWhereSort
    on QueryBuilder<TeacherRecord, TeacherRecord, QWhere> {
  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension TeacherRecordQueryWhere
    on QueryBuilder<TeacherRecord, TeacherRecord, QWhereClause> {
  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause>
      identityIdEqualTo(String identityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'identityId',
        value: [identityId],
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause>
      identityIdNotEqualTo(String identityId) {
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause> statusEqualTo(
      String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterWhereClause>
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
}

extension TeacherRecordQueryFilter
    on QueryBuilder<TeacherRecord, TeacherRecord, QFilterCondition> {
  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'assignedGroupIdsJson',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'assignedGroupIdsJson',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'assignedGroupIdsJson',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'assignedGroupIdsJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'assignedGroupIdsJson',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedGroupIdsJson',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      assignedGroupIdsJsonIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'assignedGroupIdsJson',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'endDate',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'endDate',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'endDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'endDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'endDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      endDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'endDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdEqualTo(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdGreaterThan(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdLessThan(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdBetween(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdStartsWith(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdEndsWith(
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'identityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      identityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      maxWeeklyHoursEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'maxWeeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      maxWeeklyHoursGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'maxWeeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      maxWeeklyHoursLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'maxWeeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      maxWeeklyHoursBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'maxWeeklyHours',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'notes',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'notes',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      pendingSyncEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pendingSync',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      salaryEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'salary',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      salaryGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'salary',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      salaryLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'salary',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      salaryBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'salary',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'specialization',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'specialization',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'specialization',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'specialization',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'specialization',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'specialization',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      specializationIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'specialization',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'startDate',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'startDate',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'startDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'startDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'startDate',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      startDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'startDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
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

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      statusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      statusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      syncVersionGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      syncVersionLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      syncVersionBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'syncVersion',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      teacherNumberEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'teacherNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      teacherNumberGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'teacherNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      teacherNumberLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'teacherNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      teacherNumberBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'teacherNumber',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      weeklyHoursEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'weeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      weeklyHoursGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'weeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      weeklyHoursLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'weeklyHours',
        value: value,
      ));
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterFilterCondition>
      weeklyHoursBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'weeklyHours',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension TeacherRecordQueryObject
    on QueryBuilder<TeacherRecord, TeacherRecord, QFilterCondition> {}

extension TeacherRecordQueryLinks
    on QueryBuilder<TeacherRecord, TeacherRecord, QFilterCondition> {}

extension TeacherRecordQuerySortBy
    on QueryBuilder<TeacherRecord, TeacherRecord, QSortBy> {
  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByAssignedGroupIdsJson() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedGroupIdsJson', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByAssignedGroupIdsJsonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedGroupIdsJson', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByEndDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByMaxWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'maxWeeklyHours', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByMaxWeeklyHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'maxWeeklyHours', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortBySalary() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'salary', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortBySalaryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'salary', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortBySpecialization() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'specialization', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortBySpecializationDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'specialization', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByTeacherNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherNumber', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByTeacherNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherNumber', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> sortByWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'weeklyHours', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      sortByWeeklyHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'weeklyHours', Sort.desc);
    });
  }
}

extension TeacherRecordQuerySortThenBy
    on QueryBuilder<TeacherRecord, TeacherRecord, QSortThenBy> {
  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByAssignedGroupIdsJson() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedGroupIdsJson', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByAssignedGroupIdsJsonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedGroupIdsJson', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByEndDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByMaxWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'maxWeeklyHours', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByMaxWeeklyHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'maxWeeklyHours', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenBySalary() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'salary', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenBySalaryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'salary', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenBySpecialization() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'specialization', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenBySpecializationDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'specialization', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByTeacherNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherNumber', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByTeacherNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherNumber', Sort.desc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy> thenByWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'weeklyHours', Sort.asc);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QAfterSortBy>
      thenByWeeklyHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'weeklyHours', Sort.desc);
    });
  }
}

extension TeacherRecordQueryWhereDistinct
    on QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> {
  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctByAssignedGroupIdsJson({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'assignedGroupIdsJson',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'endDate');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctByIdentityId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'identityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctByMaxWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'maxWeeklyHours');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pendingSync');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctBySalary() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'salary');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctBySpecialization({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'specialization',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'startDate');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct> distinctByStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctByTeacherNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'teacherNumber');
    });
  }

  QueryBuilder<TeacherRecord, TeacherRecord, QDistinct>
      distinctByWeeklyHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'weeklyHours');
    });
  }
}

extension TeacherRecordQueryProperty
    on QueryBuilder<TeacherRecord, TeacherRecord, QQueryProperty> {
  QueryBuilder<TeacherRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<TeacherRecord, String?, QQueryOperations>
      assignedGroupIdsJsonProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'assignedGroupIdsJson');
    });
  }

  QueryBuilder<TeacherRecord, DateTime?, QQueryOperations> endDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'endDate');
    });
  }

  QueryBuilder<TeacherRecord, String, QQueryOperations> identityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'identityId');
    });
  }

  QueryBuilder<TeacherRecord, int, QQueryOperations> maxWeeklyHoursProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'maxWeeklyHours');
    });
  }

  QueryBuilder<TeacherRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<TeacherRecord, bool, QQueryOperations> pendingSyncProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pendingSync');
    });
  }

  QueryBuilder<TeacherRecord, int, QQueryOperations> salaryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'salary');
    });
  }

  QueryBuilder<TeacherRecord, String?, QQueryOperations>
      specializationProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'specialization');
    });
  }

  QueryBuilder<TeacherRecord, DateTime?, QQueryOperations> startDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'startDate');
    });
  }

  QueryBuilder<TeacherRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<TeacherRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<TeacherRecord, int, QQueryOperations> teacherNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'teacherNumber');
    });
  }

  QueryBuilder<TeacherRecord, int, QQueryOperations> weeklyHoursProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'weeklyHours');
    });
  }
}
