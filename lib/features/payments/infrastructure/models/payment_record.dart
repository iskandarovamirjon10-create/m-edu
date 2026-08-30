import 'package:isar/isar.dart';

part 'payment_record.g.dart';

/// `Payment` entity'sining Isar'da saqlanadigan ko'rinishi.
@collection
class PaymentRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String paymentId;

  @Index(unique: true, replace: false)
  String? idempotencyKey;

  @Index()
  late String studentIdentityId;

  String? studentName;

  @Index()
  String? groupId;

  String? groupName;

  late int amount;

  late String paymentType;

  @Index()
  late String status;

  String? receiptNumber;

  @Index()
  late DateTime paymentDate;

  DateTime? dueDate;

  String? billingPeriod;

  int discountAmount = 0;

  String? discountReason;

  int lateFee = 0;

  String? notes;

  String? receivedBy;

  int syncVersion = 1;
  bool pendingSync = true;
}
