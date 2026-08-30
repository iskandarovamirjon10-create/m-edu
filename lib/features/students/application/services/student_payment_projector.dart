import 'dart:async';

import '../../../../core/services/app_logger.dart';

import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/event_bus/event_projector.dart';
import '../../../payments/domain/events/payment_events.dart';
import '../../domain/repositories/student_repository.dart';

/// `PaymentReceivedEvent` → Student read-model proyeksiyasi.
///
/// C-03: To'lov qabul qilinganda Student yozuvidagi `paymentStatus`,
/// `totalPaid`, `lastPaymentDate` maydonlari yangilanadi. Bunga qadar
/// hech kim Student'ning to'lov holatini yangilamasdi — dashboard'dagi
/// "to'lov qilmagan" ogohlantirishi va student profilidagi to'lov holati
/// stale qolardi (§8 source of truth: student to'lov holati to'lovlardan
/// derived — read-model shu proyeksiya orqali sinxronlanadi).
///
/// Student topilmasa (to'lov boshqa turdagi identity'ga tegishli bo'lsa)
/// hech narsa qilinmaydi — noto'g'ri yozuv yaratilmaydi.
class StudentPaymentProjector implements EventProjector {
  final StudentRepository _studentRepository;
  final EventBus _eventBus;

  late final StreamSubscription<PaymentReceivedEvent> _subscription;

  StudentPaymentProjector({
    required StudentRepository studentRepository,
    required EventBus eventBus,
  })  : _studentRepository = studentRepository,
        _eventBus = eventBus {
    _subscription = _eventBus.on<PaymentReceivedEvent>().listen(_handle);
  }

  Future<void> _handle(PaymentReceivedEvent event) async {
    try {
      final payment = event.payment;
      final student = await _studentRepository.fetchByIdentityId(
        payment.studentIdentityId,
      );
      if (student == null) return;

      // P1-001: Incremental update (fast path).
      // Idempotency kafolati: FinancialReconciliationService app ishga
      // tushganda barcha talabalar uchun totalPaid ni to'lovlardan
      // qayta hisoblaydi — crash yoki duplicate event tufayli
      // xatolik bo'lsa ham tuzatiladi.
      final updated = student.copyWith(
        paymentStatus: true,
        totalPaid: student.totalPaid + payment.paidAmount,
        lastPaymentDate: payment.paymentDate,
      );
      await _studentRepository.update(updated);
    } catch (error) {
      AppLogger.warning(
        'StudentPaymentProjector: Student read-model update error: ${error.runtimeType}',
      );
    }
  }

  @override
  void dispose() {
    _subscription.cancel();
  }
}
