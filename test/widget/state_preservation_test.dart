import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/dashboard/presentation/pages/main_shell_page.dart';

/// PHASE D — STATE PRESERVATION (brief §35, §6).
///
/// Har bir primary tab o'z state'ini saqlaydi: tab'ga o'tib-qaytganingizda
/// qidiruv/scroll/hisoblagich qayta yuklanmaydi (StatefulShellRoute).
void main() {
  Future<void> pumpShell(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => _FakeAuthController('admin'),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: buildStatefulRouter(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('tab state\'i saqlanadi (counter qayta yuklanmaydi)',
      (tester) async {
    await pumpShell(tester);

    // Boshida: A sahifasi, counter 0.
    expect(find.text('A:0'), findsOneWidget);

    // O'quvchilar (B) ga o'tamiz va 2 marta bosamiz.
    await tester.tap(find.text("O'quvchilar"));
    await tester.pumpAndSettle();
    await tester.tap(find.text('inc B'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('inc B'));
    await tester.pumpAndSettle();
    expect(find.text('B:2'), findsOneWidget);

    // Boshqa tab'ga o'tib qaytamiz — B state saqlanadi (2 qoladi).
    await tester.tap(find.text('Bosh sahifa'));
    await tester.pumpAndSettle();
    expect(find.text('A:0'), findsOneWidget);

    await tester.tap(find.text("O'quvchilar"));
    await tester.pumpAndSettle();
    expect(find.text('B:2'), findsOneWidget);

    // Davomat (F) ham mustaqil state (contract §9.2: Attendance tab).
    await tester.tap(find.text('Davomat'));
    await tester.pumpAndSettle();
    expect(find.text('F:0'), findsOneWidget);
    await tester.tap(find.text('inc F'));
    await tester.pumpAndSettle();
    await tester.tap(find.text("O'quvchilar"));
    await tester.pumpAndSettle();
    expect(find.text('B:2'), findsOneWidget);
  });

  testWidgets('go() orqali branch almashganda ham state saqlanadi',
      (tester) async {
    await pumpShell(tester);
    // B tab'da counter oshiramiz.
    await tester.tap(find.text("O'quvchilar"));
    await tester.pumpAndSettle();
    await tester.tap(find.text('inc B'));
    await tester.pumpAndSettle();

    // Davomat tab'iga o'tamiz — goBranch orqali.
    await tester.tap(find.text('Davomat'));
    await tester.pumpAndSettle();
    expect(find.text('F:0'), findsOneWidget);

    // B ga qaytamiz — state saqlangan.
    await tester.tap(find.text("O'quvchilar"));
    await tester.pumpAndSettle();
    expect(find.text('B:1'), findsOneWidget);
  });
}

/// State'li stub: counter'li sahifa — holat saqlanishini tekshiradi.
///
/// Real [AppRouter] bilan bir xil branch tartibi (0-11); pastki panel
/// spec bo'yicha: Home(0), Students(1), Groups(8), Schedule(3), More(4).
GoRouter buildStatefulRouter() {
  return GoRouter(
    initialLocation: '/dashboard',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShellPage(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, __) => const _CounterPage('A'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/students',
                builder: (_, __) => const _CounterPage('B'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/attendance',
                builder: (_, __) => const _CounterPage('F'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/schedule',
                builder: (_, __) => const _CounterPage('D'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/more',
                builder: (_, __) => const _CounterPage('E'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/finance',
                builder: (_, __) => const _CounterPage('F2'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (_, __) => const _CounterPage('F3'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings/users',
                builder: (_, __) => const _CounterPage('F4'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                builder: (_, __) => const _CounterPage('C'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                builder: (_, __) => const _CounterPage('F5'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/homework',
                builder: (_, __) => const _CounterPage('F6'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/teachers',
                builder: (_, __) => const _CounterPage('F7'),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// Counter'li stateful sahifa — state preservation o'lchovi.
class _CounterPage extends StatefulWidget {
  final String tag;
  const _CounterPage(this.tag);

  @override
  State<_CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<_CounterPage> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('${widget.tag}:$_count',
                style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => setState(() => _count++),
              child: Text('inc ${widget.tag}'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FakeAuthController extends AuthController {
  _FakeAuthController(String role) : super() {
    state = AuthStateAuthenticated(
      userId: 'u1',
      role: role,
      name: 'Test',
    );
  }
}
