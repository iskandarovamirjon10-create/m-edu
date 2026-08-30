// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'debt_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetDebtRecordCollection on Isar {
  IsarCollection<DebtRecord> get debtRecords => this.collection();
}

const DebtRecordSchema = CollectionSchema(
  name: r'DebtRecord',
  id: -4440346507630387461,
  properties: {
    r'billingPeriod': PropertySchema(
      id: 0,
      name: r'billingPeriod',
      type: IsarType.string,
    ),
    r'debtId': PropertySchema(
      id: 1,
      name: r'debtId',
      type: IsarType.string,
    ),
    r'dueDate': PropertySchema(
      id: 2,
      name: r'dueDate',
      type: IsarType.dateTime,
    ),
    r'groupId': PropertySchema(
      id: 3,
      name: r'groupId',
      type: IsarType.string,
    ),
    r'groupName': PropertySchema(
      id: 4,
      name: r'groupName',
      type: IsarType.string,
    ),
    r'lastReminderDate': PropertySchema(
      id: 5,
      name: r'lastReminderDate',
      type: IsarType.dateTime,
    ),
    r'notes': PropertySchema(
      id: 6,
      name: r'notes',
      type: IsarType.string,
    ),
    r'paidAmount': PropertySchema(
      id: 7,
      name: r'paidAmount',
      type: IsarType.long,
    ),
    r'remainingAmount': PropertySchema(
      id: 8,
      name: r'remainingAmount',
      type: IsarType.long,
    ),
    r'reminderSent': PropertySchema(
      id: 9,
      name: r'reminderSent',
      type: IsarType.bool,
    ),
    r'status': PropertySchema(
      id: 10,
      name: r'status',
      type: IsarType.string,
    ),
    r'studentIdentityId': PropertySchema(
      id: 11,
      name: r'studentIdentityId',
      type: IsarType.string,
    ),
    r'studentName': PropertySchema(
      id: 12,
      name: r'studentName',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 13,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'totalAmount': PropertySchema(
      id: 14,
      name: r'totalAmount',
      type: IsarType.long,
    )
  },
  estimateSize: _debtRecordEstimateSize,
  serialize: _debtRecordSerialize,
  deserialize: _debtRecordDeserialize,
  deserializeProp: _debtRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'debtId': IndexSchema(
      id: 7945793207552902711,
      name: r'debtId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'debtId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'studentIdentityId': IndexSchema(
      id: 177084474242673397,
      name: r'studentIdentityId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'studentIdentityId',
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
    ),
    r'billingPeriod': IndexSchema(
      id: 7885888706574685079,
      name: r'billingPeriod',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'billingPeriod',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _debtRecordGetId,
  getLinks: _debtRecordGetLinks,
  attach: _debtRecordAttach,
  version: '3.1.0+1',
);

int _debtRecordEstimateSize(
  DebtRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.billingPeriod.length * 3;
  bytesCount += 3 + object.debtId.length * 3;
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
  {
    final value = object.notes;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.status.length * 3;
  bytesCount += 3 + object.studentIdentityId.length * 3;
  {
    final value = object.studentName;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  return bytesCount;
}

void _debtRecordSerialize(
  DebtRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.billingPeriod);
  writer.writeString(offsets[1], object.debtId);
  writer.writeDateTime(offsets[2], object.dueDate);
  writer.writeString(offsets[3], object.groupId);
  writer.writeString(offsets[4], object.groupName);
  writer.writeDateTime(offsets[5], object.lastReminderDate);
  writer.writeString(offsets[6], object.notes);
  writer.writeLong(offsets[7], object.paidAmount);
  writer.writeLong(offsets[8], object.remainingAmount);
  writer.writeBool(offsets[9], object.reminderSent);
  writer.writeString(offsets[10], object.status);
  writer.writeString(offsets[11], object.studentIdentityId);
  writer.writeString(offsets[12], object.studentName);
  writer.writeLong(offsets[13], object.syncVersion);
  writer.writeLong(offsets[14], object.totalAmount);
}

DebtRecord _debtRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = DebtRecord();
  object.billingPeriod = reader.readString(offsets[0]);
  object.debtId = reader.readString(offsets[1]);
  object.dueDate = reader.readDateTime(offsets[2]);
  object.groupId = reader.readStringOrNull(offsets[3]);
  object.groupName = reader.readStringOrNull(offsets[4]);
  object.id = id;
  object.lastReminderDate = reader.readDateTimeOrNull(offsets[5]);
  object.notes = reader.readStringOrNull(offsets[6]);
  object.paidAmount = reader.readLong(offsets[7]);
  object.remainingAmount = reader.readLong(offsets[8]);
  object.reminderSent = reader.readBool(offsets[9]);
  object.status = reader.readString(offsets[10]);
  object.studentIdentityId = reader.readString(offsets[11]);
  object.studentName = reader.readStringOrNull(offsets[12]);
  object.syncVersion = reader.readLong(offsets[13]);
  object.totalAmount = reader.readLong(offsets[14]);
  return object;
}

P _debtRecordDeserializeProp<P>(
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
    case 3:
      return (reader.readStringOrNull(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 6:
      return (reader.readStringOrNull(offset)) as P;
    case 7:
      return (reader.readLong(offset)) as P;
    case 8:
      return (reader.readLong(offset)) as P;
    case 9:
      return (reader.readBool(offset)) as P;
    case 10:
      return (reader.readString(offset)) as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readStringOrNull(offset)) as P;
    case 13:
      return (reader.readLong(offset)) as P;
    case 14:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _debtRecordGetId(DebtRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _debtRecordGetLinks(DebtRecord object) {
  return [];
}

void _debtRecordAttach(IsarCollection<dynamic> col, Id id, DebtRecord object) {
  object.id = id;
}

extension DebtRecordByIndex on IsarCollection<DebtRecord> {
  Future<DebtRecord?> getByDebtId(String debtId) {
    return getByIndex(r'debtId', [debtId]);
  }

  DebtRecord? getByDebtIdSync(String debtId) {
    return getByIndexSync(r'debtId', [debtId]);
  }

  Future<bool> deleteByDebtId(String debtId) {
    return deleteByIndex(r'debtId', [debtId]);
  }

  bool deleteByDebtIdSync(String debtId) {
    return deleteByIndexSync(r'debtId', [debtId]);
  }

  Future<List<DebtRecord?>> getAllByDebtId(List<String> debtIdValues) {
    final values = debtIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'debtId', values);
  }

  List<DebtRecord?> getAllByDebtIdSync(List<String> debtIdValues) {
    final values = debtIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'debtId', values);
  }

  Future<int> deleteAllByDebtId(List<String> debtIdValues) {
    final values = debtIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'debtId', values);
  }

  int deleteAllByDebtIdSync(List<String> debtIdValues) {
    final values = debtIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'debtId', values);
  }

  Future<Id> putByDebtId(DebtRecord object) {
    return putByIndex(r'debtId', object);
  }

  Id putByDebtIdSync(DebtRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'debtId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByDebtId(List<DebtRecord> objects) {
    return putAllByIndex(r'debtId', objects);
  }

  List<Id> putAllByDebtIdSync(List<DebtRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'debtId', objects, saveLinks: saveLinks);
  }
}

extension DebtRecordQueryWhereSort
    on QueryBuilder<DebtRecord, DebtRecord, QWhere> {
  QueryBuilder<DebtRecord, DebtRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension DebtRecordQueryWhere
    on QueryBuilder<DebtRecord, DebtRecord, QWhereClause> {
  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> idNotEqualTo(Id id) {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> idGreaterThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> idLessThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> debtIdEqualTo(
      String debtId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'debtId',
        value: [debtId],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> debtIdNotEqualTo(
      String debtId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'debtId',
              lower: [],
              upper: [debtId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'debtId',
              lower: [debtId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'debtId',
              lower: [debtId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'debtId',
              lower: [],
              upper: [debtId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause>
      studentIdentityIdEqualTo(String studentIdentityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'studentIdentityId',
        value: [studentIdentityId],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause>
      studentIdentityIdNotEqualTo(String studentIdentityId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentIdentityId',
              lower: [],
              upper: [studentIdentityId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentIdentityId',
              lower: [studentIdentityId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentIdentityId',
              lower: [studentIdentityId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'studentIdentityId',
              lower: [],
              upper: [studentIdentityId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [null],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> groupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'groupId',
        lower: [null],
        includeLower: false,
        upper: [],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> groupIdEqualTo(
      String? groupId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [groupId],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> groupIdNotEqualTo(
      String? groupId) {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> statusEqualTo(
      String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> statusNotEqualTo(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause> billingPeriodEqualTo(
      String billingPeriod) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'billingPeriod',
        value: [billingPeriod],
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterWhereClause>
      billingPeriodNotEqualTo(String billingPeriod) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'billingPeriod',
              lower: [],
              upper: [billingPeriod],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'billingPeriod',
              lower: [billingPeriod],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'billingPeriod',
              lower: [billingPeriod],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'billingPeriod',
              lower: [],
              upper: [billingPeriod],
              includeUpper: false,
            ));
      }
    });
  }
}

extension DebtRecordQueryFilter
    on QueryBuilder<DebtRecord, DebtRecord, QFilterCondition> {
  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'billingPeriod',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'billingPeriod',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'billingPeriod',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      billingPeriodIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'billingPeriod',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'debtId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'debtId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'debtId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> debtIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'debtId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      debtIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'debtId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> dueDateEqualTo(
      DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'dueDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      dueDateGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'dueDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> dueDateLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'dueDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> dueDateBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'dueDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdEqualTo(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdLessThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdStartsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdEndsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdContains(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdMatches(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameEqualTo(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameLessThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameEndsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> groupNameMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      groupNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> idGreaterThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lastReminderDate',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lastReminderDate',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastReminderDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastReminderDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastReminderDate',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      lastReminderDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastReminderDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesEqualTo(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesGreaterThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesLessThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesStartsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesEndsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesContains(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesMatches(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> paidAmountEqualTo(
      int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paidAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      paidAmountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paidAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      paidAmountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paidAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> paidAmountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paidAmount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      remainingAmountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remainingAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      remainingAmountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remainingAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      remainingAmountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remainingAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      remainingAmountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remainingAmount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      reminderSentEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'reminderSent',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusEqualTo(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusGreaterThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusLessThan(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusBetween(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusStartsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusEndsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusContains(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusMatches(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition> statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'studentIdentityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'studentName',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'studentName',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameEqualTo(
    String? value, {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameGreaterThan(
    String? value, {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameLessThan(
    String? value, {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameStartsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameEndsWith(
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      studentNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
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

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      totalAmountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'totalAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      totalAmountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'totalAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      totalAmountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'totalAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterFilterCondition>
      totalAmountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'totalAmount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension DebtRecordQueryObject
    on QueryBuilder<DebtRecord, DebtRecord, QFilterCondition> {}

extension DebtRecordQueryLinks
    on QueryBuilder<DebtRecord, DebtRecord, QFilterCondition> {}

extension DebtRecordQuerySortBy
    on QueryBuilder<DebtRecord, DebtRecord, QSortBy> {
  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByBillingPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByBillingPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByDebtId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'debtId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByDebtIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'debtId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByDueDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByLastReminderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastReminderDate', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      sortByLastReminderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastReminderDate', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByPaidAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paidAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByPaidAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paidAmount', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remainingAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      sortByRemainingAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remainingAmount', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByReminderSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      sortByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> sortByTotalAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalAmount', Sort.desc);
    });
  }
}

extension DebtRecordQuerySortThenBy
    on QueryBuilder<DebtRecord, DebtRecord, QSortThenBy> {
  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByBillingPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByBillingPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByDebtId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'debtId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByDebtIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'debtId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByDueDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByLastReminderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastReminderDate', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      thenByLastReminderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastReminderDate', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByPaidAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paidAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByPaidAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paidAmount', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remainingAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      thenByRemainingAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remainingAmount', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByReminderSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy>
      thenByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalAmount', Sort.asc);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QAfterSortBy> thenByTotalAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'totalAmount', Sort.desc);
    });
  }
}

extension DebtRecordQueryWhereDistinct
    on QueryBuilder<DebtRecord, DebtRecord, QDistinct> {
  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByBillingPeriod(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'billingPeriod',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByDebtId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'debtId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'dueDate');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByGroupId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByGroupName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByLastReminderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastReminderDate');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByPaidAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paidAmount');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remainingAmount');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'reminderSent');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByStudentIdentityId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByStudentName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<DebtRecord, DebtRecord, QDistinct> distinctByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'totalAmount');
    });
  }
}

extension DebtRecordQueryProperty
    on QueryBuilder<DebtRecord, DebtRecord, QQueryProperty> {
  QueryBuilder<DebtRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<DebtRecord, String, QQueryOperations> billingPeriodProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'billingPeriod');
    });
  }

  QueryBuilder<DebtRecord, String, QQueryOperations> debtIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'debtId');
    });
  }

  QueryBuilder<DebtRecord, DateTime, QQueryOperations> dueDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'dueDate');
    });
  }

  QueryBuilder<DebtRecord, String?, QQueryOperations> groupIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupId');
    });
  }

  QueryBuilder<DebtRecord, String?, QQueryOperations> groupNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupName');
    });
  }

  QueryBuilder<DebtRecord, DateTime?, QQueryOperations>
      lastReminderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastReminderDate');
    });
  }

  QueryBuilder<DebtRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<DebtRecord, int, QQueryOperations> paidAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paidAmount');
    });
  }

  QueryBuilder<DebtRecord, int, QQueryOperations> remainingAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remainingAmount');
    });
  }

  QueryBuilder<DebtRecord, bool, QQueryOperations> reminderSentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'reminderSent');
    });
  }

  QueryBuilder<DebtRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<DebtRecord, String, QQueryOperations>
      studentIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentIdentityId');
    });
  }

  QueryBuilder<DebtRecord, String?, QQueryOperations> studentNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentName');
    });
  }

  QueryBuilder<DebtRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<DebtRecord, int, QQueryOperations> totalAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'totalAmount');
    });
  }
}
