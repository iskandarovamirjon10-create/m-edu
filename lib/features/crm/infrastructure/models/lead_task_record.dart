import 'package:isar/isar.dart';

part 'lead_task_record.g.dart';

/// `LeadTask` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class LeadTaskRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String taskId;

  @Index()
  late String leadId;

  late String title;

  String? description;

  @Index()
  late String type;

  @Index()
  late DateTime dueAt;

  @Index()
  late String assignedToUserId;

  @Index()
  late String status;

  @Index()
  late int priority;

  late bool reminderSent;

  DateTime? completedAt;

  String? completedByUserId;

  @Index()
  late DateTime createdAt;

  DateTime? updatedAt;
}
