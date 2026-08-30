import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/security/permissions.dart';
import 'package:m_edu/features/intelligence/application/commands/command_ranker.dart';
import 'package:m_edu/features/intelligence/application/commands/command_registry.dart';
import 'package:m_edu/features/intelligence/domain/entities/command.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

void main() {
  final registry = CommandRegistry()
    ..registerAll([
      const CommandAction(
        id: 'nav.students',
        title: "O'quvchilar",
        subtitle: 'Talabalar',
        iconKey: 'student',
        category: CommandCategory.students,
        keywords: ['students', 'talabalar'],
        route: '/students',
        basePriority: 9,
      ),
      const CommandAction(
        id: 'action.addStudent',
        title: 'Talaba qo\'shish',
        subtitle: 'Yangi talaba',
        iconKey: 'add',
        category: CommandCategory.students,
        keywords: ['add', 'yangi'],
        route: '/identity/register',
        requiredPermission: AppPermission.studentsCreate,
        basePriority: 9,
      ),
      const CommandAction(
        id: 'nav.settings',
        title: 'Sozlamalar',
        subtitle: 'Til va mavzu',
        iconKey: 'settings',
        category: CommandCategory.system,
        keywords: ['settings'],
        route: '/settings',
        requiredPermission: AppPermission.settingsView,
        basePriority: 6,
      ),
      const CommandAction(
        id: 'action.addPayment',
        title: "To'lov qabul qilish",
        subtitle: 'Yangi to\'lov',
        iconKey: 'payment',
        category: CommandCategory.payments,
        keywords: ['payment', "to'lov"],
        route: '/payments/new',
        requiredPermission: AppPermission.financeCreate,
        basePriority: 9,
      ),
    ]);

  const ranker = CommandRanker();

  group('CommandRegistry', () {
    test('ro\'yxatdan o\'tish va byId', () {
      expect(registry.length, 4);
      expect(registry.byId('nav.students')?.route, '/students');
      expect(registry.byId('noma\'lum'), isNull);
    });

    test('register bir xil ID bilan almashtiradi', () {
      final r = CommandRegistry()
        ..register(const CommandAction(
          id: 'x',
          title: 'Eski',
          subtitle: '',
          iconKey: 'home',
          category: CommandCategory.navigation,
          route: '/old',
        ))
        ..register(const CommandAction(
          id: 'x',
          title: 'Yangi',
          subtitle: '',
          iconKey: 'home',
          category: CommandCategory.navigation,
          route: '/new',
        ));
      expect(r.length, 1);
      expect(r.byId('x')?.title, 'Yangi');
    });

    test('availableFor — ruxsat bo\'yicha filter', () {
      // Teacher: studentsView bor, financeCreate yo'q.
      final teacherCommands = registry.availableFor(UserRole.teacher);
      expect(teacherCommands.any((c) => c.id == 'nav.students'), isTrue);
      expect(teacherCommands.any((c) => c.id == 'action.addPayment'), isFalse);

      // SuperAdmin hammasini ko'radi.
      final adminCommands = registry.availableFor(UserRole.superAdmin);
      expect(adminCommands.length, 4);
    });

    test('unregister', () {
      final r = CommandRegistry()
        ..register(const CommandAction(
          id: 'tmp',
          title: 'Temp',
          subtitle: '',
          iconKey: 'home',
          category: CommandCategory.navigation,
        ));
      expect(r.length, 1);
      r.unregister('tmp');
      expect(r.length, 0);
    });
  });

  group('CommandRanker — deterministik reyting', () {
    test('exact match prefix\'dan yuqori', () {
      final ranked = ranker.rank(
        query: "O'quvchilar",
        commands: registry.all,
      );
      expect(ranked.first.command.id, 'nav.students');
      expect(ranked.first.breakdown.containsKey('exact'), isTrue);
    });

    test('prefix match substring\'dan yuqori', () {
      final ranked = ranker.rank(
        query: 'to\'lov',
        commands: registry.all,
      );
      // "To'lov qabul qilish" — prefix; "Talaba qo'shish" kalit so'z emas.
      expect(ranked.first.command.id, 'action.addPayment');
    });

    test('keyword match ishlaydi', () {
      final ranked = ranker.rank(
        query: 'yangi',
        commands: registry.all,
      );
      expect(ranked.first.command.id, 'action.addStudent');
      expect(ranked.first.breakdown.containsKey('keyword'), isTrue);
    });

    test('contextual relevance: /students sahifasida students ustun', () {
      final ranked = ranker.rank(
        query: "O'quvchilar",
        commands: registry.all,
        currentRoute: '/students',
      );
      expect(ranked.first.command.category, CommandCategory.students);
    });

    test('recency bonus beradi', () {
      final ranked = ranker.rank(
        query: 'sozlamalar',
        commands: registry.all,
        recentlyUsedIds: {'nav.settings'},
      );
      expect(ranked.first.command.id, 'nav.settings');
    });

    test('deterministik: bir xil kirish → bir xil tartib', () {
      final a = ranker.rank(query: 'talaba', commands: registry.all);
      final b = ranker.rank(query: 'talaba', commands: registry.all);
      expect(
        a.map((r) => r.command.id).toList(),
        b.map((r) => r.command.id).toList(),
      );
    });

    test('mos kelmaydigan so\'rov → natija yo\'q', () {
      final ranked = ranker.rank(query: 'zzzzz', commands: registry.all);
      expect(ranked, isEmpty);
    });

    test('bo\'sh so\'rov → barcha buyruqlar (priority bo\'yicha)', () {
      final ranked = ranker.rank(query: '', commands: registry.all);
      expect(ranked.length, 4);
    });
  });
}
