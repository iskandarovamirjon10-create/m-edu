/// Domain event'larni eshitib, read-model/state'ni yangilaydigan
/// proyeksiya (projector) uchun umumiy interfeys.
///
/// C-03: Domain Events → state sinxronizatsiyasi. Har bir proyeksiya
/// o'z feature'ida yashaydi va `EventBus`'dagi o'ziga tegishli
/// hodisalarni kuzatadi. [EventSyncCoordinator] ularni ishga tushiradi
/// va ilova yopilganda [dispose] qiladi.
abstract class EventProjector {
  /// EventBus tinglovchilarini bekor qiladi (memory leak oldini oladi).
  void dispose();
}
