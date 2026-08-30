// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lead_task_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetLeadTaskRecordCollection on Isar {
  IsarCollection<LeadTaskRecord> get leadTaskRecords => this.collection();
}

const LeadTaskRecordSchema = CollectionSchema(
  name: r'LeadTaskRecord',
  id: 561719272809420085,
  properties: {
    r'assignedToUserId': PropertySchema(
      id: 0,
      name: r'assignedToUserId',
      type: IsarType.string,
    ),
    r'completedAt': PropertySchema(
      id: 1,
      name: r'completedAt',
      type: IsarType.dateTime,
    ),
    r'completedByUserId': PropertySchema(
      id: 2,
      name: r'completedByUserId',
      type: IsarType.string,
    ),
    r'createdAt': PropertySchema(
      id: 3,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'description': PropertySchema(
      id: 4,
      name: r'description',
      type: IsarType.string,
    ),
    r'dueAt': PropertySchema(
      id: 5,
      name: r'dueAt',
      type: IsarType.dateTime,
    ),
    r'leadId': PropertySchema(
      id: 6,
      name: r'leadId',
      type: IsarType.string,
    ),
    r'priority': PropertySchema(
      id: 7,
      name: r'priority',
      type: IsarType.long,
    ),
    r'reminderSent': PropertySchema(
      id: 8,
      name: r'reminderSent',
      type: IsarType.bool,
    ),
    r'status': PropertySchema(
      id: 9,
      name: r'status',
      type: IsarType.string,
    ),
    r'taskId': PropertySchema(
      id: 10,
      name: r'taskId',
      type: IsarType.string,
    ),
    r'title': PropertySchema(
      id: 11,
      name: r'title',
      type: IsarType.string,
    ),
    r'type': PropertySchema(
      id: 12,
      name: r'type',
      type: IsarType.string,
    ),
    r'updatedAt': PropertySchema(
      id: 13,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _leadTaskRecordEstimateSize,
  serialize: _leadTaskRecordSerialize,
  deserialize: _leadTaskRecordDeserialize,
  deserializeProp: _leadTaskRecordDeserializeProp,
  idName: r'id',
  indexes: {
    r'taskId': IndexSchema(
      id: -6391211041487498726,
      name: r'taskId',
      unique: true,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'taskId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'leadId': IndexSchema(
      id: 2640900727793063999,
      name: r'leadId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'leadId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'type': IndexSchema(
      id: 5117122708147080838,
      name: r'type',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'type',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'dueAt': IndexSchema(
      id: 3701044435752459706,
      name: r'dueAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'dueAt',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    ),
    r'assignedToUserId': IndexSchema(
      id: 6164623084035227094,
      name: r'assignedToUserId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'assignedToUserId',
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
    r'priority': IndexSchema(
      id: -6477851841645083544,
      name: r'priority',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'priority',
          type: IndexType.value,
          caseSensitive: false,
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
  getId: _leadTaskRecordGetId,
  getLinks: _leadTaskRecordGetLinks,
  attach: _leadTaskRecordAttach,
  version: '3.1.0+1',
);

int _leadTaskRecordEstimateSize(
  LeadTaskRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.assignedToUserId.length * 3;
  {
    final value = object.completedByUserId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.description;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.leadId.length * 3;
  bytesCount += 3 + object.status.length * 3;
  bytesCount += 3 + object.taskId.length * 3;
  bytesCount += 3 + object.title.length * 3;
  bytesCount += 3 + object.type.length * 3;
  return bytesCount;
}

void _leadTaskRecordSerialize(
  LeadTaskRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.assignedToUserId);
  writer.writeDateTime(offsets[1], object.completedAt);
  writer.writeString(offsets[2], object.completedByUserId);
  writer.writeDateTime(offsets[3], object.createdAt);
  writer.writeString(offsets[4], object.description);
  writer.writeDateTime(offsets[5], object.dueAt);
  writer.writeString(offsets[6], object.leadId);
  writer.writeLong(offsets[7], object.priority);
  writer.writeBool(offsets[8], object.reminderSent);
  writer.writeString(offsets[9], object.status);
  writer.writeString(offsets[10], object.taskId);
  writer.writeString(offsets[11], object.title);
  writer.writeString(offsets[12], object.type);
  writer.writeDateTime(offsets[13], object.updatedAt);
}

LeadTaskRecord _leadTaskRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = LeadTaskRecord();
  object.assignedToUserId = reader.readString(offsets[0]);
  object.completedAt = reader.readDateTimeOrNull(offsets[1]);
  object.completedByUserId = reader.readStringOrNull(offsets[2]);
  object.createdAt = reader.readDateTime(offsets[3]);
  object.description = reader.readStringOrNull(offsets[4]);
  object.dueAt = reader.readDateTime(offsets[5]);
  object.id = id;
  object.leadId = reader.readString(offsets[6]);
  object.priority = reader.readLong(offsets[7]);
  object.reminderSent = reader.readBool(offsets[8]);
  object.status = reader.readString(offsets[9]);
  object.taskId = reader.readString(offsets[10]);
  object.title = reader.readString(offsets[11]);
  object.type = reader.readString(offsets[12]);
  object.updatedAt = reader.readDateTimeOrNull(offsets[13]);
  return object;
}

P _leadTaskRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 2:
      return (reader.readStringOrNull(offset)) as P;
    case 3:
      return (reader.readDateTime(offset)) as P;
    case 4:
      return (reader.readStringOrNull(offset)) as P;
    case 5:
      return (reader.readDateTime(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    case 7:
      return (reader.readLong(offset)) as P;
    case 8:
      return (reader.readBool(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (reader.readString(offset)) as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readString(offset)) as P;
    case 13:
      return (reader.readDateTimeOrNull(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _leadTaskRecordGetId(LeadTaskRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _leadTaskRecordGetLinks(LeadTaskRecord object) {
  return [];
}

void _leadTaskRecordAttach(
    IsarCollection<dynamic> col, Id id, LeadTaskRecord object) {
  object.id = id;
}

extension LeadTaskRecordByIndex on IsarCollection<LeadTaskRecord> {
  Future<LeadTaskRecord?> getByTaskId(String taskId) {
    return getByIndex(r'taskId', [taskId]);
  }

  LeadTaskRecord? getByTaskIdSync(String taskId) {
    return getByIndexSync(r'taskId', [taskId]);
  }

  Future<bool> deleteByTaskId(String taskId) {
    return deleteByIndex(r'taskId', [taskId]);
  }

  bool deleteByTaskIdSync(String taskId) {
    return deleteByIndexSync(r'taskId', [taskId]);
  }

  Future<List<LeadTaskRecord?>> getAllByTaskId(List<String> taskIdValues) {
    final values = taskIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'taskId', values);
  }

  List<LeadTaskRecord?> getAllByTaskIdSync(List<String> taskIdValues) {
    final values = taskIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'taskId', values);
  }

  Future<int> deleteAllByTaskId(List<String> taskIdValues) {
    final values = taskIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'taskId', values);
  }

  int deleteAllByTaskIdSync(List<String> taskIdValues) {
    final values = taskIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'taskId', values);
  }

  Future<Id> putByTaskId(LeadTaskRecord object) {
    return putByIndex(r'taskId', object);
  }

  Id putByTaskIdSync(LeadTaskRecord object, {bool saveLinks = true}) {
    return putByIndexSync(r'taskId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByTaskId(List<LeadTaskRecord> objects) {
    return putAllByIndex(r'taskId', objects);
  }

  List<Id> putAllByTaskIdSync(List<LeadTaskRecord> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'taskId', objects, saveLinks: saveLinks);
  }
}

extension LeadTaskRecordQueryWhereSort
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QWhere> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhere> anyDueAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'dueAt'),
      );
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhere> anyPriority() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'priority'),
      );
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhere> anyCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'createdAt'),
      );
    });
  }
}

extension LeadTaskRecordQueryWhere
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QWhereClause> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> idBetween(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> taskIdEqualTo(
      String taskId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'taskId',
        value: [taskId],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      taskIdNotEqualTo(String taskId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'taskId',
              lower: [],
              upper: [taskId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'taskId',
              lower: [taskId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'taskId',
              lower: [taskId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'taskId',
              lower: [],
              upper: [taskId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> leadIdEqualTo(
      String leadId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'leadId',
        value: [leadId],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      leadIdNotEqualTo(String leadId) {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> typeEqualTo(
      String type) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'type',
        value: [type],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      typeNotEqualTo(String type) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'type',
              lower: [],
              upper: [type],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'type',
              lower: [type],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'type',
              lower: [type],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'type',
              lower: [],
              upper: [type],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> dueAtEqualTo(
      DateTime dueAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'dueAt',
        value: [dueAt],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      dueAtNotEqualTo(DateTime dueAt) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'dueAt',
              lower: [],
              upper: [dueAt],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'dueAt',
              lower: [dueAt],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'dueAt',
              lower: [dueAt],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'dueAt',
              lower: [],
              upper: [dueAt],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      dueAtGreaterThan(
    DateTime dueAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'dueAt',
        lower: [dueAt],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> dueAtLessThan(
    DateTime dueAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'dueAt',
        lower: [],
        upper: [dueAt],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> dueAtBetween(
    DateTime lowerDueAt,
    DateTime upperDueAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'dueAt',
        lower: [lowerDueAt],
        includeLower: includeLower,
        upper: [upperDueAt],
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      assignedToUserIdEqualTo(String assignedToUserId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'assignedToUserId',
        value: [assignedToUserId],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      assignedToUserIdNotEqualTo(String assignedToUserId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'assignedToUserId',
              lower: [],
              upper: [assignedToUserId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'assignedToUserId',
              lower: [assignedToUserId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'assignedToUserId',
              lower: [assignedToUserId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'assignedToUserId',
              lower: [],
              upper: [assignedToUserId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause> statusEqualTo(
      String status) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'status',
        value: [status],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      priorityEqualTo(int priority) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'priority',
        value: [priority],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      priorityNotEqualTo(int priority) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'priority',
              lower: [],
              upper: [priority],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'priority',
              lower: [priority],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'priority',
              lower: [priority],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'priority',
              lower: [],
              upper: [priority],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      priorityGreaterThan(
    int priority, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'priority',
        lower: [priority],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      priorityLessThan(
    int priority, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'priority',
        lower: [],
        upper: [priority],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      priorityBetween(
    int lowerPriority,
    int upperPriority, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'priority',
        lower: [lowerPriority],
        includeLower: includeLower,
        upper: [upperPriority],
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      createdAtEqualTo(DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'createdAt',
        value: [createdAt],
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      createdAtNotEqualTo(DateTime createdAt) {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      createdAtGreaterThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      createdAtLessThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterWhereClause>
      createdAtBetween(
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

extension LeadTaskRecordQueryFilter
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QFilterCondition> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdEqualTo(
    String value, {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdGreaterThan(
    String value, {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdLessThan(
    String value, {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdBetween(
    String lower,
    String upper, {
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'assignedToUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'assignedToUserId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'assignedToUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      assignedToUserIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'assignedToUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'completedAt',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'completedAt',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'completedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'completedByUserId',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'completedByUserId',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'completedByUserId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'completedByUserId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'completedByUserId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'completedByUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      completedByUserIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'completedByUserId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      createdAtLessThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      createdAtBetween(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'description',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'description',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'description',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'description',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'description',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'description',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      descriptionIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'description',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      dueAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'dueAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      dueAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'dueAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      dueAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'dueAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      dueAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'dueAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdEqualTo(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdGreaterThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdLessThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdBetween(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdStartsWith(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdEndsWith(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'leadId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'leadId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'leadId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      leadIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'leadId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      priorityEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'priority',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      priorityGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'priority',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      priorityLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'priority',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      priorityBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'priority',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      reminderSentEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'reminderSent',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      statusContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'status',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      statusMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'status',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      statusIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      statusIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'status',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'taskId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'taskId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'taskId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'taskId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      taskIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'taskId',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'title',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'title',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'title',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'title',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      titleIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'title',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'type',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'type',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'type',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'type',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      typeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'type',
        value: '',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      updatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      updatedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'updatedAt',
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      updatedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      updatedAtLessThan(
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

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterFilterCondition>
      updatedAtBetween(
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

extension LeadTaskRecordQueryObject
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QFilterCondition> {}

extension LeadTaskRecordQueryLinks
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QFilterCondition> {}

extension LeadTaskRecordQuerySortBy
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QSortBy> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByAssignedToUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByAssignedToUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByCompletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByCompletedByUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedByUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByCompletedByUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedByUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByDescription() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'description', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByDescriptionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'description', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByDueAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByDueAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByLeadId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByLeadIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByPriority() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'priority', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByPriorityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'priority', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByReminderSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByTaskId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'taskId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByTaskIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'taskId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByTitleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension LeadTaskRecordQuerySortThenBy
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QSortThenBy> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByAssignedToUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByAssignedToUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'assignedToUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByCompletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByCompletedByUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedByUserId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByCompletedByUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'completedByUserId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByDescription() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'description', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByDescriptionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'description', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByDueAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByDueAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dueAt', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByLeadId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByLeadIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'leadId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByPriority() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'priority', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByPriorityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'priority', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByReminderSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'reminderSent', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByTaskId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'taskId', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByTaskIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'taskId', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByTitleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByType() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByTypeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'type', Sort.desc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QAfterSortBy>
      thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension LeadTaskRecordQueryWhereDistinct
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> {
  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByAssignedToUserId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'assignedToUserId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByCompletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'completedAt');
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByCompletedByUserId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'completedByUserId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByDescription(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'description', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByDueAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'dueAt');
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByLeadId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'leadId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByPriority() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'priority');
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByReminderSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'reminderSent');
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByStatus(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByTaskId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'taskId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByTitle(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'title', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct> distinctByType(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'type', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<LeadTaskRecord, LeadTaskRecord, QDistinct>
      distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension LeadTaskRecordQueryProperty
    on QueryBuilder<LeadTaskRecord, LeadTaskRecord, QQueryProperty> {
  QueryBuilder<LeadTaskRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations>
      assignedToUserIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'assignedToUserId');
    });
  }

  QueryBuilder<LeadTaskRecord, DateTime?, QQueryOperations>
      completedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'completedAt');
    });
  }

  QueryBuilder<LeadTaskRecord, String?, QQueryOperations>
      completedByUserIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'completedByUserId');
    });
  }

  QueryBuilder<LeadTaskRecord, DateTime, QQueryOperations> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<LeadTaskRecord, String?, QQueryOperations>
      descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'description');
    });
  }

  QueryBuilder<LeadTaskRecord, DateTime, QQueryOperations> dueAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'dueAt');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations> leadIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'leadId');
    });
  }

  QueryBuilder<LeadTaskRecord, int, QQueryOperations> priorityProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'priority');
    });
  }

  QueryBuilder<LeadTaskRecord, bool, QQueryOperations> reminderSentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'reminderSent');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations> taskIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'taskId');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations> titleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'title');
    });
  }

  QueryBuilder<LeadTaskRecord, String, QQueryOperations> typeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'type');
    });
  }

  QueryBuilder<LeadTaskRecord, DateTime?, QQueryOperations>
      updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
