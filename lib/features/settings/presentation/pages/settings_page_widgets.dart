// QISM: settings_page.dart ning "part" fayli — leaf widgetlar.
//
// `part of` sababli asosiy fayl bilan bir xil privat scopeni bo'lishadi.

part of 'settings_page.dart';

class _SecuritySection extends ConsumerStatefulWidget {
  const _SecuritySection();

  @override
  ConsumerState<_SecuritySection> createState() => _SecuritySectionState();
}

class _SecuritySectionState extends ConsumerState<_SecuritySection> {
  bool? _supported;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final supported = await BiometricService.isAvailable();
    if (!mounted) return;
    setState(() => _supported = supported);
  }

  @override
  Widget build(BuildContext context) {
    if (_supported == null) {
      return const _GlassCard(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      );
    }
    if (!_supported!) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitleText('Xavfsizlik'),
        SizedBox(height: 12),
        _BiometricSettingsCard(),
      ],
    );
  }
}

class _SectionTitleText extends StatelessWidget {
  final String title;
  const _SectionTitleText(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textPrimary,
      ),
    );
  }
}

/// Tebranish bildirishnomalari kartasi.
///
/// Shaxs qo'shilganda, davomat belgilanganda, to'lov qabul qilinganda va
/// boshqa muhim hodisalarda telefon tebranishi yoqiladi/o'chiriladi.
/// Qiymat [SecureSettingsStore]'da saqlanadi (Isar sxemasi o'zgarmaydi).
class _VibrationSettingsCard extends ConsumerStatefulWidget {
  const _VibrationSettingsCard();

  @override
  ConsumerState<_VibrationSettingsCard> createState() =>
      _VibrationSettingsCardState();
}

class _VibrationSettingsCardState
    extends ConsumerState<_VibrationSettingsCard> {
  bool _enabled = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final enabled =
        await ref.read(secureSettingsStoreProvider).isVibrationEnabled();
    if (!mounted) return;
    setState(() => _enabled = enabled);
  }

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: SwitchListTile(
        secondary: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: context.dsColors.accent.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(Icons.vibration, color: context.dsColors.accent),
        ),
        title: Text('Tebranish bildirishnomalari'),
        subtitle: Text(
          "Shaxs qo'shilganda, davomat belgilanganda, to'lov qabul "
          'qilinganda va boshqa hodisalarda telefon tebranadi.',
        ),
        value: _enabled,
        onChanged: (value) async {
          final messenger = ScaffoldMessenger.of(context);
          final bgColor =
              value ? context.dsColors.success : context.dsColors.textSecondary;
          setState(() => _enabled = value);
          await ref
              .read(secureSettingsStoreProvider)
              .setVibrationEnabled(value);
          if (!mounted) return;
          messenger.showSnackBar(
            SnackBar(
              content: Text(
                value ? 'Tebranish yoqildi ✓' : 'Tebranish o\'chirildi',
              ),
              backgroundColor: bgColor,
            ),
          );
        },
      ),
    );
  }
}

/// Biometrik tez kirish sozlamalari kartasi.
class _BiometricSettingsCard extends ConsumerStatefulWidget {
  const _BiometricSettingsCard();

  @override
  ConsumerState<_BiometricSettingsCard> createState() =>
      _BiometricSettingsCardState();
}

class _BiometricSettingsCardState
    extends ConsumerState<_BiometricSettingsCard> {
  bool _enabled = false;
  List<BiometricType> _types = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final enabled =
        await ref.read(settingsRepositoryProvider).isBiometricEnabled();
    final types = await BiometricService.availableTypes();
    if (!mounted) return;
    setState(() {
      _enabled = enabled;
      _types = types;
    });
  }

  String get _biometricLabel {
    if (_types.contains(BiometricType.face)) return 'Face ID';
    return 'Barmoq izi';
  }

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: SwitchListTile(
        secondary: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: context.dsColors.accent.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            _types.isEmpty
                ? Icons.fingerprint
                : BiometricService.iconFor(_types.first),
            color: context.dsColors.accent,
          ),
        ),
        title: Text('$_biometricLabel bilan kirish'),
        subtitle: Text(
          'Tizimga parol kiritmasdan tez kirish. \nOxirgi hisob biometrik tasdiqlangach tiklanadi.',
        ),
        value: _enabled,
        onChanged: (value) async {
          final messenger = ScaffoldMessenger.of(context);
          final bgColor =
              value ? context.dsColors.success : context.dsColors.textSecondary;
          setState(() => _enabled = value);
          // Yoqilayotganda biometrikni darhol tekshiramiz — foydalanuvchi
          // barmoq izini/yuzni tasdiqlab, funksiya ishlashiga ishonch
          // hosil qiladi (muvaffaqiyatsiz bo'lsa o'chirib qo'yamiz).
          if (value) {
            final ok = await BiometricService.authenticate(
              reason: 'Biometrik kirishni yoqish uchun tasdiqlang',
            );
            if (!mounted) return;
            if (!ok) {
              setState(() => _enabled = false);
              messenger.showSnackBar(
                SnackBar(
                  content: Text(
                      'Biometrik tasdiqlanmadi — sozlama o\'zgartirilmadi'),
                  backgroundColor: context.dsColors.error,
                ),
              );
              return;
            }
          }
          await ref.read(settingsRepositoryProvider).setBiometricEnabled(value);
          if (!mounted) return;
          messenger.showSnackBar(
            SnackBar(
              content: Text(
                value
                    ? 'Biometrik kirish yoqildi ✓'
                    : 'Biometrik kirish o\'chirildi',
              ),
              backgroundColor: bgColor,
            ),
          );
        },
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: child,
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: colors.accent.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(DsRadius.sm),
          boxShadow: DsShadow.low,
        ),
        child: Icon(icon, color: colors.accent, size: 20),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: colors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 12,
          color: colors.textSecondary,
        ),
      ),
      trailing: Icon(
        Icons.chevron_right,
        color: colors.textTertiary,
        size: 20,
      ),
      onTap: onTap,
    );
  }
}

/// Kameralarni tarmoqdan avtomatik qidirish varag'i (bottom sheet).
///
/// Skanlash jarayonini progress bar bilan ko'rsatadi va topilgan
/// kameralarni ro'yxat qilib chiqaradi. Birortasi tanlansa — uning
/// IP manzili qaytariladi (Navigator.pop orqali).

/// Til tanlash varianti — neomorphism uslubida.
class _LanguageOption extends StatelessWidget {
  final String label;
  final String flag;
  final bool isSelected;
  final VoidCallback onTap;

  const _LanguageOption({
    required this.label,
    required this.flag,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: EdgeInsets.only(bottom: 8),
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.accent.withValues(alpha: 0.1)
              : colors.surfaceOverlay,
          borderRadius: BorderRadius.circular(DsRadius.sm),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: colors.accent.withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : DsShadow.low,
          border: isSelected
              ? Border.all(color: colors.accent.withValues(alpha: 0.3), width: 1.5)
              : null,
        ),
        child: Row(
          children: [
            Text(flag, style: TextStyle(fontSize: 24)),
            SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected
                      ? colors.accent
                      : colors.textPrimary,
                ),
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle_rounded, color: colors.accent, size: 22),
          ],
        ),
      ),
    );
  }
}

/// Mavzu tanlash varianti — neomorphism uslubida.
class _ThemeOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _ThemeOption({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: EdgeInsets.only(bottom: 8),
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.accent.withValues(alpha: 0.1)
              : colors.surfaceOverlay,
          borderRadius: BorderRadius.circular(DsRadius.sm),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: colors.accent.withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : DsShadow.low,
          border: isSelected
              ? Border.all(color: colors.accent.withValues(alpha: 0.3), width: 1.5)
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isSelected
                    ? colors.accent.withValues(alpha: 0.15)
                    : colors.surfaceOverlay,
                borderRadius: BorderRadius.circular(DsRadius.sm),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isSelected ? colors.accent : colors.textSecondary,
              ),
            ),
            SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected
                      ? colors.accent
                      : colors.textPrimary,
                ),
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle_rounded, color: colors.accent, size: 22),
          ],
        ),
      ),
    );
  }
}
