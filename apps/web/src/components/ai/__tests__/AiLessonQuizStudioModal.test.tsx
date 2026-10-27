import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiLessonQuizStudioModal } from '../AiLessonQuizStudioModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as aiLib from '@/lib/ai';

vi.mock('@/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof aiLib>();
  return {
    ...actual,
    aiStudioApi: {
      ...actual.aiStudioApi,
      generateQuiz: vi.fn(),
      generateLessonPlan: vi.fn(),
    },
  };
});

describe('AiLessonQuizStudioModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly in open state with default topic and switches tabs', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AiLessonQuizStudioModal
        open={true}
        onClose={onClose}
        defaultTopic="Kvadrat tenglamalar"
        defaultSubject="Matematika"
      />
    );

    expect(screen.getByText(/AI Metodik Dars & Viktorina Studiyasi/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kvadrat tenglamalar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Matematika')).toBeInTheDocument();

    // Verify Tab buttons
    const lessonTab = screen.getByRole('button', { name: /Dars Ishlanmasi/i });
    expect(lessonTab).toBeInTheDocument();

    await user.click(lessonTab);
    expect(screen.getByText(/Dars davomiyligi:/i)).toBeInTheDocument();
  });

  it('generates a quiz when form is submitted in quiz mode', async () => {
    const user = userEvent.setup();
    const mockQuizResult = {
      topic: 'Nyuton qonunlari',
      subject: 'Fizika',
      level: "O'rta",
      bloomsTaxonomyLevel: 'apply',
      questions: [
        {
          question: 'Nyutonning birinchi qonuni nima deb ataladi?',
          options: ['A) Inersiya qonuni', 'B) Dinamika qonuni', 'C) Tortishish qonuni', 'D) Saqlanish qonuni'],
          correctAnswer: 'A',
          explanation: 'Tinchlik yoki to‘g‘ri chiziqli tekis harakat saqlanishi inersiya deyiladi.',
          bloomLevel: 'apply',
        },
      ],
      rubricCriteria: ['Asosiy formulani bilish', 'Amaliy masalani tahlil qilish'],
    };

    vi.mocked(aiLib.aiStudioApi.generateQuiz).mockResolvedValue(mockQuizResult);

    render(
      <AiLessonQuizStudioModal
        open={true}
        onClose={() => {}}
        defaultTopic="Nyuton qonunlari"
        defaultSubject="Fizika"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Testlarni Yaratish/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiLib.aiStudioApi.generateQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Nyuton qonunlari',
          subject: 'Fizika',
        })
      );
    });

    expect(await screen.findByText(/Nyutonning birinchi qonuni nima deb ataladi\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Inersiya qonuni/i)).toBeInTheDocument();
  });

  it('generates a lesson plan when submitted in lesson mode', async () => {
    const user = userEvent.setup();
    const mockLessonResult = {
      title: 'Nyuton qonunlari — 45 daqiqalik dars ishlanmasi',
      topic: 'Nyuton qonunlari',
      subject: 'Fizika',
      level: "O'rta",
      durationMinutes: 45,
      bloomsTaxonomyLevel: 'apply',
      learningObjectives: ['Inersiya hodisasini tushunish', 'Harakat tenglamalarini tuzish'],
      materialsNeeded: ['Tajriba aravachasi', 'Dinamometr'],
      steps: [
        {
          minuteRange: '0-5',
          phase: 'Kirish & Motivatsiya',
          teacherAction: 'Tajriba namoyishi',
          studentAction: 'Kuzatish va fikr bildirish',
          checkpoint: 'Qiziqish uyg‘onganini tekshirish',
        },
      ],
      differentiatedTasks: {
        support: 'Sodda masalalar',
        core: 'Standart masalalar',
        extension: 'Murakkab loyihalar',
      },
      homework: '15-paragrafni o‘qish',
    };

    vi.mocked(aiLib.aiStudioApi.generateLessonPlan).mockResolvedValue(mockLessonResult);

    render(
      <AiLessonQuizStudioModal
        open={true}
        onClose={() => {}}
        defaultTopic="Nyuton qonunlari"
        defaultSubject="Fizika"
        initialMode="lesson"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Dars Rejasini Tuzish/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiLib.aiStudioApi.generateLessonPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Nyuton qonunlari',
          subject: 'Fizika',
          durationMinutes: 45,
        })
      );
    });

    expect(await screen.findByText(/Inersiya hodisasini tushunish/i)).toBeInTheDocument();
    expect(screen.getByText(/Tajriba namoyishi/i)).toBeInTheDocument();
  });
});
