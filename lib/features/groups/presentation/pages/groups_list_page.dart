import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';
import '../../domain/entities/group.dart';
import '../providers/group_providers.dart';

/// Guruhlar ro'yxati sahifasi (spec §6 #16-18).
///
/// "No Demo Data" siyosati (spec §5): baza bo'sh bo'lsa empty-state
/// ko'rsatiladi, hech qachon namunaviy guruh chiqarilmaydi.
class GroupsListPage extends ConsumerStatefulWidget {
  const GroupsListPage({super.key});

  @override
  ConsumerState<GroupsListPage> createState() => _GroupsListPageState();
}

class _GroupsListPageState extends ConsumerState<GroupsListPage> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guruhlar'),
        actions: [
          IconButton(
            tooltip: 'Yangi guruh',
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/groups/create'),
          ),
        ],
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
                hintText: 'Guruh nomi, fan yoki kod bo\'yicha...',
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
            child: groupsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('Xato: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (groups) {
                if (groups.isEmpty) {
                  return _EmptyGroups(
                    onCreate: () => context.push('/groups/create'),
                  );
                }

                final filtered = _filter(groups);
                if (filtered.isEmpty && _query.isNotEmpty) {
                  return Center(
                    child: Text('Hech narsa topilmadi',
                        style:
                            TextStyle(color: context.dsColors.textSecondary)),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) => _GroupCard(
                    group: filtered[index],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Group> _filter(List<Group> groups) {
    if (_query.isEmpty) return groups;
    return groups.where((g) {
      return g.name.toLowerCase().contains(_query) ||
          (g.code?.toLowerCase().contains(_query) ?? false) ||
          (g.subject?.toLowerCase().contains(_query) ?? false) ||
          (g.teacherName?.toLowerCase().contains(_query) ?? false);
    }).toList();
  }
}

class _GroupCard extends StatelessWidget {
  final Group group;

  const _GroupCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final occupancyColor = group.occupancyPercentage >= 90
        ? context.dsColors.error
        : group.occupancyPercentage >= 70
            ? context.dsColors.warning
            : context.dsColors.success;

    return GestureDetector(
      onTap: () => context.push('/groups/${group.groupId}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: context.dsColors.surface,
          border: Border.all(
            color: context.dsColors.border.withValues(alpha: 0.5),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -6,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: context.dsColors.accentGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      group.code ?? group.name.substring(0, 2).toUpperCase(),
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.name,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: context.dsColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 2),
                      if (group.subject != null)
                        Text(
                          group.subject!,
                          style: TextStyle(
                            fontSize: 13,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                StatusBadge(status: group.status),
              ],
            ),
            const SizedBox(height: 12),
            // Sig'im progress
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: group.occupancyPercentage / 100,
                      backgroundColor:
                          context.dsColors.border.withValues(alpha: 0.3),
                      valueColor: AlwaysStoppedAnimation<Color>(occupancyColor),
                      minHeight: 6,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${group.currentSize}/${group.capacity}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: occupancyColor,
                  ),
                ),
              ],
            ),
            SizedBox(height: 12),
            Row(
              children: [
                if (group.hasTeacher) ...[
                  Icon(Icons.person_outline,
                      size: 16, color: context.dsColors.textSecondary),
                  SizedBox(width: 4),
                  Text(
                    group.teacherName ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                  SizedBox(width: 12),
                ],
                if (group.hasRoom) ...[
                  Icon(Icons.room_outlined,
                      size: 16, color: context.dsColors.textSecondary),
                  SizedBox(width: 4),
                  Text(
                    group.roomName ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                  SizedBox(width: 12),
                ],
                if (group.monthlyFee > 0) ...[
                  Icon(Icons.attach_money,
                      size: 16, color: context.dsColors.textSecondary),
                  SizedBox(width: 4),
                  Text(
                    '${_formatCurrency(group.monthlyFee)} so\'m',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}

class StatusBadge extends StatelessWidget {
  final GroupStatus status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      GroupStatus.active => ('Faol', context.dsColors.success),
      GroupStatus.inactive => ('Nofaol', context.dsColors.textSecondary),
      GroupStatus.archived => ('Arxiv', context.dsColors.warning),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _EmptyGroups extends StatelessWidget {
  final VoidCallback onCreate;

  const _EmptyGroups({required this.onCreate});

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
                    color: context.dsColors.success.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.groups_outlined, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              'Hali guruhlar yo\'q',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Birinchi guruhni yarating — o\'quvchilarni guruhlarga tayinlang.',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add),
              label: const Text('Guruh yaratish'),
            ),
          ],
        ),
      ),
    );
  }
}
