import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../providers/intelligence_providers.dart';
import '../../application/search/intent_search_service.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// COMMAND PALETTE — global buyruq markazi (spec §6, §33).
///
/// CTRL+K bilan ochiladi. Ichida:
/// - qidiruv maydoni (autofocus)
/// - natijalar: amallar + entity'lar + navigatsiya
/// - klaviatura navigatsiyasi: Arrow Up/Down, Enter, Escape, Tab
/// - sichqoncha: hover + click
/// - accessibility: semantics
///
/// MOBILE: touch-friendly, pastki sheet ko'rinishida.
/// DESKTOP: markazda suzuvchi oyna (Windows-first).
///
/// Motion: [CrystalMotion] tokenlari — opacity + scale + y-translation.
/// ═══════════════════════════════════════════════════════════════════════
class CommandPalettePage extends ConsumerStatefulWidget {
  const CommandPalettePage({super.key});

  @override
  ConsumerState<CommandPalettePage> createState() => _CommandPalettePageState();
}

class _CommandPalettePageState extends ConsumerState<CommandPalettePage> {
  final TextEditingController _queryController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  Timer? _debounce;
  int _selectedIndex = 0;

  /// Qidiruv debounce'ı — har belgida butun bazani skan qilmaslik uchun
  /// (performance spec §43, §44).
  static const Duration _debounceDuration = Duration(milliseconds: 150);

  @override
  void initState() {
    super.initState();
    // Autofocus — ochilishi bilan klaviatura tayyor.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _searchFocus.requestFocus();
    });
    _queryController.addListener(_onQueryChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _queryController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    _debounce?.cancel();
    _debounce = Timer(_debounceDuration, () {
      if (!mounted) return;
      // Provider'ni yangilash: query o'zgarganda natijalar qayta hisoblanadi
      // (autoDispose FutureProvider — debounce orqali chaqiriladi).
      ref
          .read(commandPaletteControllerProvider.notifier)
          .setQuery(_queryController.text);
    });
  }

  void _close() {
    ref.read(commandPaletteControllerProvider.notifier).close();
  }

  void _select(int index) {
    if (index < 0) return;
    setState(() => _selectedIndex = index);
  }

  Future<void> _execute(int index) async {
    final results = ref.read(paletteResultsProvider).valueOrNull?.results;
    if (results == null || index < 0 || index >= results.length) return;
    final result = results[index];
    if (result.route.isEmpty) return;

    unawaited(AppHaptics.tap());
    // Recency: bajarilgan buyruqni eslab qolamiz (ranking uchun).
    ref.read(recentUsageTrackerProvider).record(result.title);
    _close();

    if (!mounted) return;
    // Shell branch'lariga go(), qolganlarga push() (MorePage qoidasi).
    if (result.isBranchGo) {
      context.go(result.route);
    } else {
      unawaited(context.push(result.route));
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 600;

    // Natijalar — query o'zgarishi bilan avtomatik yangilanadi.
    final resultsAsync = ref.watch(paletteResultsProvider);
    final results =
        resultsAsync.valueOrNull?.results ?? const <IntentSearchResult>[];
    final loading = resultsAsync.isLoading;

    // Tanlangan indeksni chegaralash (deterministik).
    if (_selectedIndex >= results.length) {
      // build ichida setState qilmaslik uchun post-frame'da.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _selectedIndex >= results.length) {
          setState(
              () => _selectedIndex = results.isEmpty ? 0 : results.length - 1);
        }
      });
    }

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // Barrier — bosish bilan yopiladi.
          Positioned.fill(
            child: GestureDetector(
              onTap: _close,
              child: ColoredBox(
                color: Colors.black.withValues(alpha: 0.35),
              ),
            ),
          ),
          // Markazlashtirilgan/pastki sheet oyna.
          Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: isMobile ? 0 : 24),
              child: Align(
                alignment:
                    isMobile ? Alignment.bottomCenter : Alignment.topCenter,
                child: Padding(
                  padding: EdgeInsets.only(
                    top: isMobile ? 0 : 80,
                    bottom: isMobile ? 24 : 0,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: 620,
                      maxHeight: isMobile
                          ? MediaQuery.of(context).size.height * 0.72
                          : MediaQuery.of(context).size.height * 0.6,
                    ),
                    child: _PaletteSheet(
                      queryController: _queryController,
                      searchFocus: _searchFocus,
                      results: results,
                      loading: loading,
                      selectedIndex: _selectedIndex,
                      isMobile: isMobile,
                      onSelect: _select,
                      onExecute: _execute,
                      onClose: _close,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Palette shishasi — qidiruv + natijalar.
class _PaletteSheet extends StatelessWidget {
  final TextEditingController queryController;
  final FocusNode searchFocus;
  final List<IntentSearchResult> results;
  final bool loading;
  final int selectedIndex;
  final bool isMobile;
  final ValueChanged<int> onSelect;
  final ValueChanged<int> onExecute;
  final VoidCallback onClose;

  const _PaletteSheet({
    required this.queryController,
    required this.searchFocus,
    required this.results,
    required this.loading,
    required this.selectedIndex,
    required this.isMobile,
    required this.onSelect,
    required this.onExecute,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return TweenAnimationBuilder<double>(
      // OPEN: opacity + scale + y-translation (CrystalMotion tokenlari).
      tween: Tween(begin: 0, end: 1),
      duration: DsMotion.normal + const Duration(milliseconds: 40),
      curve: DsMotion.standard,
      builder: (context, t, child) {
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 12 * (1 - t)),
            child: Transform.scale(scale: 0.98 + 0.02 * t, child: child),
          ),
        );
      },
      child: AppSurface.glass(
        elevation: 3,
        enableBlur: true,
        borderRadius: DsRadius.lg,
        child: Column(
          children: [
            // Qidiruv maydoni.
            Semantics(
              textField: true,
              label: 'Buyruq qidirish',
              child: _PaletteSearchField(
                controller: queryController,
                focusNode: searchFocus,
                onEscape: onClose,
                onArrowDown: () => onSelect(
                  (selectedIndex + 1).clamp(0, results.length - 1),
                ),
                onArrowUp: () => onSelect(
                  (selectedIndex - 1).clamp(0, results.length - 1),
                ),
                onEnter: () => onExecute(selectedIndex),
              ),
            ),
            Divider(height: 1, color: colors.divider.withValues(alpha: 0.5)),
            // Natijalar.
            Expanded(child: _buildResults(colors)),
            // ULTRA CORE #17 — klaviatura yordami (desktop): qisqa, sokin
            // footer. Mobil'da klaviatura yo'q — ko'rsatilmaydi.
            if (!isMobile) _KeyboardHelpFooter(colors: colors),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(DsColors colors) {
    if (loading && results.isEmpty) {
      return const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off_rounded,
                size: 40, color: colors.textTertiary),
            const SizedBox(height: 8),
            Text(
              'Qidiruvni boshlang — buyruq yoki talaba nomi',
              style: DsType.body(color: colors.textSecondary),
            ),
          ],
        ),
      );
    }

    return Scrollbar(
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: results.length,
        itemBuilder: (context, index) {
          final result = results[index];
          final selected = index == selectedIndex;
          return _PaletteResultRow(
            result: result,
            selected: selected,
            onTap: () => onExecute(index),
            onHover: () => onSelect(index),
          );
        },
      ),
    );
  }
}

/// Qidiruv maydoni — klaviatura boshqaruvi bilan.
class _PaletteSearchField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onEscape;
  final VoidCallback onArrowDown;
  final VoidCallback onArrowUp;
  final VoidCallback onEnter;

  const _PaletteSearchField({
    required this.controller,
    required this.focusNode,
    required this.onEscape,
    required this.onArrowDown,
    required this.onArrowUp,
    required this.onEnter,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Focus(
      focusNode: focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        // Klaviatura navigatsiyasi (Windows-first):
        // Arrow Up/Down — tanlov, Enter — bajarish, Escape — yopish.
        if (event is! KeyDownEvent) return KeyEventResult.ignored;
        switch (event.logicalKey) {
          case LogicalKeyboardKey.arrowDown:
            onArrowDown();
            return KeyEventResult.handled;
          case LogicalKeyboardKey.arrowUp:
            onArrowUp();
            return KeyEventResult.handled;
          case LogicalKeyboardKey.enter:
            onEnter();
            return KeyEventResult.handled;
          case LogicalKeyboardKey.escape:
            onEscape();
            return KeyEventResult.handled;
          case LogicalKeyboardKey.tab:
            // Tab — keyingi natijaga, Shift+Tab — oldingisiga.
            if (HardwareKeyboard.instance.isShiftPressed) {
              onArrowUp();
            } else {
              onArrowDown();
            }
            return KeyEventResult.handled;
          default:
            return KeyEventResult.ignored;
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Icon(Icons.search_rounded, size: 22, color: colors.accent),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Buyruq yoki qidiruv...',
                  hintStyle: DsType.body(color: colors.textTertiary),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
                style: DsType.body(color: colors.textPrimary),
                onSubmitted: (_) => onEnter(),
              ),
            ),
            // Klaviatura tugmasi ko'rsatkichi (desktop).
            if (!_isMobile(context))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.surfaceOverlay,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'ESC',
                  style: DsType.caption(color: colors.textTertiary),
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < 600;
}

/// Bitta natija qatori — hover/press/focus holatlari bilan.
class _PaletteResultRow extends StatefulWidget {
  final IntentSearchResult result;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onHover;

  const _PaletteResultRow({
    required this.result,
    required this.selected,
    required this.onTap,
    required this.onHover,
  });

  @override
  State<_PaletteResultRow> createState() => _PaletteResultRowState();
}

class _PaletteResultRowState extends State<_PaletteResultRow> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final result = widget.result;
    final iconColor = _iconColor(result.type, colors);
    final selected = widget.selected;

    return Semantics(
      button: true,
      selected: selected,
      label: '${result.title}, ${result.subtitle}',
      child: MouseRegion(
        onEnter: (_) {
          setState(() => _hovered = true);
          widget.onHover();
        },
        onExit: (_) => setState(() => _hovered = false),
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: DsMotion.fast,
            curve: DsMotion.standard,
            margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(DsRadius.md),
              color: selected
                  ? colors.accent.withValues(alpha: 0.12)
                  : (_hovered ? colors.surfaceOverlay : null),
              border: Border.all(
                color: selected
                    ? colors.accent.withValues(alpha: 0.4)
                    : Colors.transparent,
                width: 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(_iconFor(result.iconKey),
                      size: 18, color: iconColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        result.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.bodyStrong(
                          color: selected
                              ? colors.accent
                              : colors.textPrimary,
                        ),
                      ),
                      Text(
                        result.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.caption(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (result.type == SearchResultType.navigation)
                  Icon(Icons.north_west_rounded,
                      size: 14, color: colors.textTertiary),
                if (result.type == SearchResultType.action)
                  Icon(Icons.bolt_rounded, size: 14, color: colors.accent),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _iconColor(SearchResultType type, DsColors colors) {
    return switch (type) {
      SearchResultType.action => colors.accent,
      SearchResultType.entity => colors.accent,
      SearchResultType.navigation => colors.textSecondary,
    };
  }

  IconData _iconFor(String key) {
    return switch (key) {
      'student' => Icons.school_outlined,
      'teacher' => Icons.co_present_outlined,
      'group' => Icons.groups_outlined,
      'payment' => Icons.payments_outlined,
      'debt' => Icons.warning_amber_rounded,
      'attendance' => Icons.how_to_reg_rounded,
      'report' => Icons.insert_chart_outlined,
      'sync' => Icons.sync_rounded,
      'home' => Icons.home_outlined,
      'settings' => Icons.settings_outlined,
      'notification' => Icons.notifications_outlined,
      'add' => Icons.add_circle_outline_rounded,
      'expense' => Icons.request_quote_outlined,
      'face' => Icons.face_retouching_natural,
      'qr' => Icons.qr_code_scanner_rounded,
      'person' => Icons.person_outline_rounded,
      'schedule' => Icons.calendar_month_outlined,
      'profile' => Icons.badge_outlined,
      'view' => Icons.visibility_outlined,
      'edit' => Icons.edit_outlined,
      'notes' => Icons.sticky_note_2_outlined,
      'history' => Icons.history_rounded,
      'restore' => Icons.restore_rounded,
      'receipt' => Icons.receipt_long_outlined,
      'export' => Icons.file_download_outlined,
      _ => Icons.arrow_right_alt_rounded,
    };
  }
}

/// ULTRA CORE #17 — klaviatura yordami footer'ı.
///
/// Desktop'da palette ochilganda mavjud tugmalarni sokin ko'rsatadi:
/// ↑↓ — navigatsiya, Enter — bajarish, Esc — yopish.
class _KeyboardHelpFooter extends StatelessWidget {
  final DsColors colors;

  const _KeyboardHelpFooter({required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceOverlay.withValues(alpha: 0.6),
        border: Border(
          top: BorderSide(color: colors.divider.withValues(alpha: 0.5)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ShortcutKey(label: '↑', hint: 'Harakat'),
          _ShortcutKey(label: '↓', hint: 'Harakat'),
          _ShortcutKey(label: 'Enter', hint: 'Bajarish'),
          _ShortcutKey(label: 'Esc', hint: 'Yopish'),
        ],
      ),
    );
  }
}

class _ShortcutKey extends StatelessWidget {
  final String label;
  final String hint;

  const _ShortcutKey({required this.label, required this.hint});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: colors.surfaceRaised,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(
                color: colors.divider.withValues(alpha: 0.6),
              ),
            ),
            child: Text(
              label,
              style: DsType.caption(
                color: colors.textSecondary,
              ).copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            hint,
            style: DsType.caption(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }
}
