import 'package:flutter/material.dart';

import '../../../../design/design.dart';

/// Wizard bosqichining sarlavha qismi: ikonka + sarlavha + izoh.
class WizardStepHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const WizardStepHeader({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            gradient: context.dsColors.accentGradient,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: context.dsColors.accent.withValues(alpha: 0.3),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Icon(icon, size: 34, color: Colors.white),
        ),
        SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: context.dsColors.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
        SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            color: context.dsColors.textSecondary,
            height: 1.5,
          ),
        ),
      ],
    );
  }
}
