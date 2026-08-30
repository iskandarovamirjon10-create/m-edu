import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/presentation/pages/crm_kanban_page.dart';
import 'package:m_edu/features/crm/presentation/providers/lead_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/l10n/app_localizations.dart';

import '../helpers/fake_lead_repository.dart';

void main() {
  Widget wrap(List<Override> overrides, Widget child) {
    return ProviderScope(
      overrides: [
        // RBAC: amallar (drag, detail actions) ko'rinishi uchun superAdmin.
        actorRoleProvider.overrideWithValue(UserRole.superAdmin),
        ...overrides,
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('uz', 'UZ'),
        home: child,
      ),
    );
  }

  Lead lead({
    required String id,
    required String name,
    String? phone,
    LeadStage stage = LeadStage.newLead,
    LeadSource source = LeadSource.instagram,
  }) {
    return Lead(
      leadId: id,
      fullName: name,
      phone: phone,
      source: source,
      stage: stage,
      createdAt: DateTime(2026, 8, 1),
    );
  }

  group('CrmKanbanPage', () {
    testWidgets("barcha 5 bosqich ustuni va bo'sh holat ko'rinadi",
        (tester) async {
      final repo = FakeLeadRepository();

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('CRM — Lead Pipeline'), findsOneWidget);
      expect(find.text('Yangi'), findsOneWidget);
      expect(find.text("Bog'lanildi"), findsOneWidget);
      expect(find.text('Sinov darsiga yozilgan'), findsOneWidget);
      expect(find.text('Konvertatsiya qilingan'), findsOneWidget);
      expect(find.text("Yo'qotilgan"), findsOneWidget);
      expect(find.text('Yangi lead'), findsOneWidget); // FAB
    });

    testWidgets("lead kartalari ism/telefon/ball bilan ko'rinadi",
        (tester) async {
      final repo = FakeLeadRepository();
      repo.saved.addAll([
        lead(
          id: 'LEAD-2026-000001',
          name: 'Ali Valiyev',
          phone: '+998901234567',
          stage: LeadStage.newLead,
        ),
        lead(
          id: 'LEAD-2026-000002',
          name: 'Bekzod Karimov',
          phone: '+998909876543',
          stage: LeadStage.contacted,
          source: LeadSource.telegram,
        ),
      ]);

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Ali Valiyev'), findsOneWidget);
      expect(find.text('Bekzod Karimov'), findsOneWidget);
      // Maskalangan telefon.
      expect(find.text('+99890******67'), findsOneWidget);
      // Hot/Warm/Cold badge (ism+telefon → +2, instagram +1 → Warm).
      expect(find.text('Warm'), findsWidgets);
    });

    testWidgets('qidiruv filtri ishlaydi', (tester) async {
      final repo = FakeLeadRepository();
      repo.saved.addAll([
        lead(id: 'LEAD-2026-000001', name: 'Ali Valiyev', phone: '+998901234567'),
        lead(id: 'LEAD-2026-000002', name: 'Bekzod Karimov', phone: '+998909876543'),
      ]);

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'Bekzod');
      await tester.pumpAndSettle();

      expect(find.text('Bekzod Karimov'), findsOneWidget);
      expect(find.text('Ali Valiyev'), findsNothing);
    });

    testWidgets("FAB 'Yangi lead' sheet ochadi", (tester) async {
      final repo = FakeLeadRepository();

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Yangi lead'));
      await tester.pumpAndSettle();

      // Capture sheet formasi ko'rinadi.
      expect(find.text('To\'liq ism'), findsOneWidget);
      expect(find.text('Manba'), findsOneWidget);
      expect(find.text('Saqlash'), findsOneWidget);
    });

    testWidgets('karta bosilganda detail sheet ochiladi', (tester) async {
      final repo = FakeLeadRepository();
      repo.saved.add(lead(
        id: 'LEAD-2026-000001',
        name: 'Ali Valiyev',
        phone: '+998901234567',
      ));

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ali Valiyev'));
      await tester.pumpAndSettle();

      expect(find.text('LEAD-2026-000001'), findsOneWidget);
      expect(find.text('Faoliyat tarixi'), findsOneWidget);
      expect(find.text("O'quvchiga aylantirish"), findsOneWidget);
    });

    testWidgets("detail sheetda 'Tahrirlash' dialog ochadi (regression)",
        (tester) async {
      final repo = FakeLeadRepository();
      repo.saved.add(lead(
        id: 'LEAD-2026-000001',
        name: 'Ali Valiyev',
        phone: '+998901234567',
      ));

      await tester.pumpWidget(wrap(
        [leadRepositoryProvider.overrideWithValue(repo)],
        const CrmKanbanPage(),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ali Valiyev'));
      await tester.pumpAndSettle();

      // Tahrirlash — ilgari ref.watch event handler'da ishlatilib,
      // "watch outside build" xatosi bilan yiqilardi.
      await tester.ensureVisible(find.text('Tahrirlash'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tahrirlash'));
      await tester.pumpAndSettle();

      expect(find.text('Izoh'), findsOneWidget);
      expect(find.text('Saqlash'), findsWidgets);
    });
  });
}
