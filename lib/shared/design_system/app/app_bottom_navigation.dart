import 'package:flutter/material.dart';

import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — PASTKI NAVIGATSIYA (PHASE D — mobile shell, brief §4-5)
///
/// Premium floating glass dock. System navigation inset handled via
/// MediaQuery — never overlaps Android gesture/3-button navigation.
/// ═══════════════════════════════════════════════════════════════════════

/// Bottom nav element ta'rifi.
class AppNavDestination {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const AppNavDestination({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

/// Suzuvchi shisha pastki panel — premium floating bottom bar.
///
/// `bottomNavigationBar` slot'ida turadi. System bottom inset
/// qo'shimcha padding sifatida qo'llaniladi — kontent hech qachon
/// Android navigatsiya ustiga chiqmaydi.
class AppBottomNavigationBar extends StatelessWidget {
  final int currentIndex;
  final List<AppNavDestination> destinations;
  final ValueChanged<int> onDestinationSelected;

  const AppBottomNavigationBar({
    super.key,
    required this.currentIndex,
    required this.destinations,
    required this.onDestinationSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    // P2-08 FIX: System nav bar uses ~48dp on 3-button, ~0 on gesture.
    final safeBottom = bottomInset > 0 ? bottomInset : 0.0;

    return Container(
      key: const Key('floating-nav-bar'),
      padding: EdgeInsets.only(bottom: safeBottom),
      decoration: const BoxDecoration(
        color: Colors.transparent,
      ),
      child: Container(
        height: 56,
        margin: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: isDark
              ? const Color(0xFF2A2D35).withValues(alpha: 0.95)
              : Colors.white.withValues(alpha: 0.92),
          borderRadius: DsRadius.xlAll,
          border: Border.all(
            color: isDark
                ? const Color(0xFF374151).withValues(alpha: 0.5)
                : const Color(0xFFE2E8F0).withValues(alpha: 0.8),
            width: 0.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -4,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: [
              for (var i = 0; i < destinations.length; i++)
                Expanded(
                  child: RepaintBoundary(
                    child: _BottomNavItem(
                      destination: destinations[i],
                      isSelected: i == currentIndex,
                      onTap: () => onDestinationSelected(i),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bitta item — smooth transitions, glass surface treatment.
class _BottomNavItem extends StatelessWidget {
  final AppNavDestination destination;
  final bool isSelected;
  final VoidCallback onTap;

  const _BottomNavItem({
    required this.destination,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Semantics(
      container: true,
      button: true,
      label: destination.label,
      selected: isSelected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: DsMotion.normal,
          curve: Curves.easeOutCubic,
          constraints: const BoxConstraints(minHeight: 48),
          decoration: BoxDecoration(
            borderRadius: DsRadius.mdAll,
            color: isSelected
                ? (colors.accent.withValues(alpha: 0.12))
                : Colors.transparent,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isSelected ? destination.activeIcon : destination.icon,
                  size: 22,
                  color: isSelected
                      ? colors.accent
                      : colors.textTertiary,
                ),
                const SizedBox(height: 2),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      destination.label,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.visible,
                      style: DsType.caption(
                        color: isSelected
                            ? colors.accent
                            : colors.textTertiary,
                      ).copyWith(
                        fontSize: 10,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
