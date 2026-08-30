import 'package:flutter/material.dart';

import '../../../core/theme/app_responsive.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — PAGE SCAFFOLD (Responsive Content Boundary)
///
/// Provides consistent page-level padding and content width constraints
/// at different breakpoints WITHOUT forcing desktop ERP content into
/// a phone-width container.
///
/// Breakpoints:
///   <600  — full-width, mobile padding
///   600-899 — responsive tablet, no artificial max width
///   900-1199 — desktop hybrid, sidebar available
///   1200+ — desktop ERP layout, full available width
///
/// Different page types define their OWN content strategy via
/// [contentStrategy] — forms, dashboards, tables, and detail pages
/// each have different optimal widths.
/// ═══════════════════════════════════════════════════════════════════════

/// Content width strategy for different page types.
enum PageContentStrategy {
  /// Forms and detail pages — constrained width for readability.
  /// Desktop: max 960px centered.
  forms,

  /// Dashboards — moderate constraint to prevent excessively long lines.
  /// Desktop: max 1440px.
  dashboard,

  /// Tables — use full available width for data density.
  /// No max width constraint.
  tables,

  /// Settings — constrained similar to forms.
  /// Desktop: max 960px centered.
  settings,

  /// Full-width content — no constraint.
  full,
}

class PageScaffold extends StatelessWidget {
  final Widget child;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final PageContentStrategy contentStrategy;
  final bool useSafeArea;

  const PageScaffold({
    super.key,
    required this.child,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.contentStrategy = PageContentStrategy.full,
    this.useSafeArea = true,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: appBar,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final breakpoint = AppBreakpoint.fromWidth(constraints.maxWidth);
          final padding = breakpoint.pagePadding;

          Widget content = Padding(
            padding: padding,
            child: child,
          );

          // Apply content strategy constraints only where appropriate.
          if (_shouldConstrain(breakpoint)) {
            final maxWidth = _maxWidthForStrategy(breakpoint);
            if (maxWidth != double.infinity) {
              content = Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxWidth),
                  child: content,
                ),
              );
            }
          }

          if (useSafeArea) {
            content = SafeArea(top: false, child: content);
          }

          return content;
        },
      ),
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
    );
  }

  bool _shouldConstrain(AppBreakpoint breakpoint) {
    // Tables use full width at all breakpoints.
    if (contentStrategy == PageContentStrategy.tables) return false;
    // Full-width pages don't constrain.
    if (contentStrategy == PageContentStrategy.full) return false;
    // Mobile and tablet: no artificial max width.
    if (breakpoint.isMobile || breakpoint.isTablet) return false;
    // Desktop+: apply strategy constraints.
    return true;
  }

  double _maxWidthForStrategy(AppBreakpoint breakpoint) {
    return switch (contentStrategy) {
      PageContentStrategy.forms => 960,
      PageContentStrategy.dashboard => breakpoint.contentMaxWidth,
      PageContentStrategy.tables => double.infinity,
      PageContentStrategy.settings => 960,
      PageContentStrategy.full => double.infinity,
    };
  }
}

/// ═══════════════════════════════════════════════════════════════════════
/// CONTENT WRAPPER — Wraps page content with responsive padding.
///
/// Use this inside pages that already have their own Scaffold to get
/// consistent responsive padding without needing a new scaffold.
/// ═══════════════════════════════════════════════════════════════════════
class ResponsiveContentPadding extends StatelessWidget {
  final Widget child;
  final bool addBottomPadding;

  const ResponsiveContentPadding({
    super.key,
    required this.child,
    this.addBottomPadding = true,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final breakpoint = AppBreakpoint.fromWidth(constraints.maxWidth);
        final padding = breakpoint.pagePadding;
        final adjustedPadding = addBottomPadding
            ? padding.copyWith(bottom: padding.bottom + 80)
            : padding;
        return Padding(padding: adjustedPadding, child: child);
      },
    );
  }
}
