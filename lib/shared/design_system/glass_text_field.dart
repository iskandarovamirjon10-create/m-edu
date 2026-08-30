import 'package:flutter/material.dart';

import 'liquid/liquid_glass_text_field.dart';

/// Crystal Air → Liquid Glass Text Field komponenti.
///
/// Muzlagan shisha matn kiritish maydoni — fokusda glow bilan yonadi.
class GlassTextField extends StatelessWidget {
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

  const GlassTextField({
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
  Widget build(BuildContext context) {
    return LiquidGlassTextField(
      controller: controller,
      hintText: hintText,
      labelText: labelText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: onChanged,
      maxLines: maxLines,
      enabled: enabled,
      textInputAction: textInputAction,
    );
  }
}
