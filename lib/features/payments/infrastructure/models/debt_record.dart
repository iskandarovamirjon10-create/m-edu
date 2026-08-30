import 'package:isar/isar.dart';

part 'debt_record.g.dart';

/// `Debt` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class DebtRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String debtId;

  @Index()
  late String studentIdentityId;

  String? studentName;

  @Index()
  String? groupId;

  String? groupName;

  late DateTime dueDate;

  late int totalAmount;

  late int paidAmount;

  late int remainingAmount;

  @Index()
  late String status;

  @Index()
  late String billingPeriod;

  late bool reminderSent;

  DateTime? lastReminderDate;

  String? notes;

  int syncVersion = 1;
}
