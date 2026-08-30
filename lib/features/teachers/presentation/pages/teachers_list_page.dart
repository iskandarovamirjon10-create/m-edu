import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../identity/presentation/widgets/identity_avatar.dart';
import '../../../identity/presentation/widgets/status_badge.dart';
import '../../domain/entities/teacher.dart';
import '../providers/teacher_providers.dart';

/// O'qituvchilar ro'yxati sahifasi (spec §6 #12-15).
class TeachersListPage extends ConsumerStatefulWidget {
  const TeachersListPage({super.key});

  @override
  ConsumerState<TeachersListPage> createState() => _TeachersListPageState();
}

class _TeachersListPageState extends ConsumerState<TeachersListPage> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final teachersAsync = ref.watch(teacherListProvider);
    final identitiesAsync = ref.watch(identityListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.teachersTitle),
        actions: [
          IconButton(
            tooltip: "Yangi o'qituvchi",
            icon: const Icon(Icons.person_add_alt_1),
            onPressed: () => context.push('/identity/register'),
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
                hintText: 'Ism, ID yoki mutaxassislik bo\'yicha...',
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
            child: teachersAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('Xato: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (teachers) {
                if (teachers.isEmpty) {
                  return _EmptyTeachers(
                    onRegister: () => context.push('/identity/register'),
                  );
                }

                return identitiesAsync.when(
                  loading: () => Center(child: CircularProgressIndicator()),
                  error: (error, _) => Center(
                    child: Text('Xato: $error',
                        style: TextStyle(color: context.dsColors.error)),
                  ),
                  data: (identities) {
                    final filtered = _filter(teachers, identities);
                    if (filtered.isEmpty && _query.isNotEmpty) {
                      return Center(
                        child: Text('Hech narsa topilmadi',
                            style: TextStyle(
                                color: context.dsColors.textSecondary)),
                      );
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final teacher = filtered[index];
                        final identity = identities.firstWhere(
                          (i) => i.identityId == teacher.identityId,
                          orElse: () => Identity(
                            identityId: teacher.identityId,
                            firstName: 'Noma\'lum',
                            lastName: '',
                            role: IdentityRole.teacher,
                            status: IdentityStatus.active,
                            qrSeed: '',
                            createdAt: DateTime.now(),
                          ),
                        );
                        return _TeacherCard(
                          teacher: teacher,
                          identity: identity,
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Teacher> _filter(List<Teacher> teachers, List<Identity> identities) {
    if (_query.isEmpty) return teachers;
    return teachers.where((t) {
      final identity = identities.firstWhere(
        (i) => i.identityId == t.identityId,
        orElse: () => Identity(
          identityId: t.identityId,
          firstName: '',
          lastName: '',
          role: IdentityRole.teacher,
          status: IdentityStatus.active,
          qrSeed: '',
          createdAt: DateTime.now(),
        ),
      );
      return identity.fullName.toLowerCase().contains(_query) ||
          t.identityId.toLowerCase().contains(_query) ||
          (t.specialization?.toLowerCase().contains(_query) ?? false);
    }).toList();
  }
}

class _TeacherCard extends StatelessWidget {
  final Teacher teacher;
  final Identity identity;

  const _TeacherCard({
    required this.teacher,
    required this.identity,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/teachers/${teacher.identityId}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
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
                  SizedBox(height: 3),
                  Text(
                    teacher.specialization ?? 'Mutaxassislik belgilanmagan',
                    style: TextStyle(
                      fontSize: 13,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Workload indicator
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: teacher.workloadPercentage / 100,
                            backgroundColor:
                                context.dsColors.border.withValues(alpha: 0.3),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              _workloadColor(context, teacher.workloadPercentage),
                            ),
                            minHeight: 4,
                          ),
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        '${teacher.weeklyHours}/${teacher.maxWeeklyHours} soat',
                        style: TextStyle(
                          fontSize: 11,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                    ],
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

  Color _workloadColor(BuildContext context, double percentage) {
    if (percentage >= 90) return context.dsColors.error;
    if (percentage >= 70) return context.dsColors.warning;
    return context.dsColors.success;
  }
}

class _EmptyTeachers extends StatelessWidget {
  final VoidCallback onRegister;

  const _EmptyTeachers({required this.onRegister});

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
                    color: context.dsColors.info.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.co_present, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              'Hali o\'qituvchilar yo\'q',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Birinchi o\'qituvchini ro\'yxatga oling.',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRegister,
              icon: const Icon(Icons.person_add_alt_1),
              label: Text(context.l10n.teachersAdd),
            ),
          ],
        ),
      ),
    );
  }
}
