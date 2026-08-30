import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart' show BiometricType;

import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../organization/presentation/providers/organization_providers.dart';
import '../providers/auth_providers.dart';
import '../providers/google_auth_provider.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// LOGIN — CENTERED CARD DESIGN (Uiverse-inspired, M-EDU branded)
///
/// Card-based layout: centered authentication card with soft gradient
/// background, rounded corners, blue shadow, clean typography.
/// Preserves all existing auth logic: local + Google + biometric.
///
/// Responsive: SafeArea + SingleChildScrollView + LayoutBuilder.
/// Accessible: semantic labels, focus indicators, screen reader support.
/// ═══════════════════════════════════════════════════════════════════════
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Login muvaffaqiyatli bo'lgach: tashkilot o'rnatilmagan bo'lsa
  /// first-run wizard'ga, aks holda bosh sahifaga yo'naltiramiz.
  Future<void> _routeAfterLogin() async {
    try {
      final requiresSetup =
          await ref.read(organizationRequiresSetupProvider.future);
      if (!mounted) return;
      context.go(requiresSetup ? '/setup' : '/dashboard');
    } catch (_) {
      if (!mounted) return;
      context.go('/dashboard');
    }
  }

  void _handleLogin() {
    if (_formKey.currentState?.validate() ?? false) {
      HapticFeedback.lightImpact();
      ref.read(authControllerProvider.notifier).login(
            _emailController.text.trim(),
            _passwordController.text,
          );
    }
  }

  void _handleBiometricLogin() {
    ref.read(authControllerProvider.notifier).loginWithBiometric();
  }

  /// Parolni tiklash — lokal auth uchun xavfsiz.
  void _showForgotPassword() {
    final l10n = context.l10n;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.loginForgotTitle),
        content: Text(l10n.loginForgotBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.loginDialogOk),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Muvaffaqiyatli kirish → tegishli sahifaga yo'naltirish.
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (next is AuthStateAuthenticated &&
          previous is! AuthStateAuthenticated) {
        _routeAfterLogin();
      }
    });

    // P0-02 FIX: Google muvaffaqiyatli kirish → bosh sahifaga.
    // Diqqat: _SocialLoginSection ichida ham shu listener bor —
    // bu yerda faqat bir marta ishlaydi (duplicate yo'q).
    ref.listen<GoogleAuthUiState>(googleAuthControllerProvider, (previous, next) {
      if (next is GoogleAuthSuccessState &&
          previous is! GoogleAuthSuccessState) {
        _routeAfterLogin();
      }
    });

    final authState = ref.watch(authControllerProvider);
    final biometricAvailable =
        ref.watch(biometricLoginAvailableProvider).valueOrNull ?? false;
    final errorMessage = authState is AuthStateError ? authState.message : null;
    final isLoading = authState is AuthStateLoading;
    final colors = context.dsColors;

    return Scaffold(
      // Soft gradient background matching CSS: #F8F9FD → white
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colors.scaffold,
              colors.surface,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: MediaQuery.sizeOf(context).width > 600
                    ? 24
                    : 20,
                vertical: 24,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: _LoginCard(
                  formKey: _formKey,
                  emailController: _emailController,
                  passwordController: _passwordController,
                  obscurePassword: _obscurePassword,
                  isLoading: isLoading,
                  errorMessage: errorMessage,
                  biometricAvailable: biometricAvailable,
                  onTogglePassword: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  onLogin: _handleLogin,
                  onBiometric: _handleBiometricLogin,
                  onForgotPassword: _showForgotPassword,
                  onGoogleSignedIn: _routeAfterLogin,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN CARD — Container matching CSS .container
// ═══════════════════════════════════════════════════════════════════════

class _LoginCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool obscurePassword;
  final bool isLoading;
  final String? errorMessage;
  final bool biometricAvailable;
  final VoidCallback onTogglePassword;
  final VoidCallback onLogin;
  final VoidCallback onBiometric;
  final VoidCallback onForgotPassword;
  final VoidCallback onGoogleSignedIn;

  const _LoginCard({
    required this.formKey,
    required this.emailController,
    required this.passwordController,
    required this.obscurePassword,
    required this.isLoading,
    required this.errorMessage,
    required this.biometricAvailable,
    required this.onTogglePassword,
    required this.onLogin,
    required this.onBiometric,
    required this.onForgotPassword,
    required this.onGoogleSignedIn,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        // CSS .container: gradient background
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            colors.surface,
            colors.surface,
          ],
        ),
        borderRadius: DsRadius.xlAll,
        border: Border.all(
          color: colors.surface,
          width: 5,
        ),
        // CSS .container: box-shadow (soft blue)
        boxShadow: [
          BoxShadow(
            color: colors.accent.withValues(alpha: 0.18),
            blurRadius: 30,
            offset: const Offset(0, 30),
            spreadRadius: -20,
          ),
        ],
      ),
      // CSS .container: padding: 25px 35px
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ─── Logo + Heading ────────────────────────────────
            const _LoginLogo(),
            const SizedBox(height: 20),
            Text(
              'M-Edu',
              style: DsType.display(color: colors.accent),
              semanticsLabel: 'M-Edu',
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.loginSubtitle,
              textAlign: TextAlign.center,
              style: DsType.body(color: colors.textSecondary),
            ),
            SizedBox(height: DsSpacing.xl),

            // ─── Email Input ──────────────────────────────────
            Semantics(
              label: context.l10n.loginEmail,
              child: _CardTextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                labelText: context.l10n.loginEmail,
                hintText: context.l10n.loginEmailHint,
                prefixIcon: Icons.email_outlined,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return context.l10n.loginEmailRequired;
                  }
                  // P0-01 FIX: To'g'ri email formati tekshiriladi.
                  final emailRegex = RegExp(
                    r"^[a-zA-Z0-9.!#\$%&'*+/=?^_`{|}~-]+@"
                    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
                    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
                  );
                  if (!emailRegex.hasMatch(value)) {
                    return context.l10n.loginEmailInvalid;
                  }
                  return null;
                },
              ),
            ),
            SizedBox(height: DsSpacing.lg),

            // ─── Password Input ───────────────────────────────
            Semantics(
              label: context.l10n.loginPassword,
              child: _CardTextField(
                controller: passwordController,
                obscureText: obscurePassword,
                labelText: context.l10n.loginPassword,
                hintText: '********',
                prefixIcon: Icons.lock_outline,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                suffixIcon: IconButton(
                  icon: Icon(
                    obscurePassword
                        ? Icons.visibility_off
                        : Icons.visibility,
                    size: 20,
                    semanticLabel: obscurePassword
                        ? 'Show password'
                        : 'Hide password',
                  ),
                  onPressed: onTogglePassword,
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return context.l10n.loginPasswordRequired;
                  }
                  // P0-01 FIX: Parol kamida 8 ta belgi.
                  if (value.length < 8) {
                    return context.l10n.loginPasswordShort;
                  }
                  return null;
                },
              ),
            ),

            // ─── Inline Error ─────────────────────────────────
            _ErrorBanner(message: errorMessage),
            const SizedBox(height: 8),

            // ─── Forgot Password
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: isLoading ? null : onForgotPassword,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  context.l10n.loginForgotPassword,
                  style: DsType.caption(color: colors.accent),
                ),
              ),
            ),
            SizedBox(height: DsSpacing.xl),

            // ─── Primary Login Button ─────────────────────────
            _LoginButton(
              loading: isLoading,
              label: context.l10n.loginButton,
              onPressed: onLogin,
            ),

            // ─── Biometric ────────────────────────────────────
            if (biometricAvailable) ...[
              const SizedBox(height: 14),
              _BiometricButton(
                enabled: !isLoading,
                onPressed: onBiometric,
              ),
            ],

            // ─── Social Login Section
            SizedBox(height: DsSpacing.xl),
            _SocialLoginSection(
              enabled: !isLoading,
              onGoogleSignedIn: onGoogleSignedIn,
            ),

            // ─── Agreement / Register
            SizedBox(height: DsSpacing.lg),
            _LoginFooter(
              isLoading: isLoading,
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOGO — Breathing animation (3s, 1.0↔1.02)
// ═══════════════════════════════════════════════════════════════════════

class _LoginLogo extends StatefulWidget {
  const _LoginLogo();

  @override
  State<_LoginLogo> createState() => _LoginLogoState();
}

class _LoginLogoState extends State<_LoginLogo>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    _scale = Tween(begin: 1.0, end: 1.02).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
      _controller.value = 0;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Semantics(
      label: 'M-Edu logo',
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: colors.accentGradient,
            borderRadius: DsRadius.xlAll,
            boxShadow: [
                BoxShadow(
                  color: colors.accent.withValues(alpha: 0.25),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                  spreadRadius: -2,
                ),
              ],
          ),
          child: const Icon(
            Icons.school_rounded,
            size: 40,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CARD TEXT FIELD — White bg, rounded, shadow, blue focus
// ═══════════════════════════════════════════════════════════════════════

class _CardTextField extends StatelessWidget {
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final String labelText;
  final String hintText;
  final IconData prefixIcon;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final List<String>? autofillHints;

  const _CardTextField({
    this.controller,
    this.keyboardType,
    required this.labelText,
    required this.hintText,
    required this.prefixIcon,
    this.textInputAction,
    this.obscureText = false,
    this.suffixIcon,
    this.validator,
    this.autofillHints,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      validator: validator,
      style: DsType.body(color: colors.textPrimary),
      decoration: InputDecoration(
        labelText: labelText,
        hintText: hintText,
        hintStyle: DsType.body(color: colors.textTertiary),
        labelStyle: DsType.body(color: colors.textTertiary),
        prefixIcon: Icon(prefixIcon, size: 20, color: colors.textTertiary),
        suffixIcon: suffixIcon,
        // CSS .input: white bg, rounded 20px, shadow
        filled: true,
        fillColor: colors.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        // CSS .input: box-shadow (soft blue) via border
        enabledBorder: OutlineInputBorder(
          borderRadius: DsRadius.lgAll,
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: DsRadius.lgAll,
          borderSide: BorderSide(
            color: colors.accent,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: DsRadius.lgAll,
          borderSide: BorderSide(
            color: colors.error,
            width: 1.5,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: DsRadius.lgAll,
          borderSide: BorderSide(
            color: colors.error,
            width: 2,
          ),
        ),
        // CSS .input: box-shadow
        errorStyle: DsType.caption(color: colors.error).copyWith(fontSize: 11),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ERROR BANNER — Inline error with shake animation
// ═══════════════════════════════════════════════════════════════════════

class _ErrorBanner extends StatefulWidget {
  final String? message;

  const _ErrorBanner({this.message});

  @override
  State<_ErrorBanner> createState() => _ErrorBannerState();
}

class _ErrorBannerState extends State<_ErrorBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shake;
  String? _lastShown;

  @override
  void initState() {
    super.initState();
    _shake = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void didUpdateWidget(_ErrorBanner old) {
    super.didUpdateWidget(old);
    if (widget.message != null && widget.message != _lastShown) {
      _lastShown = widget.message;
      if (!MediaQuery.disableAnimationsOf(context)) {
        _shake.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    if (message == null || message.isEmpty) return const SizedBox.shrink();

    final colors = context.dsColors;
    return AnimatedBuilder(
      animation: _shake,
      builder: (context, child) {
        final offset = math.sin(_shake.value * 2 * math.pi * 2) * 6;
        return Transform.translate(
          offset: Offset(offset, 0),
          child: child,
        );
      },
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: colors.errorBg,            borderRadius: DsRadius.mdAll,
          border: Border.all(color: colors.error.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, size: 16, color: colors.error),
            const SizedBox(width: 8),
            Expanded(
              child:              Text(
                message,
                style: DsType.caption(color: colors.error).copyWith(
                  height: 1.3,
                ),

              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN BUTTON — Blue→cyan gradient, rounded, shadow
// ═══════════════════════════════════════════════════════════════════════

class _LoginButton extends StatefulWidget {
  final bool loading;
  final String label;
  final VoidCallback onPressed;

  const _LoginButton({
    required this.loading,
    required this.label,
    required this.onPressed,
  });

  @override
  State<_LoginButton> createState() => _LoginButtonState();
}

class _LoginButtonState extends State<_LoginButton>
    with SingleTickerProviderStateMixin {
  bool _pressed = false;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
      lowerBound: 0.55,
      upperBound: 1.0,
    );
  }

  @override
  void didUpdateWidget(_LoginButton old) {
    super.didUpdateWidget(old);
    if (widget.loading &&
        !MediaQuery.disableAnimationsOf(context) &&
        !_pulseController.isAnimating) {
      _pulseController.repeat(reverse: true);
    } else if (!widget.loading && _pulseController.isAnimating) {
      _pulseController.stop();
      _pulseController.value = 1.0;
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    // P2-07 FIX: Login tugmasi — har doim bosilishi mumkin yoki yo'qligini
    // aniq ko'rsatadi. Loading holatida taps bloklanadi.
    final button = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.loading ? null : (_) => setState(() => _pressed = true),
      onTapUp: widget.loading ? null : (_) => setState(() => _pressed = false),
      onTapCancel: widget.loading ? null : () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            // CSS .login-button: linear-gradient(45deg, #1089D3, #12B1D1)
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.accent,
                colors.accent,
              ],
            ),
            borderRadius: DsRadius.lgAll,
            boxShadow: [
              BoxShadow(
                color: colors.accent.withValues(alpha: 0.35),
                blurRadius: 10,
                offset: const Offset(0, 15),
                spreadRadius: -15,
              ),
            ],
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    widget.label,
                    style: DsType.bodyStrong(color: Colors.white),
                  ),
          ),
        ),
      ),
    );

    // CSS .login-button: loading pulse
    if (widget.loading) {
      return FadeTransition(
        opacity: _pulseController,
        child: button,
      );
    }
    return button;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BIOMETRIC BUTTON
// ═══════════════════════════════════════════════════════════════════════

class _BiometricButton extends ConsumerWidget {
  final bool enabled;
  final VoidCallback onPressed;

  const _BiometricButton({
    required this.enabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final types = ref.watch(biometricTypesProvider).valueOrNull ?? const [];
    final isFace = types.contains(BiometricType.face);
    final colors = context.dsColors;

    return Semantics(
      label: isFace ? 'Sign in with Face ID' : 'Sign in with fingerprint',
      button: true,
      child: GestureDetector(
        onTap: enabled ? onPressed : null,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: DsRadius.lgAll,
            border: Border.all(
              color: colors.border,
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isFace ? Icons.face_retouching_natural : Icons.fingerprint,
                size: 22,
                color: colors.accent,
              ),
              const SizedBox(width: 8),
              Text(
                isFace ? context.l10n.loginFaceId : context.l10n.loginBiometric,
                style: DsType.bodyStrong(color: colors.accent),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SOCIAL LOGIN SECTION — OR divider + circular social buttons
// ═══════════════════════════════════════════════════════════════════════

class _SocialLoginSection extends ConsumerWidget {
  final bool enabled;
  final VoidCallback onGoogleSignedIn;

  const _SocialLoginSection({
    required this.enabled,
    required this.onGoogleSignedIn,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(googleAuthControllerProvider);
    final isLoading = state is GoogleAuthLoading;
    final errorMessage = switch (state) {
      GoogleAuthErrorState(:final message) => message,
      _ => null,
    };
    final colors = context.dsColors;

    // P0-02 FIX: Route handled by parent _LoginPage — no duplicate listener.

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // CSS .social-account-container .title
        Text(
          'OR',
          style: DsType.caption(color: colors.textTertiary),
        ),
        const SizedBox(height: 12),

        // CSS .social-accounts: flex, centered, gap 15px
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Google button
            Semantics(
              label: 'Continue with Google',
              button: true,
              child: _SocialButton(
                enabled: enabled && !isLoading,
                isLoading: isLoading,
                onTap: () {
                  HapticFeedback.lightImpact();
                  ref.read(googleAuthControllerProvider.notifier).signIn();
                },
                child: isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.g_mobiledata,
                        size: 22,
                        color: Colors.white,
                      ),
              ),
            ),
          ],
        ),

        // Inline Google error
        if (errorMessage != null) ...[
          const SizedBox(height: 8),
          Text(
            errorMessage,
            textAlign: TextAlign.center,              style: DsType.caption(color: colors.error),
          ),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SOCIAL BUTTON — Circular, white border, shadow, scale animation
// ═══════════════════════════════════════════════════════════════════════

class _SocialButton extends StatefulWidget {
  final bool enabled;
  final bool isLoading;
  final VoidCallback onTap;
  final Widget child;

  const _SocialButton({
    required this.enabled,
    this.isLoading = false,
    required this.onTap,
    required this.child,
  });

  @override
  State<_SocialButton> createState() => _SocialButtonState();
}

class _SocialButtonState extends State<_SocialButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    // CSS .social-button: bg gradient black→gray, border 5px white,
    // border-radius 50%, 40px, shadow
    return GestureDetector(
      onTapDown: widget.enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: widget.enabled ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: widget.enabled ? () => setState(() => _pressed = false) : null,
      onTap: widget.enabled ? widget.onTap : null,
      child: AnimatedScale(
        scale: _pressed ? 0.9 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.textPrimary,
                colors.textSecondary,
              ],
            ),
            shape: BoxShape.circle,
            border: Border.all(
              color: colors.surface,
              width: 4,
            ),
            boxShadow: [
              BoxShadow(
                color: colors.accent.withValues(alpha: 0.18),
                blurRadius: 10,
                offset: const Offset(0, 8),
                spreadRadius: -8,
              ),
            ],
          ),
          child: Center(child: widget.child),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN FOOTER — Agreement + Register link
// ═══════════════════════════════════════════════════════════════════════

class _LoginFooter extends StatelessWidget {
  final bool isLoading;

  const _LoginFooter({required this.isLoading});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // CSS .agreement: centered, small blue link
        Text(
          context.l10n.loginSecureNote,
          textAlign: TextAlign.center,              style: DsType.caption(
            color: colors.textTertiary,
          ).copyWith(height: 1.4),
        ),
        const SizedBox(height: 12),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              context.l10n.loginNoAccount,
              style: DsType.body(color: colors.textSecondary),
            ),
            TextButton(
              onPressed: isLoading ? null : () => context.push('/register'),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                context.l10n.loginRegister,
                style: DsType.bodyStrong(color: colors.accent),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
