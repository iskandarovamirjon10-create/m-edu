// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetStudentRecordCollection on Isar {
  IsarCollection<StudentRecord> get studentRecords => this.collection();
}

const StudentRecordSchema = CollectionSchema(
  name: r'StudentRecord',
  id: 8613560644430267955,
  properties: {
    r'academicYear': PropertySchema(
      id: 0,
      name: r'academicYear',
      type: IsarType.string,
    ),
    r'assignedAt': PropertySchema(
      id: 1,
      name: r'assignedAt',
      type: IsarType.dateTime,
    ),
    r'attendancePercentage': PropertySchema(
      id: 2,
      name: r'attendancePercentage',
      type: IsarType.double,
    ),
    r'completedAt': PropertySchema(
      id: 3,
      name: r'completedAt',
      type: IsarType.dateTime,
    ),
    r'enrolledAt': PropertySchema(
      id: 4,
      name: r'enrolledAt',
      type: IsarType.dateTime,
    ),
    r'groupId': PropertySchema(
      id: 5,
      name: r'groupId',
      type: IsarType.string,
    ),
    r'groupName': PropertySchema(
      id: 6,
      name: r'groupName',
      type: IsarType.string,
    ),
    r'identityId': PropertySchema(
      id: 7,
      name: r'identityId',
      type: IsarType.string,
    ),
    r'lastPaymentDate': PropertySchema(
      id: 8,
      name: r'lastPaymentDate',
      type: IsarType.dateTime,
    ),
    r'notes': PropertySchema(
      id: 9,
      name: r'notes',
      type: IsarType.string,
    ),
    r'parentId': PropertySchema(
      id: 10,
      name: r'parentId',
      type: IsarType.string,
    ),
    r'parentName': PropertySchema(
      id: 11,
      name: r'parentName',
      type: IsarType.string,
    ),
    r'parentPhone': PropertySchema(
      id: 12,
      name: r'parentPhone',
      type: IsarType.string,
    ),
    r'parentTelegramId': PropertySchema(
      id: 13,
      name: r'parentTelegramId',
      type: IsarType.string,
    ),
    r'paymentStatus': PropertySchema(
      id: 14,
      name: r'paymentStatus',
      type: IsarType.bool,
    ),
    r'pendingSync': PropertySchema(
      id: 15,
      name: r'pendingSync',
      type: IsarType.bool,
    ),
    r'studentNumber': PropertySchema(
      id: 16,
      name: r'studentNumber',
      type: IsarType.long,
    ),
    r'studentStatus': PropertySchema(
      id: 17,
      name: r'studentStatus',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 18,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'totalPaid': PropertySchema(
      id: 19,
      name: r'totalPaid',
      type: IsarType.long,
    ),
    r'transferStatus': PropertySchema(
      id: 20,
      name: r'transferStatus',
      type: IsarType.string,
    ),
    r'transferToGroupId': PropertySchema(
      id: 21,
      name: r'transferToGroupId',
      type: IsarType.string,
    )
  },
  estimateSize: _studentRecordEstimateSize,
  serialize: _studentRecordSerialize,
  deserialize: _studentRecordDeserialize,
  deserializeProp: _studentRecordDeserializeProp,
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
    r'groupId': IndexSchema(
      id: -8523216633229774932,
      name: r'groupId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'groupId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'studentStatus': IndexSchema(
      id: 3076932318372651913,
      name: r'studentStatus',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'studentStatus',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _studentRecordGetId,
  getLinks: _studentRecordGetLinks,
  attach: _studentRecordAttach,
  version: '3.1.0+1',
);

int _studentRecordEstimateSize(
  StudentRecord object,
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
    final value = object.groupId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.groupName;
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
    final value = object.parentId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.parentName;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.parentPhone;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.parentTelegramId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.studentStatus.length * 3;
  bytesCount += 3 + object.transferStatus.length * 3;
  {
    final value = object.transferToGroupId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  return bytesCount;
}

void _studentRecordSerialize(
  StudentRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.academicYear);
  writer.writeDateTime(offsets[1], object.assignedAt);
  writer.writeDouble(offsets[2], object.attendancePercentage);
  writer.writeDateTime(offsets[3], object.completedAt);
  writer.writeDateTime(offsets[4], object.enrolledAt);
  writer.writeString(offsets[5], object.groupId);
  writer.writeString(offsets[6], object.groupName);
  writer.writeString(offsets[7], object.identityId);
  writer.writeDateTime(offsets[8], object.lastPaymentDate);
  writer.writeString(offsets[9], object.notes);
  writer.writeString(offsets[10], object.parentId);
  writer.writeString(offsets[11], object.parentName);
  writer.writeString(offsets[12], object.parentPhone);
  writer.writeString(offsets[13], object.parentTelegramId);
  writer.writeBool(offsets[14], object.paymentStatus);
  writer.writeBool(offsets[15], object.pendingSync);
  writer.writeLong(offsets[16], object.studentNumber);
  writer.writeString(offsets[17], object.studentStatus);
  writer.writeLong(offsets[18], object.syncVersion);
  writer.writeLong(offsets[19], object.totalPaid);
  writer.writeString(offsets[20], object.transferStatus);
  writer.writeString(offsets[21], object.transferToGroupId);
}

StudentRecord _studentRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = StudentRecord();
  object.academicYear = reader.readStringOrNull(offsets[0]);
  object.assignedAt = reader.readDateTimeOrNull(offsets[1]);
  object.attendancePercentage = reader.readDouble(offsets[2]);
  object.completedAt = reader.readDateTimeOrNull(offsets[3]);
  object.enrolledAt = reader.readDateTime(offsets[4]);
  object.groupId = reader.readStringOrNull(offsets[5]);
  object.groupName = reader.readStringOrNull(offsets[6]);
  object.id = id;
  object.identityId = reader.readString(offsets[7]);
  object.lastPaymentDate = reader.readDateTimeOrNull(offsets[8]);
  object.notes = reader.readStringOrNull(offsets[9]);
  object.parentId = reader.readStringOrNull(offsets[10]);
  object.parentName = reader.readStringOrNull(offsets[11]);
  object.parentPhone = reader.readStringOrNull(offsets[12]);
  object.parentTelegramId = reader.readStringOrNull(offsets[13]);
  object.paymentStatus = reader.readBool(offsets[14]);
  object.pendingSync = reader.readBool(offsets[15]);
  object.studentNumber = reader.readLong(offsets[16]);
  object.studentStatus = reader.readString(offsets[17]);
  object.syncVersion = reader.readLong(offsets[18]);
  object.totalPaid = reader.readLong(offsets[19]);
  object.transferStatus = reader.readString(offsets[20]);
  object.transferToGroupId = reader.readStringOrNull(offsets[21]);
  return object;
}

P _studentRecordDeserializeProp<P>(
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
      return (reader.readDouble(offset)) as P;
    case 3:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 4:
      return (reader.readDateTime(offset)) as P;
    case 5:
      return (reader.readStringOrNull(offset)) as P;
    case 6:
      return (reader.readStringOrNull(offset)) as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 9:
      return (reader.readStringOrNull(offset)) as P;
    case 10:
      return (reader.readStringOrNull(offset)) as P;
    case 11:
      return (reader.readStringOrNull(offset)) as P;
    case 12:
      return (reader.readStringOrNull(offset)) as P;
    case 13:
      return (reader.readStringOrNull(offset)) as P;
    case 14:
      return (reader.readBool(offset)) as P;
    case 15:
      return (reader.readBool(offset)) as P;
    case 16:
      return (reader.readLong(offset)) as P;
    case 17:
      return (reader.readString(offset)) as P;
    case 18:
      return (reader.readLong(offset)) as P;
    case 19:
      return (reader.readLong(offset)) as P;
    case 20:
      return (reader.readString(offset)) as P;
    case 21:
      return (reader.readStringOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _studentRecordGetId(StudentRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _studentRecordGetLinks(StudentRecord object) {
  return [];
}

void _studentRecordAttach(
    IsarCollection<dynamic> col, Id id, StudentRecord object) {
  object.id = id;
}

extension StudentRecordByIndex on IsarCollection<StudentRecord> {
  Future<StudentRecord?> getByIdentityId(String identityId) {
    return getByIndex(r'identityId', [identityId]);
  }

  StudentRecord? getByIdentityIdSync(String identityId) {
    return getByIndexSync(r'identityId', [identityId]);
  }

  Future<bool> deleteByIdentityId(String identityId) {
    return deleteByIndex(r'identityId', [identityId]);
  }

  bool deleteByIdentityIdSync(String identityId) {
    return deleteByIndexSync(r'identityId', [identityId]);
  }

  Future<List<StudentRecord?>> getAllByIdentityId(
      List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'identityId', values);
  }

  List<StudentRecord?> getAllByIdentityIdSync(List<String> identityIdValues) {
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

  Future<Id> putByIdentityId(StudentRecord object) {
    return putByIndex(r'identityId', object);
  }

  Id putByIdentityIdSync(StudentRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'identityId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByIdentityId(List<StudentRecord> objects) {
    return putAllByIndex(r'identityId', objects);
  }

  List<Id> putAllByIdentityIdSync(List<StudentRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'identityId', objects, saveLinks: saveLinks);
  }
}

extension StudentRecordQueryWhereSort
    on QueryBuilder<StudentRecord, StudentRecord, QWhere> {
  QueryBuilder<StudentRecord, StudentRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension StudentRecordQueryWhere
    on QueryBuilder<StudentRecord, StudentRecord, QWhereClause> {
  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      identityIdEqualTo(String identityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'identityId',
        value: [identityId],
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [null],
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      groupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'groupId',
        lower: [null],
        includeLower: false,
        upper: [],
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause> groupIdEqualTo(
      String? groupId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [groupId],
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      groupIdNotEqualTo(String? groupId) {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      studentStatusEqualTo(String studentStatus) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'studentStatus',
        value: [studentStatus],
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterWhereClause>
      studentStatusNotEqualTo(String studentStatus) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentStatus',
              lower: [],
              upper: [studentStatus],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentStatus',
              lower: [studentStatus],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentStatus',
              lower: [studentStatus],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentStatus',
              lower: [],
              upper: [studentStatus],
              includeUpper: false,
            ));
      }
    });
  }
}

extension StudentRecordQueryFilter
    on QueryBuilder<StudentRecord, StudentRecord, QFilterCondition> {
  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'academicYear',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'academicYear',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'academicYear',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'academicYear',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'academicYear',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      academicYearIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'academicYear',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'assignedAt',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'assignedAt',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'assignedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'assignedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      assignedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'assignedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      attendancePercentageEqualTo(
    double value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'attendancePercentage',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      attendancePercentageGreaterThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'attendancePercentage',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      attendancePercentageLessThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'attendancePercentage',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      attendancePercentageBetween(
    double lower,
    double upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'attendancePercentage',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'completedAt',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'completedAt',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'completedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'completedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'completedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      completedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'completedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      enrolledAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'enrolledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      enrolledAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'enrolledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      enrolledAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'enrolledAt',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      enrolledAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'enrolledAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdEqualTo(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdGreaterThan(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdLessThan(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdEndsWith(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'groupName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      groupNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      identityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      identityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'identityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      identityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      identityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lastPaymentDate',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lastPaymentDate',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastPaymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastPaymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastPaymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      lastPaymentDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastPaymentDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'notes',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'parentId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'parentId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdEqualTo(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdGreaterThan(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdLessThan(
    String? value, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdStartsWith(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdEndsWith(
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'parentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'parentId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'parentId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'parentName',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'parentName',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'parentName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'parentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'parentName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentName',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'parentName',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'parentPhone',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'parentPhone',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'parentPhone',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'parentPhone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'parentPhone',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentPhone',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentPhoneIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'parentPhone',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'parentTelegramId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'parentTelegramId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'parentTelegramId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'parentTelegramId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'parentTelegramId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'parentTelegramId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      parentTelegramIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'parentTelegramId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      paymentStatusEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentStatus',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      pendingSyncEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pendingSync',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentNumberEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentNumberGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentNumberLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentNumberBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentNumber',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentStatus',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentStatus',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentStatus',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      studentStatusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentStatus',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
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

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      totalPaidEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'totalPaid',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      totalPaidGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'totalPaid',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      totalPaidLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'totalPaid',
        value: value,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      totalPaidBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'totalPaid',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'transferStatus',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'transferStatus',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'transferStatus',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'transferStatus',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferStatusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'transferStatus',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'transferToGroupId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'transferToGroupId',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'transferToGroupId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'transferToGroupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'transferToGroupId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'transferToGroupId',
        value: '',
      ));
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterFilterCondition>
      transferToGroupIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'transferToGroupId',
        value: '',
      ));
    });
  }
}

extension StudentRecordQueryObject
    on QueryBuilder<StudentRecord, StudentRecord, QFilterCondition> {}

extension StudentRecordQueryLinks
    on QueryBuilder<StudentRecord, StudentRecord, QFilterCondition> {}

extension StudentRecordQuerySortBy
    on QueryBuilder<StudentRecord, StudentRecord, QSortBy> {
  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByAcademicYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByAcademicYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByAssignedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByAssignedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByAttendancePercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attendancePercentage', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByAttendancePercentageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attendancePercentage', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByCompletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByEnrolledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'enrolledAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByEnrolledAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'enrolledAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByLastPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPaymentDate', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByLastPaymentDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPaymentDate', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByParentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByParentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByParentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentName', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByParentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentName', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByParentPhone() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentPhone', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByParentPhoneDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentPhone', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByParentTelegramId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentTelegramId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByParentTelegramIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentTelegramId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByPaymentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByStudentNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentNumber', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByStudentNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentNumber', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByStudentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByStudentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> sortByTotalPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalPaid', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByTotalPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalPaid', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByTransferStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByTransferStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByTransferToGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferToGroupId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      sortByTransferToGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferToGroupId', Sort.desc);
    });
  }
}

extension StudentRecordQuerySortThenBy
    on QueryBuilder<StudentRecord, StudentRecord, QSortThenBy> {
  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByAcademicYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByAcademicYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'academicYear', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByAssignedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByAssignedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByAttendancePercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attendancePercentage', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByAttendancePercentageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'attendancePercentage', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByCompletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByEnrolledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'enrolledAt', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByEnrolledAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'enrolledAt', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByLastPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPaymentDate', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByLastPaymentDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastPaymentDate', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByParentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByParentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByParentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentName', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByParentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentName', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByParentPhone() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentPhone', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByParentPhoneDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentPhone', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByParentTelegramId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentTelegramId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByParentTelegramIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'parentTelegramId', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByPaymentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByStudentNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentNumber', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByStudentNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentNumber', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByStudentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByStudentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy> thenByTotalPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalPaid', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByTotalPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalPaid', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByTransferStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferStatus', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByTransferStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferStatus', Sort.desc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByTransferToGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferToGroupId', Sort.asc);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QAfterSortBy>
      thenByTransferToGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'transferToGroupId', Sort.desc);
    });
  }
}

extension StudentRecordQueryWhereDistinct
    on QueryBuilder<StudentRecord, StudentRecord, QDistinct> {
  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByAcademicYear(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'academicYear', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByAssignedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'assignedAt');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByAttendancePercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'attendancePercentage');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'completedAt');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByEnrolledAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'enrolledAt');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByGroupId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByGroupName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByIdentityId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'identityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByLastPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastPaymentDate');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByParentId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'parentId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByParentName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'parentName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByParentPhone(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'parentPhone', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByParentTelegramId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'parentTelegramId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paymentStatus');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pendingSync');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByStudentNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentNumber');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByStudentStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentStatus',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct> distinctByTotalPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'totalPaid');
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByTransferStatus({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'transferStatus',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<StudentRecord, StudentRecord, QDistinct>
      distinctByTransferToGroupId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'transferToGroupId',
          caseSensitive: caseSensitive);
    });
  }
}

extension StudentRecordQueryProperty
    on QueryBuilder<StudentRecord, StudentRecord, QQueryProperty> {
  QueryBuilder<StudentRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations>
      academicYearProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'academicYear');
    });
  }

  QueryBuilder<StudentRecord, DateTime?, QQueryOperations>
      assignedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'assignedAt');
    });
  }

  QueryBuilder<StudentRecord, double, QQueryOperations>
      attendancePercentageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'attendancePercentage');
    });
  }

  QueryBuilder<StudentRecord, DateTime?, QQueryOperations>
      completedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'completedAt');
    });
  }

  QueryBuilder<StudentRecord, DateTime, QQueryOperations> enrolledAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'enrolledAt');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> groupIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupId');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> groupNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupName');
    });
  }

  QueryBuilder<StudentRecord, String, QQueryOperations> identityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'identityId');
    });
  }

  QueryBuilder<StudentRecord, DateTime?, QQueryOperations>
      lastPaymentDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastPaymentDate');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> parentIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'parentId');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> parentNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'parentName');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations> parentPhoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'parentPhone');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations>
      parentTelegramIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'parentTelegramId');
    });
  }

  QueryBuilder<StudentRecord, bool, QQueryOperations> paymentStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paymentStatus');
    });
  }

  QueryBuilder<StudentRecord, bool, QQueryOperations> pendingSyncProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pendingSync');
    });
  }

  QueryBuilder<StudentRecord, int, QQueryOperations> studentNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentNumber');
    });
  }

  QueryBuilder<StudentRecord, String, QQueryOperations>
      studentStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentStatus');
    });
  }

  QueryBuilder<StudentRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<StudentRecord, int, QQueryOperations> totalPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'totalPaid');
    });
  }

  QueryBuilder<StudentRecord, String, QQueryOperations>
      transferStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'transferStatus');
    });
  }

  QueryBuilder<StudentRecord, String?, QQueryOperations>
      transferToGroupIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'transferToGroupId');
    });
  }
}
