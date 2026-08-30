import '../entities/payment.dart';
import '../entities/debt.dart';
import '../entities/expense.dart';

/// To'lov ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class PaymentRepository {
  // ==================== To'lovlar ====================

  /// Yangi to'lovni saqlaydi.
  Future<Payment> save(Payment payment);

  /// To'lov holatini yangilaydi.
  Future<Payment> updateStatus(String paymentId, PaymentStatus newStatus);

  /// To'lov ID bo'yicha to'lovni topadi.
  Future<Payment?> fetchById(String paymentId);

  /// Barcha to'lovlarni qaytaradi.
  Future<List<Payment>> fetchAll();

  /// Talaba identity ID bo'yicha to'lovlarni topadi.
  Future<List<Payment>> fetchByStudentId(String studentIdentityId);

  /// Guruh ID bo'yicha to'lovlarni topadi.
  Future<List<Payment>> fetchByGroupId(String groupId);

  /// Sana oralig'i bo'yicha to'lovlarni topadi.
  Future<List<Payment>> fetchByDateRange(DateTime start, DateTime end);

  /// To'lov turini bo'yicha to'lovlarni topadi.
  Future<List<Payment>> fetchByType(PaymentType type);

  /// Oxirgi kvitansiya raqamini qaytaradi.
  Future<String?> lastReceiptNumber();

  /// Identity merge (P0-01): `fromIdentityId` ga bog'langan to'lov va
  /// qarzdorlik yozuvlarini `toIdentityId` ga ko'chiradi (bitta atomik
  /// tranzaksiyada — qisman repoint bo'lib qolmaydi).
  /// Qaytarilgan qiymat: ko'chirilgan yozuvlar soni.
  Future<int> repointPaymentAndDebtReferences(
    String fromIdentityId,
    String toIdentityId,
  );

  /// To'lov + qarzdorlik yangilanishlarini saqlaydi (spec §33 — atomik).
  ///
  /// Default xulq-atvor: ketma-ket `save` + `updateDebt` (eski bilan bir xil).
  /// Real implementatsiya bitta `writeTxn` da bajaradi — qisman holat
  /// qoldirmaydi (to'lov saqlanib, qarz yangilanmay qolish xavfi yo'q).
  Future<Payment> saveWithDebts(Payment payment, List<Debt> debtUpdates) async {
    final saved = await save(payment);
    for (final debt in debtUpdates) {
      await updateDebt(debt);
    }
    return saved;
  }

  // ==================== Qarzdorlik ====================

  /// Yangi qarzdorlikni saqlaydi.
  Future<Debt> saveDebt(Debt debt);

  /// Qarzdorlikni yangilaydi.
  Future<Debt> updateDebt(Debt debt);

  /// Talaba identity ID bo'yicha qarzdorliklarni topadi.
  Future<List<Debt>> fetchDebtsByStudentId(String studentIdentityId);

  /// To'lanmagan qarzdorliklarni qaytaradi.
  Future<List<Debt>> fetchOutstandingDebts();

  /// Muddati o'tgan qarzdorliklarni qaytaradi.
  Future<List<Debt>> fetchOverdueDebts();

  /// Guruh ID bo'yicha qarzdorliklarni topadi.
  Future<List<Debt>> fetchDebtsByGroupId(String groupId);

  /// Qarzdorlikni to'liq to'langan deb belgilaydi.
  Future<Debt> markDebtAsPaid(String debtId);

  /// Eslatma yuborilganligini belgilaydi.
  Future<Debt> markReminderSent(String debtId);

  // ==================== Xarajatlar (chiqim) ====================

  /// Yangi xarajatni saqlaydi.
  Future<Expense> saveExpense(Expense expense);

  /// Xarajatni o'chiradi.
  Future<void> deleteExpense(String expenseId);

  /// Xarajat ID bo'yicha topadi.
  Future<Expense?> fetchExpenseById(String expenseId);

  /// Barcha xarajatlarni qaytaradi.
  Future<List<Expense>> fetchAllExpenses();

  /// Sana oralig'i bo'yicha xarajatlarni topadi.
  Future<List<Expense>> fetchExpensesByDateRange(
    DateTime start,
    DateTime end,
  );
}
