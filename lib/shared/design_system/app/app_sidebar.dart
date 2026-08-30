import 'package:flutter/material.dart';

import '../../../core/extensions/l10n_context.dart';
import '../../../core/theme/app_density.dart';
import '../../../core/theme/app_motion.dart';
import '../../../design/design.dart';
import '../../../l10n/app_localizations.dart';
import 'app_shell_top_bar.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — DESKTOP SIDEBAR (PHASE D — brief §11-13)
/// ═══════════════════════════════════════════════════════════════════════

class AppSidebarDestination {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final int branchIndex;

  const AppSidebarDestination({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.branchIndex,
  });
}

class AppSidebar extends StatefulWidget {
  final int currentIndex;
  final List<AppSidebarDestination> primary;
  final List<AppSidebarDestination> secondary;
  final List<AppSidebarDestination> utility;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onLogout;

  const AppSidebar({
    super.key,
    required this.currentIndex,
    required this.primary,
    required this.secondary,
    required this.utility,
    required this.onDestinationSelected,
    required this.onLogout,
  });

  @override
  State<AppSidebar> createState() => _AppSidebarState();
}

class _AppSidebarState extends State<AppSidebar> {
  bool _collapsed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final l10n = context.l10n;
    final all = [...widget.primary, ...widget.secondary, ...widget.utility];

    return AnimatedContainer(
      key: const Key('desktop-nav-rail'),
      duration: AppMotion.normal,
      curve: AppMotion.exit,
      width: _collapsed ? 72 : 260,
      decoration: BoxDecoration(
        color: colors.navBg,
        border: Border(
          right: BorderSide(
            color: colors.divider.withValues(alpha: 0.5),
            width: 0.8,
          ),
        ),
      ),
      child: ClipRect(
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 72,
              child: IgnorePointer(
                ignoring: !_collapsed,
                child: AnimatedOpacity(
                  opacity: _collapsed ? 1 : 0,
                  duration: AppMotion.fast,
                  curve: Curves.easeOut,
                  child: _buildCollapsed(colors, l10n, all),
                ),
              ),
            ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 260,
              child: IgnorePointer(
                ignoring: _collapsed,
                child: AnimatedOpacity(
                  opacity: _collapsed ? 0 : 1,
                  duration: AppMotion.fast,
                  curve: Curves.easeOut,
                  child: _buildExpanded(colors, l10n),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _setCollapsed(bool value) => setState(() => _collapsed = value);

  Widget _buildCollapsed(
    DsColors colors,
    AppLocalizations l10n,
    List<AppSidebarDestination> all,
  ) {
    return SafeArea(
      child: Column(
        children: [
          const SizedBox(height: 16),
          _brandLogo(colors),
          const SizedBox(height: 12),
          Tooltip(
            message: l10n.actionExpand,
            child: _SidebarIconButton(
              icon: Icons.chevron_right_rounded,
              label: l10n.actionExpand,
              onTap: () => _setCollapsed(false),
            ),
          ),
          const SizedBox(height: 8),
          for (final d in all)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Center(
                child: Tooltip(
                  message: d.label,
                  waitDuration: const Duration(milliseconds: 400),
                  child: _SidebarIconButton(
                    icon: d.branchIndex == widget.currentIndex
                        ? d.activeIcon
                        : d.icon,
                    label: d.label,
                    isSelected: d.branchIndex == widget.currentIndex,
                    onTap: () => widget.onDestinationSelected(d.branchIndex),
                  ),
                ),
              ),
            ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Center(
              child: AppProfileMenu(
                onLogout: widget.onLogout,
                child: _SidebarIconButton(
                  icon: Icons.person_outline_rounded,
                  label: l10n.navProfile,
                  onTap: null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpanded(DsColors colors, AppLocalizations l10n) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 12, 8),
            child: Row(
              children: [
                _brandLogo(colors),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'M-Edu',
                        style: DsType.h2(color: colors.textPrimary),
                      ),
                      Text(
                        l10n.shellBrandSubtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.caption(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: _CollapseRow(
              label: l10n.actionCollapse,
              onTap: () => _setCollapsed(true),
            ),
          ),
          const SizedBox(height: 8),
          if (widget.primary.isNotEmpty) ...[
            _SectionLabel(label: l10n.navPrimary),
            ...widget.primary.map(
              (d) => _expandedItem(d),
            ),
          ],
          if (widget.secondary.isNotEmpty) ...[
            const SizedBox(height: 10),
            _SectionLabel(label: l10n.navSecondary),
            ...widget.secondary.map(
              (d) => _expandedItem(d),
            ),
          ],
          const Spacer(),
          ...widget.utility.map((d) => _expandedItem(d)),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            child: AppProfileMenu(
              onLogout: widget.onLogout,
              child: _SidebarRow(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: l10n.navProfile,
                isSelected: false,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _expandedItem(AppSidebarDestination d) {
    final selected = d.branchIndex == widget.currentIndex;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Semantics(
        container: true,
        button: true,
        label: d.label,
        selected: selected,
        child: _SidebarRow(
          icon: d.icon,
          activeIcon: d.activeIcon,
          label: d.label,
          isSelected: selected,
          onTap: () => widget.onDestinationSelected(d.branchIndex),
        ),
      ),
    );
  }

  Widget _brandLogo(DsColors colors) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: colors.accentGradient,
        borderRadius: BorderRadius.circular(13),
        boxShadow: [
          BoxShadow(
            color: colors.accent.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: const Icon(
        Icons.school_rounded,
        color: Colors.white,
        size: 22,
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
      child: Text(
        label,
        style: DsType.caption(
          color: context.dsColors.textTertiary,
        ).copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _CollapseRow extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _CollapseRow({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: DsRadius.smAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Icon(
                Icons.chevron_left_rounded,
                size: 20,
                color: colors.textTertiary,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: DsType.caption(color: colors.textTertiary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SidebarRow extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isSelected;
  final VoidCallback? onTap;

  const _SidebarRow({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isSelected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: DsRadius.smAll,
        hoverColor: colors.surfaceOverlay,
        focusColor: colors.accent.withValues(alpha: 0.08),
        splashColor: colors.accent.withValues(alpha: 0.06),
        highlightColor: Colors.transparent,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          curve: AppMotion.exit,
          height: context.appDensity.rowHeight * 0.9,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: DsRadius.smAll,
            color: isSelected
                ? colors.accent.withValues(alpha: 0.12)
                : Colors.transparent,
          ),
          child: Row(
            children: [
              if (isSelected)
                Container(
                  width: 4,
                  height: 20,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: colors.accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              Icon(
                isSelected ? activeIcon : icon,
                size: 22,
                color: isSelected
                    ? colors.accent
                    : colors.textSecondary,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: DsType.body(
                    color: isSelected
                        ? colors.textPrimary
                        : colors.textSecondary,
                  ).copyWith(
                    fontSize: 14,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.w500,
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

class _SidebarIconButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool isSelected;

  const _SidebarIconButton({
    required this.icon,
    required this.label,
    this.onTap,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Semantics(
      button: onTap != null,
      label: label,
      selected: isSelected,
      child: InkWell(
        onTap: onTap,
        borderRadius: DsRadius.smAll,
        hoverColor: colors.surfaceOverlay,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          curve: AppMotion.exit,
          width: context.appDensity.rowHeight,
          height: context.appDensity.rowHeight,
          decoration: BoxDecoration(
            borderRadius: DsRadius.smAll,
            color: isSelected
                ? colors.accent.withValues(alpha: 0.12)
                : Colors.transparent,
          ),
          child: Icon(
            icon,
            size: 22,
            color: isSelected
                ? colors.accent
                : colors.textSecondary,
          ),
        ),
      ),
    );
  }
}
