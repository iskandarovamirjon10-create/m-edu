import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/di/core_providers.dart';
import '../core/event_bus/event_bus.dart';
import '../features/attendance/domain/events/attendance_events.dart';
import '../features/groups/domain/events/group_events.dart';
import '../features/identity/domain/events/identity_events.dart';
import '../features/notifications/domain/events/notification_events.dart';
import '../features/organization/domain/events/organization_events.dart';
import '../features/payments/domain/events/payment_events.dart';
import '../features/scheduling/domain/events/schedule_events.dart';
import '../features/settings/infrastructure/services/secure_settings_store.dart';
import '../features/settings/presentation/providers/settings_providers.dart';
import '../features/students/domain/events/student_events.dart';
import '../features/teachers/domain/events/teacher_events.dart';

/// Tebranish kuchi darajasi.
enum VibrationIntensity {
  /// Kuchsiz (noyob foydalaniladi).
  light,

  /// O'rtacha — kichik hodisalar (guruh, xarajat, bildirishnoma).
  medium,

  /// Kuchli — muhim hodisalar (shaxs qo'shildi, davomat, to'lov).
  heavy,
}

/// Domain Event → telefon tebranishi ko'prigi.
///
/// Foydalanuvchi talabi: \"biron hodisa bo'lganda yoki shaxs qo'shilganda
/// telefon vibratsiya bildirsin\". Har bir muhim biznes hodisasi
/// ([EventBus] orqali) eshitiladi va Android/iOS'da haptic feedback
/// ishga tushiriladi. Desktop (Windows/Linux) va web'da `HapticFeedback`
/// hech narsa qilmaydi — zararsiz no-op.
///
/// Yoqish/o'chirish: Sozlamalar → Bildirishnomalar → \"Tebranish\"
/// ([SecureSettingsStore.isVibrationEnabled], default: yoqilgan).
///
/// Throttle: bir-biriga yaqin hodisalar to'plami (masalan ommaviy
/// eslatma yuborish) qurilmani haddan tashqari tebratib qo'ymasligi
/// uchun 400ms oralig'ida bitta tebranish ruxsat etiladi.
class VibrationCoordinator {
  static const Duration _minInterval = Duration(milliseconds: 400);

  final EventBus _bus;
  final Future<void> Function(VibrationIntensity) _vibrate;
  final Future<bool> Function() _isEnabled;

  final List<StreamSubscription<dynamic>> _subscriptions = [];
  DateTime _lastVibrateAt = DateTime.fromMillisecondsSinceEpoch(0);

  VibrationCoordinator({
    required EventBus bus,
    SecureSettingsStore? store,
    Future<void> Function(VibrationIntensity)? vibrate,
    Future<bool> Function()? isEnabled,
  })  : _bus = bus,
        _vibrate = vibrate ?? _defaultVibrate,
        _isEnabled = isEnabled ??
            (store ?? SecureSettingsStore()).isVibrationEnabled;

  /// Barcha tinglovchilarni ro'yxatdan o'tkazadi.
  void start() {
    // ── Kuchli tebranish: muhim hodisalar ──────────────────────────────
    _on<IdentityRegisteredEvent>((_) => _handle(VibrationIntensity.heavy));
    _on<StudentRegisteredEvent>((_) => _handle(VibrationIntensity.heavy));
    _on<TeacherRegisteredEvent>((_) => _handle(VibrationIntensity.heavy));
    _on<AttendanceMarkedEvent>((_) => _handle(VibrationIntensity.heavy));
    _on<PaymentReceivedEvent>((_) => _handle(VibrationIntensity.heavy));
    _on<DebtCreatedEvent>((_) => _handle(VibrationIntensity.heavy));

    // ── O'rtacha tebranish: qo'shimcha hodisalar ──────────────────────
    _on<IdentityMergedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<DebtPaidEvent>((_) => _handle(VibrationIntensity.medium));
    _on<GroupCreatedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<GroupMemberAddedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<GroupMemberRemovedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<StudentAssignedToGroupEvent>((_) => _handle(VibrationIntensity.medium));
    _on<StudentTransferredEvent>((_) => _handle(VibrationIntensity.medium));
    _on<ExpenseCreatedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<NotificationCreatedEvent>((_) => _handle(VibrationIntensity.medium));
    _on<PaymentReminderSentEvent>((_) => _handle(VibrationIntensity.medium));
    _on<OrganizationSetupCompletedEvent>(
      (_) => _handle(VibrationIntensity.medium),
    );

    // ── Yengil tebranish: jadval/xona o'zgarishlari ────────────────────
    _on<ScheduleCreatedEvent>((_) => _handle(VibrationIntensity.light));
    _on<RoomCreatedEvent>((_) => _handle(VibrationIntensity.light));
  }

  void _on<T extends DomainEvent>(void Function(T event) handler) {
    _subscriptions.add(_bus.on<T>().listen(handler));
  }

  Future<void> _handle(VibrationIntensity level) async {
    if (!await _isEnabled()) return;
    final now = DateTime.now();
    if (now.difference(_lastVibrateAt) < _minInterval) return;
    _lastVibrateAt = now;
    await _vibrate(level);
  }

  /// Standart haptic feedback — Android/iOS'da ishlaydi, desktop'da no-op.
  ///
  /// `HapticFeedback` platform kanali orqali ishlaydi; desktop/web'da
  /// qaysidir platformada xato tashlashi mumkin — tebranish hech qachon
  /// ilovani buzmasligi uchun hamma xato yutiladi (Windows/Linux birinchi
  /// darajali platformalar).
  static Future<void> _defaultVibrate(VibrationIntensity level) async {
    try {
      switch (level) {
        case VibrationIntensity.light:
          await HapticFeedback.lightImpact();
        case VibrationIntensity.medium:
          await HapticFeedback.mediumImpact();
        case VibrationIntensity.heavy:
          await HapticFeedback.heavyImpact();
      }
    } catch (_) {
      // Desktop/web — haptic qo'llab-quvvatlanmaydi, jim o'tkazib yuboramiz.
    }
  }

  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
  }
}

/// Ko'prikni ishga tushiradigan provider.
///
/// `main.dart` dagi `MEduApp.build` da `eventSyncProvider` bilan birga
/// watch qilinadi — ilova hayoti davomida yashaydi.
final vibrationSyncProvider = Provider<VibrationCoordinator>((ref) {
  final coordinator = VibrationCoordinator(
    bus: ref.watch(eventBusProvider),
    store: ref.watch(secureSettingsStoreProvider),
  );
  coordinator.start();
  ref.onDispose(coordinator.dispose);
  return coordinator;
});
