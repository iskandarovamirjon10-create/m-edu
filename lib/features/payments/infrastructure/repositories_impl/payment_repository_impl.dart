import '../../../../core/extensions/enum_x.dart';
import '../../domain/entities/payment.dart';
import '../../domain/entities/debt.dart';
import '../../domain/entities/expense.dart';
import '../../domain/repositories/payment_repository.dart';
import '../datasources/isar_payment_datasource.dart';
import '../models/payment_record.dart';
import '../models/debt_record.dart';
import '../models/expense_record.dart';

/// `PaymentRepository` interfeysining Isar asosidagi implementatsiyasi.
class PaymentRepositoryImpl implements PaymentRepository {
  final IsarPaymentDataSource _datasource;

  PaymentRepositoryImpl(this._datasource);

  // ==================== To'lovlar ====================

  @override
  Future<Payment> save(Payment payment) async {
    final record = _toRecord(payment);
    final saved = await _datasource.insert(record);
    // Fresh write — record valid (`!` xavfsiz).
    return _toEntity(saved)!;
  }

  @override
  Future<Payment> saveWithDebts(Payment payment, List<Debt> debtUpdates) async {
    final record = _toRecord(payment);
    final debtRecords = debtUpdates.map(_toDebtRecord).toList();
    final saved = await _datasource.insertWithDebts(record, debtRecords);
    return _toEntity(saved)!;
  }

  @override
  Future<Payment> updateStatus(
    String paymentId,
    PaymentStatus newStatus,
  ) async {
    final record = await _datasource.findById(paymentId);
    if (record == null) throw Exception('To\'lov topilmadi: $paymentId');

    record.status = newStatus.name;
    record.syncVersion += 1;
    record.pendingSync = true;

    final updated = await _datasource.insert(record);
    return _toEntity(updated)!;
  }

  @override
  Future<Payment?> fetchByIdempotencyKey(String key) async {
    final record = await _datasource.findByIdempotencyKey(key);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<Payment?> fetchById(String paymentId) async {
    final record = await _datasource.findById(paymentId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<Payment>> fetchAll() async {
    final records = await _datasource.findAll();
    // Corrupt yozuvlar o'tkazib yuboriladi — moliyaviy hisobga FAKE
    // kirmaydi (spec §7, §9: revenue total va individual to'lovlar
    // matematik mos bo'lishi shart; noto'g'ri status yozuv "completed"
    // deb hisoblanmaydi).
    return records.map(_toEntity).whereType<Payment>().toList();
  }

  @override
  Future<List<Payment>> fetchByStudentId(String studentIdentityId) async {
    final records = await _datasource.findByStudentId(studentIdentityId);
    return records.map(_toEntity).whereType<Payment>().toList();
  }

  @override
  Future<List<Payment>> fetchByGroupId(String groupId) async {
    final records = await _datasource.findByGroupId(groupId);
    return records.map(_toEntity).whereType<Payment>().toList();
  }

  @override
  Future<List<Payment>> fetchByDateRange(DateTime start, DateTime end) async {
    final records = await _datasource.findByDateRange(start, end);
    return records.map(_toEntity).whereType<Payment>().toList();
  }

  @override
  Future<List<Payment>> fetchByType(PaymentType type) async {
    final records = await _datasource.findByType(type.name);
    return records.map(_toEntity).whereType<Payment>().toList();
  }

  @override
  Future<String?> lastReceiptNumber() => _datasource.lastReceiptNumber();

  @override
  Future<int> repointPaymentAndDebtReferences(
    String fromIdentityId,
    String toIdentityId,
  ) =>
      _datasource.repointPaymentAndDebtReferences(
        fromIdentityId,
        toIdentityId,
      );

  // ==================== Qarzdorlik ====================

  @override
  Future<Debt> saveDebt(Debt debt) async {
    final record = _toDebtRecord(debt);
    final saved = await _datasource.insertDebt(record);
    return _toDebtEntity(saved)!;
  }

  @override
  Future<Debt> updateDebt(Debt debt) async {
    final record = _toDebtRecord(debt);
    final saved = await _datasource.insertDebt(record);
    return _toDebtEntity(saved)!;
  }

  @override
  Future<List<Debt>> fetchDebtsByStudentId(String studentIdentityId) async {
    final records = await _datasource.findDebtsByStudentId(studentIdentityId);
    return records.map(_toDebtEntity).whereType<Debt>().toList();
  }

  @override
  Future<List<Debt>> fetchOutstandingDebts() async {
    final records = await _datasource.findOutstandingDebts();
    return records.map(_toDebtEntity).whereType<Debt>().toList();
  }

  @override
  Future<List<Debt>> fetchOverdueDebts() async {
    final records = await _datasource.findOverdueDebts();
    return records.map(_toDebtEntity).whereType<Debt>().toList();
  }

  @override
  Future<List<Debt>> fetchDebtsByGroupId(String groupId) async {
    final records = await _datasource.findDebtsByGroupId(groupId);
    return records.map(_toDebtEntity).whereType<Debt>().toList();
  }

  @override
  Future<Debt> markDebtAsPaid(String debtId) async {
    final record = await _datasource.findDebtById(debtId);
    if (record == null) throw Exception('Qarzdorlik topilmadi: $debtId');

    record.status = 'paid';
    record.paidAmount = record.totalAmount;
    record.remainingAmount = 0;
    record.syncVersion += 1;

    final updated = await _datasource.insertDebt(record);
    return _toDebtEntity(updated)!;
  }

  @override
  Future<Debt> markReminderSent(String debtId) async {
    final record = await _datasource.findDebtById(debtId);
    if (record == null) throw Exception('Qarzdorlik topilmadi: $debtId');

    record.reminderSent = true;
    record.lastReminderDate = DateTime.now();
    record.syncVersion += 1;

    final updated = await _datasource.insertDebt(record);
    return _toDebtEntity(updated)!;
  }

  // ==================== Xarajatlar (chiqim) ====================

  @override
  Future<Expense> saveExpense(Expense expense) async {
    final record = _toExpenseRecord(expense);
    final saved = await _datasource.insertExpense(record);
    return _toExpenseEntity(saved)!;
  }

  @override
  Future<void> deleteExpense(String expenseId) async {
    await _datasource.deleteExpense(expenseId);
  }

  @override
  Future<Expense?> fetchExpenseById(String expenseId) async {
    final record = await _datasource.findExpenseById(expenseId);
    return record == null ? null : _toExpenseEntity(record);
  }

  @override
  Future<List<Expense>> fetchAllExpenses() async {
    final records = await _datasource.findAllExpenses();
    return records.map(_toExpenseEntity).whereType<Expense>().toList();
  }

  @override
  Future<List<Expense>> fetchExpensesByDateRange(
    DateTime start,
    DateTime end,
  ) async {
    final records = await _datasource.findExpensesByDateRange(start, end);
    return records.map(_toExpenseEntity).whereType<Expense>().toList();
  }

  // ==================== Mapping ====================

  PaymentRecord _toRecord(Payment payment) {
    return PaymentRecord()
      ..paymentId = payment.paymentId
      ..idempotencyKey = payment.idempotencyKey
      ..studentIdentityId = payment.studentIdentityId
      ..studentName = payment.studentName
      ..groupId = payment.groupId
      ..groupName = payment.groupName
      ..amount = payment.amount
      ..paymentType = payment.paymentType.name
      ..status = payment.status.name
      ..receiptNumber = payment.receiptNumber
      ..paymentDate = payment.paymentDate
      ..dueDate = payment.dueDate
      ..billingPeriod = payment.billingPeriod
      ..discountAmount = payment.discountAmount
      ..discountReason = payment.discountReason
      ..lateFee = payment.lateFee
      ..notes = payment.notes
      ..receivedBy = payment.receivedBy
      ..syncVersion = payment.syncVersion
      ..pendingSync = payment.pendingSync;
  }

  /// [Payment]'ga xavfsiz o'giradi (spec §7, §17). Corrupt/legacy
  /// enum qiymatlari → `null` → yozuv moliyaviy hisobga kirmaydi
  /// (noto'g'ri status "completed" deb revenue'ga qo'shilmaydi).
  Payment? _toEntity(PaymentRecord record) {
    final paymentType = tryEnumByName(PaymentType.values, record.paymentType);
    final status = tryEnumByName(PaymentStatus.values, record.status);
    if (paymentType == null || status == null) return null;
    return Payment(
      paymentId: record.paymentId,
      idempotencyKey: record.idempotencyKey,
      studentIdentityId: record.studentIdentityId,
      studentName: record.studentName,
      groupId: record.groupId,
      groupName: record.groupName,
      amount: record.amount,
      paymentType: paymentType,
      status: status,
      receiptNumber: record.receiptNumber,
      paymentDate: record.paymentDate,
      dueDate: record.dueDate,
      billingPeriod: record.billingPeriod,
      discountAmount: record.discountAmount,
      discountReason: record.discountReason,
      lateFee: record.lateFee,
      notes: record.notes,
      receivedBy: record.receivedBy,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }

  DebtRecord _toDebtRecord(Debt debt) {
    return DebtRecord()
      ..debtId = debt.debtId
      ..studentIdentityId = debt.studentIdentityId
      ..studentName = debt.studentName
      ..groupId = debt.groupId
      ..groupName = debt.groupName
      ..dueDate = debt.dueDate
      ..totalAmount = debt.totalAmount
      ..paidAmount = debt.paidAmount
      ..remainingAmount = debt.remainingAmount
      ..status = debt.status.name
      ..billingPeriod = debt.billingPeriod
      ..reminderSent = debt.reminderSent
      ..lastReminderDate = debt.lastReminderDate
      ..notes = debt.notes
      ..syncVersion = debt.syncVersion;
  }

  /// [Debt]'ga xavfsiz o'giradi — corrupt status yozuv o'tkazib
  /// yuboriladi (qarz hisobiga FAKE summa kirmaydi).
  Debt? _toDebtEntity(DebtRecord record) {
    final status = tryEnumByName(DebtStatus.values, record.status);
    if (status == null) return null;
    return Debt(
      debtId: record.debtId,
      studentIdentityId: record.studentIdentityId,
      studentName: record.studentName,
      groupId: record.groupId,
      groupName: record.groupName,
      dueDate: record.dueDate,
      totalAmount: record.totalAmount,
      paidAmount: record.paidAmount,
      remainingAmount: record.remainingAmount,
      status: status,
      billingPeriod: record.billingPeriod,
      reminderSent: record.reminderSent,
      lastReminderDate: record.lastReminderDate,
      notes: record.notes,
      syncVersion: record.syncVersion,
    );
  }

  ExpenseRecord _toExpenseRecord(Expense expense) {
    return ExpenseRecord()
      ..expenseId = expense.expenseId
      ..expenseType = expense.expenseType.name
      ..title = expense.title
      ..amount = expense.amount
      ..expenseDate = expense.expenseDate
      ..billingPeriod = expense.billingPeriod
      ..payee = expense.payee
      ..notes = expense.notes
      ..createdBy = expense.createdBy
      ..syncVersion = expense.syncVersion
      ..pendingSync = expense.pendingSync;
  }

  /// [Expense]'ga xavfsiz o'giradi — corrupt tur o'tkazib yuboriladi
  /// (xarajat hisobiga FAKE kirmaydi).
  Expense? _toExpenseEntity(ExpenseRecord record) {
    final expenseType = tryEnumByName(ExpenseType.values, record.expenseType);
    if (expenseType == null) return null;
    return Expense(
      expenseId: record.expenseId,
      expenseType: expenseType,
      title: record.title,
      amount: record.amount,
      expenseDate: record.expenseDate,
      billingPeriod: record.billingPeriod,
      payee: record.payee,
      notes: record.notes,
      createdBy: record.createdBy,
      syncVersion: record.syncVersion,
      pendingSync: record.pendingSync,
    );
  }
}
