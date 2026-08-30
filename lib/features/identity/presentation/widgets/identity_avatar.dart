import 'package:flutter/material.dart';

import '../../../../design/design.dart';
import '../../domain/entities/identity.dart';

/// Identity uchun avatar — foto yo'q bo'lganda ism bosh harflari bilan
/// premium gradient doira ko'rsatadi (spec: xom yuz rasmi saqlanmaydi).
class IdentityAvatar extends StatelessWidget {
  final Identity identity;
  final double radius;

  const IdentityAvatar({
    super.key,
    required this.identity,
    this.radius = 24,
  });

  @override
  Widget build(BuildContext context) {
    final initials = _initials(identity.fullName);
    final gradient = _gradientFor(context, identity.role);

    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: gradient,
        boxShadow: [
          BoxShadow(
            color: _roleColor(context, identity.role).withValues(alpha: 0.35),
            blurRadius: radius / 2,
            offset: Offset(0, radius / 4),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initials,
          style: TextStyle(
            color: Colors.white,
            fontSize: radius * 0.75,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  String _initials(String fullName) {
    final parts = fullName.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  LinearGradient _gradientFor(BuildContext context, IdentityRole role) {
    return switch (role) {
      IdentityRole.student => context.dsColors.accentGradient,
      IdentityRole.teacher => context.dsColors.accentGradient,
      IdentityRole.staff => context.dsColors.accentGradient,
      IdentityRole.parent => context.dsColors.accentGradient,
    };
  }

  Color _roleColor(BuildContext context, IdentityRole role) {
    return switch (role) {
      IdentityRole.student => context.dsColors.accent,
      IdentityRole.teacher => context.dsColors.info,
      IdentityRole.staff => context.dsColors.warning,
      IdentityRole.parent => context.dsColors.success,
    };
  }
}
