import 'package:flutter/material.dart';

import '../../../../design/design.dart';
import '../../domain/entities/identity_activity.dart';

/// Activity Timeline — identity uchun audit-log vizualizatsiyasi (spec §3).
class ActivityTimeline extends StatelessWidget {
  final List<IdentityActivity> activities;

  const ActivityTimeline({super.key, required this.activities});

  @override
  Widget build(BuildContext context) {
    if (activities.isEmpty) {
      return const _EmptyTimeline();
    }

    return Column(
      children: [
        for (var i = 0; i < activities.length; i++)
          _TimelineItem(
            activity: activities[i],
            isLast: i == activities.length - 1,
          ),
      ],
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final IdentityActivity activity;
  final bool isLast;

  const _TimelineItem({required this.activity, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _visualFor(context, activity.type);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(color: color.withValues(alpha: 0.3)),
                  ),
                  child: Icon(icon, size: 14, color: color),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: context.dsColors.border.withValues(alpha: 0.4),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    activity.description,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: context.dsColors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    _formatTime(activity.occurredAt),
                    style: TextStyle(
                      fontSize: 12,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  (IconData, Color) _visualFor(BuildContext context, String type) {
    return switch (type) {
      IdentityActivityTypes.registered => (Icons.person_add, context.dsColors.success),
      IdentityActivityTypes.statusChanged => (
          Icons.swap_horiz,
          context.dsColors.warning
        ),
      IdentityActivityTypes.faceEnrolled => (
          Icons.face_retouching_natural,
          context.dsColors.accent
        ),
      IdentityActivityTypes.paymentReceived => (
          Icons.payments,
          context.dsColors.success
        ),
      IdentityActivityTypes.attendanceMarked => (
          Icons.check_circle,
          context.dsColors.info
        ),
      IdentityActivityTypes.identityMerged => (Icons.merge, context.dsColors.info),
      _ => (Icons.event_note, context.dsColors.textSecondary),
    };
  }

  String _formatTime(DateTime time) {
    const months = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentabr',
      'Oktabr',
      'Noyabr',
      'Dekabr',
    ];
    final hh = time.hour.toString().padLeft(2, '0');
    final mm = time.minute.toString().padLeft(2, '0');
    return '${time.day} ${months[time.month - 1]} ${time.year}, $hh:$mm';
  }
}

class _EmptyTimeline extends StatelessWidget {
  const _EmptyTimeline();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(Icons.history, size: 40, color: context.dsColors.textTertiary),
          SizedBox(height: 12),
          Text(
            'Hodisalar hali yo\'q',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: context.dsColors.textSecondary,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Har bir muhim harakat shu yerda qayd etiladi',
            style: TextStyle(
              fontSize: 13,
              color: context.dsColors.textSecondary.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }
}
