import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Liquid Glass Text Field — muzlagan shisha matn kiritish maydoni.
///
/// Shaffof qatlam + yumshoq soyali, fokusda glow bilan yonadi.
/// (Avval BackdropFilter ishlatilardi — perfomance sababli olib tashlandi.)
class LiquidGlassTextField extends StatefulWidget {
  final TextEditingController? controller;
  final String? hintText;
  final String? labelText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final int maxLines;
  final bool enabled;
  final TextInputAction? textInputAction;

  const LiquidGlassTextField({
    super.key,
    this.controller,
    this.hintText,
    this.labelText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.validator,
    this.onChanged,
    this.maxLines = 1,
    this.enabled = true,
    this.textInputAction,
  });

  @override
  State<LiquidGlassTextField> createState() => _LiquidGlassTextFieldState();
}

class _LiquidGlassTextFieldState extends State<LiquidGlassTextField> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Focus(
      onFocusChange: (value) => setState(() => _focused = value),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: _focused
              ? [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.28),
                    blurRadius: 18,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [
                  BoxShadow(
                    color: AppTheme.liquidShadow.withValues(alpha: 0.5),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                    spreadRadius: -4,
                  ),
                ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppTheme.liquidFrostDark.withValues(alpha: 0.8)
                        : AppTheme.liquidFrostLight.withValues(alpha: 0.85),
                  ),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _focused
                          ? AppTheme.primary.withValues(alpha: 0.8)
                          : (isDark
                              ? AppTheme.liquidEdgeDark
                              : AppTheme.liquidEdgeLight),
                      width: _focused ? 1.4 : 0.9,
                    ),
                  ),
                ),
              ),
              TextFormField(
                controller: widget.controller,
                obscureText: widget.obscureText,
                keyboardType: widget.keyboardType,
                validator: widget.validator,
                onChanged: widget.onChanged,
                maxLines: widget.maxLines,
                enabled: widget.enabled,
                textInputAction: widget.textInputAction,
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? AppTheme.textPrimaryDark : AppTheme.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: widget.hintText,
                  labelText: widget.labelText,
                  prefixIcon: widget.prefixIcon != null
                      ? Icon(
                          widget.prefixIcon,
                          color: _focused
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                        )
                      : null,
                  suffixIcon: widget.suffixIcon,
                  filled: true,
                  fillColor: Colors.transparent,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedErrorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
