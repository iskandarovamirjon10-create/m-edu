import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_density.dart';
import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — SEARCH FIELD (§13, §12)
/// ═══════════════════════════════════════════════════════════════════════

class AppSearchField extends StatefulWidget {
  final TextEditingController? controller;
  final String hint;
  final ValueChanged<String> onSearch;
  final ValueChanged<String>? onSubmitted;
  final bool isLoading;
  final Duration debounce;
  final bool readOnly;
  final VoidCallback? onTap;
  final String? semanticLabel;

  const AppSearchField({
    super.key,
    this.controller,
    this.hint = 'Qidirish...',
    required this.onSearch,
    this.onSubmitted,
    this.isLoading = false,
    this.debounce = const Duration(milliseconds: 300),
    this.readOnly = false,
    this.onTap,
    this.semanticLabel,
  });

  @override
  State<AppSearchField> createState() => _AppSearchFieldState();
}

class _AppSearchFieldState extends State<AppSearchField> {
  late final TextEditingController _controller;
  Timer? _debounceTimer;
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _focusNode.dispose();
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(widget.debounce, () {
      if (mounted) {
        widget.onSearch(_controller.text);
      }
    });
  }

  void _clear() {
    _controller.clear();
    widget.onSearch('');
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Semantics(
      label: widget.semanticLabel ?? widget.hint,
      button: false,
      child: SizedBox(
        height: context.touchTargetFloor(48),
        child: TextField(
          controller: _controller,
          focusNode: _focusNode,
          readOnly: widget.readOnly,
          onTap: widget.readOnly ? widget.onTap : null,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: DsType.body(color: colors.textTertiary),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 12, right: 8),
              child: Icon(
                Icons.search_rounded,
                size: 20,
                color: colors.textTertiary,
              ),
            ),
            prefixIconConstraints: const BoxConstraints(
              minWidth: 0,
              minHeight: 0,
            ),
            suffixIcon: widget.isLoading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : _controller.text.isNotEmpty
                    ? IconButton(
                        icon: Icon(
                          Icons.cancel_rounded,
                          size: 18,
                          color: colors.textTertiary,
                        ),
                        onPressed: _clear,
                        tooltip: 'Tozalash',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 40,
                          minHeight: 40,
                        ),
                      )
                    : null,
            suffixIconConstraints: const BoxConstraints(
              minWidth: 0,
              minHeight: 0,
            ),
            filled: true,
            fillColor: colors.surfaceOverlay,
            border: OutlineInputBorder(
              borderRadius: DsRadius.smAll,
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: DsRadius.smAll,
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: DsRadius.smAll,
              borderSide: BorderSide(
                color: colors.borderFocus,
                width: 1.5,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            isDense: true,
          ),
          style: DsType.body(color: colors.textPrimary),
          textInputAction: TextInputAction.search,
          onSubmitted: widget.onSubmitted ?? widget.onSearch,
        ),
      ),
    );
  }
}
