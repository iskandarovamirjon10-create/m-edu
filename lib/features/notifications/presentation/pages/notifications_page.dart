import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design/design.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../domain/entities/notification.dart';
import '../providers/notification_providers.dart';

/// Bildirishnomalar ro'yxati sahifasi (spec §6 #38-40).
class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationListProvider);
    final unreadCount = ref.watch(unreadCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirishnomalar'),
        actions: [
          if ((unreadCount.valueOrNull ?? 0) > 0)
            IconButton(
              tooltip: 'Barchasini o\'qilgan deb belgilash',
              icon: const Icon(Icons.done_all),
              onPressed: _markAllAsRead,
            ),
          IconButton(
            tooltip: 'Eski bildirishnomalarni tozalash',
            icon: const Icon(Icons.delete_sweep),
            onPressed: _cleanupOld,
          ),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text('Xato: $error',
              style: TextStyle(color: context.dsColors.error)),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return const _EmptyNotifications();
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
            itemCount: notifications.length,
            itemBuilder: (context, index) => _NotificationCard(
              notification: notifications[index],
              onTap: () => _markAsRead(notifications[index]),
            ),
          );
        },
      ),
    );
  }

  Future<void> _markAsRead(AppNotification notification) async {
    if (notification.isUnread) {
      await ref
          .read(notificationRepositoryProvider)
          .markAsRead(notification.notificationId);
      ref.invalidate(notificationListVersionProvider);
    }
  }

  Future<void> _markAllAsRead() async {
    await ref.read(notificationRepositoryProvider).markAllAsRead();
    ref.invalidate(notificationListVersionProvider);
  }

  Future<void> _cleanupOld() async {
    final count = await ref.read(notificationRepositoryProvider).cleanupOld();
    ref.invalidate(notificationListVersionProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$count ta eski bildirishnoma tozalandi')),
      );
    }
  }
}

class _NotificationCard extends ConsumerWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationCard({
    required this.notification,
    required this.onTap,
  });

  /// SMS-kanalli navbatdagi bildirishnomani qurilmaning SMS ilovasi
  /// orqali yuborish (matn va raqam oldindan to'ldirilgan holda).
  Future<void> _launchSms(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final targetId = notification.targetIdentityId;
      String? phone;
      if (targetId != null) {
        final identity =
            await ref.read(identityDetailProvider(targetId).future);
        phone = identity?.phone;
      }
      if (phone == null || phone.isEmpty) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('Telefon raqami kiritilmagan — SMS yuborib '),
            backgroundColor: context.dsColors.warning,
          ),
        );
        return;
      }
      final opened = await ref
          .read(smsServiceProvider)
          .launchSms(phone: phone, message: notification.body);
      if (!opened && context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('SMS ilovasini ochib bo\'lmadi'),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    } catch (_) {
      if (!context.mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text('SMS yuborishda xatolik'),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isUnread = notification.isUnread;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: isUnread
              ? context.dsColors.accent.withValues(alpha: 0.05)
              : context.dsColors.surface,
          border: Border.all(
            color: isUnread
                ? context.dsColors.accent.withValues(alpha: 0.3)
                : context.dsColors.border.withValues(alpha: 0.5),
            width: isUnread ? 1.5 : 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -6,
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _typeColor(context).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  notification.icon,
                  style: TextStyle(fontSize: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isUnread
                                ? context.dsColors.textPrimary
                                : context.dsColors.textSecondary,
                          ),
                        ),
                      ),
                      if (isUnread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: context.dsColors.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: TextStyle(
                      fontSize: 13,
                      color: context.dsColors.textSecondary,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        _formatDate(notification.createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: context.dsColors.textTertiary,
                        ),
                      ),
                      SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: context.dsColors.surface,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          notification.channelName,
                          style: TextStyle(
                            fontSize: 10,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                      ),
                      // Yetkazish holati (faqat tashqi kanallar uchun
                      // ma'noli — §16: QUEUED/SENDING/SENT/FAILED).
                      if (notification.channel != DeliveryChannel.inApp)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: _deliveryColor(context)
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              notification.deliveryStateLabel,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: _deliveryColor(context),
                              ),
                            ),
                          ),
                        ),
                      // SMS-kanalli navbatdagi bildirishnoma — real
                      // yuborish tugmasi (qurilma SMS ilovasi ochiladi).
                      if (notification.channel == DeliveryChannel.sms &&
                          notification.deliveryState == DeliveryState.queued)
                        Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: InkWell(
                            onTap: () => _launchSms(context, ref),
                            borderRadius: BorderRadius.circular(6),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: context.dsColors.accent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.sms_outlined,
                                      size: 13, color: context.dsColors.accent),
                                  SizedBox(width: 4),
                                  Text(
                                    'SMS yuborish',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: context.dsColors.accent,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _typeColor(BuildContext context) {
    return switch (notification.type) {
      NotificationType.paymentReminder => context.dsColors.warning,
      NotificationType.paymentReceived => context.dsColors.success,
      NotificationType.attendanceAlert => context.dsColors.error,
      NotificationType.scheduleChange => context.dsColors.info,
      NotificationType.general => context.dsColors.accent,
      NotificationType.system => context.dsColors.textSecondary,
    };
  }

  Color _deliveryColor(BuildContext context) {
    return switch (notification.deliveryState) {
      DeliveryState.queued => context.dsColors.textSecondary,
      DeliveryState.sending => context.dsColors.info,
      DeliveryState.sent => context.dsColors.success,
      DeliveryState.failed => context.dsColors.error,
    };
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} daqiqa oldin';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} soat oldin';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} kun oldin';
    } else {
      return DateFormat('dd.MM.yyyy').format(date);
    }
  }
}

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Icon(
                Icons.notifications_none,
                size: 44,
                color: Colors.white,
              ),
            ),
            SizedBox(height: 24),
            Text(
              "Bildirishnomalar yo'q",
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              "Yangi bildirishnomalar shu yerda paydo bo'ladi.",
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
