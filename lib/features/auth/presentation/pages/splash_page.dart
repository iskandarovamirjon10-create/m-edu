import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/services/app_logger.dart';
import '../../../../design/design.dart';
import '../providers/auth_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU PREMIUM STARTUP SCREEN
///
/// Phase 1: Logo fade + scale (0.88 → 1.0)
/// Phase 2: Subtle glow ripple
/// Phase 3: "M-Edu" text fade-in
/// Phase 4: Tagline fade-in
/// Phase 5: Loading indicator
///
/// No fake timers. No artificial delays. Auth state drives navigation.
/// ═══════════════════════════════════════════════════════════════════════
class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with TickerProviderStateMixin {
  // Phase 1-2: Logo entrance
  late final AnimationController _logoController;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;

  // Phase 3: Brand text
  late final AnimationController _textController;
  late final Animation<double> _textFade;

  // Phase 4: Tagline
  late final AnimationController _taglineController;
  late final Animation<double> _taglineFade;

  // Phase 5: Loading dots
  late final AnimationController _loadingController;

  // Phase 2: Glow ripple
  late final AnimationController _glowController;
  late final Animation<double> _glowScale;
  late final Animation<double> _glowOpacity;

  // F-S02 FIX: Auth timeout — 10 seconds max.
  Timer? _authTimeoutTimer;
  bool _timedOut = false;

  // P2-07 FIX: Track pending sequence timers for proper disposal.
  // Future.delayed creates FakeAsync timers that leak if not cancelled.
  final List<Timer> _sequenceTimers = [];

  @override
  void initState() {
    super.initState();

    // Phase 1: Logo — 600ms easeOutCubic
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _logoScale = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOutCubic),
    );
    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeOut),
    );

    // Phase 2: Glow — 1200ms, starts with logo
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _glowScale = Tween<double>(begin: 0.6, end: 1.4).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeOut),
    );
    _glowOpacity = Tween<double>(begin: 0.3, end: 0.0).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeOut),
    );

    // Phase 3: Brand text — starts at 300ms
    _textController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _textFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _textController, curve: Curves.easeOut),
    );

    // Phase 4: Tagline — starts at 500ms
    _taglineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _taglineFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _taglineController, curve: Curves.easeOut),
    );

    // Phase 5: Loading dots — continuous subtle pulse
    _loadingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // F-S02 FIX: Auth timeout — 10 seconds max.
    // If auth state doesn't resolve within 10s, show timeout UI.
    _authTimeoutTimer = Timer(const Duration(seconds: 10), _onAuthTimeout);

    // Kick off the sequence
    _startSequence();
  }

  /// F-S02 FIX: Called after 10 seconds if auth state is still
  /// initial or loading. Shows timeout UI with retry.
  void _onAuthTimeout() {
    if (!mounted) return;
    final authState = ref.read(authControllerProvider);
    if (authState is AuthStateInitial || authState is AuthStateLoading) {
      AppLogger.warning('F-S02 Splash auth timeout (10s)');
      setState(() => _timedOut = true);
    }
  }

  /// Retry auth initialization after timeout.
  ///
  /// F-S02 FIX: Re-triggers AuthController.appStarted().
  /// Does NOT clear session, does NOT delete data, does NOT
  /// affect Firebase session. Only re-checks existing session.
  void _retryAuth() {
    if (!mounted) return;
    setState(() => _timedOut = false);
    // Reset timeout timer
    _authTimeoutTimer?.cancel();
    _authTimeoutTimer = Timer(const Duration(seconds: 10), _onAuthTimeout);
    // Re-trigger auth initialization
    ref.read(authControllerProvider.notifier).appStarted();
  }  Future<void> _startSequence() async {
    // P2-07 FIX: Use Timer instead of Future.delayed for testability.
    // Future.delayed creates FakeAsync timers that leak if the widget
    // is disposed before they complete. Timer objects can be explicitly
    // cancelled in dispose().
    _sequenceTimers.add(Timer(const Duration(milliseconds: 50), () {
      if (!mounted) return;
      _logoController.forward();
      _glowController.forward();
    }));
    _sequenceTimers.add(Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      _textController.forward();
    }));
    _sequenceTimers.add(Timer(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      _taglineController.forward();
    }));
  }

  @override
  void dispose() {
    // P2-07 FIX: Cancel ALL pending timers to prevent FakeAsync leaks.
    for (final t in _sequenceTimers) {
      t.cancel();
    }
    _sequenceTimers.clear();
    _authTimeoutTimer?.cancel();
    _logoController.dispose();
    _glowController.dispose();
    _textController.dispose();
    _taglineController.dispose();
    _loadingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Listen for auth state changes — navigate immediately when ready.
    // F-S02 FIX: Cancel timeout if auth resolves before 10s.
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      // Auth resolved — cancel timeout timer (safe even if already fired).
      if (next is AuthStateUnauthenticated || next is AuthStateAuthenticated) {
        _authTimeoutTimer?.cancel();
      }
      if (next is AuthStateUnauthenticated) {
        if (context.mounted) context.go('/login');
      } else if (next is AuthStateAuthenticated) {
        if (context.mounted) context.go('/dashboard');
      }
    });

    final colors = context.dsColors;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness:
            isDark ? Brightness.light : Brightness.dark,
        systemNavigationBarColor: colors.scaffold,
        systemNavigationBarIconBrightness:
            isDark ? Brightness.light : Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: colors.scaffold,
        body: SafeArea(
          child: Semantics(
            label: 'M-Edu splash screen',
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Spacer(flex: 3),
                  // ─── Logo ──────────────────────────────────────────
                  _buildLogo(isDark, colors),
                  SizedBox(height: DsSpacing.xl),
                  // ─── Brand name ────────────────────────────────────
                  _buildBrandText(isDark, colors),
                  SizedBox(height: DsSpacing.md),
                  // ─── Tagline ───────────────────────────────────────
                  _buildTagline(isDark, colors),
                  const Spacer(flex: 2),
                  // ─── Loading indicator or Timeout UI ──────────────
                  if (_timedOut)
                    _buildTimeoutUI(colors)
                  else
                    _buildLoadingIndicator(isDark, colors),
                  SizedBox(height: DsSpacing.xxxl),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo(bool isDark, DsColors colors) {
    return AnimatedBuilder(
      animation: _logoController,
      builder: (context, child) {
        return Opacity(
          opacity: _logoFade.value,
          child: Transform.scale(
            scale: _logoScale.value,
            child: Semantics(
              label: 'M-Edu logo',
              child: child,
            ),
          ),
        );
      },
      child: AnimatedBuilder(
        animation: _glowController,
        builder: (context, child) {
          return Stack(
            alignment: Alignment.center,
            children: [
              // Glow ripple
              Transform.scale(
                scale: _glowScale.value,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.accent
                          .withValues(alpha: _glowOpacity.value),
                      width: 2,
                    ),
                  ),
                ),
              ),
              // Logo container
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  gradient: colors.accentGradient,
                  borderRadius: DsRadius.xlAll,
                  boxShadow: [
                    BoxShadow(
                      color: colors.accent.withValues(alpha: 0.3),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                      spreadRadius: -4,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.school_rounded,
                  size: 44,
                  color: Colors.white,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBrandText(bool isDark, DsColors colors) {
    return AnimatedBuilder(
      animation: _textController,
      builder: (context, child) {
        return Opacity(
          opacity: _textFade.value,
          child: Transform.translate(
            offset: Offset(0, 8 * (1 - _textFade.value)),
            child: Semantics(
              header: true,
              child: Text(
                'M-Edu',
                style: DsType.display(color: colors.textPrimary),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTagline(bool isDark, DsColors colors) {
    return AnimatedBuilder(
      animation: _taglineController,
      builder: (context, child) {
        return Opacity(
          opacity: _taglineFade.value,
          child: Transform.translate(
            offset: Offset(0, 6 * (1 - _taglineFade.value)),
            child: Text(
              context.l10n.splashTagline,
              textAlign: TextAlign.center,
              style: DsType.body(color: colors.textSecondary),
            ),
          ),
        );
      },
    );
  }

  Widget _buildLoadingIndicator(bool isDark, DsColors colors) {
    return AnimatedBuilder(
      animation: _loadingController,
      builder: (context, child) {
        return Semantics(
          label: 'Loading',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (i) {
              final offset = (_loadingController.value + i * 0.33) % 1.0;
              final opacity = (1.0 - (offset * 2)).clamp(0.2, 1.0);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Opacity(
                  opacity: opacity,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.accent,
                    ),
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }

  /// F-S02 FIX: Timeout UI — shown when auth doesn't resolve within 10s.
  ///
  /// Does NOT clear session or data. Only re-triggers auth check.
  Widget _buildTimeoutUI(DsColors colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          label: 'Connection timeout',
          child: Icon(
            Icons.access_time_filled,
            size: 32,
            color: colors.textTertiary,
          ),
        ),
        SizedBox(height: DsSpacing.lg),
        Text(
          context.l10n.splashAuthTimeout,
          textAlign: TextAlign.center,
          style: DsType.body(color: colors.textSecondary),
        ),
        SizedBox(height: DsSpacing.xl),
        DsButton(
          label: context.l10n.actionRetry,
          variant: DsButtonVariant.secondary,
          size: DsButtonSize.sm,
          onPressed: _retryAuth,
        ),
      ],
    );
  }
}
