// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'signed_qr_nonce_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetSignedQrNonceRecordCollection on Isar {
  IsarCollection<SignedQrNonceRecord> get signedQrNonceRecords =>
      this.collection();
}

const SignedQrNonceRecordSchema = CollectionSchema(
  name: r'SignedQrNonceRecord',
  id: 2550936614989785381,
  properties: {
    r'nonce': PropertySchema(
      id: 0,
      name: r'nonce',
      type: IsarType.string,
    ),
    r'studentId': PropertySchema(
      id: 1,
      name: r'studentId',
      type: IsarType.string,
    ),
    r'usedAt': PropertySchema(
      id: 2,
      name: r'usedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _signedQrNonceRecordEstimateSize,
  serialize: _signedQrNonceRecordSerialize,
  deserialize: _signedQrNonceRecordDeserialize,
  deserializeProp: _signedQrNonceRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'nonce': IndexSchema(
      id: 7333207388468111083,
      name: r'nonce',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'nonce',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _signedQrNonceRecordGetId,
  getLinks: _signedQrNonceRecordGetLinks,
  attach: _signedQrNonceRecordAttach,
  version: '3.1.0+1',
);

int _signedQrNonceRecordEstimateSize(
  SignedQrNonceRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.nonce.length * 3;
  bytesCount += 3 + object.studentId.length * 3;
  return bytesCount;
}

void _signedQrNonceRecordSerialize(
  SignedQrNonceRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.nonce);
  writer.writeString(offsets[1], object.studentId);
  writer.writeDateTime(offsets[2], object.usedAt);
}

SignedQrNonceRecord _signedQrNonceRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = SignedQrNonceRecord();
  object.id = id;
  object.nonce = reader.readString(offsets[0]);
  object.studentId = reader.readString(offsets[1]);
  object.usedAt = reader.readDateTime(offsets[2]);
  return object;
}

P _signedQrNonceRecordDeserializeProp<P>(
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
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _signedQrNonceRecordGetId(SignedQrNonceRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _signedQrNonceRecordGetLinks(
    SignedQrNonceRecord object) {
  return [];
}

void _signedQrNonceRecordAttach(
    IsarCollection<dynamic> col, Id id, SignedQrNonceRecord object) {
  object.id = id;
}

extension SignedQrNonceRecordQueryWhereSort
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QWhere> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension SignedQrNonceRecordQueryWhere
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QWhereClause> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
      nonceEqualTo(String nonce) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'nonce',
        value: [nonce],
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterWhereClause>
      nonceNotEqualTo(String nonce) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'nonce',
              lower: [],
              upper: [nonce],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'nonce',
              lower: [nonce],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'nonce',
              lower: [nonce],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'nonce',
              lower: [],
              upper: [nonce],
              includeUpper: false,
            ));
      }
    });
  }
}

extension SignedQrNonceRecordQueryFilter on QueryBuilder<SignedQrNonceRecord,
    SignedQrNonceRecord, QFilterCondition> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'nonce',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'nonce',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'nonce',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'nonce',
        value: '',
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      nonceIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'nonce',
        value: '',
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdEqualTo(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdGreaterThan(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdLessThan(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdBetween(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdStartsWith(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdEndsWith(
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

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentId',
        value: '',
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      studentIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentId',
        value: '',
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      usedAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      usedAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      usedAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'usedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterFilterCondition>
      usedAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'usedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension SignedQrNonceRecordQueryObject on QueryBuilder<SignedQrNonceRecord,
    SignedQrNonceRecord, QFilterCondition> {}

extension SignedQrNonceRecordQueryLinks on QueryBuilder<SignedQrNonceRecord,
    SignedQrNonceRecord, QFilterCondition> {}

extension SignedQrNonceRecordQuerySortBy
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QSortBy> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByNonce() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nonce', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByNonceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nonce', Sort.desc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByStudentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByStudentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.desc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      sortByUsedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.desc);
    });
  }
}

extension SignedQrNonceRecordQuerySortThenBy
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QSortThenBy> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByNonce() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nonce', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByNonceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nonce', Sort.desc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByStudentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByStudentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentId', Sort.desc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.asc);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QAfterSortBy>
      thenByUsedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'usedAt', Sort.desc);
    });
  }
}

extension SignedQrNonceRecordQueryWhereDistinct
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QDistinct> {
  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QDistinct>
      distinctByNonce({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'nonce', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QDistinct>
      distinctByStudentId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QDistinct>
      distinctByUsedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'usedAt');
    });
  }
}

extension SignedQrNonceRecordQueryProperty
    on QueryBuilder<SignedQrNonceRecord, SignedQrNonceRecord, QQueryProperty> {
  QueryBuilder<SignedQrNonceRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<SignedQrNonceRecord, String, QQueryOperations> nonceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'nonce');
    });
  }

  QueryBuilder<SignedQrNonceRecord, String, QQueryOperations>
      studentIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentId');
    });
  }

  QueryBuilder<SignedQrNonceRecord, DateTime, QQueryOperations>
      usedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'usedAt');
    });
  }
}
