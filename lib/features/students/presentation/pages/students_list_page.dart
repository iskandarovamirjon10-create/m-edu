import 'dart:async';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../domain/entities/student.dart';
import '../providers/student_providers.dart';
import '../widgets/student_card.dart';

/// O'quvchilar ro'yxati — Universal Identity'dan rol=student bo'lgan
/// yozuvlarni ko'rsatadi (spec §6 #6-11).
///
/// "No Demo Data" siyosati (spec §5): baza bo'sh bo'lsa empty-state
/// ko'rsatiladi, hech qachon namunaviy o'quvchi chiqarilmaydi.
///
/// Phase 16 (student list scale): browse holatida butun jadval emas,
/// sahifalab yuklanadi (infinite scroll). Qidiruv/filtr rejimida esa
/// to'liq to'plam kerak (cross-field matn mosligi) — u debounce bilan
/// boshqariladi (quyida `_searchDebounce`).
class StudentsListPage extends ConsumerStatefulWidget {
  const StudentsListPage({super.key});

  @override
  ConsumerState<StudentsListPage> createState() => _StudentsListPageState();
}

class _StudentsListPageState extends ConsumerState<StudentsListPage> {
  static const int _pageSize = 100;

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  String _query = '';
  _FilterType _filterType = _FilterType.all;

  /// Browse rejimida yuklangan talabalar (sahifalar bo'yicha yig'iladi).
  List<Student> _browseStudents = const [];
  bool _browseLoadingMore = false;

  /// Qidiruv debounce (spec §15: 150–200ms) — har bir belgida butun
  /// ro'yxatni qayta filtrlash o'rniga, yozish pauza qilganda bir marta
  /// ishlaydi. Katta datasetda (1000+ talaba) per-keystroke jank'ni
  /// oldini oladi; kichik ro'yxatlarda natija farqi sezilmaydi.
  static const Duration _searchDebounce = Duration(milliseconds: 180);
  Timer? _debounce;

  bool get _isBrowsing => _query.isEmpty && _filterType == _FilterType.all;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  /// Sahifa oxiriga yaqinlashganda keyingi sahifani yuklaydi (infinite
  /// scroll). Butun jadval bir vaqtda xotiraga yuklanmaydi.
  void _onScroll() {
    if (!_isBrowsing) return;
    if (_browseLoadingMore) return;
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    final total = await ref.read(studentCountProvider.future);
    if (_browseStudents.length >= total) return;
    setState(() => _browseLoadingMore = true);
    try {
      final page = await ref.read(studentQueriesProvider).fetchPage(
            offset: _browseStudents.length,
            limit: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        _browseStudents = [..._browseStudents, ...page];
        _browseLoadingMore = false;
      });
    } catch (_) {
      // Error state quyida list orqali ko'rsatiladi — jim yutilmaydi.
      if (!mounted) return;
      setState(() => _browseLoadingMore = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(_searchDebounce, () {
      if (mounted) setState(() => _query = value.trim().toLowerCase());
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() => _query = '');
  }

  void _setFilter(_FilterType type) {
    setState(() => _filterType = type);
  }

  @override
  Widget build(BuildContext context) {
    // Ma'lumot o'zgarganda (ro'yxatga olish/arxivlash/...) browse
    // keshini tozalaymiz — eskirgan sahifalar ko'rinmaydi.
    ref.listen(studentListVersionProvider, (prev, next) {
      if (prev != next) {
        _browseStudents = const [];
      }
    });

    // Browse rejimida jami soni (indeks orqali, ro'yxatni yuklamaydi).
    final countAsync = _isBrowsing ? ref.watch(studentCountProvider) : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.studentsTitle),
        actions: [
          IconButton(
            tooltip: "Yangi o'quvchi",
            icon: const Icon(Icons.person_add_alt_1),
            onPressed: () => context.push('/identity/register'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Ism, ID yoki guruh bo\'yicha qidirish...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: _clearSearch,
                      ),
              ),
            ),
          ),
          // Filter chips — tor ekranlarda RIGHT OVERFLOWED bo'lmasligi
          // uchun gorizontal scroll'ga o'ralgan.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'Barchasi',
                    isSelected: _filterType == _FilterType.all,
                    onTap: () => _setFilter(_FilterType.all),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Faol',
                    isSelected: _filterType == _FilterType.active,
                    onTap: () => _setFilter(_FilterType.active),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Muzlatilgan',
                    isSelected: _filterType == _FilterType.frozen,
                    onTap: () => _setFilter(_FilterType.frozen),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Bitirgan',
                    isSelected: _filterType == _FilterType.graduated,
                    onTap: () => _setFilter(_FilterType.graduated),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Arxivlangan',
                    isSelected: _filterType == _FilterType.archived,
                    onTap: () => _setFilter(_FilterType.archived),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Students list
          Expanded(
            child: _isBrowsing
                ? _buildBrowseList(countAsync!)
                : _buildFilteredList(),
          ),
        ],
      ),
    );
  }

  /// Browse rejimi (qidiruv/filtrsiz): sahifalab yuklanadi.
  Widget _buildBrowseList(AsyncValue<int> countAsync) {
    return countAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorView(message: '$error'),
      data: (total) {
        if (total == 0) {
          return _EmptyStudents(
            onRegister: () => context.push('/identity/register'),
          );
        }
        // Boshlang'ich sahifani (scroll'dan oldin) yuklaymiz.
        if (_browseStudents.isEmpty && !_browseLoadingMore) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _loadMore());
        }
        // Yuklangan sahifalar uchun identity map — faqat ko'rinadigan
        // talabalar uchun, butun identity jadvali emas.
        final identityIds = _browseStudents.map((s) => s.identityId).toList();
        final identitiesAsync = ref.watch(identityByIdsProvider(identityIds));
        return identitiesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorView(message: '$error'),
          data: (identities) {
            final identityMap = {
              for (final i in identities) i.identityId: i,
            };
            return ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              itemCount: _browseStudents.length + (_browseLoadingMore ? 1 : 0),
              // Har bir qator mustaqil rastrlanadi — scroll'da
              // faqat ko'rinadigan kartalar qayta chiziladi.
              itemBuilder: (context, index) {
                if (index >= _browseStudents.length) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final student = _browseStudents[index];
                final identity = identityMap[student.identityId] ??
                    Identity(
                      identityId: student.identityId,
                      firstName: 'Noma\'lum',
                      lastName: '',
                      role: IdentityRole.student,
                      status: IdentityStatus.active,
                      qrSeed: '',
                      createdAt: DateTime.now(),
                    );
                return RepaintBoundary(
                  child: StudentCard(
                    student: student,
                    identity: identity,
                    showAttendance: true,
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  /// Qidiruv/filtr rejimi: to'liq to'plam ustida client-side moslik
  /// (cross-field matn qidiruvi to'liq setni talab qiladi; debounce bilan).
  Widget _buildFilteredList() {
    final studentsAsync = ref.watch(studentListProvider);
    final identitiesAsync = ref.watch(identityListProvider);

    return studentsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorView(message: '$error'),
      data: (students) {
        if (students.isEmpty) {
          return _EmptyStudents(
            onRegister: () => context.push('/identity/register'),
          );
        }

        return identitiesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorView(message: '$error'),
          data: (identities) {
            // O(1) qidiruv uchun identity map — katta ro'yxatlarda
            // scroll lag'ini oldini oladi (avval O(n×m) edi).
            final identityMap = {
              for (final i in identities) i.identityId: i,
            };
            final filtered = _filter(students, identityMap);
            if (filtered.isEmpty && _query.isNotEmpty) {
              return const _NoResults();
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              itemCount: filtered.length,
              // Har bir qator mustaqil rastrlanadi — scroll'da
              // faqat ko'rinadigan kartalar qayta chiziladi.
              itemBuilder: (context, index) {
                final student = filtered[index];
                final identity = identityMap[student.identityId] ??
                    Identity(
                      identityId: student.identityId,
                      firstName: 'Noma\'lum',
                      lastName: '',
                      role: IdentityRole.student,
                      status: IdentityStatus.active,
                      qrSeed: '',
                      createdAt: DateTime.now(),
                    );
                return RepaintBoundary(
                  child: StudentCard(
                    student: student,
                    identity: identity,
                    showAttendance: true,
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  List<Student> _filter(
    List<Student> students,
    Map<String, Identity> identityMap,
  ) {
    var filtered = students;

    // Status filter
    switch (_filterType) {
      case _FilterType.active:
        filtered = filtered.where((s) => s.isActive).toList();
        break;
      case _FilterType.frozen:
        filtered = filtered
            .where((s) => s.studentStatus == StudentStatus.frozen)
            .toList();
        break;
      case _FilterType.graduated:
        filtered = filtered
            .where((s) => s.studentStatus == StudentStatus.graduated)
            .toList();
        break;
      case _FilterType.archived:
        filtered = filtered
            .where((s) => s.studentStatus == StudentStatus.archived)
            .toList();
        break;
      case _FilterType.all:
        break;
    }

    // Search filter — identityMap'dan O(1) qidiruv (§29: ism, familiya,
    // real ID, telefon, email, ota-ona raqami/ismi).
    if (_query.isNotEmpty) {
      filtered = filtered.where((s) {
        final identity = identityMap[s.identityId];
        final phone = identity?.phone ?? '';
        final email = identity?.email ?? '';
        return (identity?.fullName.toLowerCase().contains(_query) ?? false) ||
            s.identityId.toLowerCase().contains(_query) ||
            (s.groupName?.toLowerCase().contains(_query) ?? false) ||
            (s.groupId?.toLowerCase().contains(_query) ?? false) ||
            (s.parentName?.toLowerCase().contains(_query) ?? false) ||
            (s.parentPhone?.toLowerCase().contains(_query) ?? false) ||
            phone.toLowerCase().contains(_query) ||
            email.toLowerCase().contains(_query);
      }).toList();
    }

    return filtered;
  }
}

enum _FilterType { all, active, frozen, graduated, archived }

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: DsMotion.normal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? context.dsColors.accent.withValues(alpha: 0.15)
              : context.dsColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? context.dsColors.accent : context.dsColors.border,
            width: isSelected ? 1.5 : 0.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            color:
                isSelected ? context.dsColors.accent : context.dsColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _EmptyStudents extends StatelessWidget {
  final VoidCallback onRegister;

  const _EmptyStudents({required this.onRegister});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: context.dsColors.accent.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(Icons.groups_outlined, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              'Hali o\'quvchilar yo\'q',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Birinchi o\'quvchini ro\'yxatga oling — u avtomatik real ID va '
              'raqamli ID karta oladi.',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRegister,
              icon: const Icon(Icons.person_add_alt_1),
              label: Text(context.l10n.studentsEmpty),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  const _NoResults();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off,
                size: 56, color: context.dsColors.textTertiary),
            SizedBox(height: 12),
            Text(
              'Hech narsa topilmadi',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 56, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              'Ma\'lumotlarni yuklashda xato',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 6),
            Text(
              message,
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
