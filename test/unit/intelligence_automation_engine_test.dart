import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/automation/automation_engine.dart';
import 'package:m_edu/features/intelligence/domain/entities/automation_rule.dart';

void main() {
  group('AutomationEngine — trigger → condition → action', () {
    test('registratsiya va ro\'yxat', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.studentCreated,
          action: AutomationAction.refreshRecommendations,
        ));
      expect(engine.rules.length, 1);
      expect(engine.rules.single.id, 'r1');
    });

    test('mos trigger + true condition → action qaytariladi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.studentCreated,
          action: AutomationAction.refreshRecommendations,
        ));
      final matched = engine.evaluate(
        AutomationTrigger.studentCreated,
        evaluateCondition: (_) => true,
      );
      expect(matched.length, 1);
      expect(matched.single.action, AutomationAction.refreshRecommendations);
    });

    test('boshqa trigger → qoida ishga tushmaydi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.studentCreated,
          action: AutomationAction.refreshRecommendations,
        ));
      final matched = engine.evaluate(
        AutomationTrigger.paymentChanged,
        evaluateCondition: (_) => true,
      );
      expect(matched, isEmpty);
    });

    test('condition false → action bajarilmaydi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.paymentChanged,
          action: AutomationAction.refreshDashboard,
        ));
      final matched = engine.evaluate(
        AutomationTrigger.paymentChanged,
        evaluateCondition: (_) => false,
      );
      expect(matched, isEmpty);
    });

    test('disabled qoida — hech qachon ishga tushmaydi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.studentCreated,
          action: AutomationAction.refreshRecommendations,
          enabled: false,
        ));
      final matched = engine.evaluate(
        AutomationTrigger.studentCreated,
        evaluateCondition: (_) => true,
      );
      expect(matched, isEmpty);
    });

    test('condition exception → qoida xavfsiz o\'tkazib yuboriladi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Test',
          trigger: AutomationTrigger.appStarted,
          action: AutomationAction.refreshRecommendations,
        ));
      final matched = engine.evaluate(
        AutomationTrigger.appStarted,
        evaluateCondition: (_) => throw StateError('test'),
      );
      expect(matched, isEmpty);
    });

    test('bir xil ID bilan qayta register → almashtiradi', () {
      final engine = AutomationEngine()
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Eski',
          trigger: AutomationTrigger.appStarted,
          action: AutomationAction.refreshRecommendations,
        ))
        ..register(const AutomationRule(
          id: 'r1',
          description: 'Yangi',
          trigger: AutomationTrigger.appStarted,
          action: AutomationAction.startSync,
        ));
      expect(engine.rules.length, 1);
      expect(engine.rules.single.description, 'Yangi');
    });
  });
}
