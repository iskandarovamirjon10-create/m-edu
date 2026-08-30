// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_record.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetSettingsRecordCollection on Isar {
  IsarCollection<SettingsRecord> get settingsRecords => this.collection();
}

const SettingsRecordSchema = CollectionSchema(
  name: r'SettingsRecord',
  id: -4061629773282228682,
  properties: {
    r'ambiguousThreshold': PropertySchema(
      id: 0,
      name: r'ambiguousThreshold',
      type: IsarType.double,
    ),
    r'autoBackupEnabled': PropertySchema(
      id: 1,
      name: r'autoBackupEnabled',
      type: IsarType.bool,
    ),
    r'autoMarkAttendance': PropertySchema(
      id: 2,
      name: r'autoMarkAttendance',
      type: IsarType.bool,
    ),
    r'backupIntervalDays': PropertySchema(
      id: 3,
      name: r'backupIntervalDays',
      type: IsarType.long,
    ),
    r'glassIntensity': PropertySchema(
      id: 4,
      name: r'glassIntensity',
      type: IsarType.long,
    ),
    r'hikvisionChannel': PropertySchema(
      id: 5,
      name: r'hikvisionChannel',
      type: IsarType.long,
    ),
    r'hikvisionEnabled': PropertySchema(
      id: 6,
      name: r'hikvisionEnabled',
      type: IsarType.bool,
    ),
    r'hikvisionIp': PropertySchema(
      id: 7,
      name: r'hikvisionIp',
      type: IsarType.string,
    ),
    r'hikvisionPassword': PropertySchema(
      id: 8,
      name: r'hikvisionPassword',
      type: IsarType.string,
    ),
    r'hikvisionPort': PropertySchema(
      id: 9,
      name: r'hikvisionPort',
      type: IsarType.long,
    ),
    r'hikvisionRtspPath': PropertySchema(
      id: 10,
      name: r'hikvisionRtspPath',
      type: IsarType.string,
    ),
    r'hikvisionUsername': PropertySchema(
      id: 11,
      name: r'hikvisionUsername',
      type: IsarType.string,
    ),
    r'language': PropertySchema(
      id: 12,
      name: r'language',
      type: IsarType.string,
    ),
    r'lastBackupDate': PropertySchema(
      id: 13,
      name: r'lastBackupDate',
      type: IsarType.dateTime,
    ),
    r'lastMonthlyReportSent': PropertySchema(
      id: 14,
      name: r'lastMonthlyReportSent',
      type: IsarType.string,
    ),
    r'matchThreshold': PropertySchema(
      id: 15,
      name: r'matchThreshold',
      type: IsarType.double,
    ),
    r'notificationsEnabled': PropertySchema(
      id: 16,
      name: r'notificationsEnabled',
      type: IsarType.bool,
    ),
    r'paperSize': PropertySchema(
      id: 17,
      name: r'paperSize',
      type: IsarType.string,
    ),
    r'printerName': PropertySchema(
      id: 18,
      name: r'printerName',
      type: IsarType.string,
    ),
    r'pushEnabled': PropertySchema(
      id: 19,
      name: r'pushEnabled',
      type: IsarType.bool,
    ),
    r'scanIntervalMs': PropertySchema(
      id: 20,
      name: r'scanIntervalMs',
      type: IsarType.long,
    ),
    r'sendMonthlyReport': PropertySchema(
      id: 21,
      name: r'sendMonthlyReport',
      type: IsarType.bool,
    ),
    r'smsEnabled': PropertySchema(
      id: 22,
      name: r'smsEnabled',
      type: IsarType.bool,
    ),
    r'syncVersion': PropertySchema(
      id: 23,
      name: r'syncVersion',
      type: IsarType.long,
    ),
    r'telegramBotToken': PropertySchema(
      id: 24,
      name: r'telegramBotToken',
      type: IsarType.string,
    ),
    r'telegramEnabled': PropertySchema(
      id: 25,
      name: r'telegramEnabled',
      type: IsarType.bool,
    ),
    r'themeMode': PropertySchema(
      id: 26,
      name: r'themeMode',
      type: IsarType.string,
    )
  },
  estimateSize: _settingsRecordEstimateSize,
  serialize: _settingsRecordSerialize,
  deserialize: _settingsRecordDeserialize,
  deserializeProp: _settingsRecordDeserializeProp,
  idName: r'id',
  indexes: {},
  links: {},
  embeddedSchemas: {},
  getId: _settingsRecordGetId,
  getLinks: _settingsRecordGetLinks,
  attach: _settingsRecordAttach,
  version: '3.1.0+1',
);

int _settingsRecordEstimateSize(
  SettingsRecord object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.hikvisionIp;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.hikvisionPassword;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.hikvisionRtspPath;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.hikvisionUsername;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.language.length * 3;
  {
    final value = object.lastMonthlyReportSent;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.paperSize.length * 3;
  {
    final value = object.printerName;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.telegramBotToken;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.themeMode.length * 3;
  return bytesCount;
}

void _settingsRecordSerialize(
  SettingsRecord object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDouble(offsets[0], object.ambiguousThreshold);
  writer.writeBool(offsets[1], object.autoBackupEnabled);
  writer.writeBool(offsets[2], object.autoMarkAttendance);
  writer.writeLong(offsets[3], object.backupIntervalDays);
  writer.writeLong(offsets[4], object.glassIntensity);
  writer.writeLong(offsets[5], object.hikvisionChannel);
  writer.writeBool(offsets[6], object.hikvisionEnabled);
  writer.writeString(offsets[7], object.hikvisionIp);
  writer.writeString(offsets[8], object.hikvisionPassword);
  writer.writeLong(offsets[9], object.hikvisionPort);
  writer.writeString(offsets[10], object.hikvisionRtspPath);
  writer.writeString(offsets[11], object.hikvisionUsername);
  writer.writeString(offsets[12], object.language);
  writer.writeDateTime(offsets[13], object.lastBackupDate);
  writer.writeString(offsets[14], object.lastMonthlyReportSent);
  writer.writeDouble(offsets[15], object.matchThreshold);
  writer.writeBool(offsets[16], object.notificationsEnabled);
  writer.writeString(offsets[17], object.paperSize);
  writer.writeString(offsets[18], object.printerName);
  writer.writeBool(offsets[19], object.pushEnabled);
  writer.writeLong(offsets[20], object.scanIntervalMs);
  writer.writeBool(offsets[21], object.sendMonthlyReport);
  writer.writeBool(offsets[22], object.smsEnabled);
  writer.writeLong(offsets[23], object.syncVersion);
  writer.writeString(offsets[24], object.telegramBotToken);
  writer.writeBool(offsets[25], object.telegramEnabled);
  writer.writeString(offsets[26], object.themeMode);
}

SettingsRecord _settingsRecordDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = SettingsRecord();
  object.ambiguousThreshold = reader.readDouble(offsets[0]);
  object.autoBackupEnabled = reader.readBool(offsets[1]);
  object.autoMarkAttendance = reader.readBool(offsets[2]);
  object.backupIntervalDays = reader.readLong(offsets[3]);
  object.glassIntensity = reader.readLong(offsets[4]);
  object.hikvisionChannel = reader.readLong(offsets[5]);
  object.hikvisionEnabled = reader.readBool(offsets[6]);
  object.hikvisionIp = reader.readStringOrNull(offsets[7]);
  object.hikvisionPassword = reader.readStringOrNull(offsets[8]);
  object.hikvisionPort = reader.readLong(offsets[9]);
  object.hikvisionRtspPath = reader.readStringOrNull(offsets[10]);
  object.hikvisionUsername = reader.readStringOrNull(offsets[11]);
  object.id = id;
  object.language = reader.readString(offsets[12]);
  object.lastBackupDate = reader.readDateTimeOrNull(offsets[13]);
  object.lastMonthlyReportSent = reader.readStringOrNull(offsets[14]);
  object.matchThreshold = reader.readDouble(offsets[15]);
  object.notificationsEnabled = reader.readBool(offsets[16]);
  object.paperSize = reader.readString(offsets[17]);
  object.printerName = reader.readStringOrNull(offsets[18]);
  object.pushEnabled = reader.readBool(offsets[19]);
  object.scanIntervalMs = reader.readLong(offsets[20]);
  object.sendMonthlyReport = reader.readBool(offsets[21]);
  object.smsEnabled = reader.readBool(offsets[22]);
  object.syncVersion = reader.readLong(offsets[23]);
  object.telegramBotToken = reader.readStringOrNull(offsets[24]);
  object.telegramEnabled = reader.readBool(offsets[25]);
  object.themeMode = reader.readString(offsets[26]);
  return object;
}

P _settingsRecordDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDouble(offset)) as P;
    case 1:
      return (reader.readBool(offset)) as P;
    case 2:
      return (reader.readBool(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    case 4:
      return (reader.readLong(offset)) as P;
    case 5:
      return (reader.readLong(offset)) as P;
    case 6:
      return (reader.readBool(offset)) as P;
    case 7:
      return (reader.readStringOrNull(offset)) as P;
    case 8:
      return (reader.readStringOrNull(offset)) as P;
    case 9:
      return (reader.readLong(offset)) as P;
    case 10:
      return (reader.readStringOrNull(offset)) as P;
    case 11:
      return (reader.readStringOrNull(offset)) as P;
    case 12:
      return (reader.readString(offset)) as P;
    case 13:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 14:
      return (reader.readStringOrNull(offset)) as P;
    case 15:
      return (reader.readDouble(offset)) as P;
    case 16:
      return (reader.readBool(offset)) as P;
    case 17:
      return (reader.readString(offset)) as P;
    case 18:
      return (reader.readStringOrNull(offset)) as P;
    case 19:
      return (reader.readBool(offset)) as P;
    case 20:
      return (reader.readLong(offset)) as P;
    case 21:
      return (reader.readBool(offset)) as P;
    case 22:
      return (reader.readBool(offset)) as P;
    case 23:
      return (reader.readLong(offset)) as P;
    case 24:
      return (reader.readStringOrNull(offset)) as P;
    case 25:
      return (reader.readBool(offset)) as P;
    case 26:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _settingsRecordGetId(SettingsRecord object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _settingsRecordGetLinks(SettingsRecord object) {
  return [];
}

void _settingsRecordAttach(
    IsarCollection<dynamic> col, Id id, SettingsRecord object) {
  object.id = id;
}

extension SettingsRecordQueryWhereSort
    on QueryBuilder<SettingsRecord, SettingsRecord, QWhere> {
  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension SettingsRecordQueryWhere
    on QueryBuilder<SettingsRecord, SettingsRecord, QWhereClause> {
  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhereClause> idNotEqualTo(
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhereClause> idGreaterThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhereClause> idLessThan(
      Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterWhereClause> idBetween(
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
}

extension SettingsRecordQueryFilter
    on QueryBuilder<SettingsRecord, SettingsRecord, QFilterCondition> {
  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      ambiguousThresholdEqualTo(
    double value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'ambiguousThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      ambiguousThresholdGreaterThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'ambiguousThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      ambiguousThresholdLessThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'ambiguousThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      ambiguousThresholdBetween(
    double lower,
    double upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'ambiguousThreshold',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      autoBackupEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'autoBackupEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      autoMarkAttendanceEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'autoMarkAttendance',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      backupIntervalDaysEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'backupIntervalDays',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      backupIntervalDaysGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'backupIntervalDays',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      backupIntervalDaysLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'backupIntervalDays',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      backupIntervalDaysBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'backupIntervalDays',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      glassIntensityEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'glassIntensity',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      glassIntensityGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'glassIntensity',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      glassIntensityLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'glassIntensity',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      glassIntensityBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'glassIntensity',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionChannelEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionChannel',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionChannelGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionChannel',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionChannelLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionChannel',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionChannelBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionChannel',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'hikvisionIp',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'hikvisionIp',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionIp',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'hikvisionIp',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'hikvisionIp',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionIp',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionIpIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'hikvisionIp',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'hikvisionPassword',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'hikvisionPassword',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionPassword',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'hikvisionPassword',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'hikvisionPassword',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionPassword',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPasswordIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'hikvisionPassword',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPortEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionPort',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPortGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionPort',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPortLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionPort',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionPortBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionPort',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'hikvisionRtspPath',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'hikvisionRtspPath',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionRtspPath',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'hikvisionRtspPath',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'hikvisionRtspPath',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionRtspPath',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionRtspPathIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'hikvisionRtspPath',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'hikvisionUsername',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'hikvisionUsername',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hikvisionUsername',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'hikvisionUsername',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'hikvisionUsername',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hikvisionUsername',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      hikvisionUsernameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'hikvisionUsername',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition> idBetween(
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'language',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'language',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'language',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'language',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      languageIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'language',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lastBackupDate',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lastBackupDate',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastBackupDate',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastBackupDate',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastBackupDate',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastBackupDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastBackupDate',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'lastMonthlyReportSent',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'lastMonthlyReportSent',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastMonthlyReportSent',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'lastMonthlyReportSent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentMatches(String pattern,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'lastMonthlyReportSent',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastMonthlyReportSent',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      lastMonthlyReportSentIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'lastMonthlyReportSent',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      matchThresholdEqualTo(
    double value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'matchThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      matchThresholdGreaterThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'matchThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      matchThresholdLessThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'matchThreshold',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      matchThresholdBetween(
    double lower,
    double upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'matchThreshold',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      notificationsEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'notificationsEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paperSize',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'paperSize',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'paperSize',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paperSize',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      paperSizeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'paperSize',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'printerName',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'printerName',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'printerName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'printerName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'printerName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'printerName',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      printerNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'printerName',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      pushEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'pushEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      scanIntervalMsEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'scanIntervalMs',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      scanIntervalMsGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'scanIntervalMs',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      scanIntervalMsLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'scanIntervalMs',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      scanIntervalMsBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'scanIntervalMs',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      sendMonthlyReportEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'sendMonthlyReport',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      smsEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'smsEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      syncVersionEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncVersion',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
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

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'telegramBotToken',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'telegramBotToken',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'telegramBotToken',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'telegramBotToken',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'telegramBotToken',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramBotToken',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramBotTokenIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'telegramBotToken',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      telegramEnabledEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'telegramEnabled',
        value: value,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'themeMode',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'themeMode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'themeMode',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'themeMode',
        value: '',
      ));
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterFilterCondition>
      themeModeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'themeMode',
        value: '',
      ));
    });
  }
}

extension SettingsRecordQueryObject
    on QueryBuilder<SettingsRecord, SettingsRecord, QFilterCondition> {}

extension SettingsRecordQueryLinks
    on QueryBuilder<SettingsRecord, SettingsRecord, QFilterCondition> {}

extension SettingsRecordQuerySortBy
    on QueryBuilder<SettingsRecord, SettingsRecord, QSortBy> {
  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAmbiguousThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ambiguousThreshold', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAmbiguousThresholdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ambiguousThreshold', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAutoBackupEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoBackupEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAutoBackupEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoBackupEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAutoMarkAttendance() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoMarkAttendance', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByAutoMarkAttendanceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoMarkAttendance', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByBackupIntervalDays() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'backupIntervalDays', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByBackupIntervalDaysDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'backupIntervalDays', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByGlassIntensity() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'glassIntensity', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByGlassIntensityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'glassIntensity', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionChannel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionChannel', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionChannelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionChannel', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionIp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionIp', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionIpDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionIp', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionPassword() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPassword', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionPasswordDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPassword', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionPort() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPort', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionPortDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPort', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionRtspPath() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionRtspPath', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionRtspPathDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionRtspPath', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionUsername() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionUsername', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByHikvisionUsernameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionUsername', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> sortByLanguage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'language', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByLanguageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'language', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByLastBackupDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastBackupDate', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByLastBackupDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastBackupDate', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByLastMonthlyReportSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastMonthlyReportSent', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByLastMonthlyReportSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastMonthlyReportSent', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByMatchThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'matchThreshold', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByMatchThresholdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'matchThreshold', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByNotificationsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationsEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByNotificationsEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationsEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> sortByPaperSize() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paperSize', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByPaperSizeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paperSize', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByPrinterName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'printerName', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByPrinterNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'printerName', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByPushEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pushEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByPushEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pushEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByScanIntervalMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'scanIntervalMs', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByScanIntervalMsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'scanIntervalMs', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySendMonthlyReport() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sendMonthlyReport', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySendMonthlyReportDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sendMonthlyReport', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySmsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'smsEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySmsEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'smsEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByTelegramBotToken() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramBotToken', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByTelegramBotTokenDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramBotToken', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByTelegramEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByTelegramEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> sortByThemeMode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'themeMode', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      sortByThemeModeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'themeMode', Sort.desc);
    });
  }
}

extension SettingsRecordQuerySortThenBy
    on QueryBuilder<SettingsRecord, SettingsRecord, QSortThenBy> {
  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAmbiguousThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ambiguousThreshold', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAmbiguousThresholdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ambiguousThreshold', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAutoBackupEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoBackupEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAutoBackupEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoBackupEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAutoMarkAttendance() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoMarkAttendance', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByAutoMarkAttendanceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'autoMarkAttendance', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByBackupIntervalDays() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'backupIntervalDays', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByBackupIntervalDaysDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'backupIntervalDays', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByGlassIntensity() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'glassIntensity', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByGlassIntensityDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'glassIntensity', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionChannel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionChannel', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionChannelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionChannel', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionIp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionIp', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionIpDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionIp', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionPassword() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPassword', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionPasswordDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPassword', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionPort() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPort', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionPortDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionPort', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionRtspPath() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionRtspPath', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionRtspPathDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionRtspPath', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionUsername() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionUsername', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByHikvisionUsernameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hikvisionUsername', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> thenByLanguage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'language', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByLanguageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'language', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByLastBackupDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastBackupDate', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByLastBackupDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastBackupDate', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByLastMonthlyReportSent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastMonthlyReportSent', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByLastMonthlyReportSentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastMonthlyReportSent', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByMatchThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'matchThreshold', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByMatchThresholdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'matchThreshold', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByNotificationsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationsEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByNotificationsEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'notificationsEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> thenByPaperSize() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paperSize', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByPaperSizeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paperSize', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByPrinterName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'printerName', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByPrinterNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'printerName', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByPushEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pushEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByPushEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'pushEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByScanIntervalMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'scanIntervalMs', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByScanIntervalMsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'scanIntervalMs', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySendMonthlyReport() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sendMonthlyReport', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySendMonthlyReportDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sendMonthlyReport', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySmsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'smsEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySmsEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'smsEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenBySyncVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncVersion', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByTelegramBotToken() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramBotToken', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByTelegramBotTokenDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramBotToken', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByTelegramEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramEnabled', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByTelegramEnabledDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'telegramEnabled', Sort.desc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy> thenByThemeMode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'themeMode', Sort.asc);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QAfterSortBy>
      thenByThemeModeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'themeMode', Sort.desc);
    });
  }
}

extension SettingsRecordQueryWhereDistinct
    on QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> {
  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByAmbiguousThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'ambiguousThreshold');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByAutoBackupEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'autoBackupEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByAutoMarkAttendance() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'autoMarkAttendance');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByBackupIntervalDays() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'backupIntervalDays');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByGlassIntensity() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'glassIntensity');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionChannel() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionChannel');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> distinctByHikvisionIp(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionIp', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionPassword({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionPassword',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionPort() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionPort');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionRtspPath({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionRtspPath',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByHikvisionUsername({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hikvisionUsername',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> distinctByLanguage(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'language', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByLastBackupDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastBackupDate');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByLastMonthlyReportSent({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastMonthlyReportSent',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByMatchThreshold() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'matchThreshold');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByNotificationsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'notificationsEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> distinctByPaperSize(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paperSize', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> distinctByPrinterName(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'printerName', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByPushEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'pushEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByScanIntervalMs() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'scanIntervalMs');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctBySendMonthlyReport() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'sendMonthlyReport');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctBySmsEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'smsEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctBySyncVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncVersion');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByTelegramBotToken({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramBotToken',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct>
      distinctByTelegramEnabled() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'telegramEnabled');
    });
  }

  QueryBuilder<SettingsRecord, SettingsRecord, QDistinct> distinctByThemeMode(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'themeMode', caseSensitive: caseSensitive);
    });
  }
}

extension SettingsRecordQueryProperty
    on QueryBuilder<SettingsRecord, SettingsRecord, QQueryProperty> {
  QueryBuilder<SettingsRecord, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<SettingsRecord, double, QQueryOperations>
      ambiguousThresholdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'ambiguousThreshold');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      autoBackupEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'autoBackupEnabled');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      autoMarkAttendanceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'autoMarkAttendance');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations>
      backupIntervalDaysProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'backupIntervalDays');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations> glassIntensityProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'glassIntensity');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations>
      hikvisionChannelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionChannel');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      hikvisionEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionEnabled');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      hikvisionIpProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionIp');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      hikvisionPasswordProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionPassword');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations> hikvisionPortProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionPort');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      hikvisionRtspPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionRtspPath');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      hikvisionUsernameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hikvisionUsername');
    });
  }

  QueryBuilder<SettingsRecord, String, QQueryOperations> languageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'language');
    });
  }

  QueryBuilder<SettingsRecord, DateTime?, QQueryOperations>
      lastBackupDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastBackupDate');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      lastMonthlyReportSentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastMonthlyReportSent');
    });
  }

  QueryBuilder<SettingsRecord, double, QQueryOperations>
      matchThresholdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'matchThreshold');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      notificationsEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'notificationsEnabled');
    });
  }

  QueryBuilder<SettingsRecord, String, QQueryOperations> paperSizeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paperSize');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      printerNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'printerName');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations> pushEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'pushEnabled');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations> scanIntervalMsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'scanIntervalMs');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      sendMonthlyReportProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'sendMonthlyReport');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations> smsEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'smsEnabled');
    });
  }

  QueryBuilder<SettingsRecord, int, QQueryOperations> syncVersionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncVersion');
    });
  }

  QueryBuilder<SettingsRecord, String?, QQueryOperations>
      telegramBotTokenProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramBotToken');
    });
  }

  QueryBuilder<SettingsRecord, bool, QQueryOperations>
      telegramEnabledProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'telegramEnabled');
    });
  }

  QueryBuilder<SettingsRecord, String, QQueryOperations> themeModeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'themeMode');
    });
  }
}
