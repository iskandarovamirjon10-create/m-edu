import 'package:flutter/material.dart';
import '../../../../core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../domain/entities/identity.dart';
import '../../application/commands/register_identity_command.dart';
import '../providers/identity_providers.dart';

/// Yangi shaxsni ro'yxatdan o'tkazish (spec §3 #1).
///
/// Muvaffaqiyatli registratsiya: real ID generatsiya qilinadi,
/// audit hodisa yoziladi va ro'yxat yangilanadi.
class RegisterIdentityPage extends ConsumerStatefulWidget {
  const RegisterIdentityPage({super.key});

  @override
  ConsumerState<RegisterIdentityPage> createState() =>
      _RegisterIdentityPageState();
}

class _RegisterIdentityPageState extends ConsumerState<RegisterIdentityPage> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _middleNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();

  IdentityRole _role = IdentityRole.student;
  bool _submitting = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _middleNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final command = ref.read(registerIdentityCommandProvider);
      final identity = await command.execute(
        RegisterIdentityRequest(
          firstName: _firstNameController.text,
          lastName: _lastNameController.text,
          middleName: _middleNameController.text.isEmpty
              ? null
              : _middleNameController.text,
          role: _role,
          phone: _phoneController.text.isEmpty ? null : _phoneController.text,
          email: _emailController.text.isEmpty ? null : _emailController.text,
        ),
      );

      // C-03: Identity/Student ro'yxatlari `IdentityRegisteredEvent` va
      // `StudentRegisteredEvent` orqali avtomatik yangilanadi — qo'lda
      // state++ shart emas (§79).
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${identity.fullName} ro\'yxatdan o\'tkazildi — ID: ${identity.identityId}',
          ),
          backgroundColor: context.dsColors.success,
        ),
      );
      // BUG-001 (LIVE QA P1): `context.go` shu yerda butun navigatsiya
      // stekini almashtirardi — /identity/:identityId top-level route
      // bo'lgani uchun dashboard (StatefulShell) stekdan tushib qolar va
      // Android back tugmasi ilovani butunlay yopardi. `pushReplacement`
      // ro'yxatdan o'tkazish sahifasini profil bilan almashtiradi — back
      // oldingi sahifaga (dashboard/ro'yxat) qaytadi.
      context.pushReplacement('/identity/${identity.identityId}');
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.identityRegister)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _RoleSelectorHeader(),
                const SizedBox(height: 16),
                _RoleSelector(
                  value: _role,
                  onChanged: (role) => setState(() => _role = role),
                ),
                const SizedBox(height: 28),
                const _SectionTitle('Shaxsiy ma\'lumotlar'),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _firstNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Ism *',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (value) => (value == null || value.trim().isEmpty)
                      ? 'Ism kiriting'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _lastNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Familiya *',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (value) => (value == null || value.trim().isEmpty)
                      ? 'Familiya kiriting'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _middleNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Otasining ismi (ixtiyoriy)',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 28),
                const _SectionTitle('Kontakt'),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Telefon (ixtiyoriy)',
                    hintText: '+998 90 123 45 67',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email (ixtiyoriy)',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) return null;
                    return value.contains('@') ? null : "Email noto'g'ri";
                  },
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text('Ro\'yxatdan o\'tkazish'),
                  ),
                ),
                SizedBox(height: 12),
                Center(
                  child: Text(
                    'Ro\'yxatdan o\'tgach real ID va raqamli ID karta avtomatik yaratiladi',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
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

class _RoleSelectorHeader extends StatelessWidget {
  const _RoleSelectorHeader();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Rolni tanlang',
      style: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: context.dsColors.textPrimary),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textSecondary,
      ),
    );
  }
}

class _RoleSelector extends StatelessWidget {
  final IdentityRole value;
  final ValueChanged<IdentityRole> onChanged;

  const _RoleSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final roles = [
      (IdentityRole.student, Icons.school_outlined, "O'quvchi"),
      (IdentityRole.teacher, Icons.co_present_outlined, "O'qituvchi"),
      (IdentityRole.staff, Icons.badge_outlined, 'Xodim'),
      (IdentityRole.parent, Icons.family_restroom_outlined, 'Ota-ona'),
    ];

    return Row(
      children: [
        for (final (role, icon, label) in roles)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _RoleChip(
                icon: icon,
                label: label,
                selected: value == role,
                onTap: () => onChanged(role),
              ),
            ),
          ),
      ],
    );
  }
}

class _RoleChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _RoleChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: selected
              ? context.dsColors.accent.withValues(alpha: 0.12)
              : Colors.white.withValues(alpha: 0.5),
          border: Border.all(
            color: selected
                ? context.dsColors.accent
                : context.dsColors.border.withValues(alpha: 0.5),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 22,
              color:
                  selected ? context.dsColors.accent : context.dsColors.textSecondary,
            ),
            SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                color: selected
                    ? context.dsColors.accent
                    : context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
