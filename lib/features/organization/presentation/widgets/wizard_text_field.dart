import 'package:flutter/material.dart';

/// Wizard bosqichlarida ishlatiladigan glass uslubdagi kiritish maydoni.
class WizardTextField extends StatelessWidget {
  final TextEditingController controller;
  final IconData icon;
  final String label;
  final String hint;
  final bool required;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onChanged;

  const WizardTextField({
    super.key,
    required this.controller,
    required this.icon,
    required this.label,
    required this.hint,
    this.required = false,
    this.keyboardType = TextInputType.text,
    this.validator,
    this.textInputAction = TextInputAction.next,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onChanged: onChanged,
      textCapitalization: TextCapitalization.words,
      decoration: InputDecoration(
        labelText: required ? '$label *' : label,
        hintText: hint,
        prefixIcon: Icon(icon),
      ),
      validator: validator ??
          (value) {
            if (required && (value == null || value.trim().isEmpty)) {
              return 'Bu maydon majburiy';
            }
            return null;
          },
    );
  }
}
