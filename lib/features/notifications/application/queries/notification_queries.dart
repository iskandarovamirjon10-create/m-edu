import '../../domain/entities/notification.dart';
import '../../domain/repositories/notification_repository.dart';

/// Bildirishnoma o'qish operatsiyalari (CQRS queries).
class NotificationQueries {
  final NotificationRepository _repository;

  NotificationQueries({required NotificationRepository repository})
      : _repository = repository;

  Future<List<AppNotification>> fetchAll() => _repository.fetchAll();

  Future<List<AppNotification>> fetchUnread() => _repository.fetchUnread();

  Future<List<AppNotification>> fetchByTarget(String identityId) =>
      _repository.fetchByTarget(identityId);

  Future<List<AppNotification>> fetchByType(NotificationType type) =>
      _repository.fetchByType(type);

  Future<int> countUnread({String? targetIdentityId}) =>
      _repository.countUnread(targetIdentityId: targetIdentityId);

  Future<List<AppNotification>> fetchRecent({int limit = 10}) async {
    final all = await _repository.fetchAll();
    return all.take(limit).toList();
  }
}
