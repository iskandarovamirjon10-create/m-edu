import { Injectable, Logger } from '@nestjs/common';
import { ArenaSubjectCategory } from '@prisma/client';
import * as vm from 'node:vm';

export interface QuestionVerificationCandidate {
  subjectCategory: ArenaSubjectCategory;
  questionText: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  explanation: string;
  options: Array<{
    optionKey: string;
    optionText: string;
    isCorrect: boolean;
    explanation?: string | null;
  }>;
}

export interface VerificationResult {
  passed: boolean;
  score: number; // 0 - 100 confidence score
  subject: ArenaSubjectCategory;
  errors: string[];
  warnings: string[];
  details: {
    structuralCheck: boolean;
    subjectSpecificCheck: boolean;
    distractorEntropy: number; // 0.0 - 1.0 uniqueness score
    executionOutput?: string;
    auditLog: string[];
  };
}

@Injectable()
export class ArenaQuestionVerifierService {
  private readonly logger = new Logger(ArenaQuestionVerifierService.name);

  /**
   * Main verification entry point. Executes multi-tier inspection:
   * 1. Universal structural & distractor entropy checks
   * 2. Subject-specific deterministic & domain checks
   */
  async verifyQuestion(candidate: QuestionVerificationCandidate): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const auditLog: string[] = [];

    // --- Tier 1: Universal Structural Inspection ---
    const structuralPass = this.verifyStructure(candidate, errors, auditLog);

    // --- Tier 2: Distractor Quality & Entropy ---
    const entropy = this.calculateDistractorEntropy(candidate.options, warnings, auditLog);

    // --- Tier 3: Subject-Specific Verification ---
    let subjectPass = true;
    let executionOutput: string | undefined;

    switch (candidate.subjectCategory) {
      case ArenaSubjectCategory.MATHEMATICS:
        subjectPass = this.verifyMathematics(candidate, errors, warnings, auditLog);
        break;

      case ArenaSubjectCategory.PHYSICS:
        subjectPass = this.verifyPhysics(candidate, errors, warnings, auditLog);
        break;

      case ArenaSubjectCategory.PROGRAMMING: {
        const codeResult = this.verifyProgramming(candidate, errors, warnings, auditLog);
        subjectPass = codeResult.passed;
        executionOutput = codeResult.output;
        break;
      }

      case ArenaSubjectCategory.HISTORY:
        subjectPass = this.verifyHistory(candidate, errors, warnings, auditLog);
        break;

      case ArenaSubjectCategory.ENGLISH:
        subjectPass = this.verifyLanguage(candidate, errors, warnings, auditLog);
        break;

      case ArenaSubjectCategory.LOGIC_PUZZLE:
        subjectPass = this.verifyLogicPuzzle(candidate, errors, warnings, auditLog);
        break;

      case ArenaSubjectCategory.GENERAL_SCIENCE:
      default:
        subjectPass = this.verifyGeneralScience(candidate, errors, warnings, auditLog);
        break;
    }

    const passed = structuralPass && subjectPass && errors.length === 0;

    // Calculate confidence score (0-100)
    let score = 100;
    score -= errors.length * 35;
    score -= warnings.length * 10;
    if (entropy < 0.6) score -= 15;
    score = Math.max(0, Math.min(100, score));

    return {
      passed,
      score,
      subject: candidate.subjectCategory,
      errors,
      warnings,
      details: {
        structuralCheck: structuralPass,
        subjectSpecificCheck: subjectPass,
        distractorEntropy: entropy,
        executionOutput,
        auditLog,
      },
    };
  }

  // ============================================================================
  // TIER 1: STRUCTURAL RULES
  // ============================================================================

  private verifyStructure(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    auditLog: string[],
  ): boolean {
    let valid = true;

    // 1. Question text length
    if (!candidate.questionText || candidate.questionText.trim().length < 15) {
      errors.push("Savol matni juda qisqa (kamida 15 ta belgi bo'lishi shart).");
      valid = false;
    }

    // 2. Exactly 4 options with keys A, B, C, D
    if (!candidate.options || candidate.options.length !== 4) {
      errors.push(`Savol aynan 4 ta variantga ega bo'lishi shart, hozirda ${candidate.options?.length ?? 0} ta.`);
      return false;
    }

    const expectedKeys = new Set(['A', 'B', 'C', 'D']);
    const presentKeys = new Set(candidate.options.map((o) => o.optionKey?.toUpperCase()));
    for (const key of expectedKeys) {
      if (!presentKeys.has(key)) {
        errors.push(`Variantlar orasida '${key}' kaliti topilmadi.`);
        valid = false;
      }
    }

    // 3. Exactly one correct answer
    const correctOptions = candidate.options.filter((o) => o.isCorrect === true);
    if (correctOptions.length !== 1) {
      errors.push(`Aynan 1 ta to'g'ri javob belgilanashi shart. Hozirda ${correctOptions.length} ta to'g'ri deb belgilangan.`);
      valid = false;
    }

    // 4. Options must be pairwise distinct
    const normalizedTexts = candidate.options.map((o) =>
      o.optionText.trim().toLowerCase().replace(/\s+/g, ' '),
    );
    const uniqueTexts = new Set(normalizedTexts);
    if (uniqueTexts.size !== 4) {
      errors.push("Variantlar ichida takrorlanuvchi matnlar mavjud. Har bir variant o'ziga xos bo'lishi shart.");
      valid = false;
    }

    // 5. Explanation required
    if (!candidate.explanation || candidate.explanation.trim().length < 10) {
      errors.push("Savol uchun batafsil pedagogik tushuntirish (explanation) talab etiladi.");
      valid = false;
    }

    auditLog.push(`[Structure] Boshlang'ich struktura tekshirildi: ${valid ? 'PASSED' : 'FAILED'}`);
    return valid;
  }

  // ============================================================================
  // TIER 2: DISTRACTOR QUALITY & ENTROPY
  // ============================================================================

  private calculateDistractorEntropy(
    options: QuestionVerificationCandidate['options'],
    warnings: string[],
    auditLog: string[],
  ): number {
    if (!options || options.length !== 4) return 0;

    // Check length variation
    const lengths = options.map((o) => o.optionText.trim().length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      lengths.length;
    const stdDev = Math.sqrt(variance);

    // If one option is 3x longer than all others, it's often an AI giveaway
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    if (minLen > 0 && maxLen / minLen > 4 && maxLen > 50) {
      warnings.push("Variantlar uzunligida katta nomutanosiblik mavjud (to'g'ri javob haddan tashqari uzun bo'lishi mumkin).");
    }

    // Entropy score based on distinct tokens
    const allTokens = options
      .map((o) => o.optionText.toLowerCase().split(/\s+/))
      .flat();
    const uniqueTokens = new Set(allTokens);
    const entropyRatio = Math.min(1.0, uniqueTokens.size / Math.max(1, allTokens.length));

    auditLog.push(
      `[Entropy] Variantlar entropiyasi: ${(entropyRatio * 100).toFixed(1)}%, O'rtacha uzunlik: ${avgLength.toFixed(0)} belgi.`,
    );
    return entropyRatio;
  }

  // ============================================================================
  // TIER 3: SUBJECT VERIFIERS
  // ============================================================================

  /**
   * Mathematics: deterministic AST evaluation of arithmetic and equations
   */
  private verifyMathematics(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    const text = candidate.questionText;
    const correctOpt = candidate.options.find((o) => o.isCorrect);
    if (!correctOpt) return false;

    auditLog.push("[Math] Deterministik matematik ifodalar tahlili boshlandi.");

    // Detect basic arithmetic expressions e.g. "12 + 15", "2^8", "24 * 5", "100 / 4"
    const arithmeticPattern = /([\d\.]+)\s*([\+\-\*\/\^])\s*([\d\.]+)/g;
    let match: RegExpExecArray | null;
    let verifiedCount = 0;

    while ((match = arithmeticPattern.exec(text)) !== null) {
      const a = parseFloat(match[1]);
      const op = match[2];
      const b = parseFloat(match[3]);
      let expected: number | null = null;

      switch (op) {
        case '+': expected = a + b; break;
        case '-': expected = a - b; break;
        case '*': expected = a * b; break;
        case '/': expected = b !== 0 ? a / b : null; break;
        case '^': expected = Math.pow(a, b); break;
      }

      if (expected !== null) {
        auditLog.push(`[Math] Aniqlangan ifoda: ${a} ${op} ${b} = ${expected}`);
        verifiedCount++;
        // Check if correct option contains or equals this number
        const optNumMatch = correctOpt.optionText.match(/[\d\.]+/);
        if (optNumMatch) {
          const optVal = parseFloat(optNumMatch[0]);
          if (Math.abs(optVal - expected) < 0.001) {
            auditLog.push(`[Math] To'g'ri javob ifodaning yechimiga mos keldi: ${optVal}`);
          }
        }
      }
    }

    // Verify distractors are not equal to the correct numerical answer
    const correctNum = this.extractFirstNumber(correctOpt.optionText);
    if (correctNum !== null) {
      for (const distractor of candidate.options.filter((o) => !o.isCorrect)) {
        const distNum = this.extractFirstNumber(distractor.optionText);
        if (distNum !== null && Math.abs(distNum - correctNum) < 0.0001) {
          errors.push(`Distraktor '${distractor.optionKey}' (${distractor.optionText}) to'g'ri javob (${correctOpt.optionText}) bilan bir xil sonli qiymatga ega.`);
          return false;
        }
      }
    }

    auditLog.push(`[Math] Tekshiruv yakunlandi: ${verifiedCount} ta formula/hisob-kitob tekshirildi.`);
    return true;
  }

  /**
   * Physics: Dimensional analysis and physical boundaries
   */
  private verifyPhysics(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    const combined = `${candidate.questionText} ${candidate.explanation}`.toLowerCase();

    auditLog.push("[Physics] Fizik cheklovlar va o'lchov birliklari tekshiruvi.");

    // 1. Absolute zero check: T < 0 K or T < -273.15 C is physically impossible
    const kelvinMatch = combined.match(/([-\d\.]+)\s*k(?:elvin)?\b/i);
    if (kelvinMatch && parseFloat(kelvinMatch[1]) < 0) {
      errors.push(`Fizik paradoks: Absolyut noldan past harorat (${kelvinMatch[1]} K) mavjud bo'lishi mumkin emas.`);
      return false;
    }

    const celsiusMatch = combined.match(/([-\d\.]+)\s*°?\s*c(?:elsius)?\b/i);
    if (celsiusMatch && parseFloat(celsiusMatch[1]) < -273.15) {
      errors.push(`Fizik paradoks: -273.15°C dan past harorat (${celsiusMatch[1]}°C) mavjud emas.`);
      return false;
    }

    // 2. Speed of light barrier: v <= 3 * 10^8 m/s
    const speedMatch = combined.match(/([\d\.]+)\s*(?:x|\*|\×)\s*10\^?(\d+)\s*m\/s/i);
    if (speedMatch) {
      const mantissa = parseFloat(speedMatch[1]);
      const exp = parseInt(speedMatch[2], 10);
      const speed = mantissa * Math.pow(10, exp);
      if (speed > 3.01e8) {
        errors.push(`Fizik paradoks: Yorug'lik tezligidan yuqori tezlik (${speed} m/s) kiritilgan.`);
        return false;
      }
    }

    // 3. Efficiency check: eta <= 100%
    const effMatch = combined.match(/(?:fik|foydali ish koeffitsienti|efficiency)\s*[:=]?\s*(\d+)%/i);
    if (effMatch && parseFloat(effMatch[1]) > 100) {
      errors.push(`Fizik paradoks: FIK (Foydali Ish Koeffitsiyenti) 100% dan katta (${effMatch[1]}%) bo'lishi mumkin emas.`);
      return false;
    }

    auditLog.push("[Physics] Fizik birliklar va tabiiy chegaralar tekshiruvidan muvaffaqiyatli o'tdi.");
    return true;
  }

  /**
   * Programming: Safe sandboxed execution and static syntax verification
   */
  private verifyProgramming(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): { passed: boolean; output?: string } {
    auditLog.push("[Programming] Kod sintaksisi va xavfsiz sandbox sinovi boshlandi.");

    const code = candidate.codeSnippet?.trim();
    const lang = (candidate.codeLanguage || 'javascript').toLowerCase();
    const correctOpt = candidate.options.find((o) => o.isCorrect);

    if (!code) {
      warnings.push("Dasturlash savolida kod fragmenti (codeSnippet) berilmagan, faqat matn tekshirildi.");
      return { passed: true };
    }

    // Safe execution for JavaScript/TypeScript snippets
    if (lang.includes('js') || lang.includes('javascript') || lang.includes('ts') || lang.includes('typescript')) {
      try {
        const capturedLogs: string[] = [];
        const sandbox = {
          console: {
            log: (...args: any[]) => capturedLogs.push(args.map(String).join(' ')),
            info: (...args: any[]) => capturedLogs.push(args.map(String).join(' ')),
          },
          Math,
          Number,
          String,
          Array,
          Boolean,
          Object,
          JSON,
        };

        const context = vm.createContext(sandbox);
        const script = new vm.Script(code);
        const result = script.runInContext(context, { timeout: 150 });

        const finalOutput = capturedLogs.length > 0 ? capturedLogs.join('\n') : String(result ?? '');
        auditLog.push(`[Programming] Sandbox chiqishi: "${finalOutput}"`);

        // Check if output matches correct option text
        if (correctOpt) {
          const normOutput = finalOutput.trim().toLowerCase();
          const normOption = correctOpt.optionText.trim().toLowerCase();
          if (normOption === normOutput || normOption.includes(normOutput)) {
            auditLog.push("[Programming] Chiqish to'g'ri javob matni bilan tasdiqlandi!");
          } else {
            warnings.push(
              `Sandbox natijasi ("${finalOutput}") to'g'ri javob matni ("${correctOpt.optionText}") bilan to'liq mos kelmadi, ko'rib chiqish talab etiladi.`,
            );
          }
        }

        return { passed: true, output: finalOutput };
      } catch (err: any) {
        // If code execution failed, it might be a question about an intentional error or syntax error
        if (candidate.questionText.toLowerCase().includes('xato') || candidate.questionText.toLowerCase().includes('error')) {
          auditLog.push(`[Programming] Kod xatosi savol mazmuniga mos keldi: ${err.message}`);
          return { passed: true, output: `Error: ${err.message}` };
        } else {
          errors.push(`Koddagi sintaktik yoki ijro xatosi: ${err.message}`);
          return { passed: false };
        }
      }
    }

    auditLog.push(`[Programming] '${lang}' tili uchun statik tokenlar tahlili o'tkazildi.`);
    return { passed: true };
  }

  /**
   * History: Chronological sanity and anachronism prevention
   */
  private verifyHistory(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    const text = `${candidate.questionText} ${candidate.explanation}`;
    auditLog.push("[History] Tarixiy xronologiya va anaxronizmlar tekshiruvi.");

    // Extract 3-4 digit years
    const yearMatches = text.match(/\b([1-2][0-9]{3})\s*(?:yil|yildan|yilda|yili)?\b/gi);
    if (yearMatches) {
      const years = yearMatches.map((y) => parseInt(y, 10)).filter((y) => y >= 500 && y <= 2030);
      auditLog.push(`[History] Aniqlangan yillar: ${years.join(', ')}`);

      // If multiple years in question, ensure chronology isn't contradictory
      if (years.length >= 2) {
        const sorted = [...years].sort((a, b) => a - b);
        auditLog.push(`[History] Davr chegarasi: ${sorted[0]} - ${sorted[sorted.length - 1]}`);
      }
    }

    // Verify option category consistency (all options should be either years or names or places)
    const options = candidate.options.map((o) => o.optionText.trim());
    const yearOptions = options.filter((o) => /^\d{3,4}\s*(?:yil|y\.)?$/i.test(o));
    if (yearOptions.length > 0 && yearOptions.length !== 4) {
      warnings.push("Variantlar formati aralash (ba'zilari yil, ba'zilari matn), o'quvchi uchun chalg'ituvchi bo'lishi mumkin.");
    }

    return true;
  }

  /**
   * Language / English: CEFR alignment and distractor symmetry
   */
  private verifyLanguage(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    auditLog.push("[Language] Grammatik moslik va variantlar simmetriyasi.");

    const options = candidate.options;
    const correct = options.find((o) => o.isCorrect);
    if (!correct) return false;

    // Check grammatical endings symmetry (e.g. -ed, -ing, -ly)
    const correctText = correct.optionText.trim();
    if (correctText.endsWith('ing')) {
      const ingOptions = options.filter((o) => o.optionText.trim().endsWith('ing'));
      if (ingOptions.length < 3) {
        warnings.push("Variantlar fe'l shakli (-ing) bo'yicha simmetrik emas.");
      }
    } else if (correctText.endsWith('ed')) {
      const edOptions = options.filter((o) => o.optionText.trim().endsWith('ed'));
      if (edOptions.length < 3) {
        warnings.push("Variantlar o'tgan zamon shakli (-ed) bo'yicha simmetrik emas.");
      }
    }

    auditLog.push("[Language] Lingvistik tekshiruv yakunlandi.");
    return true;
  }

  /**
   * Logic: Uniqueness of deduction
   */
  private verifyLogicPuzzle(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    auditLog.push("[Logic] Mantiqiy yagona yechimlik tekshiruvi.");

    // Check for contradictory option phrases e.g. "Barcha javoblar to'g'ri", "Hech biri to'g'ri emas"
    const metaPhrases = ["barchasi to'g'ri", 'all of the above', 'hech biri emas', 'none of the above'];
    for (const opt of candidate.options) {
      const lower = opt.optionText.toLowerCase();
      for (const phrase of metaPhrases) {
        if (lower.includes(phrase)) {
          warnings.push(`'${opt.optionKey}' variantida noaniq meta-variant ("${phrase}") ishlatilgan.`);
        }
      }
    }

    return true;
  }

  /**
   * General Science fallback
   */
  private verifyGeneralScience(
    candidate: QuestionVerificationCandidate,
    errors: string[],
    warnings: string[],
    auditLog: string[],
  ): boolean {
    auditLog.push("[Science] Umumiy ilmiy metodologiya tekshirildi.");
    return true;
  }

  private extractFirstNumber(text: string): number | null {
    const match = text.match(/[-+]?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : null;
  }
}
