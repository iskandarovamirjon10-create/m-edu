import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/security/pin_lock_service.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// PIN LOCK LIFECYCLE — App Lifecycle Observer for PIN Lock
///
/// When the app comes to foreground and PIN lock is enabled,
/// activates the lock screen. Also re-checks on app start.
///
/// ARCHITECTURE NOTE: This is a pure lifecycle observer. The overlay
/// rendering happens inside MaterialApp.builder (in main.dart) to
/// ensure Directionality, Theme, and Localization context are available.
/// Wrapping MaterialApp with a Stack caused a runtime crash:
/// "No Directionality widget found. Stack widgets require a
/// Directionality widget ancestor."
/// ═══════════════════════════════════════════════════════════════════════
class PinLockLifecycle extends ConsumerStatefulWidget {
  const PinLockLifecycle({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PinLockLifecycle> createState() => _PinLockLifecycleState();
}

class _PinLockLifecycleState extends ConsumerState<PinLockLifecycle>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPinLock();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPinLock();
    }
  }

  Future<void> _checkPinLock() async {
    final enabled = await PinLockService().isEnabled();
    if (!mounted) return;
    if (enabled && mounted) {
      ref.read(pinLockActiveProvider.notifier).state = true;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Whether PIN lock overlay is currently active.
/// Used by PinLockLifecycle (observer) and MaterialApp.builder (renderer).
final pinLockActiveProvider = StateProvider<bool>((ref) => false);
