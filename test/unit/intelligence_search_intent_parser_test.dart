import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/search/search_intent_parser.dart';
import 'package:m_edu/features/intelligence/domain/entities/search_intent.dart';

void main() {
  final parser = SearchIntentParser();

  group('SearchIntentParser — entity aniqlash', () {
    test('"Ali" → any entity, nom qidiruvi', () {
      final intent = parser.parse('Ali');
      expect(intent.entityType, SearchEntityType.any);
      expect(intent.nameQuery, 'ali');
      expect(intent.hasIntent, isFalse);
    });

    test('"talaba" → student entity', () {
      final intent = parser.parse('talaba');
      expect(intent.entityType, SearchEntityType.student);
      expect(intent.hasIntent, isTrue);
    });

    test('"guruh" → group entity', () {
      final intent = parser.parse('guruh');
      expect(intent.entityType, SearchEntityType.group);
    });

    test('"to\'lov" → payment entity', () {
      final intent = parser.parse("to'lov");
      expect(intent.entityType, SearchEntityType.payment);
    });

    test('"davomat" → attendance entity', () {
      final intent = parser.parse('davomat');
      expect(intent.entityType, SearchEntityType.attendance);
    });

    test('"hisobot" → report entity', () {
      final intent = parser.parse('hisobot');
      expect(intent.entityType, SearchEntityType.report);
    });
  });

  group('SearchIntentParser — amal va filter', () {
    test('"unpaid" → payment + unpaid filter', () {
      final intent = parser.parse('unpaid');
      expect(intent.entityType, SearchEntityType.payment);
      expect(intent.filters, contains(SearchFilter.unpaid));
      expect(intent.hasIntent, isTrue);
    });

    test('"bugungi davomat" → attendance + today filter', () {
      final intent = parser.parse('bugungi davomat');
      expect(intent.entityType, SearchEntityType.attendance);
      expect(intent.filters, contains(SearchFilter.today));
    });

    test('"qo\'shish" → create action', () {
      final intent = parser.parse("talaba qo'shish");
      expect(intent.entityType, SearchEntityType.student);
      expect(intent.actionType, SearchActionType.create);
    });
  });

  group('SearchIntentParser — guruh pattern', () {
    test('"Ali 9-B" → student + group query', () {
      final intent = parser.parse('Ali 9-B');
      expect(intent.nameQuery, 'ali');
      expect(intent.groupQuery, '9-b');
      expect(intent.hasIntent, isTrue);
    });

    test('"9b" → guruh kodi', () {
      final intent = parser.parse('9b');
      expect(intent.groupQuery, '9b');
      expect(intent.hasIntent, isTrue);
    });
  });

  group('SearchIntentParser — determinizm va chegaralar', () {
    test('bir xil so\'rov → bir xil intent', () {
      final a = parser.parse("Ali 9-B to'lamagan");
      final b = parser.parse("Ali 9-B to'lamagan");
      expect(a.props, b.props);
    });

    test('bo\'sh so\'rov → any entity, intent yo\'q', () {
      final intent = parser.parse('   ');
      expect(intent.entityType, SearchEntityType.any);
      expect(intent.hasIntent, isFalse);
      expect(intent.nameQuery, '');
    });

    test('noma\'lum so\'z → sof nom qidiruvi', () {
      final intent = parser.parse('Aziza');
      expect(intent.entityType, SearchEntityType.any);
      expect(intent.nameQuery, 'aziza');
    });
  });
}
