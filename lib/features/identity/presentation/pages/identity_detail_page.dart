import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../face_recognition/infrastructure/services/face_vision_engine.dart';
import '../../../face_recognition/presentation/providers/face_recognition_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../teachers/presentation/providers/teacher_providers.dart';
import '../../application/commands/merge_identity_command.dart';
import '../../application/queries/identity_duplicates_query.dart';
import '../../domain/entities/identity.dart';
import '../providers/identity_providers.dart';
import '../widgets/activity_timeline_widget.dart';
import '../widgets/digital_id_card.dart';
import '../widgets/identity_avatar.dart';
import '../widgets/status_badge.dart';

/// Identity profili: Premium ID karta + kontakt + status workflow +
/// Activity Timeline (audit-log).
class IdentityDetailPage extends ConsumerWidget {
  final String identityId;

  const IdentityDetailPage({super.key, required this.identityId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final identityAsync = ref.watch(identityDetailProvider(identityId));
    final activitiesAsync = ref.watch(identityActivitiesProvider(identityId));

    return Scaffold(
      appBar: AppBar(title: Text('Identity profili')),
      body: identityAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(message: '$error'),
        data: (identity) {
          if (identity == null) {
            return const _ErrorView(message: 'Identity topilmadi');
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.read(identityListVersionProvider.notifier).state++;
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                DigitalIdCard(
                  identity: identity,
                  onShare: () => _shareIdentity(context, identity),
                ),
                SizedBox(height: 24),
                _StatusWorkflowCard(identity: identity),
                SizedBox(height: 24),
                _MergeSection(identity: identity),
                SizedBox(height: 24),
                _ContactCard(identity: identity),
                SizedBox(height: 24),
                _FaceIdSection(identity: identity),
                SizedBox(height: 24),
                Text(
                  'Activity Timeline',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Barcha voqealar audit-log sifatida qayd etiladi',
                  style: TextStyle(
                      fontSize: 12, color: context.dsColors.textSecondary),
                ),
                SizedBox(height: 12),
                activitiesAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => Text('$error'),
                  data: (activities) =>
                      ActivityTimeline(activities: activities),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _shareIdentity(BuildContext context, Identity identity) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: 'M-EDU raqamli ID karta\n\n'
              'ID: ${identity.identityId}\n'
              'Ism: ${identity.fullName}\n'
              'Holat: ${identity.status.name}',
        ),
      );
    } catch (_) {
      // Desktop (Linux/Windows) platformalarida share xizmati
      // mavjud bo'lmasligi mumkin — xato o'rniga xabar ko'rsatamiz.
      messenger.showSnackBar(
        SnackBar(
          content: Text('Ulashish bu qurilmada mavjud emas'),
          backgroundColor: context.dsColors.textSecondary,
        ),
      );
    }
  }
}

class _StatusWorkflowCard extends ConsumerWidget {
  final Identity identity;

  const _StatusWorkflowCard({required this.identity});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actions = _availableActions(context, identity.status);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Holat boshqaruvi',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(width: 10),
            StatusBadge(status: identity.status),
          ],
        ),
        SizedBox(height: 12),
        if (actions.isEmpty)
          Container(
            padding: EdgeInsets.all(16),
            decoration: _glassDecoration(context),
            child: Text(
              'Bu holatdan boshqa o\'tishlar mavjud emas.',
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
            ),
          )
        else
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: actions
                .map(
                  (a) => _StatusActionChip(
                    icon: a.icon,
                    label: a.label,
                    color: a.color,
                    onTap: () => _confirmAndApply(context, ref, a),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }

  List<_StatusAction> _availableActions(BuildContext context, IdentityStatus status) {
    // O'quvchi/o'qituvchi uchun butunlay o'chirish amali (hard delete).
    // Xodim/ota-ona uchun ko'rsatilmaydi (ular Student/Teacher yozuviga
    // bog'lanmagan). Identity o'chirilsa — Student/Teacher + Face bazasi
    // ham tozalanadi (command'lar ichida).
    final isDeletable = identity.role == IdentityRole.student ||
        identity.role == IdentityRole.teacher;
    final deleteAction = isDeletable
        ? [
            _StatusAction(
              target: IdentityStatus.archived, // isDelete=true da ishlatilmaydi
              icon: Icons.delete_outline,
              label: "O'chirish",
              color: context.dsColors.error,
              isDelete: true,
            ),
          ]
        : const <_StatusAction>[];

    final statusActions = switch (status) {
      IdentityStatus.active => [
          _StatusAction(
            target: IdentityStatus.frozen,
            icon: Icons.pause_circle_outline,
            label: 'Muzlatish',
            color: context.dsColors.warning,
          ),
          _StatusAction(
            target: IdentityStatus.graduated,
            icon: Icons.workspace_premium_outlined,
            label: 'Bitirish',
            color: context.dsColors.accent,
          ),
          _StatusAction(
            target: IdentityStatus.archived,
            icon: Icons.archive_outlined,
            label: 'Arxivlash',
            color: context.dsColors.textSecondary,
          ),
        ],
      IdentityStatus.frozen => [
          _StatusAction(
            target: IdentityStatus.active,
            icon: Icons.play_circle_outline,
            label: 'Qayta faollashtirish',
            color: context.dsColors.success,
          ),
        ],
      IdentityStatus.graduated => [
          _StatusAction(
            target: IdentityStatus.archived,
            icon: Icons.archive_outlined,
            label: 'Arxivlash',
            color: context.dsColors.textSecondary,
          ),
        ],
      IdentityStatus.archived => [
          _StatusAction(
            target: IdentityStatus.active,
            icon: Icons.restore,
            label: 'Qayta faollashtirish',
            color: context.dsColors.success,
          ),
        ],
    };
    return [...statusActions, ...deleteAction];
  }

  Future<void> _confirmAndApply(
    BuildContext context,
    WidgetRef ref,
    _StatusAction action,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
            action.isDelete ? "Shaxsni o'chirish" : 'Holatni o\'zgartirish'),
        content: Text(
          action.isDelete
              ? "'${identity.fullName}' butunlay o'chiriladi. "
                  'Student/Teacher yozuvi, yuz bazasi va guruh a\'zoligi '
                  'ham tozalanadi. Bu amalni qaytarib bo\'lmaydi. '
                  'Davom etasizmi?'
              : '${identity.fullName} uchun holatni '
                  '"${_labelOf(action.target)}" qilishni tasdiqlaysizmi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Bekor qilish'),
          ),
          FilledButton(
            style: action.isDelete
                ? FilledButton.styleFrom(backgroundColor: context.dsColors.error)
                : null,
            onPressed: () => Navigator.pop(context, true),
            child: Text(action.isDelete ? "O'chirish" : 'Tasdiqlash'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;

    // ── Butunlay o'chirish (hard delete) ────────────────────────────────
    // Rol bo'yicha to'g'ri command tanlanadi (student/teacher). Identity
    // profili, Student/Teacher yozuvi, Face bazasi va guruh a'zoligi
    // command'lar ichida kaskadli tozalanadi.
    if (action.isDelete) {
      final messenger = ScaffoldMessenger.of(context);
      try {
        if (identity.role == IdentityRole.teacher) {
          await ref
              .read(deleteTeacherCommandProvider)
              .execute(identity.identityId);
        } else {
          await ref
              .read(deleteStudentCommandProvider)
              .execute(identity.identityId);
        }
        if (!context.mounted) return;
        messenger.showSnackBar(
          SnackBar(
            content: Text("Shaxs o'chirildi ✓"),
            backgroundColor: context.dsColors.success,
          ),
        );
        context.pop();
      } on Failure catch (failure) {
        if (!context.mounted) return;
        messenger.showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
      return;
    }

    try {
      // C-03: Ro'yxat `IdentityStatusChangedEvent` orqali avtomatik
      // yangilanadi — qo'lda state++ shart emas (§79).
      await ref
          .read(updateIdentityStatusCommandProvider)
          .execute(identity.identityId, action.target);
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }

  static String _labelOf(IdentityStatus status) {
    return switch (status) {
      IdentityStatus.active => 'faol',
      IdentityStatus.frozen => 'muzlatilgan',
      IdentityStatus.graduated => 'bitirgan',
      IdentityStatus.archived => 'arxivlangan',
    };
  }
}

class _StatusActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _StatusActionChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                  fontSize: 13, color: color, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final Identity identity;

  const _ContactCard({required this.identity});

  @override
  Widget build(BuildContext context) {
    final rows = <(IconData, String, String)>[
      (
        Icons.badge_outlined,
        'Real ID',
        identity.identityId,
      ),
      if (identity.phone != null)
        (Icons.phone_outlined, 'Telefon', identity.phone!),
      if (identity.email != null)
        (Icons.email_outlined, 'Email', identity.email!),
    ];

    return Container(
      padding: EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ma\'lumotlar',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          SizedBox(height: 12),
          for (final (icon, label, value) in rows)
            Padding(
              padding: EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: context.dsColors.accent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 18, color: context.dsColors.accent),
                  ),
                  SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                      Text(
                        value,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: context.dsColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          if (rows.length == 1)
            Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Kontakt ma\'lumotlari kiritilmagan',
                style: TextStyle(
                    fontSize: 13, color: context.dsColors.textSecondary),
              ),
            ),
        ],
      ),
    );
  }
}

/// Identity merge/dedup bo'limi (spec §6 #5): potensial dublikatlarni
/// topib, birlashtirish imkonini beradi.
/// Face ID bo'limi — yuz namunasi holati va boshqaruvi.
class _FaceIdSection extends ConsumerWidget {
  final Identity identity;

  const _FaceIdSection({required this.identity});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasFace =
        ref.watch(hasFaceProvider(identity.identityId)).valueOrNull ?? false;
    final supported = FaceVisionEngine.isSupportedOnPlatform;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Face ID',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: context.dsColors.textPrimary,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Hikvision kamera orqali yuzni tanish',
          style:
              TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
        ),
        SizedBox(height: 12),
        AppCard(
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient:
                          hasFace ? context.dsColors.accentGradient : context.dsColors.accentGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      hasFace ? Icons.face : Icons.face_retouching_natural,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          hasFace ? 'Yuz namunasi mavjud' : "Yuz namunasi yo'q",
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: context.dsColors.textPrimary,
                          ),
                        ),
                        Text(
                          supported
                              ? (hasFace
                                  ? 'Face ID skanerida tanish mumkin'
                                  : 'Yuzni qo\'shing — Face ID ishlay boshlaydi')
                              : 'Yuz tanish Android/iOS qurilmalarida ishlaydi',
                          style: TextStyle(
                            fontSize: 12,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () =>
                          context.push('/face-enroll/${identity.identityId}'),
                      icon: Icon(
                        hasFace ? Icons.refresh : Icons.add,
                        size: 18,
                      ),
                      label: Text(hasFace ? 'Yangilash' : "Yuz qo'shish"),
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/face-scan'),
                      icon: Icon(Icons.fact_check_outlined, size: 18),
                      label: Text('Skanerda sinash'),
                      style: OutlinedButton.styleFrom(
                        padding: EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MergeSection extends ConsumerWidget {
  final Identity identity;

  const _MergeSection({required this.identity});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final duplicatesAsync =
        ref.watch(identityDuplicatesProvider(identity.identityId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dublikatlar',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: context.dsColors.textPrimary,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Bir xil shaxs ikki marta ro\'yxatdan o\'tkazilgan bo\'lishi mumkin',
          style:
              TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
        ),
        SizedBox(height: 12),
        duplicatesAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Text('$error'),
          data: (duplicates) {
            if (duplicates.isEmpty) return const _NoDuplicatesCard();
            return Container(
              padding: EdgeInsets.symmetric(vertical: 4),
              decoration: _glassDecoration(context),
              child: Column(
                children: [
                  for (var i = 0; i < duplicates.length; i++) ...[
                    _DuplicateCandidateTile(
                      identity: identity,
                      candidate: duplicates[i],
                    ),
                    if (i < duplicates.length - 1) const Divider(height: 1),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _NoDuplicatesCard extends StatelessWidget {
  const _NoDuplicatesCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Row(
        children: [
          Icon(Icons.verified_outlined, size: 20, color: context.dsColors.success),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Dublikat topilmadi. Telefon, email yoki ism-familiya '
              'bo\'yicha mos yozuvlar ko\'rsatiladi.',
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _DuplicateCandidateTile extends ConsumerWidget {
  final Identity identity;
  final IdentityDuplicateCandidate candidate;

  const _DuplicateCandidateTile({
    required this.identity,
    required this.candidate,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final duplicate = candidate.identity;

    return Padding(
      padding: EdgeInsets.fromLTRB(14, 10, 6, 10),
      child: Row(
        children: [
          IdentityAvatar(identity: duplicate, radius: 22),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  duplicate.fullName,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 2),
                Text(
                  duplicate.identityId,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.dsColors.accent,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: 4),
                _MatchReasonChip(reason: candidate.matchedBy),
              ],
            ),
          ),
          SizedBox(width: 8),
          IconButton(
            tooltip: 'Birlashtirish',
            icon: Icon(Icons.call_merge, color: context.dsColors.accent),
            onPressed: () => _confirmMerge(context, ref, duplicate),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmMerge(
    BuildContext context,
    WidgetRef ref,
    Identity duplicate,
  ) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Identity birlashtirish'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Asosiy saqlanadigan:',
                style: TextStyle(
                    fontSize: 12, color: context.dsColors.textSecondary),
              ),
              Text(
                '${identity.fullName} (${identity.identityId})',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              SizedBox(height: 12),
              Text(
                'Birlashtiriladigan:',
                style: TextStyle(
                    fontSize: 12, color: context.dsColors.textSecondary),
              ),
              Text(
                '${duplicate.fullName} (${duplicate.identityId})',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Birlashtiriladigan shaxsning Activity Timeline\'i asosiy '
                'shaxsga ko\'chiriladi, o\'zi arxiv holatiga o\'tkaziladi.',
                style: TextStyle(
                  fontSize: 12,
                  color: context.dsColors.textSecondary,
                  height: 1.4,
                ),
              ),
              SizedBox(height: 16),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Sabab (ixtiyoriy)',
                  hintText: 'masalan: ikki marta ro\'yxatdan o\'tkazilgan',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Birlashtirish'),
          ),
        ],
      ),
    );

    final reason = reasonController.text.trim();
    reasonController.dispose();
    if (confirmed != true) return;
    if (!context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      // C-03: Ro'yxat `IdentityMergedEvent` orqali avtomatik yangilanadi.
      await ref.read(mergeIdentityCommandProvider).execute(
            MergeIdentityRequest(
              primaryIdentityId: identity.identityId,
              duplicateIdentityId: duplicate.identityId,
              reason: reason.isEmpty ? null : reason,
            ),
          );
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text('${duplicate.fullName} birlashtirildi')),
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

class _MatchReasonChip extends StatelessWidget {
  final String reason;

  const _MatchReasonChip({required this.reason});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (reason) {
      DuplicateMatchReasons.phone => ('Telefon mos', context.dsColors.success),
      DuplicateMatchReasons.email => ('Email mos', context.dsColors.accent),
      DuplicateMatchReasons.name => ('Ism mos', context.dsColors.warning),
      _ => ('Mos', context.dsColors.textSecondary),
    };

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

BoxDecoration _glassDecoration(BuildContext context) {
  return BoxDecoration(
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
  );
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 56, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              message,
              style: TextStyle(
                  fontSize: 14, color: context.dsColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusAction {
  final IdentityStatus target;
  final IconData icon;
  final String label;
  final Color color;

  /// `true` — holat o'zgarishi emas, butunlay o'chirish amali.
  final bool isDelete;

  const _StatusAction({
    required this.target,
    required this.icon,
    required this.label,
    required this.color,
    this.isDelete = false,
  });
}
