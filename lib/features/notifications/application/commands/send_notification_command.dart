import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/notification.dart';
import '../../domain/events/notification_events.dart';
import '../../domain/repositories/notification_repository.dart';

/// Bildirishnoma yuborish uchun so'rov.
class SendNotificationRequest {
  final NotificationType type;
  final String title;
  final String body;
  final String? targetIdentityId;
  final String? relatedId;
  final DeliveryChannel channel;

  const SendNotificationRequest({
    required this.type,
    required this.title,
    required this.body,
    this.targetIdentityId,
    this.relatedId,
    this.channel = DeliveryChannel.inApp,
  });
}

/// `SendNotification` command'i.
class SendNotificationCommand {
  final NotificationRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): bildirishnoma yuborish — Telegram/kanallar.
  final UserRole actorRole;

  SendNotificationCommand({
    required NotificationRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<AppNotification> execute(SendNotificationRequest request) async {
    Permissions.require(actorRole, AppPermission.telegramUse);
    _validate(request);

    final now = DateTime.now();
    // In-app xabar darhol yetkazilgan hisoblanadi; tashqi kanallar
    // (Telegram/Push/SMS) navbatda qoladi va keyin haqiqiy API javobiga
    // qarab sent/failed bo'ladi (§16 — yolg'on "Sent" yo'q).
    final isInApp = request.channel == DeliveryChannel.inApp;
    final notification = AppNotification(
      notificationId: _generateId(),
      type: request.type,
      title: request.title,
      body: request.body,
      targetIdentityId: request.targetIdentityId,
      relatedId: request.relatedId,
      channel: request.channel,
      delivered: isInApp,
      deliveryState: isInApp ? DeliveryState.sent : DeliveryState.queued,
      createdAt: now,
      deliveredAt: isInApp ? now : null,
    );

    final saved = await _repository.save(notification);

    _eventBus.publish(NotificationCreatedEvent(
      notification: saved,
      occurredAt: now,
    ));

    return saved;
  }

  void _validate(SendNotificationRequest request) {
    if (request.title.trim().isEmpty) {
      throw const ValidationFailure('Sarlavha kiritilishi shart');
    }
    if (request.body.trim().isEmpty) {
      throw const ValidationFailure('Matn kiritilishi shart');
    }
  }

  String _generateId() {
    final now = DateTime.now();
    final datePart =
        '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final randomPart = Random().nextInt(99999).toString().padLeft(5, '0');
    return 'NTF-$datePart-$randomPart';
  }
}
