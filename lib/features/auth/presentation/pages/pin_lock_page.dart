import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/pin_lock_lifecycle.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/pin_lock_service.dart';
import '../../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// PIN LOCK PROVIDERS
/// ═══════════════════════════════════════════════════════════════════════

/// Whether PIN lock is currently enabled.
final pinLockEnabledProvider = FutureProvider<bool>((ref) async {
  return PinLockService().isEnabled();
});

/// PIN lock screen visibility state.
/// Canonical definition: lib/app/pin_lock_lifecycle.dart

/// ═══════════════════════════════════════════════════════════════════════
/// PIN LOCK PAGE — Shown when app is locked
/// ═══════════════════════════════════════════════════════════════════════
class PinLockPage extends ConsumerStatefulWidget {
  const PinLockPage({super.key});

  @override
  ConsumerState<PinLockPage> createState() => _PinLockPageState();
}

class _PinLockPageState extends ConsumerState<PinLockPage>
    with SingleTickerProviderStateMixin {
  final _pinController = TextEditingController();
  final _focusNode = FocusNode();
  String? _error;
  bool _loading = false;
  int _lockoutRemaining = 0;

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _shakeController, curve: Curves.easeOut),
    );
    // Auto-focus the PIN input.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _pinController.dispose();
    _focusNode.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final pin = _pinController.text;
    if (pin.isEmpty || pin.length < 4) {
      setState(() => _error = context.l10n.pinLockMinDigits);
      _shakeController.forward(from: 0);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final service = PinLockService();
    final correct = await service.verify(pin);

    if (!mounted) return;

    if (correct) {
      ref.read(pinLockActiveProvider.notifier).state = false;
      // Go back to wherever the user was.
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/dashboard');
      }
    } else {
      setState(() => _loading = false);

      // Show lockout countdown if applicable.
      final remaining = await service.lockoutRemainingSeconds();
      if (!mounted) return;

      if (remaining > 0) {
        setState(() {
          _lockoutRemaining = remaining;
          _error = context.l10n.pinLockTooManyAttempts(remaining);
        });
      } else {
        setState(() => _error = context.l10n.pinLockIncorrect);
      }
      _pinController.clear();
      _shakeController.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        // Prevent back navigation from lock screen.
        if (!didPop) {
          // Force app to background instead.
          SystemChannels.platform.invokeMethod('SystemNavigator.pop');
        }
      },
      child: Scaffold(
        backgroundColor: colors.scaffold,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Lock icon
                  Semantics(
                    label: 'M-Edu lock screen',
                    child: Container(
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
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.lock_outline_rounded,
                        size: 40,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: DsSpacing.xl),
                  Semantics(
                    header: true,
                    child: Text(
                      'M-Edu',
                      style: DsType.h1(color: colors.textPrimary),
                    ),
                  ),
                  const SizedBox(height: DsSpacing.sm),
                  Text(
                    context.l10n.pinLockTitle,
                    style: DsType.body(color: colors.textSecondary),
                  ),
                  const SizedBox(height: DsSpacing.xxl),

                  // PIN input with shake animation
                  AnimatedBuilder(
                    animation: _shakeAnimation,
                    builder: (context, child) {
                      final offset = _shakeAnimation.value > 0
                          ? (1 - _shakeAnimation.value) *
                              8 *
                              (math.sin(_shakeAnimation.value * 6.28 * 2))
                          : 0.0;
                      return Transform.translate(
                        offset: Offset(offset, 0),
                        child: child,
                      );
                    },
                    child: Semantics(
                      label: context.l10n.pinLockTitle,
                      child: TextField(
                        controller: _pinController,
                        focusNode: _focusNode,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        obscureText: true,
                        obscuringCharacter: '●',
                        style: DsType.bodyStrong(color: colors.textPrimary)
                            .copyWith(letterSpacing: 8),
                        textAlign: TextAlign.center,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          counterText: '',
                          hintText: '• • • •',
                          hintStyle: DsType.body(color: colors.textTertiary)
                              .copyWith(letterSpacing: 8),
                          filled: true,
                          fillColor: colors.surface,
                          border: OutlineInputBorder(
                            borderRadius: DsRadius.lgAll,
                            borderSide: BorderSide(
                              color: _error != null
                                  ? colors.error
                                  : colors.border,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: DsRadius.lgAll,
                            borderSide: BorderSide(
                              color: _error != null
                                  ? colors.error.withValues(alpha: 0.5)
                                  : colors.border,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: DsRadius.lgAll,
                            borderSide: BorderSide(
                              color: _error != null
                                  ? colors.error
                                  : colors.accent,
                              width: 2,
                            ),
                          ),
                          errorBorder: OutlineInputBorder(
                            borderRadius: DsRadius.lgAll,
                            borderSide: BorderSide(color: colors.error),
                          ),
                        ),
                        onSubmitted: (_) => _verify(),
                      ),
                    ),
                  ),

                  // Error message
                  if (_error != null) ...[
                    const SizedBox(height: DsSpacing.md),
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: colors.errorBg,
                          borderRadius: DsRadius.mdAll,
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline,
                                size: 18, color: colors.error),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _error!,
                                style: DsType.caption(color: colors.error),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: DsSpacing.xl),

                  // Unlock button
                  SizedBox(
                    width: double.infinity,
                    child: DsButton(
                      label: _lockoutRemaining > 0
                          ? '${_lockoutRemaining}s...'
                          : context.l10n.loginButton,
                      isLoading: _loading,
                      onPressed:
                          (_loading || _lockoutRemaining > 0) ? null : _verify,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Setup PIN page — accessible from Settings.
class PinSetupPage extends ConsumerStatefulWidget {
  const PinSetupPage({super.key});

  @override
  ConsumerState<PinSetupPage> createState() => _PinSetupPageState();
}

class _PinSetupPageState extends ConsumerState<PinSetupPage> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  bool _loading = false;
  bool _isEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadState();
  }

  Future<void> _loadState() async {
    final enabled = await PinLockService().isEnabled();
    if (mounted) setState(() => _isEnabled = enabled);
  }

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _setPin() async {
    final pin = _pinController.text;
    final confirm = _confirmController.text;

    setState(() {
      _loading = true;
      _error = null;
    });

    final service = PinLockService();
    final error = await service.setPin(pin, confirm);

    if (!mounted) return;

    if (error != null) {
      setState(() {
        _loading = false;
        _error = error;
      });
    } else {
      ref.invalidate(pinLockEnabledProvider);
      setState(() {
        _loading = false;
        _isEnabled = true;
        _error = null;
        _pinController.clear();
        _confirmController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.pinSetupSaved),
          backgroundColor: context.dsColors.success,
        ),
      );
    }
  }

  Future<void> _disablePin() async {
    final pin = _pinController.text;
    if (pin.isEmpty) {
      setState(() => _error = context.l10n.pinSetupEnterCurrent);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final service = PinLockService();
    final error = await service.disable(pin);

    if (!mounted) return;

    if (error != null) {
      setState(() {
        _loading = false;
        _error = error;
      });
    } else {
      ref.invalidate(pinLockEnabledProvider);
      setState(() {
        _loading = false;
        _isEnabled = false;
        _error = null;
        _pinController.clear();
        _confirmController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.pinSetupRemoved),
          backgroundColor: context.dsColors.success,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEnabled
              ? context.l10n.pinSetupTitleChange
              : context.l10n.pinSetupTitleSet,
        ),
      ),
      body: SingleChildScrollView(
        padding: DsSpacing.pageH.copyWith(
          top: DsSpacing.xl,
          bottom: DsSpacing.xl,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status card
            DsCard(
              child: Row(
                children: [
                  Icon(
                    _isEnabled
                        ? Icons.lock_outline
                        : Icons.lock_open_outlined,
                    color:
                        _isEnabled ? colors.success : colors.textSecondary,
                    size: 24,
                  ),
                  const SizedBox(width: DsSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isEnabled
                              ? context.l10n.pinSetupEnable
                              : context.l10n.pinSetupDisable,
                          style: DsType.bodyStrong(
                            color: colors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: DsSpacing.xxs),
                        Text(
                          _isEnabled
                              ? context.l10n.pinSetupEnableDesc
                              : context.l10n.pinSetupDisableDesc,
                          style: DsType.caption(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: DsSpacing.xl),

            Text(
              _isEnabled
                  ? context.l10n.pinSetupEnterNew
                  : context.l10n.pinSetupEnterPin,
              style: DsType.bodyStrong(color: colors.textPrimary),
            ),
            const SizedBox(height: DsSpacing.sm),

            // PIN input
            Semantics(
              label: context.l10n.pinSetupEnterPin,
              child: TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                obscureText: true,
                obscuringCharacter: '●',
                style: DsType.bodyStrong(color: colors.textPrimary)
                    .copyWith(letterSpacing: 8),
                textAlign: TextAlign.center,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                ],
                decoration: InputDecoration(
                  counterText: '',
                  hintText: context.l10n.pinSetupDigitsHint,
                  hintStyle: DsType.body(color: colors.textTertiary),
                  filled: true,
                  fillColor: colors.surface,
                  border: OutlineInputBorder(
                    borderRadius: DsRadius.lgAll,
                  ),
                ),
              ),
            ),
            const SizedBox(height: DsSpacing.lg),

            // Confirm PIN
            if (!_isEnabled) ...[
              Text(
                context.l10n.pinSetupConfirm,
                style: DsType.bodyStrong(color: colors.textPrimary),
              ),
              const SizedBox(height: DsSpacing.sm),
              Semantics(
                label: context.l10n.pinSetupConfirm,
                child: TextField(
                  controller: _confirmController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  obscureText: true,
                  obscuringCharacter: '●',
                  style: DsType.bodyStrong(color: colors.textPrimary)
                      .copyWith(letterSpacing: 8),
                  textAlign: TextAlign.center,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: context.l10n.pinSetupDigitsHint,
                    hintStyle: DsType.body(color: colors.textTertiary),
                    filled: true,
                    fillColor: colors.surface,
                    border: OutlineInputBorder(
                      borderRadius: DsRadius.lgAll,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: DsSpacing.lg),
            ],

            // Error
            if (_error != null) ...[
              Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.all(DsSpacing.md),
                  decoration: BoxDecoration(
                    color: colors.errorBg,
                    borderRadius: DsRadius.mdAll,
                  ),
                  child: Text(
                    _error!,
                    style: DsType.caption(color: colors.error),
                  ),
                ),
              ),
              const SizedBox(height: DsSpacing.lg),
            ],

            // Action button
            if (_isEnabled)
              DsButton(
                label: context.l10n.pinSetupRemoveButton,
                variant: DsButtonVariant.destructive,
                isLoading: _loading,
                onPressed: _loading ? null : _disablePin,
              )
            else
              DsButton(
                label: context.l10n.pinSetupSetButton,
                isLoading: _loading,
                onPressed: _loading ? null : _setPin,
              ),
          ],
        ),
      ),
    );
  }
}
