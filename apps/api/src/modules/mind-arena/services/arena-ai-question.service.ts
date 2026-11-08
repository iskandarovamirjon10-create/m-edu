import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestUser } from '../../../auth/types';
import {
  ArenaQuestionSource,
  ArenaQuestionStatus,
  ArenaSubjectCategory,
  QuestionDifficulty,
} from '@prisma/client';
import {
  ArenaQuestionVerifierService,
  QuestionVerificationCandidate,
} from './arena-question-verifier.service';
import { GenerateAiQuestionsDto } from '../dto/arena-question.dto';

// Safe dynamic loader for @google/genai
let GoogleGenAIClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const genai = require('@google/genai');
  GoogleGenAIClass = genai.GoogleGenAI ?? null;
} catch {
  GoogleGenAIClass = null;
}

@Injectable()
export class ArenaAiQuestionService {
  private readonly logger = new Logger(ArenaAiQuestionService.name);
  private aiClient: any = null;
  private readonly modelName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verifier: ArenaQuestionVerifierService,
  ) {
    this.modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash';
  }

  private getGenAiClient(): any {
    if (this.aiClient) return this.aiClient;
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not configured in environment');
      return null;
    }
    if (!GoogleGenAIClass) {
      this.logger.warn('@google/genai package is not loaded');
      return null;
    }

    try {
      this.aiClient = new GoogleGenAIClass({ apiKey });
      return this.aiClient;
    } catch (err: any) {
      this.logger.error(`Failed to initialize GoogleGenAI: ${err.message}`);
      return null;
    }
  }

  /**
   * Generates AI questions for Mind Arena, runs subject verification,
   * saves them as PENDING_REVIEW (or REJECTED), and returns full audit results.
   */
  async generateQuestions(user: RequestUser, dto: GenerateAiQuestionsDto) {
    const client = this.getGenAiClient();
    if (!client) {
      throw new InternalServerErrorException(
        "AI generator xizmati faol emas (Gemini API kaliti topilmadi).",
      );
    }

    const count = Math.min(Math.max(1, dto.count || 3), 5);
    const prompt = this.buildPrompt(dto, count);

    this.logger.log(
      `Generating ${count} Mind Arena questions for subject=${dto.subjectCategory}, diff=${dto.difficulty}, topic="${dto.topic}"`,
    );

    let rawQuestions: any[] = [];
    try {
      const response = await client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const text = response?.text || '';
      rawQuestions = this.parseQuestionsJson(text);
    } catch (err: any) {
      this.logger.error(`Gemini generation failed: ${err.message}`, err.stack);
      throw new BadRequestException(
        `AI orqali savollar yaratishda xatolik yuz berdi: ${err.message}`,
      );
    }

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new BadRequestException(
        "AI tomonidan yaroqli savollar to'plami qaytarilmadi. Qaytadan urinib ko'ring.",
      );
    }

    // Process and verify each generated question
    const savedQuestions = [];

    for (const raw of rawQuestions) {
      const candidate: QuestionVerificationCandidate = {
        subjectCategory: dto.subjectCategory,
        questionText: String(raw.questionText || '').trim(),
        codeSnippet: raw.codeSnippet ? String(raw.codeSnippet).trim() : null,
        codeLanguage: raw.codeLanguage ? String(raw.codeLanguage).trim() : null,
        explanation: String(raw.explanation || '').trim(),
        options: Array.isArray(raw.options)
          ? raw.options.map((opt: any, idx: number) => ({
              optionKey: String(opt.optionKey || String.fromCharCode(65 + idx)).toUpperCase(),
              optionText: String(opt.optionText || '').trim(),
              isCorrect: Boolean(opt.isCorrect),
              explanation: opt.explanation ? String(opt.explanation).trim() : null,
            }))
          : [],
      };

      // Run deep verification
      const verification = await this.verifier.verifyQuestion(candidate);

      // Determine initial status: strictly PENDING_REVIEW if passed, REJECTED if failed
      const status: ArenaQuestionStatus = verification.passed
        ? ArenaQuestionStatus.PENDING_REVIEW
        : ArenaQuestionStatus.REJECTED;

      const rejectionReason = verification.passed
        ? null
        : verification.errors.join('; ');

      // Save into DB
      const arenaQuestion = await this.prisma.arenaQuestion.create({
        data: {
          organizationId: user.organizationId || null,
          subjectCategory: dto.subjectCategory,
          difficulty: dto.difficulty,
          status,
          source: ArenaQuestionSource.AI_GENERATED,
          questionText: candidate.questionText,
          codeSnippet: candidate.codeSnippet,
          codeLanguage: candidate.codeLanguage,
          explanation: candidate.explanation,
          timeLimitSec: this.calculateTimeLimit(dto.difficulty, candidate.codeSnippet),
          tags: [
            dto.topic.toLowerCase().replace(/\s+/g, '-'),
            dto.subjectCategory.toLowerCase(),
            dto.difficulty.toLowerCase(),
          ],
          createdById: user.id,
          rejectionReason,
          verificationLog: {
            score: verification.score,
            passed: verification.passed,
            errors: verification.errors,
            warnings: verification.warnings,
            details: verification.details,
            generatedAt: new Date().toISOString(),
          },
          options: {
            create: candidate.options.map((opt, idx) => ({
              optionKey: opt.optionKey,
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              explanation: opt.explanation,
              orderIndex: idx,
            })),
          },
        },
        include: {
          options: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      savedQuestions.push({
        ...arenaQuestion,
        verification,
      });
    }

    return {
      success: true,
      requestedCount: count,
      generatedCount: savedQuestions.length,
      pendingReviewCount: savedQuestions.filter(
        (q) => q.status === ArenaQuestionStatus.PENDING_REVIEW,
      ).length,
      rejectedCount: savedQuestions.filter(
        (q) => q.status === ArenaQuestionStatus.REJECTED,
      ).length,
      questions: savedQuestions,
    };
  }

  private buildPrompt(dto: GenerateAiQuestionsDto, count: number): string {
    const langInstructions: Record<string, string> = {
      uz: "Savollar va variantlar o'zbek tilida (lotin alifbosida), professional, qiziqarli va mutlaqo to'g'ri bo'lsin.",
      ru: 'Вопросы и варианты должны быть на русском языке, профессиональные, увлекательные и строго выверенные.',
      en: 'Questions and options must be in English, professional, intellectually stimulating, and strictly accurate.',
    };

    const targetLang = langInstructions[dto.language || 'uz'] || langInstructions.uz;

    return `
You are the Chief Academic Assessment Architect for "M-EDU Mind Arena", an elite competitive real-time duel platform for students.

Your task is to generate EXACTLY ${count} high-caliber, intellectually engaging multiple-choice battle questions.

PARAMETERS:
- Subject Category: ${dto.subjectCategory}
- Difficulty: ${dto.difficulty} (EASY = clear foundational insight, MEDIUM = deep multi-step thinking, HARD = Olympiad/expert-level conceptual rigor)
- Core Topic: "${dto.topic}"
- Target Level/Grade: "${dto.targetGrade || 'Umumiy oʻrta taʻlim / Yuqori sinf'}"
- Language: ${targetLang}

CRITICAL PEDAGOGICAL & SCIENTIFIC REQUIREMENTS:
1. NO TRIVIAL OR CHILDISH QUESTIONS. The questions must challenge critical thinking, analytical reasoning, and practical application.
2. EXACTLY 4 MUTUALLY EXCLUSIVE OPTIONS (A, B, C, D).
3. EXACTLY 1 OPTION MUST BE 100% CORRECT (isCorrect: true).
4. THE 3 DISTRACTORS MUST BE HIGHLY PLAUSIBLE based on common student misconceptions, but definitively incorrect upon rigorous analysis.
5. MATHEMATICS / PHYSICS: Formulas, calculations, and units must be 100% mathematically and physically sound. No contradictory laws of physics.
6. PROGRAMMING: If code snippet is included, it MUST be valid syntax in the specified language, concise (under 20 lines), and the correct answer must match exact program output.
7. DETAILED EXPLANATION: Provide a step-by-step master proof in the "explanation" field showing why the correct answer is unequivocally true and why each distractor fails.

JSON SCHEMA REQUIREMENT (OUTPUT MUST BE STRICT RAW JSON ARRAY):
[
  {
    "questionText": "Question statement here",
    "codeSnippet": "optional code snippet or null",
    "codeLanguage": "javascript/python/cpp or null",
    "explanation": "Detailed pedagogical proof and explanation here",
    "options": [
      { "optionKey": "A", "optionText": "Option A text", "isCorrect": false, "explanation": "Why A is wrong" },
      { "optionKey": "B", "optionText": "Option B text", "isCorrect": true, "explanation": "Why B is correct" },
      { "optionKey": "C", "optionText": "Option C text", "isCorrect": false, "explanation": "Why C is wrong" },
      { "optionKey": "D", "optionText": "Option D text", "isCorrect": false, "explanation": "Why D is wrong" }
    ]
  }
]
`;
  }

  private parseQuestionsJson(text: string): any[] {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
      return [parsed];
    } catch (e) {
      // Try extracting json array brackets
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error(`Failed to parse AI JSON response: ${(e as Error).message}`);
    }
  }

  private calculateTimeLimit(
    difficulty: QuestionDifficulty,
    codeSnippet?: string | null,
  ): number {
    let base = 15;
    if (difficulty === QuestionDifficulty.EASY) base = 12;
    if (difficulty === QuestionDifficulty.HARD) base = 25;
    if (codeSnippet) base += 10;
    return Math.min(45, base);
  }
}
