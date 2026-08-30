import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/create_debt_command.dart';
import '../../application/commands/create_expense_command.dart';
import '../../application/commands/receive_payment_command.dart';
import '../../application/queries/payment_queries.dart';
import '../../domain/entities/payment.dart';
import '../../domain/entities/debt.dart';
import '../../domain/entities/expense.dart';
import '../../domain/repositories/payment_repository.dart';
import '../../infrastructure/datasources/isar_payment_datasource.dart';
import '../../infrastructure/repositories_impl/payment_repository_impl.dart';

/// Payment repository provider.
final paymentRepositoryProvider = Provider<PaymentRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return PaymentRepositoryImpl(IsarPaymentDataSource(db.instance));
});

/// Payment queries provider.
final paymentQueriesProvider = Provider<PaymentQueries>(
  (ref) => PaymentQueries(repository: ref.watch(paymentRepositoryProvider)),
);

/// Receive payment command provider.
final receivePaymentCommandProvider = Provider<ReceivePaymentCommand>(
  (ref) => ReceivePaymentCommand(
    repository: ref.watch(paymentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Create debt command provider.
final createDebtCommandProvider = Provider<CreateDebtCommand>(
  (ref) => CreateDebtCommand(
    repository: ref.watch(paymentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Create expense command provider.
final createExpenseCommandProvider = Provider<CreateExpenseCommand>(
  (ref) => CreateExpenseCommand(
    repository: ref.watch(paymentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final paymentListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha to'lovlar ro'yxati.
final paymentListProvider = FutureProvider<List<Payment>>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchAll();
});

/// Talaba to'lovlari ro'yxati.
final paymentsByStudentProvider =
    FutureProvider.family<List<Payment>, String>((ref, studentId) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchByStudentId(studentId);
});

/// Guruh to'lovlari ro'yxati.
final paymentsByGroupProvider =
    FutureProvider.family<List<Payment>, String>((ref, groupId) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchByGroupId(groupId);
});

/// To'lov tafsilotlari.
final paymentDetailProvider =
    FutureProvider.family<Payment?, String>((ref, paymentId) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchById(paymentId);
});

/// Jami to'langan summa.
final totalCollectedProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).totalCollected();
});

/// Oylik to'langan summa.
final monthlyCollectedProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).monthlyCollected();
});

/// To'lovlar soni.
final paymentCountProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).countAll();
});

// ==================== Qarzdorlik ====================

/// To'lanmagan qarzdorliklar.
final outstandingDebtsProvider = FutureProvider<List<Debt>>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchOutstandingDebts();
});

/// Muddati o'tgan qarzdorliklar.
final overdueDebtsProvider = FutureProvider<List<Debt>>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchOverdueDebts();
});

/// Jami qarz miqdori.
final totalDebtProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).totalDebt();
});

/// Qarzdor talabalar soni.
final debtorCountProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).countDebtors();
});

// ==================== Xarajatlar (chiqim) ====================

/// Barcha xarajatlar ro'yxati.
final expenseListProvider = FutureProvider<List<Expense>>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).fetchAllExpenses();
});

/// Jami xarajat.
final totalExpensesProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).totalExpenses();
});

/// Oylik xarajat.
final monthlyExpensesProvider = FutureProvider<int>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).monthlyExpenses();
});

// ==================== Balans va moliyaviy statistika ====================

/// Joriy balans = jami kirim − jami chiqim.
final currentBalanceProvider = FutureProvider<int>((ref) async {
  ref.watch(paymentListVersionProvider);
  final queries = ref.watch(paymentQueriesProvider);
  final income = await queries.totalCollected();
  final outcome = await queries.totalExpenses();
  return income - outcome;
});

/// Oylik balans = oylik kirim − oylik chiqim.
final monthlyBalanceProvider = FutureProvider<int>((ref) async {
  ref.watch(paymentListVersionProvider);
  final queries = ref.watch(paymentQueriesProvider);
  final income = await queries.monthlyCollected();
  final outcome = await queries.monthlyExpenses();
  return income - outcome;
});

/// Oxirgi 6 oylik kirim/chiqim statistikasi.
final monthlyFinanceStatsProvider =
    FutureProvider<List<MonthlyFinance>>((ref) {
  ref.watch(paymentListVersionProvider);
  return ref.watch(paymentQueriesProvider).monthlyFinanceStats();
});
