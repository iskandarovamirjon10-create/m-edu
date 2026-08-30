// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recognition_attempt_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetRecognitionAttemptRecordCollection on Isar {
  IsarCollection<RecognitionAttemptRecord> get recognitionAttemptRecords =>
      this.collection();
}

const RecognitionAttemptRecordSchema = CollectionSchema(
  name: r'RecognitionAttemptRecord',
  id: 1480147317143861169,
  properties: {
    r'cameraSource': PropertySchema(
      id: 0,
      name: r'cameraSource',
      type: IsarType.string,
    ),
    r'confidence': PropertySchema(
      id: 1,
      name: r'confidence',
      type: IsarType.double,
    ),
    r'durationMs': PropertySchema(
      id: 2,
      name: r'durationMs',
      type: IsarType.long,
    ),
    r'identityId': PropertySchema(
      id: 3,
      name: r'identityId',
      type: IsarType.string,
    ),
    r'livenessPassed': PropertySchema(
      id: 4,
      name: r'livenessPassed',
      type: IsarType.bool,
    ),
    r'outcome': PropertySchema(
      id: 5,
      name: r'outcome',
      type: IsarType.string,
    ),
    r'qualityIssueCodes': PropertySchema(
      id: 6,
      name: r'qualityIssueCodes',
      type: IsarType.stringList,
    ),
    r'reason': PropertySchema(
      id: 7,
      name: r'reason',
      type: IsarType.string,
    ),
    r'timestamp': PropertySchema(
      id: 8,
      name: r'timestamp',
      type: IsarType.dateTime,
    ),
    r'timestampIndex': PropertySchema(
      id: 9,
      name: r'timestampIndex',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _recognitionAttemptRecordEstimateSize,
  serialize: _recognitionAttemptRecordSerialize,
  deserialize: _recognitionAttemptRecordDeserialize,
  deserializeProp: _recognitionAttemptRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'timestampIndex': IndexSchema(
      id: 4370053450192163106,
      name: r'timestampIndex',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'timestampIndex',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _recognitionAttemptRecordGetId,
  getLinks: _recognitionAttemptRecordGetLinks,
  attach: _recognitionAttemptRecordAttach,
  version: '3.1.0+1',
);

int _recognitionAttemptRecordEstimateSize(
  RecognitionAttemptRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.cameraSource.length * 3;
  {
    final value = object.identityId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.outcome.length * 3;
  bytesCount += 3 + object.qualityIssueCodes.length * 3;
  {
    for (var i = 0; i < object.qualityIssueCodes.length; i++) {
      final value = object.qualityIssueCodes[i];
      bytesCount += value.length * 3;
    }
  }
  {
    final value = object.reason;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  return bytesCount;
}

void _recognitionAttemptRecordSerialize(
  RecognitionAttemptRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.cameraSource);
  writer.writeDouble(offsets[1], object.confidence);
  writer.writeLong(offsets[2], object.durationMs);
  writer.writeString(offsets[3], object.identityId);
  writer.writeBool(offsets[4], object.livenessPassed);
  writer.writeString(offsets[5], object.outcome);
  writer.writeStringList(offsets[6], object.qualityIssueCodes);
  writer.writeString(offsets[7], object.reason);
  writer.writeDateTime(offsets[8], object.timestamp);
  writer.writeDateTime(offsets[9], object.timestampIndex);
}

RecognitionAttemptRecord _recognitionAttemptRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = RecognitionAttemptRecord();
  object.cameraSource = reader.readString(offsets[0]);
  object.confidence = reader.readDoubleOrNull(offsets[1]);
  object.durationMs = reader.readLongOrNull(offsets[2]);
  object.id = id;
  object.identityId = reader.readStringOrNull(offsets[3]);
  object.livenessPassed = reader.readBoolOrNull(offsets[4]);
  object.outcome = reader.readString(offsets[5]);
  object.qualityIssueCodes = reader.readStringList(offsets[6]) ?? [];
  object.reason = reader.readStringOrNull(offsets[7]);
  object.timestamp = reader.readDateTime(offsets[8]);
  object.timestampIndex = reader.readDateTimeOrNull(offsets[9]);
  return object;
}

P _recognitionAttemptRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readDoubleOrNull(offset)) as P;
    case 2:
      return (reader.readLongOrNull(offset)) as P;
    case 3:
      return (reader.readStringOrNull(offset)) as P;
    case 4:
      return (reader.readBoolOrNull(offset)) as P;
    case 5:
      return (reader.readString(offset)) as P;
    case 6:
      return (reader.readStringList(offset) ?? []) as P;
    case 7:
      return (reader.readStringOrNull(offset)) as P;
    case 8:
      return (reader.readDateTime(offset)) as P;
    case 9:
      return (reader.readDateTimeOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _recognitionAttemptRecordGetId(RecognitionAttemptRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _recognitionAttemptRecordGetLinks(
    RecognitionAttemptRecord object) {
  return [];
}

void _recognitionAttemptRecordAttach(
    IsarCollection<dynamic> col, Id id, RecognitionAttemptRecord object) {
  object.id = id;
}

extension RecognitionAttemptRecordQueryWhereSort on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QWhere> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterWhere>
      anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterWhere>
      anyTimestampIndex() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'timestampIndex'),
      );
    });
  }
}

extension RecognitionAttemptRecordQueryWhere on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QWhereClause> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'timestampIndex',
        value: [null],
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'timestampIndex',
        lower: [null],
        includeLower: false,
        upper: [],
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexEqualTo(DateTime? timestampIndex) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'timestampIndex',
        value: [timestampIndex],
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexNotEqualTo(DateTime? timestampIndex) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'timestampIndex',
              lower: [],
              upper: [timestampIndex],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'timestampIndex',
              lower: [timestampIndex],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'timestampIndex',
              lower: [timestampIndex],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'timestampIndex',
              lower: [],
              upper: [timestampIndex],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexGreaterThan(
    DateTime? timestampIndex, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'timestampIndex',
        lower: [timestampIndex],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexLessThan(
    DateTime? timestampIndex, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'timestampIndex',
        lower: [],
        upper: [timestampIndex],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterWhereClause> timestampIndexBetween(
    DateTime? lowerTimestampIndex,
    DateTime? upperTimestampIndex, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'timestampIndex',
        lower: [lowerTimestampIndex],
        includeLower: includeLower,
        upper: [upperTimestampIndex],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension RecognitionAttemptRecordQueryFilter on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QFilterCondition> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'cameraSource',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      cameraSourceContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'cameraSource',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      cameraSourceMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'cameraSource',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'cameraSource',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> cameraSourceIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'cameraSource',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'confidence',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'confidence',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceEqualTo(
    double? value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'confidence',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceGreaterThan(
    double? value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'confidence',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceLessThan(
    double? value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'confidence',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> confidenceBetween(
    double? lower,
    double? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'confidence',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'durationMs',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'durationMs',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'durationMs',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsGreaterThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'durationMs',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsLessThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'durationMs',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> durationMsBetween(
    int? lower,
    int? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'durationMs',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'identityId',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'identityId',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdEqualTo(
    String? value, {
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdGreaterThan(
    String? value, {
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdLessThan(
    String? value, {
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
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

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> identityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> livenessPassedIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'livenessPassed',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> livenessPassedIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'livenessPassed',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> livenessPassedEqualTo(bool? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'livenessPassed',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'outcome',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      outcomeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'outcome',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      outcomeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'outcome',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'outcome',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> outcomeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'outcome',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'qualityIssueCodes',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      qualityIssueCodesElementContains(String value,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'qualityIssueCodes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      qualityIssueCodesElementMatches(String pattern,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'qualityIssueCodes',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'qualityIssueCodes',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'qualityIssueCodes',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> qualityIssueCodesLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'qualityIssueCodes',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'reason',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'reason',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'reason',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      reasonContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'reason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
          QAfterFilterCondition>
      reasonMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'reason',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'reason',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> reasonIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'reason',
        value: '',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'timestamp',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'timestampIndex',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'timestampIndex',
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'timestampIndex',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'timestampIndex',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'timestampIndex',
        value: value,
      ));
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord,
      QAfterFilterCondition> timestampIndexBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'timestampIndex',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension RecognitionAttemptRecordQueryObject on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QFilterCondition> {}

extension RecognitionAttemptRecordQueryLinks on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QFilterCondition> {}

extension RecognitionAttemptRecordQuerySortBy on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QSortBy> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByCameraSource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'cameraSource', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByCameraSourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'cameraSource', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByConfidence() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'confidence', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByConfidenceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'confidence', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByDurationMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'durationMs', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByDurationMsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'durationMs', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByLivenessPassed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'livenessPassed', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByLivenessPassedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'livenessPassed', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByOutcome() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'outcome', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByOutcomeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'outcome', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reason', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reason', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByTimestampDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByTimestampIndex() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestampIndex', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      sortByTimestampIndexDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestampIndex', Sort.desc);
    });
  }
}

extension RecognitionAttemptRecordQuerySortThenBy on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QSortThenBy> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByCameraSource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'cameraSource', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByCameraSourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'cameraSource', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByConfidence() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'confidence', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByConfidenceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'confidence', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByDurationMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'durationMs', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByDurationMsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'durationMs', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByLivenessPassed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'livenessPassed', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByLivenessPassedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'livenessPassed', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByOutcome() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'outcome', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByOutcomeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'outcome', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reason', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reason', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByTimestampDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.desc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByTimestampIndex() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestampIndex', Sort.asc);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QAfterSortBy>
      thenByTimestampIndexDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestampIndex', Sort.desc);
    });
  }
}

extension RecognitionAttemptRecordQueryWhereDistinct on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct> {
  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByCameraSource({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'cameraSource', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByConfidence() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'confidence');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByDurationMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'durationMs');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'identityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByLivenessPassed() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'livenessPassed');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByOutcome({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'outcome', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByQualityIssueCodes() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'qualityIssueCodes');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByReason({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'reason', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'timestamp');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, RecognitionAttemptRecord, QDistinct>
      distinctByTimestampIndex() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'timestampIndex');
    });
  }
}

extension RecognitionAttemptRecordQueryProperty on QueryBuilder<
    RecognitionAttemptRecord, RecognitionAttemptRecord, QQueryProperty> {
  QueryBuilder<RecognitionAttemptRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, String, QQueryOperations>
      cameraSourceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'cameraSource');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, double?, QQueryOperations>
      confidenceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'confidence');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, int?, QQueryOperations>
      durationMsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'durationMs');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, String?, QQueryOperations>
      identityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'identityId');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, bool?, QQueryOperations>
      livenessPassedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'livenessPassed');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, String, QQueryOperations>
      outcomeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'outcome');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, List<String>, QQueryOperations>
      qualityIssueCodesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'qualityIssueCodes');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, String?, QQueryOperations>
      reasonProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'reason');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, DateTime, QQueryOperations>
      timestampProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'timestamp');
    });
  }

  QueryBuilder<RecognitionAttemptRecord, DateTime?, QQueryOperations>
      timestampIndexProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'timestampIndex');
    });
  }
}
