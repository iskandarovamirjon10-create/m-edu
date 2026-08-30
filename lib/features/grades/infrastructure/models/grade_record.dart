import 'package:isar/isar.dart';

part 'grade_record.g.dart';

/// `Grade` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class GradeRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String gradeId;

  @Index()
  late String studentIdentityId;

  late String studentName;

  String? groupId;

  String? groupName;

  @Index()
  late String subjectId;

  late String subjectName;

  /// 5-ballik tizim: 2..5 (2 — qoniqarsiz, 5 — a'lo).
  late int value;

  String? comment;

  @Index()
  late DateTime date;

  int syncVersion = 1;
  bool pendingSync = true;
}
