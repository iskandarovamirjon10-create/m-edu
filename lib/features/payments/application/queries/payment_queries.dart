import '../../domain/entities/payment.dart';
import '../../domain/entities/debt.dart';
import '../../domain/entities/expense.dart';
import '../../domain/repositories/payment_repository.dart';

/// To'lov o'qish operatsiyalari (CQRS queries).
class PaymentQueries {
  final PaymentRepository _repository;

  PaymentQueries({required PaymentRepository repository})
      : _repository = repository;

  // ==================== To'lovlar ====================

  Future<List<Payment>> fetchAll() => _repository.fetchAll();

  Future<Payment?> fetchById(String paymentId) =>
      _repository.fetchById(paymentId);

  Future<List<Payment>> fetchByStudentId(String studentIdentityId) =>
      _repository.fetchByStudentId(studentIdentityId);

  Future<List<Payment>> fetchByGroupId(String groupId) =>
      _repository.fetchByGroupId(groupId);

  Future<List<Payment>> fetchByDateRange(DateTime start, DateTime end) =>
      _repository.fetchByDateRange(start, end);

  Future<List<Payment>> fetchByType(PaymentType type) =>
      _repository.fetchByType(type);

  /// Jami to'langan summa.
  Future<int> totalCollected() async {
    final payments = await _repository.fetchAll();
    return payments
        .where((p) => p.isCompleted)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);
  }

  /// Oylik to'langan summa.
  Future<int> monthlyCollected({DateTime? month}) async {
    final now = month ?? DateTime.now();
    final start = DateTime(now.year, now.month, 1);
    final end = DateTime(now.year, now.month + 1, 0, 23, 59, 59);
    final payments = await _repository.fetchByDateRange(start, end);
    return payments
        .where((p) => p.isCompleted)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);
  }

  /// To'lovlar soni.
  Future<int> countAll() async {
    final payments = await _repository.fetchAll();
    return payments.length;
  }

  /// To'langan to'lovlar soni.
  Future<int> countCompleted() async {
    final payments = await _repository.fetchAll();
    return payments.where((p) => p.isCompleted).length;
  }

  // ==================== Qarzdorlik ====================

  Future<List<Debt>> fetchOutstandingDebts() =>
      _repository.fetchOutstandingDebts();

  Future<List<Debt>> fetchOverdueDebts() => _repository.fetchOverdueDebts();

  Future<List<Debt>> fetchDebtsByStudentId(String studentIdentityId) =>
      _repository.fetchDebtsByStudentId(studentIdentityId);

  Future<List<Debt>> fetchDebtsByGroupId(String groupId) =>
      _repository.fetchDebtsByGroupId(groupId);

  /// Jami qarz miqdori.
  Future<int> totalDebt() async {
    final debts = await _repository.fetchOutstandingDebts();
    return debts.fold<int>(0, (sum, d) => sum + d.remainingAmount);
  }

  /// Muddati o'tgan jami qarz.
  Future<int> totalOverdueDebt() async {
    final debts = await _repository.fetchOverdueDebts();
    return debts.fold<int>(0, (sum, d) => sum + d.remainingAmount);
  }

  /// Qarzdor talabalar soni.
  Future<int> countDebtors() async {
    final debts = await _repository.fetchOutstandingDebts();
    final uniqueStudents = debts.map((d) => d.studentIdentityId).toSet();
    return uniqueStudents.length;
  }

  // ==================== Xarajatlar (chiqim) ====================

  Future<List<Expense>> fetchAllExpenses() => _repository.fetchAllExpenses();

  /// Jami xarajat summasi.
  Future<int> totalExpenses() async {
    final expenses = await _repository.fetchAllExpenses();
    return expenses.fold<int>(0, (sum, e) => sum + e.amount);
  }

  /// Oylik xarajat summasi.
  Future<int> monthlyExpenses({DateTime? month}) async {
    final now = month ?? DateTime.now();
    final start = DateTime(now.year, now.month, 1);
    final end = DateTime(now.year, now.month + 1, 0, 23, 59, 59);
    final expenses = await _repository.fetchExpensesByDateRange(start, end);
    return expenses.fold<int>(0, (sum, e) => sum + e.amount);
  }

  /// Xarajatlar soni.
  Future<int> countExpenses() async {
    final expenses = await _repository.fetchAllExpenses();
    return expenses.length;
  }

  /// Oxirgi 6 oylik moliyaviy statistikasi (kirim + chiqim).
  Future<List<MonthlyFinance>> monthlyFinanceStats() async {
    final now = DateTime.now();
    final payments = await _repository.fetchAll();
    final expenses = await _repository.fetchAllExpenses();

    final result = <MonthlyFinance>[];
    for (int i = 5; i >= 0; i--) {
      final m = DateTime(now.year, now.month - i, 1);
      final mEnd = DateTime(m.year, m.month + 1, 0, 23, 59, 59);

      final income = payments
          .where((p) =>
              p.isCompleted &&
              p.paymentDate.isAfter(m) &&
              p.paymentDate.isBefore(mEnd))
          .fold<int>(0, (sum, p) => sum + p.paidAmount);
      final outcome = expenses
          .where((e) =>
              e.expenseDate.isAfter(m) && e.expenseDate.isBefore(mEnd))
          .fold<int>(0, (sum, e) => sum + e.amount);

      result.add(MonthlyFinance(
        month: '${m.year}-${m.month.toString().padLeft(2, '0')}',
        income: income,
        outcome: outcome,
      ));
    }
    return result;
  }
}

/// Bir oy uchun moliyaviy ko'rsatkichlar (kirim/chiqim).
class MonthlyFinance {
  final String month;
  final int income;
  final int outcome;

  const MonthlyFinance({
    required this.month,
    required this.income,
    required this.outcome,
  });

  int get balance => income - outcome;
}
