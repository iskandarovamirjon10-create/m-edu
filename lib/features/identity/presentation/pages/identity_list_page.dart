import 'package:flutter/material.dart';
import '../../../../core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';
import '../../domain/entities/identity.dart';
import '../providers/identity_providers.dart';
import '../widgets/identity_avatar.dart';
import '../widgets/status_badge.dart';

/// Universal Identity ro'yxati (spec §3).
///
/// "No Demo Data" siyosati: bo'sh bazada empty-state ko'rsatiladi,
/// hech qachon soxta yozuv chiqarilmaydi.
class IdentityListPage extends ConsumerStatefulWidget {
  const IdentityListPage({super.key});

  @override
  ConsumerState<IdentityListPage> createState() => _IdentityListPageState();
}

class _IdentityListPageState extends ConsumerState<IdentityListPage> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final identitiesAsync = ref.watch(identityListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shaxslar'),
        actions: [
          IconButton(
            tooltip: 'QR skaner',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/identity/scan'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/identity/register'),
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(context.l10n.identityRegister),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: (value) =>
                  setState(() => _query = value.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Ism, ID yoki telefon bo\'yicha qidirish...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
              ),
            ),
          ),
          Expanded(
            child: identitiesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => _ErrorView(message: '$error'),
              data: (identities) {
                final filtered = _filter(identities);
                if (identities.isEmpty) {
                  return const _EmptyState();
                }
                if (filtered.isEmpty) {
                  return const _NoResults();
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) =>
                      _IdentityCard(identity: filtered[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Identity> _filter(List<Identity> identities) {
    if (_query.isEmpty) return identities;
    return identities.where((i) {
      return i.fullName.toLowerCase().contains(_query) ||
          i.identityId.toLowerCase().contains(_query) ||
          (i.phone?.toLowerCase().contains(_query) ?? false);
    }).toList();
  }
}

class _IdentityCard extends StatelessWidget {
  final Identity identity;

  const _IdentityCard({required this.identity});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/identity/${identity.identityId}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: context.dsColors.surface,
          border: Border.all(color: context.dsColors.border.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -6,
            ),
          ],
        ),
        child: Row(
          children: [
            IdentityAvatar(identity: identity, radius: 26),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    identity.fullName,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    identity.identityId,
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.accent,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.3,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    _roleLabel(identity.role),
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(status: identity.status),
          ],
        ),
      ),
    );
  }

  static String _roleLabel(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => "O'quvchi",
      IdentityRole.teacher => "O'qituvchi",
      IdentityRole.staff => 'Xodim',
      IdentityRole.parent => 'Ota-ona',
    };
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: context.dsColors.accent.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.badge_outlined, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              'Hali hech kim ro\'yxatdan o\'tkazilmagan',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 8),
            Text(
              'Birinchi shaxsni (o\'quvchi, o\'qituvchi, xodim yoki ota-ona) '
              'ro\'yxatga olishdan boshlang. Har bir shaxs avtomatik real ID '
              'va raqamli ID karta oladi.',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.push('/identity/register'),
              icon: const Icon(Icons.person_add_alt_1),
              label: Text(context.l10n.identityFirstAdd),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  const _NoResults();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off,
                size: 56, color: context.dsColors.textTertiary),
            SizedBox(height: 12),
            Text(
              'Hech narsa topilmadi',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 56, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              'Ma\'lumotlarni yuklashda xato',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 6),
            Text(
              message,
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
