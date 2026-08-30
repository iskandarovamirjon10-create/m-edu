import 'package:flutter/material.dart';

import '../../../../design/design.dart';
import '../../domain/entities/identity.dart';

/// Identity holatini (faol/muzlatilgan/bitirgan/arxiv) ko'rsatuvchi pill.
class StatusBadge extends StatelessWidget {
  final IdentityStatus status;
  final bool compact;

  const StatusBadge({super.key, required this.status, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final (label, color, icon) = switch (status) {
      IdentityStatus.active => ('Faol', context.dsColors.success, Icons.check_circle),
      IdentityStatus.frozen => (
          'Muzlatilgan',
          context.dsColors.warning,
          Icons.pause_circle
        ),
      IdentityStatus.graduated => (
          'Bitirgan',
          context.dsColors.accent,
          Icons.workspace_premium,
        ),
      IdentityStatus.archived => (
          'Arxiv',
          context.dsColors.textSecondary,
          Icons.archive,
        ),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(compact ? 8 : 10),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: compact ? 12 : 14, color: color),
          if (!compact) const SizedBox(width: 4),
          if (!compact)
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
}
