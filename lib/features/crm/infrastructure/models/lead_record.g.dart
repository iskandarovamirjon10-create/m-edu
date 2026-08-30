// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lead_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetLeadRecordCollection on Isar {
  IsarCollection<LeadRecord> get leadRecords => this.collection();
}

const LeadRecordSchema = CollectionSchema(
  name: r'LeadRecord',
  id: 5998442652095713702,
  properties: {
    r'assignedToUserId': PropertySchema(
      id: 0,
      name: r'assignedToUserId',
      type: IsarType.string,
    ),
    r'convertedToIdentityId': PropertySchema(
      id: 1,
      name: r'convertedToIdentityId',
      type: IsarType.string,
    ),
    r'createdAt': PropertySchema(
      id: 2,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'email': PropertySchema(
      id: 3,
      name: r'email',
      type: IsarType.string,
    ),
    r'fullName': PropertySchema(
      id: 4,
      name: r'fullName',
      type: IsarType.string,
    ),
    r'lastContactedAt': PropertySchema(
      id: 5,
      name: r'lastContactedAt',
      type: IsarType.dateTime,
    ),
    r'leadId': PropertySchema(
      id: 6,
      name: r'leadId',
      type: IsarType.string,
    ),
    r'lostReason': PropertySchema(
      id: 7,
      name: r'lostReason',
      type: IsarType.string,
    ),
    r'nextFollowUpAt': PropertySchema(
      id: 8,
      name: r'nextFollowUpAt',
      type: IsarType.dateTime,
    ),
    r'notes': PropertySchema(
      id: 9,
      name: r'notes',
      type: IsarType.string,
    ),
    r'pendingSync': PropertySchema(
      id: 10,
      name: r'pendingSync',
      type: IsarType.bool,
    ),
    r'phone': PropertySchema(
      id: 11,
      name: r'phone',
      type: IsarType.string,
    ),
    r'referredByIdentityId': PropertySchema(
      id: 12,
      name: r'referredByIdentityId',
      type: IsarType.string,
    ),
    r'score': PropertySchema(
      id: 13,
      name: r'score',
      type: IsarType.long,
    ),
    r'source': PropertySchema(
      id: 14,
      name: r'source',
      type: IsarType.string,
    ),
    r'stage': PropertySchema(
      id: 15,
      name: r'stage',
      type: IsarType.string,
    ),
    r'syncVersion': PropertySchema(
      id: 16,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'updatedAt': PropertySchema(
      id: 17,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _leadRecordEstimateSize,
  serialize: _leadRecordSerialize,
  deserialize: _leadRecordDeserialize,
  deserializeProp: _leadRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'leadId': IndexSchema(
      id: 2640900727793063999,
      name: r'leadId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'leadId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'stage': IndexSchema(
      id: 4281597865616208537,
      name: r'stage',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'stage',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'convertedToIdentityId': IndexSchema(
      id: -2578833050162809754,
      name: r'convertedToIdentityId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'convertedToIdentityId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'createdAt': IndexSchema(
      id: -3433535483987302584,
      name: r'createdAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'createdAt',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _leadRecordGetId,
  getLinks: _leadRecordGetLinks,
  attach: _leadRecordAttach,
  version: '3.1.0+1',
);

int _leadRecordEstimateSize(
  LeadRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.assignedToUserId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.convertedToIdentityId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.email;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.fullName.length * 3;
  bytesCount += 3 + object.leadId.length * 3;
  {
    final value = object.lostReason;
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
  {
    final value = object.phone;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.referredByIdentityId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.source.length * 3;
  bytesCount += 3 + object.stage.length * 3;
  return bytesCount;
}

void _leadRecordSerialize(
  LeadRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.assignedToUserId);
  writer.writeString(offsets[1], object.convertedToIdentityId);
  writer.writeDateTime(offsets[2], object.createdAt);
  writer.writeString(offsets[3], object.email);
  writer.writeString(offsets[4], object.fullName);
  writer.writeDateTime(offsets[5], object.lastContactedAt);
  writer.writeString(offsets[6], object.leadId);
  writer.writeString(offsets[7], object.lostReason);
  writer.writeDateTime(offsets[8], object.nextFollowUpAt);
  writer.writeString(offsets[9], object.notes);
  writer.writeBool(offsets[10], object.pendingSync);
  writer.writeString(offsets[11], object.phone);
  writer.writeString(offsets[12], object.referredByIdentityId);
  writer.writeLong(offsets[13], object.score);
  writer.writeString(offsets[14], object.source);
  writer.writeString(offsets[15], object.stage);
  writer.writeLong(offsets[16], object.syncVersion);
  writer.writeDateTime(offsets[17], object.updatedAt);
}

LeadRecord _leadRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = LeadRecord();
  object.assignedToUserId = reader.readStringOrNull(offsets[0]);
  object.convertedToIdentityId = reader.readStringOrNull(offsets[1]);
  object.createdAt = reader.readDateTime(offsets[2]);
  object.email = reader.readStringOrNull(offsets[3]);
  object.fullName = reader.readString(offsets[4]);
  object.id = id;
  object.lastContactedAt = reader.readDateTimeOrNull(offsets[5]);
  object.leadId = reader.readString(offsets[6]);
  object.lostReason = reader.readStringOrNull(offsets[7]);
  object.nextFollowUpAt = reader.readDateTimeOrNull(offsets[8]);
  object.notes = reader.readStringOrNull(offsets[9]);
  object.pendingSync = reader.readBool(offsets[10]);
  object.phone = reader.readStringOrNull(offsets[11]);
  object.referredByIdentityId = reader.readStringOrNull(offsets[12]);
  object.score = reader.readLong(offsets[13]);
  object.source = reader.readString(offsets[14]);
  object.stage = reader.readString(offsets[15]);
  object.syncVersion = reader.readLong(offsets[16]);
  object.updatedAt = reader.readDateTimeOrNull(offsets[17]);
  return object;
}

P _leadRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readStringOrNull(offset)) as P;
    case 1:
      return (reader.readStringOrNull(offset)) as P;
    case 2:
      return (reader.readDateTime(offset)) as P;
    case 3:
      return (reader.readStringOrNull(offset)) as P;
    case 4:
      return (reader.readString(offset)) as P;
    case 5:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readStringOrNull(offset)) as P;
    case 8:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 9:
      return (reader.readStringOrNull(offset)) as P;
    case 10:
      return (reader.readBool(offset)) as P;
    case 11:
      return (reader.readStringOrNull(offset)) as P;
    case 12:
      return (reader.readStringOrNull(offset)) as P;
    case 13:
      return (reader.readLong(offset)) as P;
    case 14:
      return (reader.readString(offset)) as P;
    case 15:
      return (reader.readString(offset)) as P;
    case 16:
      return (reader.readLong(offset)) as P;
    case 17:
      return (reader.readDateTimeOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _leadRecordGetId(LeadRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _leadRecordGetLinks(LeadRecord object) {
  return [];
}

void _leadRecordAttach(IsarCollection<dynamic> col, Id id, LeadRecord object) {
  object.id = id;
}

extension LeadRecordByIndex on IsarCollection<LeadRecord> {
  Future<LeadRecord?> getByLeadId(String leadId) {
    return getByIndex(r'leadId', [leadId]);
  }

  LeadRecord? getByLeadIdSync(String leadId) {
    return getByIndexSync(r'leadId', [leadId]);
  }

  Future<bool> deleteByLeadId(String leadId) {
    return deleteByIndex(r'leadId', [leadId]);
  }

  bool deleteByLeadIdSync(String leadId) {
    return deleteByIndexSync(r'leadId', [leadId]);
  }

  Future<List<LeadRecord?>> getAllByLeadId(List<String> leadIdValues) {
    final values = leadIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'leadId', values);
  }

  List<LeadRecord?> getAllByLeadIdSync(List<String> leadIdValues) {
    final values = leadIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'leadId', values);
  }

  Future<int> deleteAllByLeadId(List<String> leadIdValues) {
    final values = leadIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'leadId', values);
  }

  int deleteAllByLeadIdSync(List<String> leadIdValues) {
    final values = leadIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'leadId', values);
  }

  Future<Id> putByLeadId(LeadRecord object) {
    return putByIndex(r'leadId', object);
  }

  Id putByLeadIdSync(LeadRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'leadId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByLeadId(List<LeadRecord> objects) {
    return putAllByIndex(r'leadId', objects);
  }

  List<Id> putAllByLeadIdSync(List<LeadRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'leadId', objects, saveLinks: saveLinks);
  }
}

extension LeadRecordQueryWhereSort
    on QueryBuilder<LeadRecord, LeadRecord, QWhere> {
  QueryBuilder<LeadRecord, LeadRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhere> anyCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'createdAt'),
      );
    });
  }
}

extension LeadRecordQueryWhere
    on QueryBuilder<LeadRecord, LeadRecord, QWhereClause> {
  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> idNotEqualTo(Id id) {
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> idGreaterThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> idLessThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> leadIdEqualTo(
      String leadId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'leadId',
        value: [leadId],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> leadIdNotEqualTo(
      String leadId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'leadId',
              lower: [],
              upper: [leadId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'leadId',
              lower: [leadId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'leadId',
              lower: [leadId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'leadId',
              lower: [],
              upper: [leadId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> stageEqualTo(
      String stage) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'stage',
        value: [stage],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> stageNotEqualTo(
      String stage) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'stage',
              lower: [],
              upper: [stage],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'stage',
              lower: [stage],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'stage',
              lower: [stage],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'stage',
              lower: [],
              upper: [stage],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause>
      convertedToIdentityIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'convertedToIdentityId',
        value: [null],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause>
      convertedToIdentityIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'convertedToIdentityId',
        lower: [null],
        includeLower: false,
        upper: [],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause>
      convertedToIdentityIdEqualTo(String? convertedToIdentityId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'convertedToIdentityId',
        value: [convertedToIdentityId],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause>
      convertedToIdentityIdNotEqualTo(String? convertedToIdentityId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'convertedToIdentityId',
              lower: [],
              upper: [convertedToIdentityId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'convertedToIdentityId',
              lower: [convertedToIdentityId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'convertedToIdentityId',
              lower: [convertedToIdentityId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'convertedToIdentityId',
              lower: [],
              upper: [convertedToIdentityId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> createdAtEqualTo(
      DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'createdAt',
        value: [createdAt],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> createdAtNotEqualTo(
      DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [],
              upper: [createdAt],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [createdAt],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [createdAt],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'createdAt',
              lower: [],
              upper: [createdAt],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> createdAtGreaterThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [createdAt],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> createdAtLessThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [],
        upper: [createdAt],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterWhereClause> createdAtBetween(
    DateTime lowerCreatedAt,
    DateTime upperCreatedAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [lowerCreatedAt],
        includeLower: includeLower,
        upper: [upperCreatedAt],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension LeadRecordQueryFilter
    on QueryBuilder<LeadRecord, LeadRecord, QFilterCondition> {
  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'assignedToUserId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'assignedToUserId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'assignedToUserId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'assignedToUserId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedToUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      assignedToUserIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'assignedToUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'convertedToIdentityId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'convertedToIdentityId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'convertedToIdentityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'convertedToIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdMatches(String pattern,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'convertedToIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'convertedToIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      convertedToIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'convertedToIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> createdAtEqualTo(
      DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> createdAtLessThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> createdAtBetween(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'email',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'email',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'email',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'email',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'email',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> emailIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'email',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      emailIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'email',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      fullNameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'fullName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      fullNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'fullName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> fullNameMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'fullName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      fullNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'fullName',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      fullNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'fullName',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> idGreaterThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> idLessThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lastContactedAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lastContactedAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastContactedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastContactedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastContactedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lastContactedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastContactedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'leadId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'leadId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> leadIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'leadId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      leadIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'leadId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lostReason',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lostReason',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> lostReasonEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> lostReasonBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lostReason',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'lostReason',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> lostReasonMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'lostReason',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lostReason',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      lostReasonIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'lostReason',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'nextFollowUpAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'nextFollowUpAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'nextFollowUpAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'nextFollowUpAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'nextFollowUpAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      nextFollowUpAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'nextFollowUpAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'notes',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesEqualTo(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesGreaterThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesLessThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesBetween(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesStartsWith(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesEndsWith(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesContains(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesMatches(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'notes',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      pendingSyncEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pendingSync',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'phone',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'phone',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'phone',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'phone',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'phone',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> phoneIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'phone',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      phoneIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'phone',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'referredByIdentityId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'referredByIdentityId',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'referredByIdentityId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'referredByIdentityId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'referredByIdentityId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'referredByIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      referredByIdentityIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'referredByIdentityId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> scoreEqualTo(
      int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'score',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> scoreGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'score',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> scoreLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'score',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> scoreBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'score',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceEqualTo(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceGreaterThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceLessThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceBetween(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceStartsWith(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceEndsWith(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceContains(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceMatches(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> sourceIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'source',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      sourceIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'source',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'stage',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'stage',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'stage',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> stageIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'stage',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      stageIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'stage',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      updatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
      updatedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> updatedAtEqualTo(
      DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> updatedAtLessThan(
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

  QueryBuilder<LeadRecord, LeadRecord, QAfterFilterCondition> updatedAtBetween(
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

extension LeadRecordQueryObject
    on QueryBuilder<LeadRecord, LeadRecord, QFilterCondition> {}

extension LeadRecordQueryLinks
    on QueryBuilder<LeadRecord, LeadRecord, QFilterCondition> {}

extension LeadRecordQuerySortBy
    on QueryBuilder<LeadRecord, LeadRecord, QSortBy> {
  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByAssignedToUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByAssignedToUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByConvertedToIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'convertedToIdentityId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByConvertedToIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'convertedToIdentityId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByEmail() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'email', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByEmailDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'email', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByFullName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'fullName', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByFullNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'fullName', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByLastContactedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastContactedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByLastContactedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastContactedAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByLeadId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByLeadIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByLostReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lostReason', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByLostReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lostReason', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByNextFollowUpAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nextFollowUpAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByNextFollowUpAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nextFollowUpAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByPhone() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'phone', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByPhoneDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'phone', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByReferredByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'referredByIdentityId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      sortByReferredByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'referredByIdentityId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'score', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByScoreDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'score', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByStage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'stage', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByStageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'stage', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension LeadRecordQuerySortThenBy
    on QueryBuilder<LeadRecord, LeadRecord, QSortThenBy> {
  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByAssignedToUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByAssignedToUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByConvertedToIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'convertedToIdentityId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByConvertedToIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'convertedToIdentityId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByEmail() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'email', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByEmailDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'email', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByFullName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'fullName', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByFullNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'fullName', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByLastContactedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastContactedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByLastContactedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastContactedAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByLeadId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByLeadIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByLostReason() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lostReason', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByLostReasonDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lostReason', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByNextFollowUpAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nextFollowUpAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByNextFollowUpAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'nextFollowUpAt', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByNotes() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByNotesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notes', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByPendingSyncDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pendingSync', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByPhone() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'phone', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByPhoneDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'phone', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByReferredByIdentityId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'referredByIdentityId', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy>
      thenByReferredByIdentityIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'referredByIdentityId', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'score', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByScoreDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'score', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByStage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'stage', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByStageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'stage', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension LeadRecordQueryWhereDistinct
    on QueryBuilder<LeadRecord, LeadRecord, QDistinct> {
  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByAssignedToUserId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'assignedToUserId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct>
      distinctByConvertedToIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'convertedToIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByEmail(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'email', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByFullName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'fullName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByLastContactedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastContactedAt');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByLeadId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'leadId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByLostReason(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lostReason', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByNextFollowUpAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'nextFollowUpAt');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByNotes(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notes', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByPendingSync() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pendingSync');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByPhone(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'phone', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct>
      distinctByReferredByIdentityId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'referredByIdentityId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'score');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctBySource(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'source', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByStage(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'stage', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<LeadRecord, LeadRecord, QDistinct> distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension LeadRecordQueryProperty
    on QueryBuilder<LeadRecord, LeadRecord, QQueryProperty> {
  QueryBuilder<LeadRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations>
      assignedToUserIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'assignedToUserId');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations>
      convertedToIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'convertedToIdentityId');
    });
  }

  QueryBuilder<LeadRecord, DateTime, QQueryOperations> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations> emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'email');
    });
  }

  QueryBuilder<LeadRecord, String, QQueryOperations> fullNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'fullName');
    });
  }

  QueryBuilder<LeadRecord, DateTime?, QQueryOperations>
      lastContactedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastContactedAt');
    });
  }

  QueryBuilder<LeadRecord, String, QQueryOperations> leadIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'leadId');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations> lostReasonProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lostReason');
    });
  }

  QueryBuilder<LeadRecord, DateTime?, QQueryOperations>
      nextFollowUpAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'nextFollowUpAt');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notes');
    });
  }

  QueryBuilder<LeadRecord, bool, QQueryOperations> pendingSyncProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pendingSync');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'phone');
    });
  }

  QueryBuilder<LeadRecord, String?, QQueryOperations>
      referredByIdentityIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'referredByIdentityId');
    });
  }

  QueryBuilder<LeadRecord, int, QQueryOperations> scoreProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'score');
    });
  }

  QueryBuilder<LeadRecord, String, QQueryOperations> sourceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'source');
    });
  }

  QueryBuilder<LeadRecord, String, QQueryOperations> stageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'stage');
    });
  }

  QueryBuilder<LeadRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<LeadRecord, DateTime?, QQueryOperations> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
