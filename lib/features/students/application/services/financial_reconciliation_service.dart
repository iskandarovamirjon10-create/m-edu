import '../../../payments/domain/repositories/payment_repository.dart';
import '../../domain/repositories/student_repository.dart';

/// P1-001 FIX: MoliyaviyBirdamlik xizmati (Financial Reconciliation).
///
/// Muammo: `StudentPaymentProjector` event orqali `Student.totalPaid` ni
/// yangilaydi — lekin crash, event yo'qolishi yoki projector xatosi
/// tufayli `totalPaid` stale bo'lib qolishi mumkin.
///
/// Yechim: App ishga tushganda yoki davriy ravishda `totalPaid` summasi
/// to'lovlardan (source of truth) qayta hisoblanadi. Bu operatsiya
/// idempotent — bir necha bor bajarilsa ham natija bir xil.
///
/// Arxitektura tanlovi (P1-001):
///   Option A (atomik writeTxn) — Student va Payment alohida aggregate,
///     bitta transaction ichida yangilash ishonchsiz (cross-aggregate).
///   Option B (derived value) — totalPaid is calculator, not stored field.
///     Bu requires changing Student entity + all callers (high risk).
///   Option C (reconciliation) ✅ — RETAINED projection + guaranteed
///     reconciliation. Eng xavfsiz: mavjud arxitekturani buzmaydi,
///     idempotent, crash-safe.
class FinancialReconciliationService {
  final PaymentRepository _paymentRepository;
  final StudentRepository _studentRepository;

  FinancialReconciliationService({
    required PaymentRepository paymentRepository,
    required StudentRepository studentRepository,
  })  : _paymentRepository = paymentRepository,
        _studentRepository = studentRepository;

  /// Barcha talabalar uchun `totalPaid` ni to'lovlardan qayta hisoblaydi.
  ///
  /// Idempotent: agar `totalPaid` allaqachon to'g'ri bo'lsa — o'zgarmaydi.
  /// Natija: tuzatilgan talabalar soni (test/audit uchun).
  Future<int> reconcileAll() async {
    final students = await _studentRepository.fetchAll();
    var fixed = 0;

    for (final student in students) {
      final corrected = await _reconcileStudent(student);
      if (corrected) fixed++;
    }

    return fixed;
  }

  /// Bitta talaba uchun `totalPaid` ni tekshiradi va kerak bo'lsa tuzatadi.
  ///
  /// Natija: `true` = tuzatildi (o'zgardi), `false` = allaqachon to'g'ri.
  Future<bool> _reconcileStudent(dynamic student) async {
    final payments = await _paymentRepository.fetchByStudentId(
      student.identityId,
    );

    // Source of truth: faqat completed to'lovlarning paidAmount yig'indisi.
    final correctTotalPaid = payments
        .where((p) => p.isCompleted)
        .fold<int>(0, (sum, p) => sum + p.paidAmount);

    // paymentStatus ham tekshiriladi — agar completed to'lov bo'lsa
    // paymentStatus true bo'lishi kerak.
    final correctPaymentStatus = payments.any((p) => p.isCompleted);

    // Oxirgi to'lov sanasi.
    DateTime? correctLastPaymentDate;
    final completedPayments =
        payments.where((p) => p.isCompleted).toList();
    if (completedPayments.isNotEmpty) {
      completedPayments.sort((a, b) => b.paymentDate.compareTo(a.paymentDate));
      correctLastPaymentDate = completedPayments.first.paymentDate;
    }

    if (student.totalPaid == correctTotalPaid &&
        student.paymentStatus == correctPaymentStatus) {
      return false; // Allaqachon to'g'ri
    }

    final updated = student.copyWith(
      totalPaid: correctTotalPaid,
      paymentStatus: correctPaymentStatus,
      lastPaymentDate: correctLastPaymentDate,
    );
    await _studentRepository.update(updated);
    return true;
  }
}
