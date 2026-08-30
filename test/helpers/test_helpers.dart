import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:m_edu/features/dashboard/presentation/pages/main_shell_page.dart';
import 'package:m_edu/features/dashboard/presentation/pages/more_page.dart';

/// Test uchun oddiy sahifa — real feature sahifalari og'ir provider
/// bog'liqliklarga ega (Isar database), shuning uchun stub ishlatamiz.
class StubPage extends StatelessWidget {
  final String text;
  const StubPage(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(text, style: const TextStyle(fontSize: 20)),
      ),
    );
  }
}

/// Shell'ni real go_router struktura bilan quradi (10 branch, PHASE D).
///
/// Branch'lar: 0=dashboard, 1=students, 2=attendance, 3=schedule, 4=more
/// (real MorePage), 5=finance, 6=settings, 7=settings/users, 8=groups,
/// 9=reports — real [AppRouter] bilan bir xil tartib.
GoRouter buildTestShellRouter({String initialLocation = '/dashboard'}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShellPage(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, __) => const StubPage('DASHBOARD'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/students',
                builder: (_, __) => const StubPage('STUDENTS'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/attendance',
                builder: (_, __) => const StubPage('ATTENDANCE'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/schedule',
                builder: (_, __) => const StubPage('SCHEDULE'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/more',
                builder: (_, __) => const MorePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/finance',
                builder: (_, __) => const StubPage('FINANCE'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (_, __) => const StubPage('SETTINGS'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings/users',
                builder: (_, __) => const StubPage('SETTINGS-USERS'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                builder: (_, __) => const StubPage('GROUPS'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                builder: (_, __) => const StubPage('REPORTS'),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// Riverpod provider'lari bilan widget test qilish uchun wrapper.
class TestAppWrapper extends StatelessWidget {
  final Widget child;
  final List<Override> overrides;

  const TestAppWrapper({
    super.key,
    required this.child,
    this.overrides = const [],
  });

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(home: child),
    );
  }
}

/// Holat turini tekshiruvchi matcher.
Matcher isAuthStateType<T>() {
  return predicate((dynamic state) => state is T, 'is of type $T');
}

/// Async operatsiya tugashini kutish uchun yordamchi.
Future<void> waitUntil(
  bool Function() condition, {
  Duration timeout = const Duration(seconds: 5),
  Duration interval = const Duration(milliseconds: 100),
}) async {
  final stopwatch = Stopwatch()..start();
  while (!condition()) {
    if (stopwatch.elapsed > timeout) {
      throw TimeoutException(
        'Timed out waiting for condition',
        timeout,
      );
    }
    await Future<void>.delayed(interval);
  }
  stopwatch.stop();
}
