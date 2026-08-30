// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'homework_submission_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetHomeworkSubmissionRecordCollection on Isar {
  IsarCollection<HomeworkSubmissionRecord> get homeworkSubmissionRecords =>
      this.collection();
}

const HomeworkSubmissionRecordSchema = CollectionSchema(
  name: r'HomeworkSubmissionRecord',
  id: -6215539508608030309,
  properties: {
    r'homeworkId': PropertySchema(
      id: 0,
      name: r'homeworkId',
      type: IsarType.string,
    ),
    r'isLate': PropertySchema(
      id: 1,
      name: r'isLate',
      type: IsarType.bool,
    ),
    r'note': PropertySchema(
      id: 2,
      name: r'note',
      type: IsarType.string,
    ),
    r'studentId': PropertySchema(
      id: 3,
      name: r'studentId',
      type: IsarType.string,
    ),
    r'studentName': PropertySchema(
      id: 4,
      name: r'studentName',
      type: IsarType.string,
    ),
    r'submitted': PropertySchema(
      id: 5,
      name: r'submitted',
      type: IsarType.bool,
    ),
    r'submittedAt': PropertySchema(
      id: 6,
      name: r'submittedAt',
      type: IsarType.dateTime,
    ),
    r'syncVersion': PropertySchema(
      id: 7,
      name: r'syncVersion',
      type: IsarType.long,
    )
  },
  estimateSize: _homeworkSubmissionRecordEstimateSize,
  serialize: _homeworkSubmissionRecordSerialize,
  deserialize: _homeworkSubmissionRecordDeserialize,
  deserializeProp: _homeworkSubmissionRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'homeworkId': IndexSchema(
      id: 8833030421801281601,
      name: r'homeworkId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'homeworkId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'studentId': IndexSchema(
      id: -6791323312898281473,
      name: r'studentId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'studentId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _homeworkSubmissionRecordGetId,
  getLinks: _homeworkSubmissionRecordGetLinks,
  attach: _homeworkSubmissionRecordAttach,
  version: '3.1.0+1',
);

int _homeworkSubmissionRecordEstimateSize(
  HomeworkSubmissionRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.homeworkId.length * 3;
  {
    final value = object.note;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.studentId.length * 3;
  bytesCount += 3 + object.studentName.length * 3;
  return bytesCount;
}

void _homeworkSubmissionRecordSerialize(
  HomeworkSubmissionRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.homeworkId);
  writer.writeBool(offsets[1], object.isLate);
  writer.writeString(offsets[2], object.note);
  writer.writeString(offsets[3], object.studentId);
  writer.writeString(offsets[4], object.studentName);
  writer.writeBool(offsets[5], object.submitted);
  writer.writeDateTime(offsets[6], object.submittedAt);
  writer.writeLong(offsets[7], object.syncVersion);
}

HomeworkSubmissionRecord _homeworkSubmissionRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = HomeworkSubmissionRecord();
  object.homeworkId = reader.readString(offsets[0]);
  object.id = id;
  object.isLate = reader.readBool(offsets[1]);
  object.note = reader.readStringOrNull(offsets[2]);
  object.studentId = reader.readString(offsets[3]);
  object.studentName = reader.readString(offsets[4]);
  object.submitted = reader.readBool(offsets[5]);
  object.submittedAt = reader.readDateTimeOrNull(offsets[6]);
  object.syncVersion = reader.readLong(offsets[7]);
  return object;
}

P _homeworkSubmissionRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readBool(offset)) as P;
    case 2:
      return (reader.readStringOrNull(offset)) as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readString(offset)) as P;
    case 5:
      return (reader.readBool(offset)) as P;
    case 6:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 7:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _homeworkSubmissionRecordGetId(HomeworkSubmissionRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _homeworkSubmissionRecordGetLinks(
    HomeworkSubmissionRecord object) {
  return [];
}

void _homeworkSubmissionRecordAttach(
    IsarCollection<dynamic> col, Id id, HomeworkSubmissionRecord object) {
  object.id = id;
}

extension HomeworkSubmissionRecordQueryWhereSort on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QWhere> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterWhere>
      anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension HomeworkSubmissionRecordQueryWhere on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QWhereClause> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> homeworkIdEqualTo(String homeworkId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'homeworkId',
        value: [homeworkId],
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> homeworkIdNotEqualTo(String homeworkId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'homeworkId',
              lower: [],
              upper: [homeworkId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'homeworkId',
              lower: [homeworkId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'homeworkId',
              lower: [homeworkId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'homeworkId',
              lower: [],
              upper: [homeworkId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> studentIdEqualTo(String studentId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'studentId',
        value: [studentId],
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterWhereClause> studentIdNotEqualTo(String studentId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentId',
              lower: [],
              upper: [studentId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentId',
              lower: [studentId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentId',
              lower: [studentId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentId',
              lower: [],
              upper: [studentId],
              includeUpper: false,
            ));
      }
    });
  }
}

extension HomeworkSubmissionRecordQueryFilter on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QFilterCondition> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'homeworkId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      homeworkIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'homeworkId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      homeworkIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'homeworkId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'homeworkId',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> homeworkIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'homeworkId',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> isLateEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'isLate',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'note',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'note',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'note',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      noteContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'note',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      noteMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'note',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'note',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> noteIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'note',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      studentIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      studentIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentId',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentId',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      studentNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
          QAfterFilterCondition>
      studentNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> studentNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'submitted',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'submittedAt',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'submittedAt',
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'submittedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'submittedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'submittedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> submittedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'submittedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> syncVersionGreaterThan(
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> syncVersionLessThan(
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

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord,
      QAfterFilterCondition> syncVersionBetween(
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
}

extension HomeworkSubmissionRecordQueryObject on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QFilterCondition> {}

extension HomeworkSubmissionRecordQueryLinks on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QFilterCondition> {}

extension HomeworkSubmissionRecordQuerySortBy on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QSortBy> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByHomeworkId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'homeworkId', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByHomeworkIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'homeworkId', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByIsLate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isLate', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByIsLateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isLate', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByNote() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'note', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByNoteDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'note', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByStudentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByStudentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySubmitted() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submitted', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySubmittedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submitted', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySubmittedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submittedAt', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySubmittedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submittedAt', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }
}

extension HomeworkSubmissionRecordQuerySortThenBy on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QSortThenBy> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByHomeworkId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'homeworkId', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByHomeworkIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'homeworkId', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByIsLate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isLate', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByIsLateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isLate', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByNote() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'note', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByNoteDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'note', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByStudentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByStudentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySubmitted() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submitted', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySubmittedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submitted', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySubmittedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submittedAt', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySubmittedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'submittedAt', Sort.desc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QAfterSortBy>
      thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }
}

extension HomeworkSubmissionRecordQueryWhereDistinct on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct> {
  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctByHomeworkId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'homeworkId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctByIsLate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'isLate');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctByNote({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'note', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctByStudentId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctByStudentName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctBySubmitted() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'submitted');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctBySubmittedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'submittedAt');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, HomeworkSubmissionRecord, QDistinct>
      distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }
}

extension HomeworkSubmissionRecordQueryProperty on QueryBuilder<
    HomeworkSubmissionRecord, HomeworkSubmissionRecord, QQueryProperty> {
  QueryBuilder<HomeworkSubmissionRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, String, QQueryOperations>
      homeworkIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'homeworkId');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, bool, QQueryOperations>
      isLateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'isLate');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, String?, QQueryOperations>
      noteProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'note');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, String, QQueryOperations>
      studentIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentId');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, String, QQueryOperations>
      studentNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentName');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, bool, QQueryOperations>
      submittedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'submitted');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, DateTime?, QQueryOperations>
      submittedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'submittedAt');
    });
  }

  QueryBuilder<HomeworkSubmissionRecord, int, QQueryOperations>
      syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }
}
