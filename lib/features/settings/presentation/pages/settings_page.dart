import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart' show BiometricType;

import '../../../../core/auth/biometric_service.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/theme/app_density.dart';
import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_card.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/app_settings.dart';
import '../providers/settings_providers.dart';
import '../widgets/camera_settings_section.dart';
import '../widgets/monthly_report_section.dart';
import '../providers/printer_providers.dart';
import '../../../../core/services/thermal_printer_service.dart';

part 'settings_page_widgets.dart';

/// Sozlamalar sahifasi (spec §6 #42-45).
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(appSettingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.l10n.settingsTitle,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Theme.of(context).brightness == Brightness.dark
                ? context.dsColors.textPrimary
                : context.dsColors.textPrimary,
          ),
        ),
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1A1D23)
            : const Color(0xFFF0F2F5),
        elevation: 0,
        centerTitle: true,
      ),
      body: settingsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Text('Xato: $error',
                style: TextStyle(color: context.dsColors.error)),
          ),
          data: (settings) {
            return SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionTitle(context, '⚙️ ${context.l10n.settingsGeneral}'),
                  SizedBox(height: 12),
                  _buildGeneralSection(context, ref, settings),
                  SizedBox(height: 24),
                  // Xavfsizlik bo'limi — biometrik qo'llab-quvvatlanmaydigan
                  // qurilmada sarlavha bilan birga yashirinadi.
                  const _SecuritySection(),
                  SizedBox(height: 24),
                  _buildSectionTitle(
                      context, context.l10n.settingsNotifications),
                  SizedBox(height: 12),
                  _buildNotificationSection(context, ref, settings),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, context.l10n.settingsVibration),
                  SizedBox(height: 12),
                  const _VibrationSettingsCard(),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, context.l10n.morePrinter),
                  SizedBox(height: 12),
                  _buildPrinterSection(context, ref),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, context.l10n.moreBackup),
                  SizedBox(height: 12),
                  _buildBackupSection(context, ref, settings),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, 'Face ID — IP kamera'),
                  SizedBox(height: 12),
                  CameraSettingsSection(settings: settings),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, 'Oylik hisobot (Telegram)'),
                  SizedBox(height: 12),
                  MonthlyReportSection(settings: settings),
                  SizedBox(height: 24),
                  _buildSectionTitle(context, context.l10n.moreSubjects),
                  SizedBox(height: 12),
                  _buildSubjectsSection(context, ref),
                  SizedBox(height: 24),
                  // PHASE C/E: foydalanuvchilar bo'limi faqat usersView
                  // ruxsati bo'lganda ko'rsatiladi (security command'da,
                  // UX ham ruxsatsiz bo'limni yashirmaydi).
                  if (Permissions.can(ref.watch(actorRoleProvider),
                      AppPermission.usersView)) ...[
                    _buildSectionTitle(context, context.l10n.moreUsers),
                    SizedBox(height: 12),
                    _buildUsersSection(context, ref),
                    SizedBox(height: 24),
                  ],
                  _buildSectionTitle(context, context.l10n.settingsDesign),
                  SizedBox(height: 12),
                  _buildDesignSection(context, ref, settings),
                  SizedBox(height: 24),
                  _buildAboutSection(context),
                  SizedBox(height: 24),
                ],
              ),
            );
          },
        ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).brightness == Brightness.dark
              ? context.dsColors.textPrimary
              : context.dsColors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildGeneralSection(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    return _GlassCard(
      child: Column(
        children: [
          _SettingsTile(
            icon: Icons.language,
            title: context.l10n.settingsLanguage,
            subtitle: _languageName(settings.language),
            onTap: () => _showLanguagePicker(context, ref, settings),
          ),
          const Divider(height: 1),
          _SettingsTile(
            icon: Icons.dark_mode,
            title: context.l10n.settingsTheme,
            subtitle: _themeModeName(settings.themeMode),
            onTap: () => _showThemePicker(context, ref, settings),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationSection(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    return _GlassCard(
      child: Column(
        children: [
          SwitchListTile(
            title: Text(context.l10n.settingsNotifications),
            subtitle: Text(context.l10n.settingsNotificationsInApp),
            value: settings.notificationsEnabled,
            onChanged: (value) async {
              await ref.read(updateSettingsCommandProvider).execute(
                    settings.copyWith(notificationsEnabled: value),
                  );
              ref.invalidate(appSettingsProvider);
            },
          ),
          SwitchListTile(
            title: Text(context.l10n.settingsPush),
            subtitle: Text(context.l10n.settingsPushDesc),
            value: settings.pushEnabled,
            onChanged: settings.notificationsEnabled
                ? (value) async {
                    await ref.read(updateSettingsCommandProvider).execute(
                          settings.copyWith(pushEnabled: value),
                        );
                    ref.invalidate(appSettingsProvider);
                  }
                : null,
          ),
          SwitchListTile(
            title: Text('SMS'),
            subtitle: Text(context.l10n.settingsSmsDesc),
            value: settings.smsEnabled,
            onChanged: settings.notificationsEnabled
                ? (value) async {
                    await ref.read(updateSettingsCommandProvider).execute(
                          settings.copyWith(smsEnabled: value),
                        );
                    ref.invalidate(appSettingsProvider);
                  }
                : null,
          ),
          SwitchListTile(
            title: Text('Telegram'),
            subtitle: Text(context.l10n.settingsTelegramDesc),
            value: settings.telegramEnabled,
            onChanged: settings.notificationsEnabled
                ? (value) async {
                    await ref.read(updateSettingsCommandProvider).execute(
                          settings.copyWith(telegramEnabled: value),
                        );
                    ref.invalidate(appSettingsProvider);
                  }
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildPrinterSection(BuildContext context, WidgetRef ref) {
    // Thermal printer integratsiyasi — Bluetooth ESC/POS printer.
    final connectionAsync = ref.watch(printerConnectionProvider);
    final connectionState = connectionAsync.valueOrNull ?? PrinterConnectionState.disconnected;
    final isConnected = connectionState == PrinterConnectionState.connected;
    final connectedName = ref.watch(connectedDeviceNameProvider);

    return _GlassCard(
      child: Column(
        children: [
          ListTile(
            leading: Icon(
              Icons.print,
              color: isConnected ? context.dsColors.success : context.dsColors.textSecondary,
            ),
            title: Text('Thermal Printer'),
            subtitle: Text(
              isConnected
                  ? 'Ulangan: ${connectedName ?? "Printer"}'
                  : 'Bluetooth ESC/POS printer',
            ),
            trailing: Container(
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: (isConnected ? context.dsColors.success : context.dsColors.warning)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isConnected ? 'Ulangan' : 'Ulanmagan',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isConnected ? context.dsColors.success : context.dsColors.warning,
                ),
              ),
            ),
            onTap: () => context.push('/settings/printer'),
          ),
        ],
      ),
    );
  }

  Widget _buildBackupSection(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    return _GlassCard(
      child: Column(
        children: [
          SwitchListTile(
            title: Text(context.l10n.settingsAutoBackup),
            subtitle: Text(context.l10n.settingsAutoBackupDesc),
            value: settings.autoBackupEnabled,
            onChanged: (value) async {
              await ref.read(updateSettingsCommandProvider).execute(
                    settings.copyWith(autoBackupEnabled: value),
                  );
              ref.invalidate(appSettingsProvider);
            },
          ),
          if (settings.autoBackupEnabled) ...[
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.calendar_today),
              title: Text(context.l10n.settingsIntervalDays),
              subtitle: Text('${settings.backupIntervalDays} kun'),
              onTap: () => _showBackupIntervalPicker(context, ref, settings),
            ),
          ],
          if (settings.lastBackupDate != null) ...[
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.backup),
              title: Text(context.l10n.settingsLastBackup),
              subtitle: Text(_formatDate(settings.lastBackupDate!)),
            ),
          ],
          const Divider(height: 1),
          ListTile(
            leading: Icon(Icons.backup_outlined, color: context.dsColors.accent),
            title: Text(context.l10n.settingsCreateBackup,
                style: TextStyle(color: context.dsColors.accent)),
            subtitle: Text('Barcha ma\'lumotlar to\'liq zaxiralanadi'),
            onTap: () async {
              // UI darajasidagi dastlabki tekshiruv (early deny) —
              // security esa command ichida (CreateBackupCommand).
              if (!_requirePermission(
                context,
                ref,
                AppPermission.backupCreate,
              )) {
                return;
              }
              try {
                final path =
                    await ref.read(createBackupCommandProvider).execute();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Zaxira yaratildi ✓ ($path)'),
                      backgroundColor: context.dsColors.success,
                    ),
                  );
                }
              } on Failure catch (failure) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(failure.message),
                      backgroundColor: context.dsColors.error,
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Zaxira yaratishda xatolik: $e'),
                      backgroundColor: context.dsColors.error,
                    ),
                  );
                }
              }
            },
          ),
          const Divider(height: 1),
          ListTile(
            leading: Icon(Icons.settings_backup_restore,
                color: context.dsColors.accent),
            title: Text('Zaxira\'dan tiklash',
                style: TextStyle(color: context.dsColors.accent)),
            subtitle: Text(
                'Mavjud zaxira faylidan barcha ma\'lumotlarni tiklash'),
            onTap: () => _showRestorePicker(context, ref),
          ),
        ],
      ),
    );
  }

  /// RBAC: amal uchun ruxsat bo'lmasa xabarni ko'rsatib, false qaytaradi.
  ///
  /// Backup service'ga command orqali emas, to'g'ridan-to'g'ri
  /// murojaat qilinadi — shuning uchun ruxsat tekshiruvi amal
  /// bajarilishidan OLDIN shu yerda bajariladi (spec §32: UI tugmani
  /// yashirish security emas).
  bool _requirePermission(
    BuildContext context,
    WidgetRef ref,
    AppPermission permission,
  ) {
    final role = ref.read(actorRoleProvider);
    if (Permissions.can(role, permission)) return true;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Bu amal uchun ruxsatingiz yetarli emas'),
        backgroundColor: context.dsColors.error,
      ),
    );
    return false;
  }

  /// Avtomatik zaxira davrini tanlash (1/3/7/14/30 kun).
  void _showBackupIntervalPicker(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Zaxira davri (kun)',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ),
            for (final days in const [1, 3, 7, 14, 30])
              ListTile(
                title: Text('$days kun'),
                trailing: settings.backupIntervalDays == days
                    ? Icon(Icons.check, color: context.dsColors.accent)
                    : null,
                onTap: () async {
                  await ref.read(updateSettingsCommandProvider).execute(
                        settings.copyWith(backupIntervalDays: days),
                      );
                  ref.invalidate(appSettingsProvider);
                  if (context.mounted) Navigator.pop(context);
                },
              ),
          ],
        ),
      ),
    );
  }

  /// Zaxira fayllarini ro'yxat qilib, birini tanlash va tiklash.
  Future<void> _showRestorePicker(BuildContext context, WidgetRef ref) async {
    // Restore barcha ma'lumotlarni almashtiradi — buni bajarishdan
    // oldin RBAC tekshiruvi (AUDIT P2-02: manageBackup).
    if (!_requirePermission(context, ref, AppPermission.backupRestore)) return;
    final List<String> backups;
    try {
      backups = await _listBackupFiles();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Zaxira fayllarini o\'qib bo\'lmadi'),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
      return;
    }

    if (backups.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.commonEmpty),
            backgroundColor: context.dsColors.warning,
          ),
        );
      }
      return;
    }

    if (!context.mounted) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Tiklash uchun zaxirani tanlang',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final path in backups)
                    ListTile(
                      leading: Icon(Icons.inventory_2_outlined),
                      title: Text(path.split('/').last),
                      subtitle: Text(path),
                      onTap: () => Navigator.pop(context, path),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (selected == null || !context.mounted) return;

    // Restore oldidan tasdiqlash — joriy ma'lumotlar zaxira bilan
    // almashtiriladi (avtomatik oldingi nusxa yaratiladi).
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Zaxira\'dan tiklash'),
        content: Text(
          "Joriy barcha ma'lumotlar tanlangan zaxira bilan almashtiriladi. "
          'Davom etishdan oldin joriy holat avtomatik zaxiralanadi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Bekor qilish'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Tiklash'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      // RBAC command ichida ham tekshiriladi (RestoreBackupCommand).
      await ref.read(restoreBackupCommandProvider).execute(selected);
      // Barcha state'lar yangilansin — zaxira o'zgargandan keyin barcha
      // sahifalar to'g'ri ma'lumot ko'rsatishi uchun.
      ref.invalidate(appSettingsProvider);
      ref.invalidate(subjectListProvider);
      ref.invalidate(userListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ma\'lumotlar tiklandi ✓'),
            backgroundColor: context.dsColors.success,
          ),
        );
      }
    } on Failure catch (failure) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    } on FormatException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Tiklash muvaffaqiyatsiz: ${e.message}'),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Tiklashda xatolik: $e'),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    }
  }

  /// Backup papkasidagi zaxira fayllarini o'qib, oxirgisidan boshlab
  /// tartiblangan ro'yxatini qaytaradi.
  Future<List<String>> _listBackupFiles() async {
    final dir = await getApplicationSupportDirectory();
    final backupDir = Directory('${dir.path}/backups');
    if (!await backupDir.exists()) return const [];
    final files = backupDir
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.json'))
        .where((f) => !f.path.contains('auto_backup_before_restore'))
        .map((f) => f.path)
        .toList()
      ..sort();
    return files.reversed.toList();
  }

  Widget _buildSubjectsSection(BuildContext context, WidgetRef ref) {
    final subjectsAsync = ref.watch(subjectListProvider);

    return _GlassCard(
      child: subjectsAsync.when(
        loading: () => Center(child: CircularProgressIndicator()),
        error: (error, _) => Text('Xato: $error'),
        data: (subjects) {
          return Column(
            children: [
              if (subjects.isEmpty)
                Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    context.l10n.settingsSubjectsEmpty,
                    style: TextStyle(color: context.dsColors.textSecondary),
                  ),
                )
              else
                for (final subject in subjects)
                  ListTile(
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: context.dsColors.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text(
                          subject.name.substring(0, 1).toUpperCase(),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: context.dsColors.accent,
                          ),
                        ),
                      ),
                    ),
                    title: Text(subject.name),
                    subtitle: subject.code != null ? Text(subject.code!) : null,
                  ),
              ListTile(
                leading: Icon(Icons.add, color: context.dsColors.accent),
                title: Text(context.l10n.settingsSubjectAdd,
                    style: TextStyle(color: context.dsColors.accent)),
                onTap: () => _showAddSubjectDialog(context, ref),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildUsersSection(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(userListProvider);
    final canManage =
        Permissions.can(ref.watch(actorRoleProvider), AppPermission.usersView);

    return _GlassCard(
      child: Column(
        children: [
          // To'liq boshqaruv sahifasi (USER MANAGEMENT — PHASE E).
          ListTile(
            leading:
                Icon(Icons.manage_accounts_outlined, color: context.dsColors.accent),
            title: Text(context.l10n.settingsUsersManage,
                style: TextStyle(color: context.dsColors.accent)),
            subtitle:
                Text('Rollar, holatlar, audit tarixi — to\'liq boshqaruv'),
            trailing: Icon(Icons.chevron_right,
                color: context.dsColors.textSecondary),
            onTap: () => context.push('/settings/users'),
          ),
          const Divider(height: 1),
          ..._buildUserList(context, usersAsync, canManage),
        ],
      ),
    );
  }

  /// Foydalanuvchilar ro'yxati (read-only xulosa).
  List<Widget> _buildUserList(
    BuildContext context,
    AsyncValue<List<AppUser>> usersAsync,
    bool canManage,
  ) {
    if (!canManage) return const [];
    return [
      ...usersAsync.when(
        loading: () => const [
          Center(child: CircularProgressIndicator()),
        ],
        error: (error, _) => [
          Text('Xato: $error'),
        ],
        data: (users) {
          return [
            if (users.isEmpty)
              Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  context.l10n.settingsNoUsersYet,
                  style: TextStyle(color: context.dsColors.textSecondary),
                ),
              )
            else
              for (final user in users)
                ListTile(
                  leading: CircleAvatar(
                    child: Text(user.email.substring(0, 1).toUpperCase()),
                  ),
                  title: Text(user.email),
                  subtitle: Text(_roleName(user.role)),
                ),
          ];
        },
      ),
    ];
  }

  Widget _buildDesignSection(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    return _GlassCard(
      child: Column(
        children: [
          // UI zichligi (Design System 4.0 §9) — compact/comfortable/spacious.
          _SettingsTile(
            icon: Icons.space_dashboard_outlined,
            title: 'Zichlik',
            subtitle: _densityName(ref.watch(appDensityProvider).valueOrNull ??
                AppDensity.comfortable),
            onTap: () => _showDensityPicker(context, ref),
          ),
          const Divider(height: 1),
          Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      context.l10n.settingsGlassIntensity,
                      style: TextStyle(
                        fontSize: 15,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                    Text(
                      '${settings.glassIntensity}%',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.accent,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Slider(
                  value: settings.glassIntensity.toDouble(),
                  min: 0,
                  max: 100,
                  divisions: 20,
                  onChanged: (value) async {
                    await ref.read(updateSettingsCommandProvider).execute(
                          settings.copyWith(glassIntensity: value.round()),
                        );
                    ref.invalidate(appSettingsProvider);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _densityName(AppDensity density) {
    return switch (density) {
      AppDensity.compact => 'Ixcham',
      AppDensity.comfortable => 'Qulay',
      AppDensity.spacious => 'Keng',
    };
  }

  /// Zichlik tanlash varag'i (bottom sheet — AppSheet uslubida, §23).
  void _showDensityPicker(BuildContext context, WidgetRef ref) {
    final current =
        ref.read(appDensityProvider).valueOrNull ?? AppDensity.comfortable;
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Zichlikni tanlang',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ),
            for (final density in AppDensity.values)
              ListTile(
                leading: Icon(
                  switch (density) {
                    AppDensity.compact => Icons.density_small_rounded,
                    AppDensity.comfortable => Icons.density_medium_rounded,
                    AppDensity.spacious => Icons.density_large_rounded,
                  },
                  color: context.dsColors.accent,
                ),
                title: Text(_densityName(density)),
                subtitle: Text(
                  switch (density) {
                    AppDensity.compact => 'Desktop uchun ixcham ko\'rinish',
                    AppDensity.comfortable => 'Tavsiya etilgan muvozanat',
                    AppDensity.spacious => 'Sensorli ekranlar uchun keng',
                  },
                ),
                trailing: current == density
                    ? Icon(Icons.check, color: context.dsColors.accent)
                    : null,
                onTap: () async {
                  await ref
                      .read(secureSettingsStoreProvider)
                      .writeDensity(density.wire);
                  ref.invalidate(appDensityProvider);
                  if (context.mounted) Navigator.pop(context);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAboutSection(BuildContext context) {
    return _GlassCard(
      child: Column(
        children: [
          ListTile(
            leading: Icon(Icons.school, color: context.dsColors.accent),
            title: Text('M-Edu'),
            subtitle: Text(context.l10n.loginSubtitle),
          ),
          const Divider(height: 1),
          ListTile(
            leading: Icon(Icons.info_outline),
            title: Text(context.l10n.settingsVersion),
            subtitle: Text('1.0.0'),
          ),
          // ULTRA CORE §45 — Admin Diagnostics (faqat troubleshooting uchun).
          const Divider(height: 1),
          ListTile(
            leading: Icon(Icons.monitor_heart_outlined,
                color: context.dsColors.accent),
            title: Text('Diagnostika',
                style: TextStyle(color: context.dsColors.accent)),
            subtitle: Text(
                'FPS, tarmoq, sync, kamera, yuz dvigateli, baza holati'),
            trailing: Icon(Icons.chevron_right,
                color: context.dsColors.textSecondary),
            onTap: () => context.push('/settings/diagnostics'),
          ),
        ],
      ),
    );
  }

  String _languageName(String code) {
    return switch (code) {
      'uz' => "O'zbek tili",
      'ru' => 'Русский',
      'en' => 'English',
      _ => code,
    };
  }

  String _themeModeName(AppThemeMode mode) {
    return switch (mode) {
      AppThemeMode.light => "Yorug'",
      AppThemeMode.dark => "Qorong'u",
      AppThemeMode.system => 'Tizim',
    };
  }

  String _roleName(UserRole role) {
    return switch (role) {
      UserRole.superAdmin => 'Super Admin',
      UserRole.director => 'Direktor',
      UserRole.admin => 'Admin',
      UserRole.manager => 'Menejer',
      UserRole.teacher => "O'qituvchi",
      UserRole.staff => 'Xodim',
      UserRole.student => 'O\'quvchi',
      UserRole.parent => 'Ota-ona',
      UserRole.unknown => 'Noma\'lum',
    };
  }

  String _formatDate(DateTime date) {
    return '${date.day}.${date.month.toString().padLeft(2, '0')}.${date.year}';
  }

  void _showLanguagePicker(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? context.dsColors.surfaceRaised
              : context.dsColors.surfaceRaised,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: context.dsColors.textTertiary.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(height: 16),
            Text('Tilni tanlang',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? context.dsColors.textPrimary
                      : context.dsColors.textPrimary,
                )),
            SizedBox(height: 16),
            _LanguageOption(
              label: "O'zbek tili",
              flag: '🇺🇿',
              isSelected: settings.language == 'uz',
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(language: 'uz'),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            _LanguageOption(
              label: 'Русский',
              flag: '🇷🇺',
              isSelected: settings.language == 'ru',
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(language: 'ru'),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            _LanguageOption(
              label: 'English',
              flag: '🇺🇸',
              isSelected: settings.language == 'en',
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(language: 'en'),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showThemePicker(
    BuildContext context,
    WidgetRef ref,
    AppSettings settings,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? context.dsColors.surfaceRaised
              : context.dsColors.surfaceRaised,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: context.dsColors.textTertiary.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(height: 16),
            Text('Mavzuni tanlang',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? context.dsColors.textPrimary
                      : context.dsColors.textPrimary,
                )),
            SizedBox(height: 16),
            _ThemeOption(
              icon: Icons.light_mode_rounded,
              label: "Yorug'",
              isSelected: settings.themeMode == AppThemeMode.light,
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(themeMode: AppThemeMode.light),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            _ThemeOption(
              icon: Icons.dark_mode_rounded,
              label: "Qorong'u",
              isSelected: settings.themeMode == AppThemeMode.dark,
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(themeMode: AppThemeMode.dark),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            _ThemeOption(
              icon: Icons.phone_iphone_rounded,
              label: 'Tizim',
              isSelected: settings.themeMode == AppThemeMode.system,
              onTap: () async {
                await ref.read(updateSettingsCommandProvider).execute(
                      settings.copyWith(themeMode: AppThemeMode.system),
                    );
                ref.invalidate(appSettingsProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showAddSubjectDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.subjectAddTitle),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Fan nomi',
            hintText: 'masalan, Matematika',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Bekor qilish'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.trim().isNotEmpty) {
                final subject = Subject(
                  subjectId: 'SUBJ-${DateTime.now().millisecondsSinceEpoch}',
                  name: controller.text.trim(),
                );
                await ref.read(settingsRepositoryProvider).addSubject(subject);
                ref.invalidate(subjectListProvider);
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: Text('Saqlash'),
          ),
        ],
      ),
    );
  }
}

/// Oylik davomat hisoboti (Telegram) sozlamalari.
///
/// Doim ko'rinib turadi: toggle (yuborishni yoqish/o'chirish), bot token,
/// kontaktlarni sinxronlash va hisobotni qo'lda yuborish tugmalari.
