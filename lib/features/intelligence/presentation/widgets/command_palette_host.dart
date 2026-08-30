import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/intelligence_providers.dart';
import '../pages/command_palette_page.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// COMMAND PALETTE HOST — global klaviatura eshitgich + overlay boshqaruvi.
///
/// CTRL+K (Windows/Linux) yoki CMD+K (macOS) bilan ochiladi/yopiladi.
/// Overlay [MainShellPage] darajasida root overlay'ga qo'shiladi — barcha
/// sahifalar ustida ko'rinadi (context-free, offline-safe).
///
/// MOBILE: klaviatura qisqartmasi mavjud emas — palette boshqa yo'llar
/// bilan ham ochilishi mumkin (masalan dashboard qidiruv maydoni orqali,
/// [CommandPaletteController.open]).
/// ═══════════════════════════════════════════════════════════════════════
class CommandPaletteHost extends ConsumerStatefulWidget {
  final Widget child;

  const CommandPaletteHost({super.key, required this.child});

  @override
  ConsumerState<CommandPaletteHost> createState() => _CommandPaletteHostState();
}

class _CommandPaletteHostState extends ConsumerState<CommandPaletteHost> {
  OverlayEntry? _entry;

  @override
  void initState() {
    super.initState();
    // Global klaviatura qisqartmasi — fokus qayerda bo'lsa ham ishlaydi.
    HardwareKeyboard.instance.addHandler(_onKeyEvent);

    // Overlay holatini initial state'da tekshiramiz.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final isOpen = ref.read(
        commandPaletteControllerProvider.select((s) => s.isOpen),
      );
      if (isOpen && _entry == null) {
        _insertOverlay();
      }
    });
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onKeyEvent);
    _entry?.remove();
    super.dispose();
  }

bool _onKeyEvent(KeyEvent event) {
    // KeyRepeatEvent — takroriy bosim (ushlab turish); ishga tushirmaymiz.
    if (event is! KeyDownEvent) return false;
    // CTRL+K (Windows/Linux) / CMD+K (macOS) — HardwareKeyboard orqali.
    final keyboard = HardwareKeyboard.instance;
    final isShortcut = event.logicalKey == LogicalKeyboardKey.keyK &&
        (keyboard.isControlPressed || keyboard.isMetaPressed);
    if (!isShortcut) return false;

    final controller = ref.read(commandPaletteControllerProvider.notifier);
    final state = ref.read(commandPaletteControllerProvider);
    if (state.isOpen) {
      controller.close();
    } else {
      // Joriy marshrutni kontekst sifatida olamiz (ranking uchun).
      final route = _currentRoute();
      controller.open(currentRoute: route);
    }
    return true;
  }

  String? _currentRoute() {
    final router = GoRouter.maybeOf(context);
    if (router == null) return null;
    final location = router.routerDelegate.currentConfiguration.uri.path;
    return location.isEmpty ? null : location;
  }

  @override
  Widget build(BuildContext context) {
    // Palette holatini kuzatamiz — ochilganda overlay qo'shamiz.
    // CRITICAL: Overlay mutation build() ichida taqiqlangan (setState/
    // markNeedsBuild xatosi). Shuning uchun post-frame callback ishlatamiz.
    ref.listen<bool>(
      commandPaletteControllerProvider.select((s) => s.isOpen),
      (previous, next) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (next && _entry == null) {
            _insertOverlay();
          } else if (!next && _entry != null) {
            _removeOverlay();
          }
        });
      },
    );

    return widget.child;
  }

  void _insertOverlay() {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    _entry = OverlayEntry(
      builder: (context) => const CommandPalettePage(),
    );
    overlay.insert(_entry!);
  }

  void _removeOverlay() {
    _entry?.remove();
    _entry = null;
  }
}
