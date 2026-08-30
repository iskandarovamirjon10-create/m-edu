/// ═══════════════════════════════════════════════════════════════════════
/// GLOBAL SEARCH SERVICE — Unified Entity Search
///
/// Searches across students, teachers, groups, schedules, payments,
/// and navigation destinations. Results are RBAC-filtered.
/// ═══════════════════════════════════════════════════════════════════════
library;

import '../../../core/security/permissions.dart';
import '../../../features/settings/domain/entities/app_settings.dart';

/// A single search result item.
class SearchResult {
  final String title;
  final String? subtitle;
  final SearchResultCategory category;
  final String route;
  final Map<String, String>? routeParams;
  final double score;
  final bool accessible;

  const SearchResult({
    required this.title,
    this.subtitle,
    required this.category,
    required this.route,
    this.routeParams,
    this.score = 1.0,
    this.accessible = true,
  });
}

/// Search result categories for visual grouping.
enum SearchResultCategory {
  students,
  teachers,
  groups,
  navigation,
  settings,
}

/// Predefined navigation destinations (no Flutter dependencies).
class NavigationDestination {
  final String title;
  final String subtitle;
  final String categoryLabel;
  final String route;
  final AppPermission? permission;

  const NavigationDestination({
    required this.title,
    required this.subtitle,
    required this.categoryLabel,
    required this.route,
    this.permission,
  });
}

/// All searchable navigation destinations.
const kNavigationDestinations = [
  NavigationDestination(
    title: 'Bosh sahifa',
    subtitle: 'Dashboard',
    categoryLabel: 'Sahifalar',
    route: '/dashboard',
  ),
  NavigationDestination(
    title: 'O\'quvchilar',
    subtitle: 'Barcha o\'quvchilar ro\'yxati',
    categoryLabel: 'Sahifalar',
    route: '/students',
    permission: AppPermission.studentsView,
  ),
  NavigationDestination(
    title: 'Davomat',
    subtitle: 'Davomat belgilash va tarix',
    categoryLabel: 'Sahifalar',
    route: '/attendance',
    permission: AppPermission.attendanceView,
  ),
  NavigationDestination(
    title: 'Davomat markazi',
    subtitle: 'Kundalik davomat holati',
    categoryLabel: 'Sahifalar',
    route: '/attendance/center',
    permission: AppPermission.attendanceView,
  ),
  NavigationDestination(
    title: 'Davomat tarixi',
    subtitle: 'O\'tkazilgan davomatlar',
    categoryLabel: 'Sahifalar',
    route: '/attendance/history',
    permission: AppPermission.attendanceView,
  ),
  NavigationDestination(
    title: 'Jadval',
    subtitle: 'Dars jadvali va xonalar',
    categoryLabel: 'Sahifalar',
    route: '/schedule',
    permission: AppPermission.scheduleView,
  ),
  NavigationDestination(
    title: 'O\'qituvchilar',
    subtitle: 'O\'qituvchilar ro\'yxati',
    categoryLabel: 'Sahifalar',
    route: '/teachers',
    permission: AppPermission.teachersView,
  ),
  NavigationDestination(
    title: 'Guruhlar',
    subtitle: 'Guruhlar boshqaruvi',
    categoryLabel: 'Sahifalar',
    route: '/groups',
    permission: AppPermission.groupsView,
  ),
  NavigationDestination(
    title: 'Moliya',
    subtitle: 'To\'lovlar, qarzlar, xarajatlar',
    categoryLabel: 'Sahifalar',
    route: '/finance',
    permission: AppPermission.financeView,
  ),
  NavigationDestination(
    title: 'Baholar',
    subtitle: 'Baholar markazi',
    categoryLabel: 'Sahifalar',
    route: '/grades',
    permission: AppPermission.gradesView,
  ),
  NavigationDestination(
    title: 'Uy vazifalari',
    subtitle: 'Uy vazifalari boshqaruvi',
    categoryLabel: 'Sahifalar',
    route: '/homework',
  ),
  NavigationDestination(
    title: 'Hisobotlar',
    subtitle: 'Tahliliy hisobotlar',
    categoryLabel: 'Sahifalar',
    route: '/reports',
    permission: AppPermission.reportsView,
  ),
  NavigationDestination(
    title: 'CRM',
    subtitle: 'Lead pipeline',
    categoryLabel: 'Sahifalar',
    route: '/crm',
    permission: AppPermission.crmLeadsView,
  ),
  NavigationDestination(
    title: 'Sozlamalar',
    subtitle: 'Ilova sozlamalari',
    categoryLabel: 'Sozlamalar',
    route: '/settings',
    permission: AppPermission.settingsView,
  ),
  NavigationDestination(
    title: 'Face ID',
    subtitle: 'Yuz tanish',
    categoryLabel: 'Sahifalar',
    route: '/face-scan',
    permission: AppPermission.faceIdUse,
  ),
  NavigationDestination(
    title: 'Bildirishnomalar',
    subtitle: 'Xabarlar markazi',
    categoryLabel: 'Sahifalar',
    route: '/notifications',
  ),
];

/// Global search service — searches across all entities.
class GlobalSearchService {
  List<SearchResult> search({
    required String query,
    required UserRole role,
    List<dynamic>? students,
    List<dynamic>? teachers,
    List<dynamic>? groups,
  }) {
    if (query.trim().length < 2) {
      return _searchNavigation(query, role);
    }

    final results = <SearchResult>[];
    final q = query.toLowerCase().trim();

    results.addAll(_searchNavigation(q, role));

    if (students != null) {
      for (final s in students) {
        final name = (s as dynamic).fullName?.toString() ?? '';
        final group = (s as dynamic).groupName?.toString();
        final phone = (s as dynamic).phone?.toString();
        final identityId = (s as dynamic).identityId?.toString() ?? '';

        final nameMatch = _fuzzyScore(q, name.toLowerCase());
        final groupMatch = _fuzzyScore(q, (group ?? '').toLowerCase());
        final phoneMatch = _fuzzyScore(q, (phone ?? '').toLowerCase());
        final bestScore = [nameMatch, groupMatch, phoneMatch]
            .reduce((a, b) => a > b ? a : b);

        if (bestScore > 0 && Permissions.can(role, AppPermission.studentsView)) {
          results.add(SearchResult(
            title: name,
            subtitle: group ?? 'Guruhsiz',
            category: SearchResultCategory.students,
            route: '/students/$identityId',
            score: bestScore,
          ));
        }
      }
    }

    if (teachers != null) {
      for (final t in teachers) {
        final name = (t as dynamic).fullName?.toString() ?? '';
        final phone = (t as dynamic).phone?.toString();
        final identityId = (t as dynamic).identityId?.toString() ?? '';

        final nameMatch = _fuzzyScore(q, name.toLowerCase());
        final phoneMatch = _fuzzyScore(q, (phone ?? '').toLowerCase());
        final bestScore = nameMatch > phoneMatch ? nameMatch : phoneMatch;

        if (bestScore > 0 && Permissions.can(role, AppPermission.teachersView)) {
          results.add(SearchResult(
            title: name,
            subtitle: phone,
            category: SearchResultCategory.teachers,
            route: '/teachers/$identityId',
            score: bestScore,
          ));
        }
      }
    }

    if (groups != null) {
      for (final g in groups) {
        final name = (g as dynamic).name?.toString() ?? '';
        final subject = (g as dynamic).subject?.toString();
        final groupId = (g as dynamic).groupId?.toString() ?? '';

        final nameMatch = _fuzzyScore(q, name.toLowerCase());
        final subjectMatch = _fuzzyScore(q, (subject ?? '').toLowerCase());
        final bestScore = nameMatch > subjectMatch ? nameMatch : subjectMatch;

        if (bestScore > 0 && Permissions.can(role, AppPermission.groupsView)) {
          results.add(SearchResult(
            title: name,
            subtitle: subject,
            category: SearchResultCategory.groups,
            route: '/groups/$groupId',
            score: bestScore,
          ));
        }
      }
    }

    results.sort((a, b) {
      if (a.score != b.score) return b.score.compareTo(a.score);
      return a.category.index.compareTo(b.category.index);
    });

    return results;
  }

  List<SearchResult> _searchNavigation(String q, UserRole role) {
    final results = <SearchResult>[];
    for (final dest in kNavigationDestinations) {
      if (dest.permission != null && !Permissions.can(role, dest.permission!)) {
        continue;
      }
      final titleMatch = _fuzzyScore(q, dest.title.toLowerCase());
      final subtitleMatch = _fuzzyScore(q, dest.subtitle.toLowerCase());
      final bestScore = titleMatch > subtitleMatch ? titleMatch : subtitleMatch;
      if (bestScore > 0) {
        results.add(SearchResult(
          title: dest.title,
          subtitle: dest.subtitle,
          category: dest.categoryLabel == 'Sozlamalar'
              ? SearchResultCategory.settings
              : SearchResultCategory.navigation,
          route: dest.route,
          score: bestScore * 0.9,
        ));
      }
    }
    return results;
  }

  double _fuzzyScore(String query, String target) {
    if (query.isEmpty) return 0.0;
    if (target == query) return 1.0;
    if (target.startsWith(query)) return 0.95;
    if (target.contains(query)) return 0.75;
    var qi = 0;
    for (var ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] == query[qi]) qi++;
    }
    if (qi == query.length) return 0.5;
    return 0.0;
  }
}
