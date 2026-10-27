import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../ai.service';

function createMockPrisma() {
  const p: any = {
    $transaction: vi.fn(async (cb: any) => (typeof cb === 'function' ? cb(p) : Promise.all(cb))),
    student: {
      count: vi.fn(async () => 42),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async (args: any) => ({
        id: args?.where?.id || 'stud-1',
        organizationId: 'org-test',
        balance: -50000,
        user: { firstName: 'Jasur', lastName: 'Karimov', phone: '+998901234567' },
        groups: [{ group: { name: 'Frontend React', course: { name: 'Web Dev' } } }],
        attendance: [
          { date: new Date('2026-10-20'), status: 'PRESENT' },
          { date: new Date('2026-10-22'), status: 'ABSENT' },
          { date: new Date('2026-10-25'), status: 'PRESENT' },
        ],
        grades: [
          { value: 85, createdAt: new Date('2026-10-21'), notes: "Yaxshi topshirildi" },
          { value: 90, createdAt: new Date('2026-10-24'), notes: "A'lo" },
        ],
        homeworkSubmissions: [],
        Invoice: [],
        faceEnrollments: [{ id: 'face-1', status: 'ACTIVE' }],
      })),
    },
    teacher: {
      count: vi.fn(async () => 8),
      findMany: vi.fn(async () => [
        {
          id: 't-1',
          user: { firstName: 'Sardor', lastName: 'Aliyev', phone: '+998911112233' },
          _count: { groups: 3 },
        },
      ]),
    },
    group: {
      count: vi.fn(async () => 12),
      findMany: vi.fn(async () => [
        { id: 'g-1', name: 'Python Bootcamp', isActive: true, _count: { enrollments: 15 } },
        { id: 'g-2', name: 'IELTS Mastery', isActive: true, _count: { enrollments: 18 } },
      ]),
    },
    attendance: {
      count: vi.fn(async () => 35),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => [
        { status: 'PRESENT', _count: { status: 120 } },
        { status: 'ABSENT', _count: { status: 15 } },
        { status: 'LATE', _count: { status: 5 } },
      ]),
    },
    invoice: {
      aggregate: vi.fn(async (args: any) => {
        if (args?._sum?.total) return { _sum: { total: 15_000_000 } };
        if (args?._sum?.paidAmount) return { _sum: { paidAmount: 12_500_000 } };
        return { _sum: { amount: 0 } };
      }),
      count: vi.fn(async () => 4),
    },
    aiAction: {
      count: vi.fn(async () => 3),
    },
    aiConversation: {
      findFirst: vi.fn(async (args: any) => ({
        id: args?.where?.id || 'conv-1',
        organizationId: 'org-test',
        createdBy: 'user-test-1',
        title: 'M-EDU Test Suhbat',
        createdAt: new Date('2026-10-25T10:00:00.000Z'),
        updatedAt: new Date('2026-10-25T10:30:00.000Z'),
        messages: [
          {
            id: 'm-1',
            role: 'user',
            content: 'Salom, bugungi darslar qachon?',
            createdAt: new Date('2026-10-25T10:01:00.000Z'),
            status: 'completed',
          },
          {
            id: 'm-2',
            role: 'assistant',
            content: "Bugun 3 ta guruhda dars mashg'ulotlari rejalashtirilgan.",
            createdAt: new Date('2026-10-25T10:01:05.000Z'),
            status: 'completed',
          },
        ],
      })),
      create: vi.fn(async (args: any) => ({ id: 'conv-1', ...args.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    aiMessage: {
      create: vi.fn(async (args: any) => ({ id: 'msg-1', ...args.data })),
      findMany: vi.fn(async () => [
        {
          id: 'm-1',
          conversationId: 'conv-1',
          role: 'user',
          content: "Fotosintez jarayoni haqida ma'lumot bering",
          createdAt: new Date('2026-10-25T10:00:00.000Z'),
          conversation: { id: 'conv-1', title: 'Biologiya darsi', updatedAt: new Date() },
        },
      ]),
    },
  };
  return p;
}

function createMockConfig() {
  return {
    get: vi.fn((key: string) => {
      if (key === 'GEMINI_MODEL') return 'gemini-3.8-flash';
      return undefined;
    }),
  } as any;
}

describe('AI Expanded Features Suite', () => {
  let service: AiService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AiService(prisma, createMockConfig(), undefined, undefined, undefined, undefined);
  });

  describe('Feature 3: Director\'s Daily Briefing', () => {
    it('computes pending actions and new enrollments in briefing metrics', async () => {
      const briefing = await service.getExecutiveBriefing('org-test');

      expect(briefing).toBeDefined();
      expect(briefing.metrics).toBeDefined();
      expect(briefing.metrics.pendingActionsCount).toBe(3);
      expect(briefing.metrics.newEnrollmentsCount).toBe(42);
      expect(briefing.metrics.studentsCount).toBeDefined();
      expect(briefing.summary).toMatch(/AI amal/i);

      const pendingAction = briefing.priorityActions.find((a) => a.id === 'act-pending');
      expect(pendingAction).toBeDefined();
      expect(pendingAction?.category).toBe('governance');
      expect(pendingAction?.title).toContain('3 ta amal tasdiqlash kutmoqda');
    });
  });

  describe('Feature 5: Student Success Assistant', () => {
    it('produces diagnostic with meetingPrep, interventions, and factualBasis', async () => {
      const diagnostic = await service.diagnoseStudent('org-test', 'stud-1');

      expect(diagnostic.studentId).toBe('stud-1');
      expect(diagnostic.studentName).toBe('Jasur Karimov');
      expect(diagnostic.interventions).toBeDefined();
      expect(Array.isArray(diagnostic.interventions)).toBe(true);
      expect(diagnostic.interventions.length).toBeGreaterThan(0);

      expect(diagnostic.meetingPrep).toBeDefined();
      expect(diagnostic.meetingPrep.teacherBrief).toContain('Jasur');
      expect(diagnostic.meetingPrep.parentAgenda.length).toBe(3);

      expect(diagnostic.factualBasis).toBeDefined();
      expect(diagnostic.factualBasis.recentAttendance.length).toBe(3);
      expect(diagnostic.factualBasis.recentAttendance[0].status).toBe('PRESENT');
      expect(diagnostic.factualBasis.recentGrades.length).toBe(2);
      expect(diagnostic.factualBasis.recentGrades[0].grade).toBe(85);
    });
  });

  describe('Feature 6: Lesson & Assessment Studio', () => {
    it('generates quiz with Bloom\'s taxonomy level and rubric criteria', async () => {
      const quiz = await service.generateQuiz('org-test', {
        topic: 'Fotosintez jarayoni',
        subject: 'Biologiya',
        level: "Yuqori",
        questionCount: 5,
        bloomsTaxonomyLevel: 'analyze',
        difficulty: 'hard',
      });

      expect(quiz.topic).toBe('Fotosintez jarayoni');
      expect(quiz.draft).toBe(true);
      expect(quiz.verifiedByTeacher).toBe(false);
      expect(quiz.bloomsTaxonomyLevel).toBe('analyze');
      expect(quiz.difficulty).toBe('hard');
      expect(quiz.rubricCriteria).toBeDefined();
      expect(quiz.rubricCriteria.length).toBeGreaterThan(0);
      expect(quiz.questions.length).toBeGreaterThan(0);
      expect(quiz.questions[0].options.length).toBe(4);
    });

    it('generates a full structured lesson plan with duration-based steps', async () => {
      const plan = await service.generateLessonPlan('org-test', {
        topic: 'Kvadrat tenglamalar',
        subject: 'Matematika',
        level: "O'rta",
        durationMinutes: 45,
        bloomsTaxonomyLevel: 'apply',
        learningObjectives: ['Diskriminant formulasini bilish', 'Ildizlarni mustaqil hisoblash'],
      });

      expect(plan.title).toContain('Kvadrat tenglamalar');
      expect(plan.durationMinutes).toBe(45);
      expect(plan.bloomsTaxonomyLevel).toBe('apply');
      expect(plan.draft).toBe(true);
      expect(plan.verifiedByTeacher).toBe(false);
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBe(4);
      expect(plan.steps[0].teacherAction).toBeDefined();
      expect(plan.steps[0].studentAction).toBeDefined();
      expect(plan.steps[0].checkpoint).toBeDefined();
      expect(plan.differentiation).toBeDefined();
      expect(plan.differentiation.forStrugglingStudents).toBeDefined();
      expect(plan.differentiation.forAdvancedStudents).toBeDefined();
    });
  });

  describe('Feature 7: Natural-Language Reports Engine', () => {
    it('generates weekly attendance report with aggregation table', async () => {
      const report = await service.generateReport('org-test', {
        reportType: 'ATTENDANCE_WEEKLY',
        timeRange: '7d',
      });

      expect(report.reportType).toBe('ATTENDANCE_WEEKLY');
      expect(report.table.headers).toEqual(['Holat (Status)', 'Belgilar soni', 'Ulush (%)']);
      expect(report.table.rows.length).toBe(3);
      expect(report.summary).toContain('140 ta davomat');
      expect(report.insights.length).toBeGreaterThan(0);
    });

    it('generates enrollment trends report from active groups', async () => {
      const report = await service.generateReport('org-test', {
        reportType: 'ENROLLMENT_TRENDS',
        timeRange: '30d',
      });

      expect(report.reportType).toBe('ENROLLMENT_TRENDS');
      expect(report.table.headers).toEqual(['Guruh nomi', "O'quvchilar soni", 'Status']);
      expect(report.table.rows.length).toBe(2);
      expect(report.summary).toContain("33 nafar o'quvchi");
    });

    it('generates teacher workload report', async () => {
      const report = await service.generateReport('org-test', {
        reportType: 'TEACHER_WORKLOAD',
      });

      expect(report.reportType).toBe('TEACHER_WORKLOAD');
      expect(report.table.headers).toEqual(["O'qituvchi", 'Guruhlar soni', 'Telefon']);
      expect(report.table.rows.length).toBe(1);
      expect(report.table.rows[0][0]).toBe('Sardor Aliyev');
    });

    it('generates financial summary report with invoice calculations', async () => {
      const report = await service.generateReport('org-test', {
        reportType: 'FINANCIAL_SUMMARY',
        timeRange: '30d',
      });

      expect(report.reportType).toBe('FINANCIAL_SUMMARY');
      expect(report.table.headers).toEqual(["Ko'rsatkich", 'Qiymat']);
      expect(report.table.rows).toEqual([
        ['Jami hisoblangan', "15,000,000 so'm"],
        ['To\'langan summa', "12,500,000 so'm"],
        ['Kutilayotgan qarzdorlik', "2,500,000 so'm"],
        ['Muddati o\'tgan hisoblar', '4 ta'],
      ]);
    });
  });

  describe('Feature 8: Knowledge Base & Document Assistant', () => {
    it('safely processes text document with untrusted demarcation', async () => {
      const sampleText = "O'quv markazining ichki tartib-qoidalari:\n1. Darslarga o'z vaqtida kelish shart.";
      const base64 = Buffer.from(sampleText).toString('base64');

      const result = await service.analyzeDocument('org-test', {
        base64,
        mimeType: 'text/plain',
        fileName: 'ichki_tartib.txt',
        analysisType: 'policy',
      });

      expect(result.fileName).toBe('ichki_tartib.txt');
      expect(result.analysisType).toBe('policy');
      expect(result.summary).toBeDefined();
      expect(result.keyTakeaways.length).toBeGreaterThan(0);
      expect(result.actionItems.length).toBeGreaterThan(0);
    });
  });

  describe('Feature 2: Explainable Insights & Dismissal', () => {
    it('allows dismissing an insight and excludes it from future queries', async () => {
      const userId = 'user-test-1';
      const initial = await service.getInsights('org-test', userId, 'global', '/');
      expect(initial.length).toBeGreaterThan(0);

      const targetId = initial[0].id;
      service.dismissInsight(userId, targetId);

      const updated = await service.getInsights('org-test', userId, 'global', '/');
      expect(updated.some((i) => i.id === targetId)).toBe(false);
    });
  });

  describe('Feature 10: Conversation Workspace, Pinning, Search & Export', () => {
    it('exports conversation to markdown with participants and timestamps', async () => {
      const result = await service.exportConversation('org-test', 'user-test-1', 'conv-1', 'markdown');

      expect(result.format).toBe('markdown');
      expect(result.markdown).toContain('# M-EDU Test Suhbat');
      expect(result.markdown).toContain('👤 Siz');
      expect(result.markdown).toContain('Salom, bugungi darslar qachon?');
      expect(result.markdown).toContain('🤖 M-EDU AI Copilot');
    });

    it('exports conversation to structured json', async () => {
      const result = await service.exportConversation('org-test', 'user-test-1', 'conv-1', 'json');

      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('conv-1');
      expect(result.data.title).toBe('M-EDU Test Suhbat');
      expect(result.data.messages.length).toBe(2);
    });

    it('searches messages inside conversations and returns snippets', async () => {
      const results = await service.searchConversations('org-test', 'user-test-1', 'Fotosintez');

      expect(results.length).toBe(1);
      expect(results[0].conversationId).toBe('conv-1');
      expect(results[0].conversationTitle).toBe('Biologiya darsi');
      expect(results[0].snippet).toContain('Fotosintez');
    });

    it('archives conversation and updates archivedAt state', async () => {
      const result = await service.archiveConversation('org-test', 'user-test-1', 'conv-1', true);

      expect(result.ok).toBe(true);
      expect(result.conversationId).toBe('conv-1');
      expect(result.archived).toBe(true);
    });
  });

  describe('Feature 11 & 12: Usage Governance & Quota Budgets', () => {
    it('tracks organization daily AI quota and blocks when limit exceeded', async () => {
      const testOrg = 'org-quota-test';

      // 1st request
      const first = service.checkAndIncrementOrgUsage(testOrg);
      expect(first.allowed).toBe(true);
      expect(first.current).toBe(1);

      // Usage status query
      const status = service.getOrgUsage(testOrg);
      expect(status.current).toBe(1);
      expect(status.limit).toBe(500);
      expect(status.dateStr).toBe(new Date().toISOString().slice(0, 10));
    });
  });
});
