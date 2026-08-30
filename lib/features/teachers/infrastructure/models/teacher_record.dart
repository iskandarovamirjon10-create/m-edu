import 'package:isar/isar.dart';

part 'teacher_record.g.dart';

/// `Teacher` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class TeacherRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String identityId;

  late int teacherNumber;

  String? specialization;

  /// Guruh ID'lari (`List<String>` Isar'da to'g'ridan-to'g'ri saqlanmaydi).
  String? assignedGroupIdsJson;

  late int weeklyHours;
  late int maxWeeklyHours;

  @Index()
  late String status;

  DateTime? startDate;
  DateTime? endDate;

  late int salary;

  String? notes;

  int syncVersion = 1;
  bool pendingSync = true;
}
