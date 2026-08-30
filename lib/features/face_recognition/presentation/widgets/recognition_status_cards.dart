import 'package:flutter/material.dart';

import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../application/face_scan_state.dart';

/// Holat chipi: kamera ulanish holati + liveness (blink) satri.
class FaceScanStatusChip extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  final String? livenessLine;
  final Color? livenessColor;
  final bool showRetry;
  final VoidCallback? onRetry;
  final VoidCallback? onSettings;

  const FaceScanStatusChip({
    super.key,
    required this.icon,
    required this.color,
    required this.text,
    this.livenessLine,
    this.livenessColor,
    this.showRetry = false,
    this.onRetry,
    this.onSettings,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: color),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: color,
                ),
              ),
            ),
            if (showRetry) ...[
              TextButton(onPressed: onRetry, child: Text('Qayta urinish')),
              TextButton(onPressed: onSettings, child: Text('Sozlash')),
            ],
          ],
        ),
        if (livenessLine != null) ...[
          SizedBox(height: 4),
          Text(
            livenessLine!,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: livenessColor ?? Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}

/// Kadr darajasidagi ogohlantirish (2+ yuz / sifat / UNKNOWN / AMBIGUOUS).
class FaceScanWarningLine extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const FaceScanWarningLine({
    super.key,
    required this.icon,
    required this.text,
    this.color = const Color(0xFFB45309),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tanib olingan/tasdiqlanayotgan shaxs kartasi.
class FaceScanIdentityCard extends StatelessWidget {
  final Identity? identity;
  final double confidence;
  final bool ambiguous;

  /// Tasdiqlash jarayoni progressi (Confirming) — null bo'lsa yashiriladi.
  final (int, int)? confirmation;

  /// Attendance natijasi (Identified bo'lsa).
  final FaceAttendanceOutcome? attendance;

  /// Cooldown faol — qayta yozilmayotgani haqida eslatma.
  final bool cooldownActive;

  const FaceScanIdentityCard({
    super.key,
    this.identity,
    required this.confidence,
    this.ambiguous = false,
    this.confirmation,
    this.attendance,
    this.cooldownActive = false,
  });

  static String _roleLabel(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => 'o\'quvchi',
      IdentityRole.teacher => 'o\'qituvchi',
      IdentityRole.staff => 'xodim',
      IdentityRole.parent => 'ota-ona',
    };
  }

  @override
  Widget build(BuildContext context) {
    final color = ambiguous ? context.dsColors.warning : context.dsColors.success;
    final identity = this.identity;

    return AppCard(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient:
                      ambiguous ? context.dsColors.accentGradient : context.dsColors.accentGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  ambiguous ? Icons.help_outline : Icons.check_circle,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      identity?.fullName ?? 'Yuz topildi…',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                    if (identity != null)
                      Text(
                        '${identity.identityId} • ${_roleLabel(identity.role)}',
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
          SizedBox(height: 16),
          if (confirmation != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: (confirmation!.$1 / confirmation!.$2).clamp(0.0, 1.0),
                minHeight: 8,
                backgroundColor: color.withValues(alpha: 0.15),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
            SizedBox(height: 6),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _subtitle(),
                  style: TextStyle(
                    fontSize: 12,
                    color: ambiguous
                        ? context.dsColors.warning
                        : context.dsColors.textSecondary,
                  ),
                ),
              ),
              if (attendance != null) _attendanceBadge(context, attendance!),
            ],
          ),
          if (cooldownActive)
            Padding(
              padding: EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Icon(Icons.timer_outlined, size: 15, color: context.dsColors.info),
                  SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Shaxs yaqinda tasdiqlangan — qayta yozuv o\'tkazilmaydi',
                      style: TextStyle(fontSize: 12, color: context.dsColors.info),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _subtitle() {
    if (confirmation != null) {
      final (frames, required) = confirmation!;
      return 'Barqarorlik tekshiruvi: $frames/$required kadr';
    }
    if (ambiguous) return 'Noaniq moslik — yuzni to\'g\'riroq ko\'rsating';
    if (attendance != null && attendance!.isComplete) {
      return 'Face ID orqali aniqlandi';
    }
    return 'Yuz mos keldi';
  }

  Widget _attendanceBadge(BuildContext context, FaceAttendanceOutcome outcome) {
    if (outcome.recorded) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.event_available, size: 15, color: context.dsColors.success),
          SizedBox(width: 4),
          Text(
            'Davomat belgilandi',
            style: TextStyle(
              fontSize: 12,
              color: context.dsColors.success,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      );
    }
    if (outcome.duplicate) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.event_repeat, size: 15, color: context.dsColors.info),
          SizedBox(width: 4),
          Text(
            'Bugun allaqachon belgilangan',
            style: TextStyle(fontSize: 12, color: context.dsColors.info),
          ),
        ],
      );
    }
    if (outcome.blocked) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.block, size: 15, color: context.dsColors.warning),
          SizedBox(width: 4),
          Flexible(
            child: Text(
              outcome.blockedReason ?? 'Belgilanmadi',
              style: TextStyle(
                fontSize: 12,
                color: context.dsColors.warning,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

/// Oddiy ko'rsatma kartasi (yuz kutilayotganda).
class FaceScanHintCard extends StatelessWidget {
  final String text;
  final IconData icon;

  const FaceScanHintCard({
    super.key,
    required this.text,
    this.icon = Icons.face_retouching_natural,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Icon(icon, size: 32, color: context.dsColors.accent),
          SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: context.dsColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
