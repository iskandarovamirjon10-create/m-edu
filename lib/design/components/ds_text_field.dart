import 'package:flutter/material.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS TEXT FIELD — Unified input component
/// ═══════════════════════════════════════════════════════════════════════

class DsTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final String? labelText;
  final String? errorText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final int maxLines;
  final bool enabled;
  final TextInputAction? textInputAction;
  final FocusNode? focusNode;

  const DsTextField({
    super.key,
    this.controller,
    this.hintText,
    this.labelText,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.validator,
    this.onChanged,
    this.maxLines = 1,
    this.enabled = true,
    this.textInputAction,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: onChanged,
      maxLines: maxLines,
      enabled: enabled,
      textInputAction: textInputAction,
      focusNode: focusNode,
      style: DsType.body(color: context.dsColors.textPrimary),
      decoration: InputDecoration(
        hintText: hintText,
        labelText: labelText,
        errorText: errorText,
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, size: 20, color: context.dsColors.textTertiary)
            : null,
        suffixIcon: suffixIcon,
      ),
    );
  }
}
