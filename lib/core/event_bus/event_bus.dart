import 'dart:async';

/// Event-Driven Architecture yadrosi.
///
/// Modullar bir-biriga to'g'ridan-to'g'ri murojaat qilmaydi — faqat ushbu
/// bus orqali hodisalar almashadilar (spec §8: "modullar bir-biriga
/// to'g'ridan-to'g'ri murojaat qilmaydi — faqat event_bus orqali").
abstract class DomainEvent {
  const DomainEvent();

  /// Hodisa sodir bo'lgan vaqt (audit-log uchun zarur).
  DateTime get occurredAt;
}

/// Broadcast stream asosidagi sinxron bo'lmagan (async) event bus.
class EventBus {
  final StreamController<DomainEvent> _controller =
      StreamController<DomainEvent>.broadcast();

  /// Berilgan turdagi hodisalarni kuzatish.
  Stream<T> on<T extends DomainEvent>() =>
      _controller.stream.where((event) => event is T).cast<T>();

  /// Hodisani barcha tinglovchilarga tarqatadi.
  void publish(DomainEvent event) {
    if (!_controller.isClosed) {
      _controller.add(event);
    }
  }

  /// Busni yopadi (ProviderScope dispose paytida chaqiriladi).
  void dispose() {
    if (!_controller.isClosed) {
      _controller.close();
    }
  }
}
