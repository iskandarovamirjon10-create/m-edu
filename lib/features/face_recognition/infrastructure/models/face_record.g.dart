// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'face_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetFaceRecordCollection on Isar {
  IsarCollection<FaceRecord> get faceRecords => this.collection();
}

const FaceRecordSchema = CollectionSchema(
  name: r'FaceRecord',
  id: -2028938968612276340,
  properties: {
    r'createdAt': PropertySchema(
      id: 0,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'encryptedSignature': PropertySchema(
      id: 1,
      name: r'encryptedSignature',
      type: IsarType.longList,
    ),
    r'identityId': PropertySchema(
      id: 2,
      name: r'identityId',
      type: IsarType.string,
    ),
    r'sampleCount': PropertySchema(
      id: 3,
      name: r'sampleCount',
      type: IsarType.long,
    ),
    r'signature': PropertySchema(
      id: 4,
      name: r'signature',
      type: IsarType.doubleList,
    ),
    r'source': PropertySchema(
      id: 5,
      name: r'source',
      type: IsarType.string,
    ),
    r'updatedAt': PropertySchema(
      id: 6,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _faceRecordEstimateSize,
  serialize: _faceRecordSerialize,
  deserialize: _faceRecordDeserialize,
  deserializeProp: _faceRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'identityId': IndexSchema(
      id: 1738616051568895492,
      name: r'identityId',
      unique: true,
      replace: true,
      properties: [
        IndexPropertySchema(
          name: r'identityId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _faceRecordGetId,
  getLinks: _faceRecordGetLinks,
  attach: _faceRecordAttach,
  version: '3.1.0+1',
);

int _faceRecordEstimateSize(
  FaceRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.encryptedSignature;
    if (value != null) {
      bytesCount += 3 + value.length * 8;
    }
  }
  bytesCount += 3 + object.identityId.length * 3;
  bytesCount += 3 + object.signature.length * 8;
  bytesCount += 3 + object.source.length * 3;
  return bytesCount;
}

void _faceRecordSerialize(
  FaceRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDateTime(offsets[0], object.createdAt);
  writer.writeLongList(offsets[1], object.encryptedSignature);
  writer.writeString(offsets[2], object.identityId);
  writer.writeLong(offsets[3], object.sampleCount);
  writer.writeDoubleList(offsets[4], object.signature);
  writer.writeString(offsets[5], object.source);
  writer.writeDateTime(offsets[6], object.updatedAt);
}

FaceRecord _faceRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = FaceRecord();
  object.createdAt = reader.readDateTime(offsets[0]);
  object.encryptedSignature = reader.readLongList(offsets[1]);
  object.id = id;
  object.identityId = reader.readString(offsets[2]);
  object.sampleCount = reader.readLong(offsets[3]);
  object.signature = reader.readDoubleList(offsets[4]) ?? [];
  object.source = reader.readString(offsets[5]);
  object.updatedAt = reader.readDateTimeOrNull(offsets[6]);
  return object;
}

P _faceRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDateTime(offset)) as P;
    case 1:
      return (reader.readLongList(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    case 4:
      return (reader.readDoubleList(offset) ?? []) as P;
    case 5:
      return (reader.readString(offset)) as P;
    case 6:
      return (reader.readDateTimeOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _faceRecordGetId(FaceRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _faceRecordGetLinks(FaceRecord object) {
  return [];
}

void _faceRecordAttach(IsarCollection<dynamic> col, Id id, FaceRecord object) {
  object.id = id;
}

extension FaceRecordByIndex on IsarCollection<FaceRecord> {
  Future<FaceRecord?> getByIdentityId(String identityId) {
    return getByIndex(r'identityId', [identityId]);
  }

  FaceRecord? getByIdentityIdSync(String identityId) {
    return getByIndexSync(r'identityId', [identityId]);
  }

  Future<bool> deleteByIdentityId(String identityId) {
    return deleteByIndex(r'identityId', [identityId]);
  }

  bool deleteByIdentityIdSync(String identityId) {
    return deleteByIndexSync(r'identityId', [identityId]);
  }

  Future<List<FaceRecord?>> getAllByIdentityId(List<String> identityIdValues) {
    final values = identityIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'identityId', values);
  }

  List<FaceRecord?> getAllByIdentityIdSync(List<String> identityIdValues) {
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

  Future<Id> putByIdentityId(FaceRecord object) {
    return putByIndex(r'identityId', object);
  }

  Id putByIdentityIdSync(FaceRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'identityId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByIdentityId(List<FaceRecord> objects) {
    return putAllByIndex(r'identityId', objects);
  }

  List<Id> putAllByIdentityIdSync(List<FaceRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'identityId', objects, saveLinks: saveLinks);
  }
}

extension FaceRecordQueryWhereSort
    on QueryBuilder<FaceRecord, FaceRecord, QWhere> {
  QueryBuilder<FaceRecord, FaceRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension FaceRecordQueryWhere
    on QueryBuilder<FaceRecord, FaceRecord, QWhereClause> {
  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> idNotEqualTo(Id id) {
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> idGreaterThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> idLessThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> identityIdEqualTo(
      String identityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'identityId',
        value: [identityId],
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterWhereClause> identityIdNotEqualTo(
      String identityId) {
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
}

extension FaceRecordQueryFilter
    on QueryBuilder<FaceRecord, FaceRecord, QFilterCondition> {
  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> createdAtEqualTo(
      DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> createdAtLessThan(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> createdAtBetween(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'encryptedSignature',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'encryptedSignature',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureElementEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'encryptedSignature',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureElementGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'encryptedSignature',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureElementLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'encryptedSignature',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureElementBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'encryptedSignature',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      encryptedSignatureLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'encryptedSignature',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> idGreaterThan(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> identityIdEqualTo(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> identityIdBetween(
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      identityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'identityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> identityIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'identityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      identityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      identityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'identityId',
        value: '',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      sampleCountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'sampleCount',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      sampleCountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'sampleCount',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      sampleCountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'sampleCount',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      sampleCountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'sampleCount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureElementEqualTo(
    double value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'signature',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureElementGreaterThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'signature',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureElementLessThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'signature',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureElementBetween(
    double lower,
    double upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'signature',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      signatureLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'signature',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'source',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'source',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'source',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> sourceIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'source',
        value: '',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      sourceIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'source',
        value: '',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      updatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      updatedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> updatedAtEqualTo(
      DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition>
      updatedAtGreaterThan(
    DateTime? value, {
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> updatedAtLessThan(
    DateTime? value, {
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

  QueryBuilder<FaceRecord, FaceRecord, QAfterFilterCondition> updatedAtBetween(
    DateTime? lower,
    DateTime? upper, {
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

extension FaceRecordQueryObject
    on QueryBuilder<FaceRecord, FaceRecord, QFilterCondition> {}

extension FaceRecordQueryLinks
    on QueryBuilder<FaceRecord, FaceRecord, QFilterCondition> {}

extension FaceRecordQuerySortBy
    on QueryBuilder<FaceRecord, FaceRecord, QSortBy> {
  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortBySampleCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sampleCount', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortBySampleCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sampleCount', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension FaceRecordQuerySortThenBy
    on QueryBuilder<FaceRecord, FaceRecord, QSortThenBy> {
  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'identityId', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenBySampleCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sampleCount', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenBySampleCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sampleCount', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension FaceRecordQueryWhereDistinct
    on QueryBuilder<FaceRecord, FaceRecord, QDistinct> {
  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct>
      distinctByEncryptedSignature() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'encryptedSignature');
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctByIdentityId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'identityId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctBySampleCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'sampleCount');
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctBySignature() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'signature');
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctBySource(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'source', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FaceRecord, FaceRecord, QDistinct> distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension FaceRecordQueryProperty
    on QueryBuilder<FaceRecord, FaceRecord, QQueryProperty> {
  QueryBuilder<FaceRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<FaceRecord, DateTime, QQueryOperations> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<FaceRecord, List<int>?, QQueryOperations>
      encryptedSignatureProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'encryptedSignature');
    });
  }

  QueryBuilder<FaceRecord, String, QQueryOperations> identityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'identityId');
    });
  }

  QueryBuilder<FaceRecord, int, QQueryOperations> sampleCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'sampleCount');
    });
  }

  QueryBuilder<FaceRecord, List<double>, QQueryOperations> signatureProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'signature');
    });
  }

  QueryBuilder<FaceRecord, String, QQueryOperations> sourceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'source');
    });
  }

  QueryBuilder<FaceRecord, DateTime?, QQueryOperations> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
