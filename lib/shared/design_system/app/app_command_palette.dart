import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design/design.dart';
import '../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../features/settings/domain/entities/app_settings.dart';
import '../../../features/intelligence/domain/global_search_service.dart';
import '../../../features/students/presentation/providers/student_providers.dart';
import '../../../features/teachers/presentation/providers/teacher_providers.dart';
import '../../../features/groups/presentation/providers/group_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// COMMAND PALETTE — Global Search + Command Overlay
/// ═══════════════════════════════════════════════════════════════════════
class AppCommandPalette extends ConsumerStatefulWidget {
  const AppCommandPalette({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const AppCommandPalette(),
    );
  }

  @override
  ConsumerState<AppCommandPalette> createState() => _AppCommandPaletteState();
}

class _AppCommandPaletteState extends ConsumerState<AppCommandPalette> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();
  Timer? _debounce;
  List<SearchResult> _results = [];
  int _selectedIndex = 0;
  bool _loading = false;
  String _lastQuery = '';

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
    _controller.addListener(_onQueryChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.removeListener(_onQueryChanged);
    _controller.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () {
      _performSearch(_controller.text);
    });
  }

  void _performSearch(String query) {
    if (query == _lastQuery) return;
    _lastQuery = query;

    if (query.trim().length < 2) {
      setState(() {
        _results = _getNavResults(query);
        _selectedIndex = 0;
      });
      return;
    }

    setState(() {
      _loading = true;
      _selectedIndex = 0;
    });

    final authState = ref.read(authControllerProvider);
    final role = authState is AuthStateAuthenticated
        ? UserRole.fromWire(authState.role)
        : UserRole.unknown;

    final students = ref.read(studentListProvider).valueOrNull ?? [];
    final teachers = ref.read(teacherListProvider).valueOrNull ?? [];
    final groups = ref.read(groupListProvider).valueOrNull ?? [];

    final service = GlobalSearchService();
    final results = service.search(
      query: query,
      role: role,
      students: students,
      teachers: teachers,
      groups: groups,
    );

    if (mounted) {
      setState(() {
        _results = results;
        _loading = false;
        _selectedIndex = 0;
      });
    }
  }

  List<SearchResult> _getNavResults(String query) {
    final authState = ref.read(authControllerProvider);
    final role = authState is AuthStateAuthenticated
        ? UserRole.fromWire(authState.role)
        : UserRole.unknown;

    return GlobalSearchService().search(
      query: query,
      role: role,
    );
  }

  void _onKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) return;

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      Navigator.of(context).pop();
    } else if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      setState(() {
        _selectedIndex = (_selectedIndex + 1).clamp(0, _results.length - 1);
      });
      _scrollToSelected();
    } else if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      setState(() {
        _selectedIndex = (_selectedIndex - 1).clamp(0, _results.length - 1);
      });
      _scrollToSelected();
    } else if (event.logicalKey == LogicalKeyboardKey.enter) {
      if (_results.isNotEmpty && _selectedIndex < _results.length) {
        _openResult(_results[_selectedIndex]);
      }
    }
  }

  void _scrollToSelected() {
    if (!_scrollController.hasClients) return;
    final targetOffset = _selectedIndex * 56.0;
    _scrollController.animateTo(
      targetOffset,
      duration: DsMotion.fast,
      curve: Curves.easeOut,
    );
  }

  void _openResult(SearchResult result) {
    Navigator.of(context).pop();
    if (result.routeParams != null) {
      context.push(result.route, extra: result.routeParams);
    } else {
      context.push(result.route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomPadding),
      child: KeyboardListener(
        focusNode: _focusNode,
        onKeyEvent: _onKeyEvent,
        child: Container(
          height: MediaQuery.of(context).size.height * 0.6,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
          decoration: BoxDecoration(
            color: colors.surfaceRaised,
            borderRadius: DsRadius.xlAll,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 32,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              _SearchInput(
                controller: _controller,
                focusNode: _focusNode,
                colors: colors,
                loading: _loading,
              ),
              Divider(height: 1, color: colors.divider.withValues(alpha: 0.5)),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _results.isEmpty
                        ? _EmptyState(query: _controller.text, colors: colors)
                        : _ResultsList(
                            results: _results,
                            selectedIndex: _selectedIndex,
                            onSelected: _openResult,
                            onHover: (i) => setState(() => _selectedIndex = i),
                            colors: colors,
                            scrollController: _scrollController,
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchInput extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final DsColors colors;
  final bool loading;

  const _SearchInput({
    required this.controller,
    required this.focusNode,
    required this.colors,
    required this.loading,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Icon(Icons.search_rounded, size: 22, color: colors.textTertiary),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              autofocus: true,
              style: DsType.body(color: colors.textPrimary),
              decoration: InputDecoration(
                hintText: 'O\'quvchi, guruh, sahifa qidirish...',
                hintStyle: DsType.body(color: colors.textTertiary),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              textInputAction: TextInputAction.search,
            ),
          ),
          if (loading)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: colors.surfaceOverlay,
                borderRadius: DsRadius.xsAll,
                border: Border.all(color: colors.border),
              ),
              child: Text(
                'Esc',
                style: DsType.caption(color: colors.textTertiary)
                    .copyWith(fontSize: 10),
              ),
            ),
        ],
      ),
    );
  }
}

({IconData icon, String label}) _categoryInfo(SearchResultCategory cat) {
  return switch (cat) {
    SearchResultCategory.students => (icon: Icons.person_outline, label: 'O\'QUVCHILAR'),
    SearchResultCategory.teachers => (icon: Icons.school_outlined, label: 'O\'QITUVCHILAR'),
    SearchResultCategory.groups => (icon: Icons.groups_outlined, label: 'GURUHLAR'),
    SearchResultCategory.navigation => (icon: Icons.arrow_forward_ios, label: 'SAHIFALAR'),
    SearchResultCategory.settings => (icon: Icons.settings_outlined, label: 'SOZLAMALAR'),
  };
}

class _ResultsList extends StatelessWidget {
  final List<SearchResult> results;
  final int selectedIndex;
  final ValueChanged<SearchResult> onSelected;
  final ValueChanged<int> onHover;
  final DsColors colors;
  final ScrollController scrollController;

  const _ResultsList({
    required this.results,
    required this.selectedIndex,
    required this.onSelected,
    required this.onHover,
    required this.colors,
    required this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    final grouped = <SearchResultCategory, List<SearchResult>>{};
    for (final r in results) {
      grouped.putIfAbsent(r.category, () => []).add(r);
    }

    var globalIndex = 0;

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: grouped.length,
      itemBuilder: (context, catIndex) {
        final category = grouped.keys.elementAt(catIndex);
        final items = grouped[category]!;
        final info = _categoryInfo(category);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  Icon(info.icon, size: 14, color: colors.textTertiary),
                  const SizedBox(width: 6),
                  Text(
                    info.label,
                    style: DsType.overline(color: colors.textTertiary),
                  ),
                ],
              ),
            ),
            for (final item in items) ...[
              Builder(builder: (ctx) {
                final idx = globalIndex;
                globalIndex++;
                return _ResultTile(
                  result: item,
                  category: category,
                  isSelected: idx == selectedIndex,
                  onTap: () => onSelected(item),
                  onHover: () => onHover(idx),
                  colors: colors,
                );
              }),
            ],
          ],
        );
      },
    );
  }
}

class _ResultTile extends StatelessWidget {
  final SearchResult result;
  final SearchResultCategory category;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onHover;
  final DsColors colors;

  const _ResultTile({
    required this.result,
    required this.category,
    required this.isSelected,
    required this.onTap,
    required this.onHover,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    final catIcon = _categoryInfo(category).icon;
    return MouseRegion(
      onEnter: (_) => onHover(),
      child: Material(
        color: isSelected ? colors.accentSoft : Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? colors.accent.withValues(alpha: 0.15)
                        : colors.fill,
                    borderRadius: DsRadius.smAll,
                  ),
                  child: Icon(catIcon, size: 18, color: colors.accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        result.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DsType.body(
                          color: colors.textPrimary,
                        ).copyWith(
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                      if (result.subtitle != null)
                        Text(
                          result.subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              DsType.caption(color: colors.textSecondary),
                        ),
                    ],
                  ),
                ),
                if (isSelected)
                  Icon(Icons.arrow_forward_ios_rounded,
                      size: 14, color: colors.accent),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String query;
  final DsColors colors;

  const _EmptyState({required this.query, required this.colors});

  @override
  Widget build(BuildContext context) {
    final hasQuery = query.trim().isNotEmpty;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            hasQuery ? Icons.search_off_rounded : Icons.keyboard_command_key,
            size: 48,
            color: colors.textTertiary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 12),
          Text(
            hasQuery ? '"$query" uchun natija topilmadi' : 'Qidirishni boshlang',
            style: DsType.body(color: colors.textSecondary),
          ),
          if (!hasQuery) ...[
            const SizedBox(height: 8),
            Text(
              'O\'quvchi, guruh, dars yoki sahifa nomini kiriting',
              style: DsType.caption(color: colors.textTertiary),
            ),
          ],
        ],
      ),
    );
  }
}
