import 'package:isar/isar.dart';

part 'schedule_record.g.dart';

/// `Schedule` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class ScheduleRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String scheduleId;

  @Index()
  late String groupId;

  String? groupName;

  @Index()
  late String teacherId;

  String? teacherName;

  @Index()
  late String roomId;

  String? roomName;

  late int dayOfWeek;

  late String startTime;

  late String endTime;

  String? subject;

  @Index()
  late String status;

  DateTime? specificDate;

  DateTime? startDate;

  DateTime? endDate;

  String? notes;

  int syncVersion = 1;
  bool pendingSync = true;
}
