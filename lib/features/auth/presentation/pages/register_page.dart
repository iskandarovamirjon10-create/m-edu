import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../organization/presentation/providers/organization_providers.dart';
import '../providers/auth_providers.dart';

/// Ro'yxatdan o'tish sahifasi.
class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _routeAfterRegister() async {
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

  void _handleRegister() {
    // P0-01 FIX: Form validatsiyasi majburiy — xatolik bo'lsa hech narsa bo'lmaydi.
    final formState = _formKey.currentState;
    if (formState == null || !formState.validate()) {
      return; // Validatsiya o'tmadi — hech qanday action yo'q.
    }
    formState.save();
    ref.read(authControllerProvider.notifier).register(
          _emailController.text.trim(),
          _passwordController.text,
          _nameController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (next is AuthStateAuthenticated) {
        _routeAfterRegister();
      } else if (next is AuthStateError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.message),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    });

    final authState = ref.watch(authControllerProvider);
    final colors = context.dsColors;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: colors.scaffoldGradient,
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: DsSpacing.pageH.copyWith(
                top: DsSpacing.xl,
                bottom: DsSpacing.xl,
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    // ─── Logo ───────────────────────────────────────────
                    Semantics(
                      label: 'M-Edu registration logo',
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          gradient: colors.accentGradient,
                          borderRadius: DsRadius.xlAll,
                          boxShadow: [
                            BoxShadow(
                              color: colors.accent.withValues(alpha: 0.3),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.person_add_rounded,
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    SizedBox(height: DsSpacing.xl),
                    Semantics(
                      header: true,
                      child: Text(
                        context.l10n.registerTitleCreate,
                        style: DsType.h1(color: colors.textPrimary),
                      ),
                    ),
                    SizedBox(height: DsSpacing.xs),
                    Text(
                      context.l10n.registerInfoPrompt,
                      style: DsType.body(color: colors.textSecondary),
                    ),
                    const SizedBox(height: 28),

                    // ─── Ro'yxatdan o'tish kartasi ─────────────────────
                    DsCard(
                      padding: DsSpacing.cardAll,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Semantics(
                            label: context.l10n.registerFirstName,
                            child: DsTextField(
                              controller: _nameController,
                              labelText: context.l10n.registerFirstName,
                              hintText: 'Abdullayev Abdulla',
                              prefixIcon: Icons.person_outline,
                              textInputAction: TextInputAction.next,
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return context.l10n.registerNameRequired;
                                }
                                return null;
                              },
                            ),
                          ),
                          SizedBox(height: DsSpacing.md),
                          Semantics(
                            label: context.l10n.registerEmail,
                            child: DsTextField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              labelText: context.l10n.registerEmail,
                              hintText: 'info@medu.uz',
                              prefixIcon: Icons.email_outlined,
                              textInputAction: TextInputAction.next,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return context.l10n.loginEmailRequired;
                                }
                                // P0-01 FIX: To'g'ri email formati tekshiriladi.
                                final emailRegex = RegExp(
                                  r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
                                  r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
                                  r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
                                );
                                if (!emailRegex.hasMatch(value)) {
                                  return context.l10n.registerEmailInvalid;
                                }
                                return null;
                              },
                            ),
                          ),
                          SizedBox(height: DsSpacing.md),
                          Semantics(
                            label: context.l10n.registerPassword,
                            child: DsTextField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              labelText: context.l10n.registerPassword,
                              prefixIcon: Icons.lock_outline,
                              textInputAction: TextInputAction.next,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                  size: 20,
                                  semanticLabel: _obscurePassword
                                      ? 'Show password'
                                      : 'Hide password',
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return context.l10n.loginPasswordRequired;
                                }
                                // P0-01 FIX: Parol kamida 8 ta belgi.
                                if (value.length < 8) {
                                  return context.l10n.loginPasswordShort;
                                }
                                // P0-01 FIX: Parol kuchi — katta harf, kichik harf, raqam.
                                final hasUpper =
                                    value.contains(RegExp(r'[A-Z]'));
                                final hasLower =
                                    value.contains(RegExp(r'[a-z]'));
                                final hasDigit =
                                    value.contains(RegExp(r'[0-9]'));
                                if (!hasUpper || !hasLower || !hasDigit) {
                                  return context.l10n.loginPasswordShort;
                                }
                                return null;
                              },
                            ),
                          ),
                          SizedBox(height: DsSpacing.md),
                          Semantics(
                            label: context.l10n.registerConfirm,
                            child: DsTextField(
                              controller: _confirmPasswordController,
                              obscureText: _obscureConfirm,
                              labelText: context.l10n.registerConfirm,
                              hintText: '********',
                              prefixIcon: Icons.lock_outline,
                              textInputAction: TextInputAction.done,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscureConfirm
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                  size: 20,
                                  semanticLabel: _obscureConfirm
                                      ? 'Show password'
                                      : 'Hide password',
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscureConfirm = !_obscureConfirm;
                                  });
                                },
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return context.l10n.registerConfirmRequired;
                                }
                                if (value != _passwordController.text) {
                                  return context.l10n.registerMismatch;
                                }
                                return null;
                              },
                            ),
                          ),
                          SizedBox(height: DsSpacing.xl),
                          DsButton(
                            label: context.l10n.registerButton,
                            isLoading: authState is AuthStateLoading,
                            onPressed: authState is AuthStateLoading
                                ? null
                                : _handleRegister,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: DsSpacing.md),

                    // ─── Kirish havolasi ────────────────────────────────
                    Semantics(
                      link: true,
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            context.l10n.registerHaveAccount,
                            style: DsType.body(color: colors.textSecondary),
                          ),
                          TextButton(
                            onPressed: () => context.pop(),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              context.l10n.loginButton,
                              style: DsType.bodyStrong(color: colors.accent),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
