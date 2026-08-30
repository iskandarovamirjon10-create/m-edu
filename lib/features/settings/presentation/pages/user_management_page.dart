import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/local_auth_store.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/app_settings.dart';
import '../providers/settings_providers.dart';

/// Foydalanuvchilarni boshqarish (USER MANAGEMENT — PHASE E).
///
/// Production-ready: ro'yxat + qidiruv + filterlar, profil + permission
/// xulosasi, hayot davri amallari (faollashtirish/to'xtatish/arxivlash/
/// o'chirish/rol o'zgartirish), audit tarixi. Barcha amallar
/// application-layer command'lar orqali (RBAC + audit).
class UserManagementPage extends ConsumerStatefulWidget {
  const UserManagementPage({super.key});

  @override
  ConsumerState<UserManagementPage> createState() =>
      _UserManagementPageState();
}

class _UserManagementPageState extends ConsumerState<UserManagementPage> {
  final _searchController = TextEditingController();
  UserRole? _roleFilter;
  AccountStatus? _statusFilter;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<LocalAccount> _filter(List<LocalAccount> accounts) {
    final query = _searchController.text.trim().toLowerCase();
    return accounts.where((a) {
      final matchesQuery = query.isEmpty ||
          a.email.toLowerCase().contains(query) ||
          a.name.toLowerCase().contains(query);
      // AUDIT P2-03: rol stringi ikkala formatda bo'lishi mumkin
      // ('super_admin' — register, 'superAdmin' — eski create) — fromWire
      // orqali taqqoslash ikkalasini ham qamrab oladi.
      final matchesRole = _roleFilter == null ||
          UserRole.fromWire(a.role) == _roleFilter;
      final matchesStatus =
          _statusFilter == null || a.status == _statusFilter!;
      return matchesQuery && matchesRole && matchesStatus;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final accountsAsync = ref.watch(userAccountsProvider);

    return Scaffold(
      appBar: AppBar(title: Text('Foydalanuvchilar')),
      floatingActionButton: Permissions.can(
              ref.watch(actorRoleProvider), AppPermission.usersCreate)
          ? FloatingActionButton.extended(
              onPressed: () => _showCreateDialog(context),
              icon: Icon(Icons.person_add_alt_1),
              label: Text('Foydalanuvchi'),
            )
          : null,
      body: accountsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline,
                    size: 48, color: context.dsColors.error),
                SizedBox(height: 12),
                Text(
                  "Foydalanuvchilarni yuklab bo'lmadi",
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(userAccountsProvider),
                  child: Text('Qayta urinish'),
                ),
              ],
            ),
          ),
        ),
        data: (accounts) {
          final filtered = _filter(accounts);
          return Column(
            children: [
              // Qidiruv + filterlar
              Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Email yoki ism bo\'yicha qidirish',
                    prefixIcon: Icon(Icons.search),
                    suffixIcon: _searchController.text.isEmpty
                        ? null
                        : IconButton(
                            icon: Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                            },
                          ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    isDense: true,
                  ),
                ),
              ),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    _FilterChip(
                      label: 'Barcha',
                      selected: _roleFilter == null && _statusFilter == null,
                      onSelected: () => setState(() {
                        _roleFilter = null;
                        _statusFilter = null;
                      }),
                    ),
                    for (final role in UserRole.values)
                      _FilterChip(
                        label: _roleLabel(role),
                        selected: _roleFilter == role,
                        onSelected: () => setState(() {
                          _roleFilter = role;
                          _statusFilter = null;
                        }),
                      ),
                    for (final status in AccountStatus.values)
                      if (status != AccountStatus.unknown)
                        _FilterChip(
                          label: _statusLabel(status),
                          selected: _statusFilter == status,
                          onSelected: () => setState(() {
                            _statusFilter = status;
                            _roleFilter = null;
                          }),
                        ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const _EmptyUsers()
                    : ListView.separated(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 88),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final account = filtered[index];
                          return _UserTile(
                            account: account,
                            onTap: () => _showProfile(context, account),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _showCreateDialog(BuildContext context) async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => const _CreateUserDialog(),
    );
    if (created == true && mounted) {
      ref.read(userAccountsVersionProvider.notifier).state++;
    }
  }

  void _showProfile(BuildContext context, LocalAccount account) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _UserProfileSheet(
        account: account,
        onChanged: () {
          ref.read(userAccountsVersionProvider.notifier).state++;
          if (mounted) setState(() {});
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onSelected;
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 4),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
        visualDensity: VisualDensity.compact,
        labelStyle: TextStyle(
          fontSize: 12,
          color: selected ? Colors.white : context.dsColors.textSecondary,
        ),
        selectedColor: context.dsColors.accent,
        backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
        checkmarkColor: Colors.white,
        side: BorderSide.none,
      ),
    );
  }
}

class _UserTile extends StatelessWidget {
  final LocalAccount account;
  final VoidCallback onTap;
  const _UserTile({required this.account, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.dsColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border:
                Border.all(color: context.dsColors.border.withValues(alpha: 0.5)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: context.dsColors.accent.withValues(alpha: 0.12),
                child: Text(
                  _initialOf(account.name, account.email),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.accent,
                  ),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.name.isEmpty ? account.email : account.name,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 2),
                    Text(
                      account.email,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              _StatusBadge(status: account.status),
              SizedBox(width: 8),
              Container(
                padding:
                    EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: context.dsColors.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _roleLabel(_roleFromName(account.role)),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.accent,
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

class _StatusBadge extends StatelessWidget {
  final AccountStatus status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      AccountStatus.active => (context.dsColors.success, 'Faol'),
      AccountStatus.suspended => (context.dsColors.warning, 'To\'xtatilgan'),
      AccountStatus.archived => (context.dsColors.textSecondary, 'Arxiv'),
      AccountStatus.unknown => (context.dsColors.error, 'Noma\'lum'),
    };
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

/// Foydalanuvchi profili (bottom sheet): ma'lumot, permission xulosasi,
/// hayot davri amallari, audit tarixi.
class _UserProfileSheet extends ConsumerWidget {
  final LocalAccount account;
  final VoidCallback onChanged;
  const _UserProfileSheet({required this.account, required this.onChanged});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
  final role = _roleFromName(account.role);
    final actorRole = ref.watch(actorRoleProvider);
    final grantedPermissions = [
      for (final permission in AppPermission.values)
        if (Permissions.can(role, permission)) permission,
    ];
    final auditEntries = ref.watch(auditLogListProvider).valueOrNull ?? const [];
    final userAudit = auditEntries
        .where((e) => e.targetType == 'user' && e.targetId == account.email)
        .take(8)
        .toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: BoxDecoration(
        color: Color(0xFFF7F7F9),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.dsColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            SizedBox(height: 16),
            // Header
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: context.dsColors.accent.withValues(alpha: 0.12),
                  child: Text(
                    _initialOf(account.name, account.email),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: context.dsColors.accent,
                    ),
                  ),
                ),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        account.name.isEmpty ? account.email : account.name,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        account.email,
                        style: TextStyle(
                          fontSize: 13,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                      SizedBox(height: 6),
                      Row(
                        children: [
                          _StatusBadge(status: account.status),
                          SizedBox(width: 8),
                          Container(
                            padding: EdgeInsets.symmetric(
                                horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: context.dsColors.accent.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _roleLabel(role),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: context.dsColors.accent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            // Info
            _InfoRow(
              icon: Icons.login,
              label: 'Oxirgi kirish',
              value: account.lastLoginAt == null
                  ? 'Hali kirmagan'
                  : _formatDate(account.lastLoginAt!),
            ),
            _InfoRow(
              icon: Icons.person_add_alt,
              label: 'Yaratilgan',
              value: _formatDate(account.createdAt),
            ),
            _InfoRow(
              icon: Icons.how_to_reg_outlined,
              label: 'Yaratdi',
              value: account.createdBy ?? '— (birinchi hisob)',
            ),
            SizedBox(height: 16),
            // Hayot davri amallari
            Text(
              'Amallar',
              style: _sectionTitle(context),
            ),
            SizedBox(height: 8),
            _ActionButtons(
              account: account,
              actorRole: actorRole,
              onChanged: onChanged,
            ),
            SizedBox(height: 16),
            // Permission xulosasi
            Text('Ruxsatlar (${grantedPermissions.length})', style: _sectionTitle(context)),
            SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final permission in grantedPermissions)
                  Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: context.dsColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: context.dsColors.success.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      _permissionLabel(permission),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.success,
                      ),
                    ),
                  ),
                if (grantedPermissions.isEmpty)
                  Text(
                    'Hech qanday ruxsat yo\'q (fail-closed)',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
              ],
            ),
            SizedBox(height: 16),
            // Audit tarixi
            Text('Audit tarixi', style: _sectionTitle(context)),
            SizedBox(height: 8),
            if (userAudit.isEmpty)
              Text(
                'Hozircha amallar yo\'q',
                style: TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
              )
            else
              for (final entry in userAudit)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.history, size: 18),
                  title: Text(
                    entry.actionLabel,
                    style: TextStyle(fontSize: 13),
                  ),
                  subtitle: Text(
                    '${entry.actorName} • ${_formatDate(entry.occurredAt)}',
                    style: TextStyle(fontSize: 11),
                  ),
                  trailing: Text(
                    entry.result == AuditResult.success ? 'OK' : 'FAIL',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: entry.result == AuditResult.success
                          ? context.dsColors.success
                          : context.dsColors.error,
                    ),
                  ),
                ),
            SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

/// Profildagi hayot davri amallari (activate/suspend/archive/restore,
/// rol o'zgartirish, o'chirish) — permission'lar bo'yicha ko'rsatiladi.
class _ActionButtons extends ConsumerWidget {
  final LocalAccount account;
  final UserRole actorRole;
  final VoidCallback onChanged;
  const _ActionButtons({
    required this.account,
    required this.actorRole,
    required this.onChanged,
  });

  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      onChanged();
      messenger.showSnackBar(
        SnackBar(
          content: Text('Amal bajarildi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canDeactivate =
        Permissions.can(actorRole, AppPermission.usersDeactivate);
    final canEdit = Permissions.can(actorRole, AppPermission.usersEdit);
    final canDelete = Permissions.can(actorRole, AppPermission.usersDelete);
    final isActive = account.status == AccountStatus.active;

    return Column(
      children: [
        if (canDeactivate && !isActive)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _run(context, ref, () => ref
                  .read(changeUserStatusCommandProvider)
                  .execute(
                    email: account.email,
                    status: AccountStatus.active,
                  )),
              icon: Icon(Icons.play_arrow),
              label: Text('Faollashtirish'),
            ),
          ),
        if (canDeactivate && isActive) ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _run(context, ref, () => ref
                      .read(changeUserStatusCommandProvider)
                      .execute(
                        email: account.email,
                        status: AccountStatus.suspended,
                      )),
                  icon: Icon(Icons.pause_circle_outline),
                  label: Text('To\'xtatish'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _run(context, ref, () => ref
                      .read(changeUserStatusCommandProvider)
                      .execute(
                        email: account.email,
                        status: AccountStatus.archived,
                      )),
                  icon: Icon(Icons.archive_outlined),
                  label: Text('Arxivlash'),
                ),
              ),
            ],
          ),
        ],
        if (canEdit) ...[
          SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _showRoleDialog(context, ref),
              icon: Icon(Icons.admin_panel_settings_outlined),
              label: Text('Rolni o\'zgartirish'),
            ),
          ),
        ],
        if (canDelete) ...[
          SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _confirmDelete(context, ref),
              style: OutlinedButton.styleFrom(
                foregroundColor: context.dsColors.error,
                side: BorderSide(color: context.dsColors.error),
              ),
              icon: Icon(Icons.delete_outline),
              label: Text('Hisobni o\'chirish'),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _showRoleDialog(BuildContext context, WidgetRef ref) async {
    final selected = await showDialog<UserRole>(
      context: context,
      builder: (context) => SimpleDialog(
        title: Text('Rolni tanlang'),
        children: [
          for (final role in UserRole.values)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, role),
              child: Row(
                children: [
                  Expanded(child: Text(_roleLabel(role))),
                  if (UserRole.fromWire(account.role) == role)
                    Icon(Icons.check, size: 18, color: context.dsColors.accent),
                ],
              ),
            ),
        ],
      ),
    );
    if (selected == null || UserRole.fromWire(account.role) == selected) return;
    if (!context.mounted) return;
    await _run(context, ref, () => ref
        .read(updateUserCommandProvider)
        .execute(email: account.email, role: selected));
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Hisobni o\'chirish'),
        content: Text(
          "'${account.email}' hisobi butunlay o'chiriladi. Bu amalni "
          'qaytarib bo\'lmaydi. Davom etasizmi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: context.dsColors.error),
            child: Text('O\'chirish'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;
    await _run(context, ref,
        () => ref.read(deleteUserCommandProvider).execute(account.email));
  }
}

/// Yangi foydalanuvchi yaratish dialogi.
class _CreateUserDialog extends ConsumerStatefulWidget {
  const _CreateUserDialog();

  @override
  ConsumerState<_CreateUserDialog> createState() => _CreateUserDialogState();
}

class _CreateUserDialogState extends ConsumerState<_CreateUserDialog> {
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  UserRole _role = UserRole.staff;
  bool _busy = false;

  @override
  void dispose() {
    _emailController.dispose();
    _nameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(createUserCommandProvider).execute(
            email: _emailController.text,
            name: _nameController.text,
            password: _passwordController.text,
            role: _role,
          );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on Failure catch (failure) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Yangi foydalanuvchi'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'user@example.com',
                prefixIcon: Icon(Icons.mail_outline),
              ),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Ism',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Parol (kamida 6 belgi)',
                prefixIcon: Icon(Icons.lock_outline),
              ),
            ),
            SizedBox(height: 16),
            DropdownButtonFormField<UserRole>(
              initialValue: _role,
              decoration: const InputDecoration(
                labelText: 'Rol',
                prefixIcon: Icon(Icons.admin_panel_settings_outlined),
              ),
              items: [
                for (final role in UserRole.values)
                  DropdownMenuItem(value: role, child: Text(_roleLabel(role))),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _role = value);
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context, false),
          child: Text('Bekor qilish'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: Text(_busy ? 'Yaratilmoqda…' : 'Yaratish'),
        ),
      ],
    );
  }
}

class _EmptyUsers extends StatelessWidget {
  const _EmptyUsers();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.groups_outlined, size: 56, color: context.dsColors.textSecondary),
          SizedBox(height: 12),
          Text(
            'Foydalanuvchilar topilmadi',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          SizedBox(height: 4),
          Text(
            'Qidiruv/filterni o\'zgartiring yoki yangi foydalanuvchi qo\'shing',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: context.dsColors.textSecondary),
          SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(fontSize: 13, color: context.dsColors.textSecondary),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

TextStyle _sectionTitle(BuildContext context) => TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      color: context.dsColors.textPrimary,
    );

UserRole _roleFromName(String name) {
  // AUDIT P2-03: wire format ('super_admin') ↔ enum nomi ('superAdmin').
  return UserRole.fromWire(name);
}

String _roleLabel(UserRole role) {
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

String _statusLabel(AccountStatus status) {
  return switch (status) {
    AccountStatus.active => 'Faol',
    AccountStatus.suspended => 'To\'xtatilgan',
    AccountStatus.archived => 'Arxiv',
    AccountStatus.unknown => 'Noma\'lum',
  };
}

/// Avatar bosh harfi — name/email ikkalasi bo'sh bo'lsa '?' qaytaradi
/// (bo'sh string'da `substring(0,1)` RangeError tashlashi mumkin edi).
String _initialOf(String name, String email) {
  final base = name.isNotEmpty ? name : email;
  if (base.isEmpty) return '?';
  return base.substring(0, 1).toUpperCase();
}

String _permissionLabel(AppPermission permission) {
  return switch (permission) {
    AppPermission.studentsView => 'students.view',
    AppPermission.studentsCreate => 'students.create',
    AppPermission.studentsEdit => 'students.edit',
    AppPermission.studentsArchive => 'students.archive',
    AppPermission.teachersView => 'teachers.view',
    AppPermission.teachersCreate => 'teachers.create',
    AppPermission.groupsView => 'groups.view',
    AppPermission.groupsCreate => 'groups.create',
    AppPermission.groupsEdit => 'groups.edit',
    AppPermission.scheduleView => 'schedule.view',
    AppPermission.scheduleCreate => 'schedule.create',
    AppPermission.attendanceView => 'attendance.view',
    AppPermission.attendanceCreate => 'attendance.create',
    AppPermission.financeView => 'finance.view',
    AppPermission.financeCreate => 'finance.create',
    AppPermission.gradesView => 'grades.view',
    AppPermission.gradesCreate => 'grades.create',
    AppPermission.reportsView => 'reports.view',
    AppPermission.reportsDelete => 'reports.delete',
    AppPermission.reportsExport => 'reports.export',
    AppPermission.settingsView => 'settings.view',
    AppPermission.settingsEdit => 'settings.edit',
    AppPermission.usersView => 'users.view',
    AppPermission.usersCreate => 'users.create',
    AppPermission.usersEdit => 'users.edit',
    AppPermission.usersDeactivate => 'users.deactivate',
    AppPermission.usersDelete => 'users.delete',
    AppPermission.faceIdView => 'faceId.view',
    AppPermission.faceIdConfigure => 'faceId.configure',
    AppPermission.faceIdUse => 'faceId.use',
    AppPermission.telegramConfigure => 'telegram.configure',
    AppPermission.telegramUse => 'telegram.use',
    AppPermission.printerConfigure => 'printer.configure',
    AppPermission.backupCreate => 'backup.create',
    AppPermission.backupRestore => 'backup.restore',
    AppPermission.auditView => 'audit.view',
    AppPermission.crmLeadsView => 'crm.leads.view',
    AppPermission.crmLeadsCreate => 'crm.leads.create',
    AppPermission.crmLeadsEdit => 'crm.leads.edit',
  };
}

String _formatDate(DateTime date) {
  return '${date.day}.${date.month.toString().padLeft(2, '0')}.${date.year} '
      '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}';
}
