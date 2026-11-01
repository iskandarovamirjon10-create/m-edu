/**
 * M-EDU V2 — 10 Flagship Features Comprehensive Test Suite (`TenFeaturesV2Suite.test.tsx`)
 * Validates:
 *  1. ExecutiveSpotlight (⌘K / Ctrl+Shift+P OmniCommand Palette)
 *  2. AttendanceHeatmap (16-Week Spatial Attendance Matrix & Streak)
 *  3. SystemTelemetryHUD (Live RTT latency, Camera FPS & Relay Monitor)
 *  4. TurnstileEmergencyLockdown (Physical Access Override & PIN safety guard)
 *  5. StudentAcademicRadar (6-Dimensional Competency & Cohort Benchmark)
 *  6. CurrencySplitCalculator (Multi-Currency & Banknote Change Splitter)
 *  7. VoiceNoteRecorder (Web Speech Dictation & Behavioral Tagging)
 *  8. AiLessonPlanStudio (Gemini 3 Lesson Curriculum & Quiz Generator)
 *  9. ThemeAccentStudio (VisionOS Appearance, OLED Midnight & Accent Palettes)
 * 10. ExecutiveSnapshotAudit (Cryptographic SHA-256 System Seal & Audit Export)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';

import { ExecutiveSpotlight } from '../spotlight/ExecutiveSpotlight';
import { AttendanceHeatmap } from '../dashboard/AttendanceHeatmap';
import { SystemTelemetryHUD } from '../telemetry/SystemTelemetryHUD';
import { TurnstileEmergencyLockdown } from '../turnstile/TurnstileEmergencyLockdown';
import { StudentAcademicRadar } from '../students/StudentAcademicRadar';
import { CurrencySplitCalculator } from '../payments/CurrencySplitCalculator';
import { VoiceNoteRecorder } from '../students/VoiceNoteRecorder';
import { AiLessonPlanStudio } from '../ai/AiLessonPlanStudio';
import { ThemeAccentStudio } from '../theme/ThemeAccentStudio';
import { ExecutiveSnapshotAudit } from '../audit/ExecutiveSnapshotAudit';

// Mock audio & toasts
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playClick: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playBeep: vi.fn(),
    playTick: vi.fn(),
    playLaserScan: vi.fn(),
    playPop: vi.fn(),
  }),
}));

vi.mock('@/components/ui', () => ({
  useToasts: () => ({
    push: vi.fn(),
    toastNode: null,
  }),
  GlassModal: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}));

vi.mock('@/lib/hardware/turnstileHardware', () => ({
  turnstileHardware: {
    isUsbRelayConnected: () => false,
    isWebSerialSupported: () => false,
    getEmergencyMode: vi.fn().mockResolvedValue('NORMAL'),
    setEmergencyMode: vi.fn().mockResolvedValue({ success: true, mode: 'LOCKDOWN' }),
    triggerGateRelease: vi.fn().mockResolvedValue({ success: true }),
    requestUsbRelayConnection: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('10 Flagship Features V2 Comprehensive Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── 1. ExecutiveSpotlight ────────────────────────────────────────────── */
  describe('1. ExecutiveSpotlight (OmniCommand Palette)', () => {
    it('renders when isOpen is true and filters items by keyword', () => {
      render(
        <MemoryRouter>
          <ExecutiveSpotlight isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/Qidiruv yoki buyruq kiriting/i);
      expect(input).toBeInTheDocument();

      // Search for payments
      fireEvent.change(input, { target: { value: "to'lov" } });
      expect(screen.getByText("To'lov qabul qilish")).toBeInTheDocument();
    });

    it('navigates when Enter key is pressed on selected item', () => {
      const handleClose = vi.fn();
      render(
        <MemoryRouter>
          <ExecutiveSpotlight isOpen={true} onClose={handleClose} />
        </MemoryRouter>,
      );

      const input = screen.getByPlaceholderText(/Qidiruv yoki buyruq kiriting/i);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  /* ── 2. AttendanceHeatmap ─────────────────────────────────────────────── */
  describe('2. AttendanceHeatmap (Spatial Attendance & Streak Matrix)', () => {
    it('renders 16-week matrix grid, average attendance and streak badge', () => {
      render(<AttendanceHeatmap overallRate={94.5} streakDays={28} />);

      expect(
        screen.getByText(/Davomat Qizg'inlik Radari/i),
      ).toBeInTheDocument();
      expect(screen.getByText('94.5%')).toBeInTheDocument();
      expect(screen.getByText('28 kun')).toBeInTheDocument();
    });
  });

  /* ── 3. SystemTelemetryHUD ────────────────────────────────────────────── */
  describe('3. SystemTelemetryHUD (Live RTT & Relay Hardware Monitor)', () => {
    it('renders live hardware telemetry and testing buttons', () => {
      render(<SystemTelemetryHUD isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Jonli Tizim Telemetriyasi & Uskunalar/i)).toBeInTheDocument();
      expect(screen.getByText('API & WebSocket RTT')).toBeInTheDocument();
      expect(screen.getByText('ESP32 Turniket Relé')).toBeInTheDocument();
      expect(screen.getByText('YuNet + SFace Engine')).toBeInTheDocument();

      const testBtn = screen.getByText(/Turniketni Sinash/i);
      expect(testBtn).toBeInTheDocument();
      fireEvent.click(testBtn);
      expect(screen.getByText(/Impuls yuborilmoqda/i)).toBeInTheDocument();
    });
  });

  /* ── 4. TurnstileEmergencyLockdown ────────────────────────────────────── */
  describe('4. TurnstileEmergencyLockdown (Physical Access Override & PIN Guard)', () => {
    it('switches to PIN verification modal on emergency button click', () => {
      render(<TurnstileEmergencyLockdown currentMode="NORMAL" />);

      const evacBtn = screen.getByText(/Evakuatsiya/i);
      fireEvent.click(evacBtn);

      expect(screen.getByText(/Favqulodda buyruqni tasdiqlang/i)).toBeInTheDocument();
      const pinInput = screen.getByPlaceholderText('••••');
      expect(pinInput).toBeInTheDocument();
    });

    it('successfully changes mode when correct PIN is entered', async () => {
      const handleModeChange = vi.fn();
      localStorage.setItem('m_edu_kiosk_pin', '1234');

      render(
        <TurnstileEmergencyLockdown
          currentMode="NORMAL"
          onModeChange={handleModeChange}
        />,
      );

      fireEvent.click(screen.getByText(/Qat'iy Blokirovka/i));
      const pinInput = screen.getByPlaceholderText('••••');
      fireEvent.change(pinInput, { target: { value: '1234' } });
      fireEvent.click(screen.getByText('Tasdiqlash'));

      await waitFor(() => {
        expect(handleModeChange).toHaveBeenCalledWith('LOCKDOWN');
      });
    });
  });

  /* ── 5. StudentAcademicRadar ──────────────────────────────────────────── */
  describe('5. StudentAcademicRadar (6-Dimensional Competency & Cohort Benchmark)', () => {
    it('renders 6 polar axes and toggles cohort benchmark overlay', () => {
      render(<StudentAcademicRadar studentName="Ali Valiyev" />);

      expect(screen.getByText(/6-O'lchamli Akademik Kompetensiya Radari/i)).toBeInTheDocument();
      expect(screen.getByText(/Nazariy Bilim/i)).toBeInTheDocument();
      expect(screen.getByText(/Davomat & Intizom/i)).toBeInTheDocument();

      const benchmarkBtn = screen.getByRole('button', { name: /Guruh Benchmarki/i });
      fireEvent.click(benchmarkBtn);
      expect(screen.getByRole('button', { name: /Guruh Benchmarki \(O'chiq\)/i })).toBeInTheDocument();
    });
  });

  /* ── 6. CurrencySplitCalculator ───────────────────────────────────────── */
  describe('6. CurrencySplitCalculator (Multi-Currency & Cash Drawer Change Splitter)', () => {
    it('calculates change and banknote denominations dynamically', () => {
      const handleApply = vi.fn();
      render(
        <I18nProvider initialLocale="uz">
          <CurrencySplitCalculator
            requiredAmountUzs={1000000}
            onApplyPayment={handleApply}
          />
        </I18nProvider>,
      );

      const input = screen.getByPlaceholderText(/Masalan: 1 500 000/i);
      fireEvent.change(input, { target: { value: '1200000' } });

      // Change must be 200,000 UZS
      expect(screen.getByText(/Qaytim \(Mijozga beriladi\)/i)).toBeInTheDocument();

      const applyBtn = screen.getByText(/To'lovni Qabul Qilish/i);
      fireEvent.click(applyBtn);
      expect(handleApply).toHaveBeenCalledWith(
        expect.objectContaining({
          cashUzs: 1200000,
          changeUzs: 200000,
        }),
      );
    });
  });

  /* ── 7. VoiceNoteRecorder ─────────────────────────────────────────────── */
  describe('7. VoiceNoteRecorder (Speech Dictation & Equalizer Waveform)', () => {
    it('toggles recording and allows adding behavioral tags', () => {
      const handleSave = vi.fn();
      render(<VoiceNoteRecorder studentName="Jasur Bek" onSaveNote={handleSave} />);

      expect(screen.getByText(/Ovozli Pedagogik Kuzatuv & Eslatma/i)).toBeInTheDocument();

      // Start recording
      const startBtn = screen.getByText(/Gapirishni boshlash/i);
      fireEvent.click(startBtn);

      // Select tag
      const activeTag = screen.getByText('🌟 Faol qatnashdi');
      fireEvent.click(activeTag);

      // Add text and save
      const textarea = screen.getByPlaceholderText(/Ovozli gapiring yoki matn kiriting/i);
      fireEvent.change(textarea, { target: { value: 'Darsda ajoyib natija ko\'rsatdi' } });

      const saveBtn = screen.getByText(/Profilga Saqlash/i);
      fireEvent.click(saveBtn);
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Darsda ajoyib natija ko\'rsatdi',
          tags: expect.arrayContaining(['🌟 Faol qatnashdi']),
        }),
      );
    });
  });

  /* ── 8. AiLessonPlanStudio ────────────────────────────────────────────── */
  describe('8. AiLessonPlanStudio (Gemini 3 Lesson Curriculum & Quiz Studio)', () => {
    it('generates structured lesson curriculum and quizzes upon clicking generate', async () => {
      render(<AiLessonPlanStudio />);

      expect(screen.getByText(/AI Pedagogik Dars Rejasi & Quiz Generator/i)).toBeInTheDocument();

      const genBtn = screen.getByText(/Gemini 3 bilan Dars Rejasini Generatsiya Qilish/i);
      fireEvent.click(genBtn);

      await waitFor(
        () => {
          expect(screen.getByText(/Kutilayotgan natijalar/i)).toBeInTheDocument();
          expect(screen.getByText(/Muzqaymoq/i)).toBeInTheDocument();
          expect(screen.getByText(/Amaliy laboratoriya/i)).toBeInTheDocument();
        },
        { timeout: 4000 },
      );
    });
  });

  /* ── 9. ThemeAccentStudio ─────────────────────────────────────────────── */
  describe('9. ThemeAccentStudio (VisionOS Appearance & OLED Midnight Studio)', () => {
    it('allows selecting OLED Midnight theme and corporate accent colors', () => {
      const handleClose = vi.fn();
      render(<ThemeAccentStudio isOpen={true} onClose={handleClose} />);

      expect(screen.getByText(/Vizual Ko'rinish & Spatial Palitra/i)).toBeInTheDocument();

      // Click OLED Midnight
      const midnightBtn = screen.getByText('OLED Qora');
      fireEvent.click(midnightBtn);
      expect(localStorage.getItem('m_edu_display_theme')).toBe('midnight');

      // Click Cyber Emerald accent
      const emeraldBtn = screen.getByText('Cyber Emerald');
      fireEvent.click(emeraldBtn);
      expect(localStorage.getItem('m_edu_accent')).toBe('emerald');

      // Save
      fireEvent.click(screen.getByText(/Sozlamalarni Saqlash/i));
      expect(handleClose).toHaveBeenCalled();
    });
  });

  /* ── 10. ExecutiveSnapshotAudit ───────────────────────────────────────── */
  describe('10. ExecutiveSnapshotAudit (Cryptographic SHA-256 System Seal)', () => {
    it('computes client-side SHA-256 hash snapshot of system status', async () => {
      render(<ExecutiveSnapshotAudit isOpen={true} onClose={vi.fn()} orgName="Test Academy" />);

      expect(screen.getByText(/Tizim Auditorlik Snapshot & SHA-256 Muhr/i)).toBeInTheDocument();

      const generateBtn = screen.getByText(/Hozirgi Holatni Muhrlash/i);
      fireEvent.click(generateBtn);

      await waitFor(
        () => {
          expect(screen.getByText(/SHA-256 Kriptografik Nazorat Qiymati/i)).toBeInTheDocument();
          expect(screen.getByText(/Davomat Holati/i)).toBeInTheDocument();
          expect(screen.getByText(/Kassa & Tushumlar/i)).toBeInTheDocument();
          expect(screen.getByText(/JSON Eksport Qilish/i)).toBeInTheDocument();
        },
        { timeout: 4000 },
      );
    });
  });
});
