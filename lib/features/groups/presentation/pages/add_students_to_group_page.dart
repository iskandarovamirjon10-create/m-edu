import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../identity/presentation/widgets/identity_avatar.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../domain/entities/group.dart';
import '../providers/group_providers.dart';

/// Guruhga o'quvchi qo'shish sahifasi (`/groups/:groupId/add-students`).
///
/// Hali guruhga tayinlanmagan faol o'quvchilar ro'yxati ko'rsatiladi —
/// bosilganda [AssignStudentToGroupCommand] ishga tushadi va o'quvchi
/// darhol guruhga qo'shiladi (ro'yxat event orqali avtomatik yangilanadi).
class AddStudentsToGroupPage extends ConsumerWidget {
  final String groupId;

  const AddStudentsToGroupPage({super.key, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(groupDetailProvider(groupId));
    final studentsAsync = ref.watch(studentListProvider);
    final identitiesAsync = ref.watch(identityListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.attendanceAddStudent)),
      body: groupAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(message: '$error'),
        data: (group) {
          if (group == null) {
            return const _ErrorView(message: 'Guruh topilmadi');
          }
          return _Body(
            group: group,
            studentsAsync: studentsAsync,
            identitiesAsync: identitiesAsync,
          );
        },
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  final Group group;
  final AsyncValue<List<Student>> studentsAsync;
  final AsyncValue<List<Identity>> identitiesAsync;

  const _Body({
    required this.group,
    required this.studentsAsync,
    required this.identitiesAsync,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFull = !group.hasAvailableSlots;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${group.name} (${group.currentSize}/${group.capacity})',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (group.hasAvailableSlots)
                Text(
                  '${group.availableSlots} ta o\'rin',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.success,
                  ),
                ),
            ],
          ),
        ),
        if (isFull)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.dsColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 18, color: context.dsColors.error),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Guruh to\'lgan — qo\'shishdan avval o\'rin bo\'shating',
                    style: TextStyle(fontSize: 13, color: context.dsColors.error),
                  ),
                ),
              ],
            ),
          )
        else
          Padding(
            padding: EdgeInsets.fromLTRB(16, 6, 16, 0),
            child: Text(
              'Guruhga tayinlanmagan o\'quvchini tanlang',
              style: TextStyle(
                  fontSize: 12, color: context.dsColors.textSecondary),
            ),
          ),
        const SizedBox(height: 8),
        Expanded(
          child: studentsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _ErrorView(message: '$error'),
            data: (students) {
              // Faqat guruhga tayinlanmagan faol o'quvchilar.
              final available = students
                  .where((s) => s.groupId == null && s.isActive)
                  .toList();

              if (available.isEmpty) {
                return _EmptyState(isFull: isFull);
              }

              return identitiesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorView(message: '$error'),
                data: (identities) {
                  final identityMap = {
                    for (final i in identities) i.identityId: i,
                  };
                  return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    itemCount: available.length,
                    itemBuilder: (context, index) {
                      final student = available[index];
                      final identity = identityMap[student.identityId] ??
                          Identity(
                            identityId: student.identityId,
                            firstName: "Noma'lum",
                            lastName: '',
                            role: IdentityRole.student,
                            status: IdentityStatus.active,
                            qrSeed: '',
                            createdAt: DateTime.now(),
                          );
                      return _StudentTile(
                        student: student,
                        identity: identity,
                        enabled: !isFull,
                        onTap: () => _assign(context, ref, student.identityId),
                      );
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _assign(
    BuildContext context,
    WidgetRef ref,
    String studentIdentityId,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      // C-03: Guruh va talaba ro'yxatlari GroupMemberAddedEvent orqali
      // avtomatik yangilanadi — qo'lda refresh shart emas.
      await ref.read(assignStudentToGroupCommandProvider).execute(
            groupId: group.groupId,
            studentIdentityId: studentIdentityId,
          );
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(context.l10n.groupAddStudentSuccess),
            backgroundColor: context.dsColors.success,
          ),
        );
      }
    } on Failure catch (failure) {
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
    }
  }
}

class _StudentTile extends StatelessWidget {
  final Student student;
  final Identity identity;
  final bool enabled;
  final VoidCallback onTap;

  const _StudentTile({
    required this.student,
    required this.identity,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: context.dsColors.surface,
            border: Border.all(
              color: context.dsColors.border.withValues(alpha: 0.5),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: context.dsColors.divider.withValues(alpha: 0.25),
                blurRadius: 16,
                offset: const Offset(0, 6),
                spreadRadius: -5,
              ),
            ],
          ),
          child: Row(
            children: [
              IdentityAvatar(identity: identity, radius: 22),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      identity.fullName,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '№${student.studentNumber}  •  ${identity.identityId}',
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.accent,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                enabled ? Icons.add_circle_outline : Icons.block,
                color:
                    enabled ? context.dsColors.success : context.dsColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool isFull;

  const _EmptyState({required this.isFull});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isFull ? Icons.event_busy_outlined : Icons.person_add_alt_1,
              size: 56,
              color: context.dsColors.textTertiary,
            ),
            SizedBox(height: 12),
            Text(
              isFull
                  ? "Guruh to'lgan"
                  : 'Barcha o\'quvchilar guruhlarga tayinlangan',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Avval o\'quvchini ro\'yxatga oling, so\'ng guruhga qo\'shing.',
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => context.push('/identity/register'),
              icon: const Icon(Icons.person_add_alt_1, size: 18),
              label: Text(context.l10n.groupAddStudentRegister),
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
              message,
              style: TextStyle(
                fontSize: 14,
                color: context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
