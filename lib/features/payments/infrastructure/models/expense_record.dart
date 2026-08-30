import 'package:isar/isar.dart';

part 'expense_record.g.dart';

/// `Expense` entity'sining Isar'da saqlanadigan ko'rinishi.
///
/// O'quv markazining chiqimlari (xarajatlar): ijara, oylik,
/// kommunal, jihoz, targ'ibot va boshqa.
@collection
class ExpenseRecord {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String expenseId;

  /// Xarajat turi (ijara, oylik, kommunal, jihoz, marketing, boshqa).
  late String expenseType;

  /// Xarajat nomi/izohi.
  late String title;

  /// Summa (UZS).
  late int amount;

  /// Xarajat sanasi.
  @Index()
  late DateTime expenseDate;

  /// Qaysi davr uchun (masalan, "2026-08") — oylik statistika uchun.
  @Index()
  late String billingPeriod;

  /// Qabul qiluvchi (kimga to'landi).
  String? payee;

  /// Izoh.
  String? notes;

  /// Kim tomonidan kiritildi (admin identity ID).
  String? createdBy;

  /// Sinxronlash versiyasi.
  int syncVersion = 1;

  /// Hali serverga sinxronlanmagan.
  bool pendingSync = true;
}
