import 'package:isar/isar.dart';

import '../../../../core/utils/ulid.dart';
import '../models/payment_record.dart';
import '../models/debt_record.dart';
import '../models/expense_record.dart';

/// Isar bilan to'g'ridan-to'g'ri ishlaydigan datasource.
class IsarPaymentDataSource {
  final Isar _db;

  IsarPaymentDataSource(this._db);

  // ==================== To'lovlar ====================

  Future<PaymentRecord> insert(PaymentRecord record) {
    return _db.writeTxn(() async {
      await _ensureReceipt(record);
      await _db.paymentRecords.put(record);
      return record;
    });
  }

  /// To'lov + qarzdorlik yangilanishlarini BIR tranzaksiyada saqlaydi
  /// (spec §33 — qisman holat qoldirilmaydi: to'lov saqlansa ham qarz
  /// yangilanadi, xatolik bo'lsa ikkalasi ham yozilmaydi).
  Future<PaymentRecord> insertWithDebts(
    PaymentRecord record,
    List<DebtRecord> debtUpdates,
  ) {
    return _db.writeTxn(() async {
      await _ensureReceipt(record);
      await _db.paymentRecords.put(record);
      for (final debt in debtUpdates) {
        await _putDebtPreservingId(debt);
      }
      return record;
    });
  }

  /// DebtRecord'ni `debtId` unique indeksi (replace:false) buzilmasdan
  /// saqlaydi — find → id copy → put (kod bazasi konventsiyasi).
  ///
  /// AUDIT P1-09: Parallel to'lovlar bir xil qarzni yangilaganda har bir
  /// to'lov yangi `DebtRecord` (id=0) yaratadi — ikkinchi put `Unique
  /// index violated` bilan yiqilardi. Mavjud record'ning id'sini saqlab,
  /// REPLACE qilamiz.
  Future<void> _putDebtPreservingId(DebtRecord debt) async {
    final existing = await _db.debtRecords
        .filter()
        .debtIdEqualTo(debt.debtId)
        .findFirst();
    if (existing != null) {
      debt.id = existing.id;
    }
    await _db.debtRecords.put(debt);
  }

  /// Kvitansiya raqamini generatsiya qiladi (spec §34).
  ///
  /// A2/E2 (multi-device): avvalgi `REC-{last+1}` qurilmaviy counter
  /// edi — ikki qurilmada to'lovlar bir xil kvitansiya raqamini olishi
  /// mumkin edi (sync'da receipt collision). Endi har bir kvitansiya
  /// global yagona qisqa ULID (80-bit tasodifiylik) — offline ham
  /// xavfsiz, hech qachon to'qnashmaydi.
  Future<void> _ensureReceipt(PaymentRecord record) async {
    if (record.receiptNumber != null && record.receiptNumber!.isNotEmpty) {
      return;
    }
    record.receiptNumber = 'REC-${Ulid.generateShort()}';
  }

  Future<PaymentRecord?> findByIdempotencyKey(String key) {
    return _db.paymentRecords
        .filter()
        .idempotencyKeyEqualTo(key)
        .findFirst();
    }

  Future<PaymentRecord?> findById(String paymentId) {
    return _db.paymentRecords
        .filter()
        .paymentIdEqualTo(paymentId)
        .findFirst();
  }

  Future<List<PaymentRecord>> findAll() {
    return _db.paymentRecords.where().sortByPaymentDateDesc().findAll();
  }

  Future<List<PaymentRecord>> findByStudentId(String studentIdentityId) {
    return _db.paymentRecords
        .filter()
        .studentIdentityIdEqualTo(studentIdentityId)
        .sortByPaymentDateDesc()
        .findAll();
  }

  Future<List<PaymentRecord>> findByGroupId(String groupId) {
    return _db.paymentRecords
        .filter()
        .groupIdEqualTo(groupId)
        .sortByPaymentDateDesc()
        .findAll();
  }

  Future<List<PaymentRecord>> findByDateRange(
    DateTime start,
    DateTime end,
  ) {
    return _db.paymentRecords
        .filter()
        .paymentDateBetween(start, end)
        .sortByPaymentDateDesc()
        .findAll();
  }

  Future<List<PaymentRecord>> findByType(String paymentType) {
    return _db.paymentRecords
        .filter()
        .paymentTypeEqualTo(paymentType)
        .sortByPaymentDateDesc()
        .findAll();
  }

  Future<String?> lastReceiptNumber() async {
    final all = await _db.paymentRecords
        .where()
        .sortByReceiptNumberDesc()
        .limit(1)
        .findAll();
    return all.isEmpty ? null : all.first.receiptNumber;
  }

  /// Identity merge (P0-01): duplicate identity'ga bog'langan barcha
  /// to'lov va qarzdorlik yozuvlarini survivor'ga ko'chiradi — BIR
  /// writeTxn ichida (qisman repoint bo'lib qolmaydi).
  ///
  /// `studentIdentityId` indekslangan, unique emas — repoint xavfsiz.
  /// Qaytgan qiymat: ko'chirilgan yozuvlar soni (idempotent).
  Future<int> repointPaymentAndDebtReferences(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return _db.writeTxn(() async {
      var moved = 0;

      final payments = await _db.paymentRecords
          .filter()
          .studentIdentityIdEqualTo(fromIdentityId)
          .findAll();
      for (final payment in payments) {
        payment.studentIdentityId = toIdentityId;
        payment.syncVersion += 1;
        payment.pendingSync = true;
        await _db.paymentRecords.put(payment);
        moved++;
      }

      final debts = await _db.debtRecords
          .filter()
          .studentIdentityIdEqualTo(fromIdentityId)
          .findAll();
      for (final debt in debts) {
        debt.studentIdentityId = toIdentityId;
        debt.syncVersion += 1;
        await _db.debtRecords.put(debt);
        moved++;
      }

      return moved;
    });
  }

  // ==================== Qarzdorlik ====================

  Future<DebtRecord> insertDebt(DebtRecord record) async {
    return _db.writeTxn(() async {
      await _putDebtPreservingId(record);
      return record;
    });
  }

  Future<DebtRecord?> findDebtById(String debtId) {
    return _db.debtRecords
        .filter()
        .debtIdEqualTo(debtId)
        .findFirst();
  }

  Future<List<DebtRecord>> findDebtsByStudentId(String studentIdentityId) {
    return _db.debtRecords
        .filter()
        .studentIdentityIdEqualTo(studentIdentityId)
        .sortByDueDateDesc()
        .findAll();
  }

  Future<List<DebtRecord>> findOutstandingDebts() async {
    final all = await _db.debtRecords.where().findAll();
    return all.where((d) => d.status != 'paid').toList()
      ..sort((a, b) => b.dueDate.compareTo(a.dueDate));
  }

  Future<List<DebtRecord>> findOverdueDebts() async {
    final now = DateTime.now();
    final all = await _db.debtRecords.where().findAll();
    return all.where((d) => d.dueDate.isBefore(now) && d.status != 'paid').toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  }

  Future<List<DebtRecord>> findDebtsByGroupId(String groupId) {
    return _db.debtRecords
        .filter()
        .groupIdEqualTo(groupId)
        .sortByDueDateDesc()
        .findAll();
  }

  // ==================== Xarajatlar (chiqim) ====================

  Future<ExpenseRecord> insertExpense(ExpenseRecord record) async {
    return _db.writeTxn(() async {
      await _db.expenseRecords.put(record);
      return record;
    });
  }

  Future<void> deleteExpense(String expenseId) async {
    await _db.writeTxn(() async {
      await _db.expenseRecords
          .filter()
          .expenseIdEqualTo(expenseId)
          .deleteAll();
    });
  }

  Future<ExpenseRecord?> findExpenseById(String expenseId) {
    return _db.expenseRecords
        .filter()
        .expenseIdEqualTo(expenseId)
        .findFirst();
  }

  Future<List<ExpenseRecord>> findAllExpenses() {
    return _db.expenseRecords.where().sortByExpenseDateDesc().findAll();
  }

  Future<List<ExpenseRecord>> findExpensesByDateRange(
    DateTime start,
    DateTime end,
  ) {
    return _db.expenseRecords
        .filter()
        .expenseDateBetween(start, end)
        .sortByExpenseDateDesc()
        .findAll();
  }
}
