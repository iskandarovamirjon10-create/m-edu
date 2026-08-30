// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'group_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetGroupRecordCollection on Isar {
  IsarCollection<GroupRecord> get groupRecords => this.collection();
}

const GroupRecordSchema = CollectionSchema(
  name: r'GroupRecord',
  id: -5470804770889049740,
  properties: {
    r'academicYear': PropertySchema(
      id: 0,
      name: r'academicYear',
      type: IsarType.string,
    ),
    r'capacity': PropertySchema(
      id: 1,
      name: r'capacity',
      type: IsarType.long,
    ),
    r'code': PropertySchema(
      id: 2,
      name: r'code',
      type: IsarType.string,
    ),
    r'currentSize': PropertySchema(
      id: 3,
      name: r'currentSize',
      type: IsarType.long,
    ),
    r'daysOfWeekJson': PropertySchema(
      id: 4,
      name: r'daysOfWeekJson',
      type: IsarType.string,
    ),
    r'endDate': PropertySchema(
      id: 5,
      name: r'endDate',
      type: IsarType.dateTime,
    ),
    r'endTime': PropertySchema(
      id: 6,
      name: r'endTime',
      type: IsarType.string,
    ),
    r'groupId': PropertySchema(
      id: 7,
      name: r'groupId',
      type: IsarType.string,
    ),
    r'monthlyFee': PropertySchema(
      id: 8,
      name: r'monthlyFee',
      type: IsarType.long,
    ),
    r'name': PropertySchema(
      id: 9,
      name: r'name',
      type: IsarType.string,
    ),
    r'notes': PropertySchema(
      id: 10,
      name: r'notes',
      type: IsarType.string,
    ),
    r'pendingSync': PropertySchema(
      id: 11,
      name: r'pendingSync',
      type: IsarType.bool,
    ),
    r'roomId': PropertySchema(
      id: 12,
      name: r'roomId',
      type: IsarType.string,
    ),
    r'roomName': PropertySchema(
      id: 13,
      name: r'roomName',
      type: IsarType.string,
    ),
    r'startDate': PropertySchema(
      id: 14,
      name: r'startDate',
      type: IsarType.dateTime,
    ),
    r'startTime': PropertySchema(
      id: 15,
      name: r'startTime',
      type: IsarType.string,
    ),
    r'status': PropertySchema(
      id: 16,
      name: r'status',
      type: IsarType.string,
    ),
    r'subject': PropertySchema(
      id: 17,
      name: r'subject',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 18,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'teacherId': PropertySchema(
      id: 19,
      name: r'teacherId',
      type: IsarType.string,
    ),
    r'teacherName': PropertySchema(
      id: 20,
      name: r'teacherName',
      type: IsarType.string,
    )
  },
  estimateSize: _groupRecordEstimateSize,
  serialize: _groupRecordSerialize,
  deserialize: _groupRecordDeserialize,
  deserializeProp: _groupRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'groupId': IndexSchema(
      id: -8523216633229774932,
      name: r'groupId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'groupId',
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
  getId: _groupRecordGetId,
  getLinks: _groupRecordGetLinks,
  attach: _groupRecordAttach,
  version: '3.1.0+1',
);

int _groupRecordEstimateSize(
  GroupRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.academicYear;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.code;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.daysOfWeekJson;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.endTime;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.groupId.length * 3;
  bytesCount += 3 + object.name.length * 3;
  {
    final value = object.notes;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.roomId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.roomName;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.startTime;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.status.length * 3;
  {
    final value = object.subject;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.teacherId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.teacherName;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  return bytesCount;
}

void _groupRecordSerialize(
  GroupRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.academicYear);
  writer.writeLong(offsets[1], object.capacity);
  writer.writeString(offsets[2], object.code);
  writer.writeLong(offsets[3], object.currentSize);
  writer.writeString(offsets[4], object.daysOfWeekJson);
  writer.writeDateTime(offsets[5], object.endDate);
  writer.writeString(offsets[6], object.endTime);
  writer.writeString(offsets[7], object.groupId);
  writer.writeLong(offsets[8], object.monthlyFee);
  writer.writeString(offsets[9], object.name);
  writer.writeString(offsets[10], object.notes);
  writer.writeBool(offsets[11], object.pendingSync);
  writer.writeString(offsets[12], object.roomId);
  writer.writeString(offsets[13], object.roomName);
  writer.writeDateTime(offsets[14], object.startDate);
  writer.writeString(offsets[15], object.startTime);
  writer.writeString(offsets[16], object.status);
  writer.writeString(offsets[17], object.subject);
  writer.writeLong(offsets[18], object.syncVersion);
  writer.writeString(offsets[19], object.teacherId);
  writer.writeString(offsets[20], object.teacherName);
}

GroupRecord _groupRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = GroupRecord();
  object.academicYear = reader.readStringOrNull(offsets[0]);
  object.capacity = reader.readLong(offsets[1]);
  object.code = reader.readStringOrNull(offsets[2]);
  object.currentSize = reader.readLong(offsets[3]);
  object.daysOfWeekJson = reader.readStringOrNull(offsets[4]);
  object.endDate = reader.readDateTimeOrNull(offsets[5]);
  object.endTime = reader.readStringOrNull(offsets[6]);
  object.groupId = reader.readString(offsets[7]);
  object.id = id;
  object.monthlyFee = reader.readLong(offsets[8]);
  object.name = reader.readString(offsets[9]);
  object.notes = reader.readStringOrNull(offsets[10]);
  object.pendingSync = reader.readBool(offsets[11]);
  object.roomId = reader.readStringOrNull(offsets[12]);
  object.roomName = reader.readStringOrNull(offsets[13]);
  object.startDate = reader.readDateTimeOrNull(offsets[14]);
  object.startTime = reader.readStringOrNull(offsets[15]);
  object.status = reader.readString(offsets[16]);
  object.subject = reader.readStringOrNull(offsets[17]);
  object.syncVersion = reader.readLong(offsets[18]);
  object.teacherId = reader.readStringOrNull(offsets[19]);
  object.teacherName = reader.readStringOrNull(offsets[20]);
  return object;
}

P _groupRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readStringOrNull(offset)) as P;
    case 1:
      return (reader.readLong(offset)) as P;
    case 2:
      return (reader.readStringOrNull(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 6:
      return (reader.readStringOrNull(offset)) as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readLong(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (reader.readStringOrNull(offset)) as P;
    case 11:
      return (reader.readBool(offset)) as P;
    case 12:
      return (reader.readStringOrNull(offset)) as P;
    case 13:
      return (reader.readStringOrNull(offset)) as P;
    case 14:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 15:
      return (reader.readStringOrNull(offset)) as P;
    case 16:
      return (reader.readString(offset)) as P;
    case 17:
      return (reader.readStringOrNull(offset)) as P;
    case 18:
      return (reader.readLong(offset)) as P;
    case 19:
      return (reader.readStringOrNull(offset)) as P;
    case 20:
      return (reader.readStringOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _groupRecordGetId(GroupRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _groupRecordGetLinks(GroupRecord object) {
  return [];
}

void _groupRecordAttach(
    IsarCollection<dynamic> col, Id id, GroupRecord object) {
  object.id = id;
}

extension GroupRecordByIndex on IsarCollection<GroupRecord> {
  Future<GroupRecord?> getByGroupId(String groupId) {
    return getByIndex(r'groupId', [groupId]);
  }

  GroupRecord? getByGroupIdSync(String groupId) {
    return getByIndexSync(r'groupId', [groupId]);
  }

  Future<bool> deleteByGroupId(String groupId) {
    return deleteByIndex(r'groupId', [groupId]);
  }

  bool deleteByGroupIdSync(String groupId) {
    return deleteByIndexSync(r'groupId', [groupId]);
  }

  Future<List<GroupRecord?>> getAllByGroupId(List<String> groupIdValues) {
    final values = groupIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'groupId', values);
  }

  List<GroupRecord?> getAllByGroupIdSync(List<String> groupIdValues) {
    final values = groupIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'groupId', values);
  }

  Future<int> deleteAllByGroupId(List<String> groupIdValues) {
    final values = groupIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'groupId', values);
  }

  int deleteAllByGroupIdSync(List<String> groupIdValues) {
    final values = groupIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'groupId', values);
  }

  Future<Id> putByGroupId(GroupRecord object) {
    return putByIndex(r'groupId', object);
  }

  Id putByGroupIdSync(GroupRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'groupId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByGroupId(List<GroupRecord> objects) {
    return putAllByIndex(r'groupId', objects);
  }

  List<Id> putAllByGroupIdSync(List<GroupRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'groupId', objects, saveLinks: saveLinks);
  }
}

extension GroupRecordQueryWhereSort
    on QueryBuilder<GroupRecord, GroupRecord, QWhere> {
  QueryBuilder<GroupRecord, GroupRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension GroupRecordQueryWhere
    on QueryBuilder<GroupRecord, GroupRecord, QWhereClause> {
  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> idGreaterThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> idLessThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> groupIdEqualTo(
      String groupId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [groupId],
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> groupIdNotEqualTo(
      String groupId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'groupId',
              lower: [],
              upper: [groupId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'groupId',
              lower: [groupId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'groupId',
              lower: [groupId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'groupId',
              lower: [],
              upper: [groupId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> statusEqualTo(
      String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterWhereClause> statusNotEqualTo(
      String status) {
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

extension GroupRecordQueryFilter
    on QueryBuilder<GroupRecord, GroupRecord, QFilterCondition> {
  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'academicYear',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'academicYear',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'academicYear',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'academicYear',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'academicYear',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      academicYearIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'academicYear',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> capacityEqualTo(
      int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'capacity',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      capacityGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'capacity',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      capacityLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'capacity',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> capacityBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'capacity',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'code',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      codeIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'code',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'code',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'code',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'code',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> codeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'code',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      codeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'code',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      currentSizeEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'currentSize',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      currentSizeGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'currentSize',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      currentSizeLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'currentSize',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      currentSizeBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'currentSize',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'daysOfWeekJson',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'daysOfWeekJson',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'daysOfWeekJson',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'daysOfWeekJson',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'daysOfWeekJson',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'daysOfWeekJson',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      daysOfWeekJsonIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'daysOfWeekJson',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'endDate',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'endDate',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endDateEqualTo(
      DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'endDate',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endDateLessThan(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endDateBetween(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'endTime',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'endTime',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'endTime',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'endTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> endTimeMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'endTime',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'endTime',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      endTimeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'endTime',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      groupIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'groupId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      groupIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> groupIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      groupIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      groupIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> idGreaterThan(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      monthlyFeeEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'monthlyFee',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      monthlyFeeGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'monthlyFee',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      monthlyFeeLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'monthlyFee',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      monthlyFeeBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'monthlyFee',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'name',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'name',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'name',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'name',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesEqualTo(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesLessThan(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesBetween(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesStartsWith(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesEndsWith(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'notes',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      pendingSyncEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pendingSync',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'roomId',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'roomId',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'roomId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'roomId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'roomId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'roomId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'roomId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'roomName',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'roomName',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomNameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'roomName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'roomName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> roomNameMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'roomName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'roomName',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      roomNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'roomName',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'startDate',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'startDate',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'startDate',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'startTime',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'startTime',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'startTime',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'startTime',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'startTime',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'startTime',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      startTimeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'startTime',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusEqualTo(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusLessThan(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusBetween(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusEndsWith(
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> statusMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'subject',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'subject',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'subject',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition> subjectMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'subject',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'subject',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      subjectIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'subject',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
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

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'teacherId',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'teacherId',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'teacherId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'teacherId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'teacherId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'teacherId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'teacherId',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'teacherName',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'teacherName',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'teacherName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'teacherName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'teacherName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'teacherName',
        value: '',
      ));
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterFilterCondition>
      teacherNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'teacherName',
        value: '',
      ));
    });
  }
}

extension GroupRecordQueryObject
    on QueryBuilder<GroupRecord, GroupRecord, QFilterCondition> {}

extension GroupRecordQueryLinks
    on QueryBuilder<GroupRecord, GroupRecord, QFilterCondition> {}

extension GroupRecordQuerySortBy
    on QueryBuilder<GroupRecord, GroupRecord, QSortBy> {
  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByAcademicYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy>
      sortByAcademicYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCapacity() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'capacity', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCapacityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'capacity', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'code', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'code', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCurrentSize() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'currentSize', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByCurrentSizeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'currentSize', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByDaysOfWeekJson() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'daysOfWeekJson', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy>
      sortByDaysOfWeekJsonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'daysOfWeekJson', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByEndDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByEndTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endTime', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByEndTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endTime', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByMonthlyFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'monthlyFee', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByMonthlyFeeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'monthlyFee', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByRoomId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByRoomIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByRoomName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomName', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByRoomNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomName', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStartTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStartTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortBySubject() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subject', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortBySubjectDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subject', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByTeacherId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByTeacherIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByTeacherName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherName', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> sortByTeacherNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherName', Sort.desc);
    });
  }
}

extension GroupRecordQuerySortThenBy
    on QueryBuilder<GroupRecord, GroupRecord, QSortThenBy> {
  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByAcademicYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy>
      thenByAcademicYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCapacity() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'capacity', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCapacityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'capacity', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'code', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'code', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCurrentSize() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'currentSize', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByCurrentSizeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'currentSize', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByDaysOfWeekJson() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'daysOfWeekJson', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy>
      thenByDaysOfWeekJsonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'daysOfWeekJson', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByEndDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endDate', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByEndTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endTime', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByEndTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'endTime', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByMonthlyFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'monthlyFee', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByMonthlyFeeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'monthlyFee', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByRoomId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByRoomIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByRoomName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomName', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByRoomNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'roomName', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startDate', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStartTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStartTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenBySubject() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subject', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenBySubjectDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subject', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByTeacherId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherId', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByTeacherIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherId', Sort.desc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByTeacherName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherName', Sort.asc);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QAfterSortBy> thenByTeacherNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'teacherName', Sort.desc);
    });
  }
}

extension GroupRecordQueryWhereDistinct
    on QueryBuilder<GroupRecord, GroupRecord, QDistinct> {
  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByAcademicYear(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'academicYear', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByCapacity() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'capacity');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByCode(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'code', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByCurrentSize() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'currentSize');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByDaysOfWeekJson(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'daysOfWeekJson',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByEndDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'endDate');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByEndTime(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'endTime', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByGroupId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByMonthlyFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'monthlyFee');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'name', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pendingSync');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByRoomId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'roomId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByRoomName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'roomName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'startDate');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByStartTime(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'startTime', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctBySubject(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'subject', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByTeacherId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'teacherId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<GroupRecord, GroupRecord, QDistinct> distinctByTeacherName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'teacherName', caseSensitive: caseSensitive);
    });
  }
}

extension GroupRecordQueryProperty
    on QueryBuilder<GroupRecord, GroupRecord, QQueryProperty> {
  QueryBuilder<GroupRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> academicYearProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'academicYear');
    });
  }

  QueryBuilder<GroupRecord, int, QQueryOperations> capacityProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'capacity');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> codeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'code');
    });
  }

  QueryBuilder<GroupRecord, int, QQueryOperations> currentSizeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'currentSize');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations>
      daysOfWeekJsonProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'daysOfWeekJson');
    });
  }

  QueryBuilder<GroupRecord, DateTime?, QQueryOperations> endDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'endDate');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> endTimeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'endTime');
    });
  }

  QueryBuilder<GroupRecord, String, QQueryOperations> groupIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupId');
    });
  }

  QueryBuilder<GroupRecord, int, QQueryOperations> monthlyFeeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'monthlyFee');
    });
  }

  QueryBuilder<GroupRecord, String, QQueryOperations> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'name');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<GroupRecord, bool, QQueryOperations> pendingSyncProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pendingSync');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> roomIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'roomId');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> roomNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'roomName');
    });
  }

  QueryBuilder<GroupRecord, DateTime?, QQueryOperations> startDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'startDate');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> startTimeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'startTime');
    });
  }

  QueryBuilder<GroupRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> subjectProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'subject');
    });
  }

  QueryBuilder<GroupRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> teacherIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'teacherId');
    });
  }

  QueryBuilder<GroupRecord, String?, QQueryOperations> teacherNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'teacherName');
    });
  }
}
