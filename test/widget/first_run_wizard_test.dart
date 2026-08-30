import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/organization/application/commands/setup_organization_command.dart';
import 'package:m_edu/features/organization/domain/entities/organization.dart';
import 'package:m_edu/features/organization/domain/repositories/organization_repository.dart';
import 'package:m_edu/features/organization/presentation/pages/first_run_wizard_page.dart';
import 'package:m_edu/features/organization/presentation/providers/organization_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

void main() {
  late FakeOrganizationRepository repository;

  setUp(() {
    repository = FakeOrganizationRepository();
  });

  Widget buildApp({bool requiresSetup = true}) {
    final router = GoRouter(
      initialLocation: '/setup',
      routes: [
        GoRoute(
          path: '/setup',
          builder: (context, state) => const FirstRunWizardPage(),
        ),
        GoRoute(
          path: '/dashboard',
          builder: (context, state) =>
              const Scaffold(body: Center(child: Text('Dashboard'))),
        ),
      ],
    );

    return ProviderScope(
      overrides: [
        setupOrganizationCommandProvider.overrideWithValue(
          SetupOrganizationCommand(
            repository: repository,
            eventBus: EventBus(),
            actorRole: UserRole.superAdmin,
          ),
        ),
        organizationRequiresSetupProvider
            .overrideWith((ref) async => requiresSetup),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('bo\'sh markaz nomi bilan Davom etish validatsiyadan o\'tmaydi',
      (tester) async {
    await tester.pumpWidget(buildApp());
    await tester.pumpAndSettle();

    // "Davom etish" ni bosamiz — markaz nomi bo'sh.
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // Hali birinchi bosqichdamiz — validatsiya xatosi ko'rinadi.
    expect(find.text('Bu maydon majburiy'), findsOneWidget);
    expect(find.text('Tashkilotingiz nomi'), findsOneWidget);
  });

  testWidgets('to\'liq oqim: ma\'lumot kiritish → yakunlash → dashboard',
      (tester) async {
    await tester.pumpWidget(buildApp());
    await tester.pumpAndSettle();

    // 1-bosqich: markaz nomi.
    await tester.enterText(find.byType(TextFormField).first, 'Bilim markazi');
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // 2-bosqich: filial.
    expect(find.text('Filial'), findsWidgets);
    await tester.enterText(find.byType(TextFormField).first, 'Chilonzor filiali');
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // 3-bosqich: xona (ixtiyoriy) — bo'sh qoldiramiz.
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // 4-bosqich: kurs (ixtiyoriy) — bo'sh qoldiramiz.
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // Yakuniy bosqich: xulosa + Yakunlash.
    expect(find.text('Hammasi tayyor!'), findsOneWidget);
    expect(find.text('Bilim markazi'), findsWidgets);
    expect(find.text('Chilonzor filiali'), findsWidgets);

    await tester.tap(find.text('Yakunlash'));
    await tester.pumpAndSettle();

    // Repository'ga saqlandi va dashboard'ga o'tdik.
    expect(repository.current, isNotNull);
    expect(repository.current!.organizationName, 'Bilim markazi');
    expect(repository.current!.branchName, 'Chilonzor filiali');
    expect(find.text('Dashboard'), findsOneWidget);
  });

  testWidgets('tashkilot allaqachon o\'rnatilgan bo\'lsa dashboard\'ga o\'tadi',
      (tester) async {
    repository.current = Organization(
      organizationName: 'Mavjud markaz',
      branchName: 'Filial',
      createdAt: DateTime.now(),
    );

    await tester.pumpWidget(buildApp(requiresSetup: false));
    await tester.pumpAndSettle();

    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Tashkilotingiz nomi'), findsNothing);
  });
}

class FakeOrganizationRepository implements OrganizationRepository {
  Organization? current;

  @override
  Future<Organization?> fetchCurrent() async => current;

  @override
  Future<Organization> save(Organization organization) async {
    current = organization;
    return organization;
  }
}
