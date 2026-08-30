import 'package:isar/isar.dart';

part 'homework_record.g.dart';

/// `Homework` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class HomeworkRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String homeworkId;

  @Index()
  late String groupId;

  String? groupName;

  late String subjectName;

  late String title;

  late String description;

  @Index()
  late DateTime dueDate;

  String? createdBy;

  String? createdByName;

  bool isCompleted = false;

  late DateTime createdAt;

  int syncVersion = 1;
  bool pendingSync = true;
}
