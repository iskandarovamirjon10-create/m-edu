// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetPaymentRecordCollection on Isar {
  IsarCollection<PaymentRecord> get paymentRecords => this.collection();
}

const PaymentRecordSchema = CollectionSchema(
  name: r'PaymentRecord',
  id: -157825587411876126,
  properties: {
    r'amount': PropertySchema(
      id: 0,
      name: r'amount',
      type: IsarType.long,
    ),
    r'billingPeriod': PropertySchema(
      id: 1,
      name: r'billingPeriod',
      type: IsarType.string,
    ),
    r'discountAmount': PropertySchema(
      id: 2,
      name: r'discountAmount',
      type: IsarType.long,
    ),
    r'discountReason': PropertySchema(
      id: 3,
      name: r'discountReason',
      type: IsarType.string,
    ),
    r'dueDate': PropertySchema(
      id: 4,
      name: r'dueDate',
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
    r'lateFee': PropertySchema(
      id: 7,
      name: r'lateFee',
      type: IsarType.long,
    ),
    r'notes': PropertySchema(
      id: 8,
      name: r'notes',
      type: IsarType.string,
    ),
    r'paymentDate': PropertySchema(
      id: 9,
      name: r'paymentDate',
      type: IsarType.dateTime,
    ),
    r'paymentId': PropertySchema(
      id: 10,
      name: r'paymentId',
      type: IsarType.string,
    ),
    r'paymentType': PropertySchema(
      id: 11,
      name: r'paymentType',
      type: IsarType.string,
    ),
    r'pendingSync': PropertySchema(
      id: 12,
      name: r'pendingSync',
      type: IsarType.bool,
    ),
    r'receiptNumber': PropertySchema(
      id: 13,
      name: r'receiptNumber',
      type: IsarType.string,
    ),
    r'receivedBy': PropertySchema(
      id: 14,
      name: r'receivedBy',
      type: IsarType.string,
    ),
    r'status': PropertySchema(
      id: 15,
      name: r'status',
      type: IsarType.string,
    ),
    r'studentIdentityId': PropertySchema(
      id: 16,
      name: r'studentIdentityId',
      type: IsarType.string,
    ),
    r'studentName': PropertySchema(
      id: 17,
      name: r'studentName',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 18,
      name: r'syncVersion',
      type: IsarType.long,
    )
  },
  estimateSize: _paymentRecordEstimateSize,
  serialize: _paymentRecordSerialize,
  deserialize: _paymentRecordDeserialize,
  deserializeProp: _paymentRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'paymentId': IndexSchema(
      id: 7838699178157896428,
      name: r'paymentId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'paymentId',
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
    r'paymentDate': IndexSchema(
      id: 2770231740271717250,
      name: r'paymentDate',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'paymentDate',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _paymentRecordGetId,
  getLinks: _paymentRecordGetLinks,
  attach: _paymentRecordAttach,
  version: '3.1.0+1',
);

int _paymentRecordEstimateSize(
  PaymentRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.billingPeriod;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.discountReason;
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
  {
    final value = object.notes;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.paymentId.length * 3;
  bytesCount += 3 + object.paymentType.length * 3;
  {
    final value = object.receiptNumber;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.receivedBy;
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

void _paymentRecordSerialize(
  PaymentRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeLong(offsets[0], object.amount);
  writer.writeString(offsets[1], object.billingPeriod);
  writer.writeLong(offsets[2], object.discountAmount);
  writer.writeString(offsets[3], object.discountReason);
  writer.writeDateTime(offsets[4], object.dueDate);
  writer.writeString(offsets[5], object.groupId);
  writer.writeString(offsets[6], object.groupName);
  writer.writeLong(offsets[7], object.lateFee);
  writer.writeString(offsets[8], object.notes);
  writer.writeDateTime(offsets[9], object.paymentDate);
  writer.writeString(offsets[10], object.paymentId);
  writer.writeString(offsets[11], object.paymentType);
  writer.writeBool(offsets[12], object.pendingSync);
  writer.writeString(offsets[13], object.receiptNumber);
  writer.writeString(offsets[14], object.receivedBy);
  writer.writeString(offsets[15], object.status);
  writer.writeString(offsets[16], object.studentIdentityId);
  writer.writeString(offsets[17], object.studentName);
  writer.writeLong(offsets[18], object.syncVersion);
}

PaymentRecord _paymentRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = PaymentRecord();
  object.amount = reader.readLong(offsets[0]);
  object.billingPeriod = reader.readStringOrNull(offsets[1]);
  object.discountAmount = reader.readLong(offsets[2]);
  object.discountReason = reader.readStringOrNull(offsets[3]);
  object.dueDate = reader.readDateTimeOrNull(offsets[4]);
  object.groupId = reader.readStringOrNull(offsets[5]);
  object.groupName = reader.readStringOrNull(offsets[6]);
  object.id = id;
  object.lateFee = reader.readLong(offsets[7]);
  object.notes = reader.readStringOrNull(offsets[8]);
  object.paymentDate = reader.readDateTime(offsets[9]);
  object.paymentId = reader.readString(offsets[10]);
  object.paymentType = reader.readString(offsets[11]);
  object.pendingSync = reader.readBool(offsets[12]);
  object.receiptNumber = reader.readStringOrNull(offsets[13]);
  object.receivedBy = reader.readStringOrNull(offsets[14]);
  object.status = reader.readString(offsets[15]);
  object.studentIdentityId = reader.readString(offsets[16]);
  object.studentName = reader.readStringOrNull(offsets[17]);
  object.syncVersion = reader.readLong(offsets[18]);
  return object;
}

P _paymentRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readLong(offset)) as P;
    case 1:
      return (reader.readStringOrNull(offset)) as P;
    case 2:
      return (reader.readLong(offset)) as P;
    case 3:
      return (reader.readStringOrNull(offset)) as P;
    case 4:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 5:
      return (reader.readStringOrNull(offset)) as P;
    case 6:
      return (reader.readStringOrNull(offset)) as P;
    case 7:
      return (reader.readLong(offset)) as P;
    case 8:
      return (reader.readStringOrNull(offset)) as P;
    case 9:
      return (reader.readDateTime(offset)) as P;
    case 10:
      return (reader.readString(offset)) as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readBool(offset)) as P;
    case 13:
      return (reader.readStringOrNull(offset)) as P;
    case 14:
      return (reader.readStringOrNull(offset)) as P;
    case 15:
      return (reader.readString(offset)) as P;
    case 16:
      return (reader.readString(offset)) as P;
    case 17:
      return (reader.readStringOrNull(offset)) as P;
    case 18:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _paymentRecordGetId(PaymentRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _paymentRecordGetLinks(PaymentRecord object) {
  return [];
}

void _paymentRecordAttach(
    IsarCollection<dynamic> col, Id id, PaymentRecord object) {
  object.id = id;
}

extension PaymentRecordByIndex on IsarCollection<PaymentRecord> {
  Future<PaymentRecord?> getByPaymentId(String paymentId) {
    return getByIndex(r'paymentId', [paymentId]);
  }

  PaymentRecord? getByPaymentIdSync(String paymentId) {
    return getByIndexSync(r'paymentId', [paymentId]);
  }

  Future<bool> deleteByPaymentId(String paymentId) {
    return deleteByIndex(r'paymentId', [paymentId]);
  }

  bool deleteByPaymentIdSync(String paymentId) {
    return deleteByIndexSync(r'paymentId', [paymentId]);
  }

  Future<List<PaymentRecord?>> getAllByPaymentId(List<String> paymentIdValues) {
    final values = paymentIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'paymentId', values);
  }

  List<PaymentRecord?> getAllByPaymentIdSync(List<String> paymentIdValues) {
    final values = paymentIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'paymentId', values);
  }

  Future<int> deleteAllByPaymentId(List<String> paymentIdValues) {
    final values = paymentIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'paymentId', values);
  }

  int deleteAllByPaymentIdSync(List<String> paymentIdValues) {
    final values = paymentIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'paymentId', values);
  }

  Future<Id> putByPaymentId(PaymentRecord object) {
    return putByIndex(r'paymentId', object);
  }

  Id putByPaymentIdSync(PaymentRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'paymentId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByPaymentId(List<PaymentRecord> objects) {
    return putAllByIndex(r'paymentId', objects);
  }

  List<Id> putAllByPaymentIdSync(List<PaymentRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'paymentId', objects, saveLinks: saveLinks);
  }
}

extension PaymentRecordQueryWhereSort
    on QueryBuilder<PaymentRecord, PaymentRecord, QWhere> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhere> anyPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'paymentDate'),
      );
    });
  }
}

extension PaymentRecordQueryWhere
    on QueryBuilder<PaymentRecord, PaymentRecord, QWhereClause> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentIdEqualTo(String paymentId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'paymentId',
        value: [paymentId],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentIdNotEqualTo(String paymentId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentId',
              lower: [],
              upper: [paymentId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentId',
              lower: [paymentId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentId',
              lower: [paymentId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentId',
              lower: [],
              upper: [paymentId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      studentIdentityIdEqualTo(String studentIdentityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'studentIdentityId',
        value: [studentIdentityId],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [null],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> groupIdEqualTo(
      String? groupId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'groupId',
        value: [groupId],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause> statusEqualTo(
      String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentDateEqualTo(DateTime paymentDate) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'paymentDate',
        value: [paymentDate],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentDateNotEqualTo(DateTime paymentDate) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentDate',
              lower: [],
              upper: [paymentDate],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentDate',
              lower: [paymentDate],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentDate',
              lower: [paymentDate],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'paymentDate',
              lower: [],
              upper: [paymentDate],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentDateGreaterThan(
    DateTime paymentDate, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'paymentDate',
        lower: [paymentDate],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentDateLessThan(
    DateTime paymentDate, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'paymentDate',
        lower: [],
        upper: [paymentDate],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterWhereClause>
      paymentDateBetween(
    DateTime lowerPaymentDate,
    DateTime upperPaymentDate, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'paymentDate',
        lower: [lowerPaymentDate],
        includeLower: includeLower,
        upper: [upperPaymentDate],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension PaymentRecordQueryFilter
    on QueryBuilder<PaymentRecord, PaymentRecord, QFilterCondition> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      amountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'amount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      amountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'amount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      amountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'amount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      amountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'amount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'billingPeriod',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'billingPeriod',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodEqualTo(
    String? value, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodGreaterThan(
    String? value, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodLessThan(
    String? value, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'billingPeriod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'billingPeriod',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'billingPeriod',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      billingPeriodIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'billingPeriod',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountAmountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'discountAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountAmountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'discountAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountAmountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'discountAmount',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountAmountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'discountAmount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'discountReason',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'discountReason',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'discountReason',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'discountReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'discountReason',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'discountReason',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      discountReasonIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'discountReason',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'dueDate',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'dueDate',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'dueDate',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateGreaterThan(
    DateTime? value, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateLessThan(
    DateTime? value, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      dueDateBetween(
    DateTime? lower,
    DateTime? upper, {
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupId',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'groupName',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'groupName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'groupName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      groupNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'groupName',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      lateFeeEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lateFee',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      lateFeeGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lateFee',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      lateFeeLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lateFee',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      lateFeeBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lateFee',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'notes',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'notes',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentDateEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentDateGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentDateLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paymentDate',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentDateBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paymentDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paymentId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'paymentId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'paymentId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'paymentId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paymentType',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'paymentType',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'paymentType',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentType',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      paymentTypeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'paymentType',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      pendingSyncEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pendingSync',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'receiptNumber',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'receiptNumber',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'receiptNumber',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'receiptNumber',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'receiptNumber',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'receiptNumber',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receiptNumberIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'receiptNumber',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'receivedBy',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'receivedBy',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'receivedBy',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'receivedBy',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'receivedBy',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'receivedBy',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      receivedByIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'receivedBy',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      statusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      statusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentIdentityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'studentName',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'studentName',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'studentName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'studentName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      studentNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'studentName',
        value: '',
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
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
}

extension PaymentRecordQueryObject
    on QueryBuilder<PaymentRecord, PaymentRecord, QFilterCondition> {}

extension PaymentRecordQueryLinks
    on QueryBuilder<PaymentRecord, PaymentRecord, QFilterCondition> {}

extension PaymentRecordQuerySortBy
    on QueryBuilder<PaymentRecord, PaymentRecord, QSortBy> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByBillingPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByBillingPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByDiscountAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountAmount', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByDiscountAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountAmount', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByDiscountReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountReason', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByDiscountReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountReason', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByDueDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByLateFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lateFee', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByLateFeeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lateFee', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentDate', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByPaymentDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentDate', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByPaymentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByPaymentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByPaymentType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentType', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByPaymentTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentType', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByReceiptNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receiptNumber', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByReceiptNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receiptNumber', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByReceivedBy() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receivedBy', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByReceivedByDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receivedBy', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }
}

extension PaymentRecordQuerySortThenBy
    on QueryBuilder<PaymentRecord, PaymentRecord, QSortThenBy> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByBillingPeriod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByBillingPeriodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'billingPeriod', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByDiscountAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountAmount', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByDiscountAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountAmount', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByDiscountReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountReason', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByDiscountReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discountReason', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByDueDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueDate', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByGroupId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByGroupIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByGroupName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByGroupNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'groupName', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByLateFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lateFee', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByLateFeeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lateFee', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentDate', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByPaymentDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentDate', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByPaymentId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByPaymentIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByPaymentType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentType', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByPaymentTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentType', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByReceiptNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receiptNumber', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByReceiptNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receiptNumber', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByReceivedBy() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receivedBy', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByReceivedByDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'receivedBy', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByStudentIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByStudentIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentIdentityId', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenByStudentName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenByStudentNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'studentName', Sort.desc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterSortBy>
      thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }
}

extension PaymentRecordQueryWhereDistinct
    on QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> {
  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'amount');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByBillingPeriod(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'billingPeriod',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctByDiscountAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'discountAmount');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctByDiscountReason({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'discountReason',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByDueDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'dueDate');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByGroupId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByGroupName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'groupName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByLateFee() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lateFee');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctByPaymentDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paymentDate');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByPaymentId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paymentId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByPaymentType(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paymentType', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pendingSync');
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByReceiptNumber(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'receiptNumber',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByReceivedBy(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'receivedBy', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctByStudentIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct> distinctByStudentName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'studentName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QDistinct>
      distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }
}

extension PaymentRecordQueryProperty
    on QueryBuilder<PaymentRecord, PaymentRecord, QQueryProperty> {
  QueryBuilder<PaymentRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<PaymentRecord, int, QQueryOperations> amountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'amount');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations>
      billingPeriodProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'billingPeriod');
    });
  }

  QueryBuilder<PaymentRecord, int, QQueryOperations> discountAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'discountAmount');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations>
      discountReasonProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'discountReason');
    });
  }

  QueryBuilder<PaymentRecord, DateTime?, QQueryOperations> dueDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'dueDate');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations> groupIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupId');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations> groupNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'groupName');
    });
  }

  QueryBuilder<PaymentRecord, int, QQueryOperations> lateFeeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lateFee');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<PaymentRecord, DateTime, QQueryOperations>
      paymentDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paymentDate');
    });
  }

  QueryBuilder<PaymentRecord, String, QQueryOperations> paymentIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paymentId');
    });
  }

  QueryBuilder<PaymentRecord, String, QQueryOperations> paymentTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paymentType');
    });
  }

  QueryBuilder<PaymentRecord, bool, QQueryOperations> pendingSyncProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pendingSync');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations>
      receiptNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'receiptNumber');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations> receivedByProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'receivedBy');
    });
  }

  QueryBuilder<PaymentRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<PaymentRecord, String, QQueryOperations>
      studentIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentIdentityId');
    });
  }

  QueryBuilder<PaymentRecord, String?, QQueryOperations> studentNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'studentName');
    });
  }

  QueryBuilder<PaymentRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }
}
