import '../entities/notification.dart';

/// Bildirishnomalar ma'lumotlarini saqlash va o'qish uchun repository interfeysi.
abstract class NotificationRepository {
  /// Yangi bildirishnomani saqlaydi.
  Future<AppNotification> save(AppNotification notification);

  /// Bildirishnomani yangilaydi.
  Future<AppNotification> update(AppNotification notification);

  /// Bildirishnoma ID bo'yicha topadi.
  Future<AppNotification?> fetchById(String notificationId);

  /// Barcha bildirishnomalarni qaytaradi.
  Future<List<AppNotification>> fetchAll();

  /// O'qilmagan bildirishnomalarni qaytaradi.
  Future<List<AppNotification>> fetchUnread();

  /// Maqsadli bildirishnomalarni qaytaradi.
  Future<List<AppNotification>> fetchByTarget(String identityId);

  /// Tur bo'yicha bildirishnomalarni qaytaradi.
  Future<List<AppNotification>> fetchByType(NotificationType type);

  /// Bildirishnomani o'qilgan deb belgilaydi.
  Future<AppNotification> markAsRead(String notificationId);

  /// Barcha bildirishnomalarni o'qilgan deb belgilaydi.
  Future<void> markAllAsRead({String? targetIdentityId});

  /// O'qilmaganlar sonini qaytaradi.
  Future<int> countUnread({String? targetIdentityId});

  /// Bildirishnomani arxivlaydi.
  Future<AppNotification> archive(String notificationId);

  /// Eski bildirishnomalarni tozalaydi (30 kundan eski).
  Future<int> cleanupOld({int daysToKeep = 30});
}
