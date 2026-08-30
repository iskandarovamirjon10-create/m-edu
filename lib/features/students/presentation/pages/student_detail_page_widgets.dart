// QISM: student_detail_page.dart ning "part" fayli — leaf widgetlar.
//
// `part of` sababli asosiy fayl bilan bir xil privat scopeni bo'lishadi.

part of 'student_detail_page.dart';

class _GlassCard extends StatelessWidget {
  final Widget child;

  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
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
      child: child,
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
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: context.dsColors.textPrimary,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: context.dsColors.textSecondary,
            ),
          ),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: context.dsColors.textPrimary,
              ),
              textAlign: TextAlign.end,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Guruh tanlash varag'i (bottom sheet).
///
/// Faol guruhlarni ko'rsatadi; tanlangan guruhga talabani o'tkazadi
/// (guruhli bo'lsa — [TransferStudentCommand], guruhsiz bo'lsa —
/// [AssignStudentToGroupCommand]). `StudentTransferredEvent` /
/// `StudentAssignedToGroupEvent` orqali ro'yxatlar avtomatik yangilanadi.
class _GroupTransferSheet extends ConsumerStatefulWidget {
  final Student student;

  const _GroupTransferSheet({required this.student});

  @override
  ConsumerState<_GroupTransferSheet> createState() =>
      _GroupTransferSheetState();
}

class _GroupTransferSheetState extends ConsumerState<_GroupTransferSheet> {
  bool _busy = false;

  Future<void> _apply(String groupId) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => _busy = true);
    try {
      if (widget.student.hasGroup) {
        final command = ref.read(transferStudentCommandProvider);
        await command.startTransfer(widget.student.identityId, groupId);
        await command.confirmTransfer(widget.student.identityId);
      } else {
        await ref.read(assignStudentToGroupCommandProvider).execute(
              groupId: groupId,
              studentIdentityId: widget.student.identityId,
            );
      }
      ref.invalidate(studentDetailProvider(widget.student.identityId));
      if (!mounted) return;
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text('Talaba guruhga tayinlandi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text('Xatolik: $e'),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(activeGroupsProvider);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
            SizedBox(height: 20),
            Text(
              widget.student.hasGroup
                  ? 'Guruhga o\'tkazish'
                  : 'Guruhga qo\'shish',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Faol guruhlardan birini tanlang',
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
            ),
            const SizedBox(height: 16),
            groupsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Xato: $error',
                  style: TextStyle(color: context.dsColors.error),
                ),
              ),
              data: (groups) {
                final available = groups
                    .where((g) => g.groupId != widget.student.groupId)
                    .toList();
                if (available.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      "O'tkazish uchun faol guruhlar yo'q",
                      style: TextStyle(
                        color: context.dsColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                  );
                }
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final group in available)
                      ListTile(
                        enabled: !_busy,
                        leading: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: context.dsColors.accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.groups,
                            color: context.dsColors.accent,
                            size: 22,
                          ),
                        ),
                        title: Text(
                          group.name,
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          group.code != null
                              ? '${group.code} • ${group.currentSize}/${group.capacity} a\'zo'
                              : '${group.currentSize}/${group.capacity} a\'zo',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _apply(group.groupId),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  /// Xavfli amal (o'chirish) — qizil rang bilan ajratiladi.
  final bool isDanger;

  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.isDanger = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDanger ? context.dsColors.error : context.dsColors.accent;
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(
        title,
        style: TextStyle(color: isDanger ? context.dsColors.error : null),
      ),
      subtitle: Text(subtitle),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
              'Xatolik yuz berdi',
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

class _NotFoundView extends StatelessWidget {
  const _NotFoundView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off,
                size: 56, color: context.dsColors.textTertiary),
            SizedBox(height: 12),
            Text(
              'Talaba topilmadi',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.pop(),
              child: const Text('Orqaga'),
            ),
          ],
        ),
      ),
    );
  }
}
