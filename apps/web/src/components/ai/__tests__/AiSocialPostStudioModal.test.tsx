import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSocialPostStudioModal } from '../AiSocialPostStudioModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as apiLib from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof apiLib>();
  return {
    ...actual,
    aiApi: {
      ...actual.aiApi,
      generateSocialPost: vi.fn(),
    },
  };
});

describe('AiSocialPostStudioModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with initial state, platforms, and goals', () => {
    render(
      <AiSocialPostStudioModal
        open={true}
        onClose={() => {}}
        defaultTopic="Frontend React kursi"
        defaultPlatform="TELEGRAM"
      />
    );

    expect(screen.getByText(/AI SMM (?:&|va) e[‘'’]lonlar studiyasi/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Frontend React kursi')).toBeInTheDocument();
    expect(screen.getByText('Telegram')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText(/Yangi guruh qabuli/i)).toBeInTheDocument();
  });

  it('generates social posts with 3 variants on form submission', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      topic: 'Frontend React kursi',
      platform: 'TELEGRAM' as const,
      goal: 'NEW_GROUP' as const,
      tone: 'exciting' as const,
      variants: [
        {
          id: 'variant_a',
          styleName: 'Faol va qiziqarli',
          hook: '🔥 Yangi guruh ochilmoqda!',
          content: '🚀 Frontend React kursimizga qabul boshlandi! Hoziroq ro‘yxatdan o‘ting.',
          hashtags: ['#react', '#frontend', '#toshkent'],
          callToAction: 'Hoziroq ro‘yxatdan o‘ting!',
          characterCount: 380,
          estimatedReadTime: '40 soniya',
        },
        {
          id: 'variant_b',
          styleName: 'Rasmiy va nufuzli',
          hook: '🎓 Professional ta’lim kursi.',
          content: '🏛 Hurmatli ota-onalar va talabalar! Yangi guruhga qabul e’lon qilinadi.',
          hashtags: ['#talim', '#nufuz'],
          callToAction: 'Batafsil ma’lumot uchun bog‘laning.',
          characterCount: 450,
          estimatedReadTime: '50 soniya',
        },
        {
          id: 'variant_c',
          styleName: 'Tezkor qabul',
          hook: '⏳ Shoshiling, 3 ta joy qoldi!',
          content: '⚠️ Qabul yakunlanmoqda! Oxirgi bo‘sh o‘rinlar.',
          hashtags: ['#shoshiling'],
          callToAction: 'Hoziroq yoziling!',
          characterCount: 290,
          estimatedReadTime: '25 soniya',
        },
      ],
      suggestedVisuals: ['Dars jarayoni fotosurati', 'Minimalist banner'],
      bestPostingTime: '18:30 - 20:30',
    };

    vi.mocked(apiLib.aiApi.generateSocialPost).mockResolvedValue(mockResponse);

    render(
      <AiSocialPostStudioModal
        open={true}
        onClose={() => {}}
        defaultTopic="Frontend React kursi"
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Generatsiya Qilish/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(apiLib.aiApi.generateSocialPost).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Frontend React kursi',
          platform: 'TELEGRAM',
        })
      );
    });

    // Verify first variant content is shown
    expect(await screen.findByText(/Frontend React kursimizga qabul boshlandi/i)).toBeInTheDocument();
    expect(screen.getByText('#react')).toBeInTheDocument();

    // Switch to Variant 2
    const variant2Btn = screen.getByRole('tab', { name: /Variant 2/i });
    await user.click(variant2Btn);
    expect(await screen.findByText(/Hurmatli ota-onalar va talabalar/i)).toBeInTheDocument();

    // Verify copy button is present
    const copyBtn = screen.getByRole('button', { name: /Nusxalash/i });
    expect(copyBtn).toBeInTheDocument();
  });

  it('handles offline fallback gracefully when API call rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(apiLib.aiApi.generateSocialPost).mockRejectedValue(new Error('Network error'));

    render(
      <AiSocialPostStudioModal
        open={true}
        onClose={() => {}}
        defaultTopic="Python Data Science"
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Generatsiya Qilish/i });
    await user.click(generateBtn);

    // Fallback lokal shablon yaratadi — foydalanuvchi bo'sh ekranda qolmaydi
    expect(await screen.findByRole('button', { name: /Nusxalash/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Python Data Science')).toBeInTheDocument();
  });
});
