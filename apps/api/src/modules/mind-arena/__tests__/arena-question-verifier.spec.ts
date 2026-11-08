import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSubjectCategory } from '@prisma/client';
import {
  ArenaQuestionVerifierService,
  QuestionVerificationCandidate,
} from '../services/arena-question-verifier.service';

describe('ArenaQuestionVerifierService — Multi-Tier Subject Verification', () => {
  let verifier: ArenaQuestionVerifierService;

  beforeEach(() => {
    verifier = new ArenaQuestionVerifierService();
  });

  // ==========================================================================
  // TIER 1: STRUCTURAL RULES
  // ==========================================================================
  describe('Universal Structural Verification', () => {
    it('should reject a question with fewer than 4 options', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        questionText: 'Agar 2x + 4 = 10 boʻlsa, x ning qiymatini toping.',
        explanation: '2x = 6, shuning uchun x = 3 boʻladi.',
        options: [
          { optionKey: 'A', optionText: 'x = 1', isCorrect: false },
          { optionKey: 'B', optionText: 'x = 3', isCorrect: true },
          { optionKey: 'C', optionText: 'x = 5', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('aynan 4 ta variant'))).toBe(true);
    });

    it('should reject a question with multiple correct answers', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        questionText: 'Quyidagilardan qaysi biri juft son?',
        explanation: '2 va 4 ikkalasi ham juft son.',
        options: [
          { optionKey: 'A', optionText: '2', isCorrect: true },
          { optionKey: 'B', optionText: '4', isCorrect: true },
          { optionKey: 'C', optionText: '3', isCorrect: false },
          { optionKey: 'D', optionText: '5', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Aynan 1 ta to\'g\'ri javob'))).toBe(true);
    });

    it('should reject duplicate option texts', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        questionText: 'Toʻrtburchakning nechta tomoni bor?',
        explanation: 'Toʻrtburchak 4 ta tomonga ega.',
        options: [
          { optionKey: 'A', optionText: '4 ta', isCorrect: true },
          { optionKey: 'B', optionText: '4 ta', isCorrect: false }, // Duplicate!
          { optionKey: 'C', optionText: '3 ta', isCorrect: false },
          { optionKey: 'D', optionText: '5 ta', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('takrorlanuvchi'))).toBe(true);
    });
  });

  // ==========================================================================
  // TIER 2: MATHEMATICS VERIFICATION
  // ==========================================================================
  describe('Mathematics Deterministic Verification', () => {
    it('should pass a mathematically sound question with valid arithmetic', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        questionText: 'Hisoblang: 12 * 8 ifodaning qiymati nechaga teng?',
        explanation: '12 koʻpaytirilgan 8 = 96 boʻladi.',
        options: [
          { optionKey: 'A', optionText: '84', isCorrect: false },
          { optionKey: 'B', optionText: '96', isCorrect: true },
          { optionKey: 'C', optionText: '104', isCorrect: false },
          { optionKey: 'D', optionText: '92', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('should reject if a distractor has the exact same numeric value as the correct answer', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        questionText: 'Hisoblang: 10 + 5 ning natijasini toping.',
        explanation: '10 + 5 = 15 boʻladi.',
        options: [
          { optionKey: 'A', optionText: '15', isCorrect: true },
          { optionKey: 'B', optionText: '15.0', isCorrect: false }, // Same numeric value!
          { optionKey: 'C', optionText: '20', isCorrect: false },
          { optionKey: 'D', optionText: '25', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('bir xil sonli qiymatga ega'))).toBe(true);
    });
  });

  // ==========================================================================
  // TIER 3: PHYSICS VERIFICATION
  // ==========================================================================
  describe('Physics Sanity & Boundary Verification', () => {
    it('should pass a physically valid question', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.PHYSICS,
        questionText: 'Jismga 5 N kuch taʼsir etib, uni 4 m masofaga siljitdi. Bajarilgan ish (A = F * s) qancha?',
        explanation: 'Ish A = 5 N * 4 m = 20 J boʻladi.',
        options: [
          { optionKey: 'A', optionText: '15 J', isCorrect: false },
          { optionKey: 'B', optionText: '20 J', isCorrect: true },
          { optionKey: 'C', optionText: '25 J', isCorrect: false },
          { optionKey: 'D', optionText: '30 J', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(true);
    });

    it('should reject questions with temperatures below absolute zero', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.PHYSICS,
        questionText: 'Gaz harorati -300°C boʻlganda bosim qanday oʻzgaradi?',
        explanation: 'Harorat pasayganda bosim ham kamayadi.',
        options: [
          { optionKey: 'A', optionText: 'Kamayadi', isCorrect: true },
          { optionKey: 'B', optionText: 'Oshadi', isCorrect: false },
          { optionKey: 'C', optionText: 'Oʻzgarmaydi', isCorrect: false },
          { optionKey: 'D', optionText: 'Nolga teng boʻladi', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Fizik paradoks') && e.includes('-273.15'))).toBe(true);
    });

    it('should reject speeds exceeding the speed of light', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.PHYSICS,
        questionText: 'Yulduzlararo kemaning tezligi 5 * 10^8 m/s boʻlganda relyativistik effektlar qanday kechadi?',
        explanation: 'Eynshteyn maxsus nisbiylik nazariyasi.',
        options: [
          { optionKey: 'A', optionText: 'Vaqt sekinlashadi', isCorrect: true },
          { optionKey: 'B', optionText: 'Vaqt tezlashadi', isCorrect: false },
          { optionKey: 'C', optionText: 'Oʻzgarishsiz', isCorrect: false },
          { optionKey: 'D', optionText: 'Massa kamayadi', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Yorug\'lik tezligidan yuqori'))).toBe(true);
    });
  });

  // ==========================================================================
  // TIER 4: PROGRAMMING VERIFICATION
  // ==========================================================================
  describe('Programming Sandboxed Execution', () => {
    it('should execute JS snippet safely in sandbox and match output', async () => {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: ArenaSubjectCategory.PROGRAMMING,
        questionText: 'Quyidagi JavaScript kodi bajarilgach, konsolga nima chiqadi?',
        codeSnippet: `
          const nums = [1, 2, 3, 4];
          const sum = nums.reduce((acc, n) => acc + n, 0);
          console.log(sum);
        `,
        codeLanguage: 'javascript',
        explanation: '1 + 2 + 3 + 4 = 10 boʻladi.',
        options: [
          { optionKey: 'A', optionText: '6', isCorrect: false },
          { optionKey: 'B', optionText: '10', isCorrect: true },
          { optionKey: 'C', optionText: '24', isCorrect: false },
          { optionKey: 'D', optionText: 'undefined', isCorrect: false },
        ],
      };

      const result = await verifier.verifyQuestion(candidate);
      expect(result.passed).toBe(true);
      expect(result.details.executionOutput).toBe('10');
    });
  });
});
