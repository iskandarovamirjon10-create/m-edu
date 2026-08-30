import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/recommendations/priority_scorer.dart';
import 'package:m_edu/features/intelligence/domain/entities/action_priority.dart';

void main() {
  const scorer = PriorityScorer();

  group('PriorityScorer — formula va vaznlar', () {
    test('maksimal barcha komponentlar → score 1.0, critical', () {
      final result = scorer.score(
        urgency: 1.0,
        importance: 1.0,
        recency: 1.0,
        context: 1.0,
      );
      expect(result.score, closeTo(1.0, 0.0001));
      expect(result.level, PriorityLevel.critical);
    });

    test('hammasi nol → score 0.0, low', () {
      final result = scorer.score(
        urgency: 0,
        importance: 0,
        recency: 0,
        context: 0,
      );
      expect(result.score, 0.0);
      expect(result.level, PriorityLevel.low);
    });

    test('faqat urgency → 0.40 hissa (40% vazn)', () {
      final result = scorer.score(
        urgency: 1.0,
        importance: 0,
        recency: 0,
        context: 0,
      );
      expect(result.score, closeTo(0.40, 0.0001));
      expect(result.breakdown['urgency'], 1.0);
    });

    test('faqat importance → 0.30 hissa', () {
      final result = scorer.score(
        urgency: 0,
        importance: 1.0,
        recency: 0,
        context: 0,
      );
      expect(result.score, closeTo(0.30, 0.0001));
    });

    test('faqat recency → 0.20 hissa', () {
      final result = scorer.score(
        urgency: 0,
        importance: 0,
        recency: 1.0,
        context: 0,
      );
      expect(result.score, closeTo(0.20, 0.0001));
    });

    test('faqat context → 0.10 hissa', () {
      final result = scorer.score(
        urgency: 0,
        importance: 0,
        recency: 0,
        context: 1.0,
      );
      expect(result.score, closeTo(0.10, 0.0001));
    });

    test('deterministik: bir xil kirish → bir xil natija', () {
      final a = scorer.score(urgency: 0.7, importance: 0.5, recency: 0.3, context: 0.2);
      final b = scorer.score(urgency: 0.7, importance: 0.5, recency: 0.3, context: 0.2);
      expect(a.score, b.score);
      expect(a.props, b.props);
    });

    test('qiymatlar 0..1 oralig\'iga klamp qilinadi', () {
      final result = scorer.score(
        urgency: 5.0,
        importance: -1.0,
        recency: 2.0,
        context: 0.5,
      );
      expect(result.urgency, 1.0);
      expect(result.importance, 0.0);
      expect(result.recency, 1.0);
    });
  });

  group('PriorityScorer — yordamchi funksiyalar', () {
    test('urgencyFromDaysOverdue: 0 kun → 0.2, 2 kun → 0.6, 10 kun → 1.0', () {
      expect(PriorityScorer.urgencyFromDaysOverdue(0), 0.2);
      expect(PriorityScorer.urgencyFromDaysOverdue(2), 0.6);
      expect(PriorityScorer.urgencyFromDaysOverdue(10), 1.0);
    });

    test('recencyFromAgeDays: 0 kun → 1.0, 7 kun → ~0.5, 30 kun → past', () {
      expect(PriorityScorer.recencyFromAgeDays(0), 1.0);
      expect(PriorityScorer.recencyFromAgeDays(7), closeTo(0.5, 0.01));
      expect(PriorityScorer.recencyFromAgeDays(30), lessThan(0.2));
    });

    test('PriorityLevel chegaralari', () {
      expect(PriorityLevel.fromScore(0.9), PriorityLevel.critical);
      expect(PriorityLevel.fromScore(0.7), PriorityLevel.high);
      expect(PriorityLevel.fromScore(0.45), PriorityLevel.medium);
      expect(PriorityLevel.fromScore(0.1), PriorityLevel.low);
    });
  });
}
