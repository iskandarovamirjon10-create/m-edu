import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/crm/domain/entities/lead.dart';
import 'package:m_edu/features/crm/domain/services/lead_score_calculator.dart';
import 'package:m_edu/features/crm/domain/value_objects/lead_score.dart';

void main() {
  // Deterministik vaqt — testlar soatga bog'liq bo'lmaydi.
  final now = DateTime(2026, 8, 11, 12, 0);

  Lead buildLead({
    String fullName = 'Ali Valiyev',
    String? phone,
    String? email,
    LeadSource source = LeadSource.website,
    LeadStage stage = LeadStage.newLead,
    DateTime? lastContactedAt,
    DateTime? createdAt,
    int? score,
  }) {
    return Lead(
      leadId: 'LEAD-2026-000001',
      fullName: fullName,
      phone: phone,
      email: email,
      source: source,
      stage: stage,
      score: score ?? 0,
      lastContactedAt: lastContactedAt,
      createdAt: createdAt ?? now.subtract(const Duration(hours: 1)),
    );
  }

  group('LeadScoreCalculator — har bir qoida alohida', () {
    test('+2: fullName va phone ikkalasi ham to\'liq', () {
      final lead = buildLead(phone: '+998901234567');
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 2);
      expect(result.breakdown['Ism va telefon'], 2);
    });

    test('+2 qoidasi: faqat ism bo\'lsa ball yo\'q', () {
      final lead = buildLead(phone: null);
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 0);
      expect(result.breakdown.containsKey('Ism va telefon'), isFalse);
    });

    test('+1: email mavjud', () {
      final lead = buildLead(email: 'ali@example.com');
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 1);
      expect(result.breakdown['Email'], 1);
    });

    test('+2: source == referral', () {
      final lead = buildLead(source: LeadSource.referral);
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 2);
      expect(result.breakdown['Referral'], 2);
    });

    test('+1: source == telegram (faol raqamli kanal)', () {
      final lead = buildLead(source: LeadSource.telegram);
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 1);
      expect(result.breakdown['Faol raqamli kanal'], 1);
    });

    test('+1: source == instagram (faol raqamli kanal)', () {
      final lead = buildLead(source: LeadSource.instagram);
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 1);
      expect(result.breakdown['Faol raqamli kanal'], 1);
    });

    test('+1 qoidasi: walkIn/website uchun raqamli kanal balli yo\'q', () {
      final walkIn = buildLead(source: LeadSource.walkIn);
      final website = buildLead(source: LeadSource.website);

      expect(
        LeadScoreCalculator.calculate(walkIn, now: now).score,
        0,
      );
      expect(
        LeadScoreCalculator.calculate(website, now: now).score,
        0,
      );
    });

    test('+1: lastContactedAt < 48 soat oldin (yaqinda aloqa)', () {
      final lead = buildLead(
        lastContactedAt: now.subtract(const Duration(hours: 10)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 1);
      expect(result.breakdown['Yaqinda aloqa'], 1);
    });

    test('+1 qoidasi: aloqa 48 soatdan ko\'p oldin bo\'lsa ball yo\'q', () {
      final lead = buildLead(
        lastContactedAt: now.subtract(const Duration(hours: 60)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 0);
      expect(result.breakdown.containsKey('Yaqinda aloqa'), isFalse);
    });

    test("+1 qoidasi: kelajakdagi sana (rejalashtirilgan aloqa) ball bermaydi",
        () {
      final lead = buildLead(
        lastContactedAt: now.add(const Duration(hours: 24)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 0);
      expect(result.breakdown.containsKey('Yaqinda aloqa'), isFalse);
    });

    test('-2: 3+ kun o\'tgan, hali contacted emas (sovib qolyapti)', () {
      final lead = buildLead(
        stage: LeadStage.newLead,
        createdAt: now.subtract(const Duration(days: 4)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      // Yakuniy score 0 dan pastga tushmaydi (klamp).
      expect(result.score, 0);
      expect(result.breakdown['Sovib qolyapti'], -2);
    });

    test('-2 qoidasi: contacted bosqichiga o\'tgan bo\'lsa jazo yo\'q', () {
      final lead = buildLead(
        stage: LeadStage.contacted,
        createdAt: now.subtract(const Duration(days: 4)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 0);
      expect(result.breakdown.containsKey('Sovib qolyapti'), isFalse);
    });

    test('3 kundan kam — sovib qolish jazosi yo\'q', () {
      final lead = buildLead(
        stage: LeadStage.newLead,
        createdAt: now.subtract(const Duration(days: 2)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.breakdown.containsKey('Sovib qolyapti'), isFalse);
    });
  });

  group('LeadScoreBucket — chegaraviy holatlar', () {
    test('score aynan 5 → Hot', () {
      expect(LeadScoreBucket.fromScore(5), LeadScoreBucket.hot);
      expect(LeadScoreBucket.fromScore(99), LeadScoreBucket.hot);
    });

    test('score aynan 2 → Warm', () {
      expect(LeadScoreBucket.fromScore(2), LeadScoreBucket.warm);
      expect(LeadScoreBucket.fromScore(3), LeadScoreBucket.warm);
      expect(LeadScoreBucket.fromScore(4), LeadScoreBucket.warm);
    });

    test('score aynan 1 → Cold', () {
      expect(LeadScoreBucket.fromScore(1), LeadScoreBucket.cold);
      expect(LeadScoreBucket.fromScore(0), LeadScoreBucket.cold);
      expect(LeadScoreBucket.fromScore(-5), LeadScoreBucket.cold);
    });

    test('Lead.scoreBucket getteri score\'dan hosil qilinadi', () {
      expect(buildLead(score: 6).scoreBucket, LeadScoreBucket.hot);
      expect(buildLead(score: 3).scoreBucket, LeadScoreBucket.warm);
      expect(buildLead(score: 0).scoreBucket, LeadScoreBucket.cold);
    });
  });

  group('Kombinatsiyalar va transparency', () {
    test('to\'liq profil + referral + yaqin aloqa → Hot (6 ball)', () {
      final lead = buildLead(
        phone: '+998901234567',
        email: 'ali@example.com',
        source: LeadSource.referral,
        lastContactedAt: now.subtract(const Duration(hours: 2)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 6);
      expect(result.bucket, LeadScoreBucket.hot);
    });

    test('to\'liq profil + telegram → Warm (3 ball)', () {
      final lead = buildLead(
        phone: '+998901234567',
        source: LeadSource.telegram,
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 3);
      expect(result.bucket, LeadScoreBucket.warm);
    });

    test('faqat email → Cold (1 ball)', () {
      final lead = buildLead(email: 'ali@example.com');
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 1);
      expect(result.bucket, LeadScoreBucket.cold);
    });

    test('describe() har bir ballni tushuntiradi (shaffoflik)', () {
      final lead = buildLead(
        phone: '+998901234567',
        source: LeadSource.referral,
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);
      final description = result.describe();

      expect(description, contains('Ism va telefon: +2'));
      expect(description, contains('Referral: +2'));
      expect(description, contains('jami 4'));
    });

    test('salbiy jazo klamp qilinadi: faqat sovib qolish → 0, Cold', () {
      final lead = buildLead(
        stage: LeadStage.newLead,
        createdAt: now.subtract(const Duration(days: 10)),
      );
      final result = LeadScoreCalculator.calculate(lead, now: now);

      expect(result.score, 0);
      expect(result.bucket, LeadScoreBucket.cold);
    });

    test('deterministik: bir xil lead + bir xil now → bir xil natija', () {
      final lead = buildLead(
        phone: '+998901234567',
        source: LeadSource.instagram,
        lastContactedAt: now.subtract(const Duration(hours: 5)),
      );

      final first = LeadScoreCalculator.calculate(lead, now: now);
      final second = LeadScoreCalculator.calculate(lead, now: now);

      expect(first.score, second.score);
      expect(first.breakdown, second.breakdown);
    });
  });

  group('Lead entity — domain qoidalari', () {
    test('converted va lost — final holatlar', () {
      expect(LeadStage.converted.isFinal, isTrue);
      expect(LeadStage.lost.isFinal, isTrue);
      expect(LeadStage.newLead.isFinal, isFalse);
      expect(LeadStage.contacted.isFinal, isFalse);
      expect(LeadStage.trialScheduled.isFinal, isFalse);
    });

    test('maskedPhone telefonni yashiradi (boshi + oxiri ko\'rinadi)', () {
      final lead = buildLead(phone: '+998901234567');
      expect(lead.maskedPhone, '+99890******67');
    });

    test('copyWith stage o\'zgartirishni qo\'llab-quvvatlaydi', () {
      final lead = buildLead();
      final advanced = lead.copyWith(stage: LeadStage.contacted);

      expect(advanced.stage, LeadStage.contacted);
      expect(lead.stage, LeadStage.newLead); // immutable — asl qiymat o'zgarmaydi
    });
  });
}
