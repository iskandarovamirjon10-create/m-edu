import 'package:isar/isar.dart';

part 'group_record.g.dart';

/// `Group` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class GroupRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String groupId;

  late String name;

  String? code;

  late int capacity;
  late int currentSize;

  String? teacherId;
  String? teacherName;
  String? roomId;
  String? roomName;
  String? subject;
  String? academicYear;

  late int monthlyFee;

  @Index()
  late String status;

  DateTime? startDate;
  DateTime? endDate;

  /// Dars kunlari JSON formatda.
  String? daysOfWeekJson;

  String? startTime;
  String? endTime;

  String? notes;

  int syncVersion = 1;
  bool pendingSync = true;
}
