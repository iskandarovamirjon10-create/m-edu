import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/search/intent_search_service.dart';
import 'package:m_edu/features/intelligence/application/search/search_intent_parser.dart';
import 'package:m_edu/features/intelligence/domain/entities/search_intent.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';

void main() {
  final parser = SearchIntentParser();
  final service = IntentSearchService();

  final now = DateTime(2026, 8, 16);

  final identities = [
    Identity(
      identityId: 'M-EDU-2026-000001',
      firstName: 'Ali',
      lastName: 'Valiyev',
      role: IdentityRole.student,
      status: IdentityStatus.active,
      qrSeed: 's1',
      createdAt: now,
    ),
    Identity(
      identityId: 'M-EDU-2026-000002',
      firstName: 'Aziza',
      lastName: 'Karimova',
      role: IdentityRole.student,
      status: IdentityStatus.active,
      qrSeed: 's2',
      createdAt: now,
    ),
    Identity(
      identityId: 'M-EDU-2026-000003',
      firstName: 'Bekzod',
      lastName: 'Toshpulatov',
      role: IdentityRole.teacher,
      status: IdentityStatus.active,
      qrSeed: 's3',
      createdAt: now,
    ),
  ];

  final groups = [
    Group(
      groupId: 'GRP-1',
      name: 'Matematika 9-B',
      code: 'MATH-9B',
      capacity: 20,
      currentSize: 15,
    ),
    Group(
      groupId: 'GRP-2',
      name: 'Ingliz tili A1',
      code: 'ENG-A1',
      capacity: 15,
      currentSize: 8,
    ),
  ];

  group('IntentSearchService — entity qidiruvi', () {
    test('"ali" → Ali Valiyev topiladi', () {
      final intent = parser.parse('ali');
      final results = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      expect(results, isNotEmpty);
      expect(results.first.title, 'Ali Valiyev');
      expect(results.first.type, SearchResultType.entity);
    });

    test('"9-B" → guruh natijasi (group filter)', () {
      final intent = parser.parse('9-B');
      final results = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      expect(results.any((r) => r.title == 'Matematika 9-B'), isTrue);
    });

    test('"aziza" → faqat Aziza', () {
      final intent = parser.parse('aziza');
      final results = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      expect(results.single.title, 'Aziza Karimova');
    });

    test('bo\'sh so\'rov + any → natija yo\'q (butun bazani skan qilmaydi)', () {
      final intent = const SearchIntent(rawQuery: '');
      final results = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      expect(results, isEmpty);
    });

    test('o\'qituvchi so\'rovi → faqat o\'qituvchi', () {
      final intent = parser.parse('o\'qituvchi Bekzod');
      final results = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      expect(results.single.title, 'Bekzod Toshpulatov');
    });
  });

  group('IntentSearchService — action qidiruvi', () {
    test('"unpaid" → to\'lov amallari', () {
      final intent = parser.parse('unpaid');
      final actions = service.searchActions(intent);
      expect(actions, isNotEmpty);
      expect(
        actions.any((a) => a.title == "To'lovni qayd etish"),
        isTrue,
      );
      expect(actions.any((a) => a.title == 'Qarzdorlar ro\'yxati'), isTrue);
    });

    test('"today attendance" → davomat amali', () {
      final intent = parser.parse('today attendance');
      final actions = service.searchActions(intent);
      expect(actions.any((a) => a.title == 'Davomatni belgilash'), isTrue);
    });

    test('"reports" → hisobotlar navigatsiyasi', () {
      final intent = parser.parse('reports');
      final actions = service.searchActions(intent);
      expect(actions.any((a) => a.title == 'Hisobotlar markazi'), isTrue);
    });

    test('"talaba qo\'shish" → create amali', () {
      final intent = parser.parse('talaba qo\'shish');
      final actions = service.searchActions(intent);
      expect(actions.any((a) => a.title == 'Talaba qo\'shish'), isTrue);
    });

    test('oddiy ism so\'rovi → action yo\'q', () {
      final intent = parser.parse('Ali');
      final actions = service.searchActions(intent);
      expect(actions, isEmpty);
    });
  });

  group('IntentSearchService — combine', () {
    test('action + entity + navigation birlashtiriladi', () {
      final intent = parser.parse('unpaid');
      final entities = service.searchEntities(
        intent: intent,
        identities: identities,
        groups: groups,
      );
      final actions = service.searchActions(intent);
      final combined = service.combine(
        intent: intent,
        entities: entities,
        actions: actions,
        commands: const [],
      );
      expect(combined.length, actions.length + entities.length);
    });
  });
}
