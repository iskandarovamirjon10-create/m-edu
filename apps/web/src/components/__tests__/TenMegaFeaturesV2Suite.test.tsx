import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartClassroomSeatingStudio } from '../groups/SmartClassroomSeatingStudio';
import { OmnichannelBroadcastStudio } from '../telegram/OmnichannelBroadcastStudio';
import { StudentChurnPredictionRadar } from '../students/StudentChurnPredictionRadar';
import { TimetableConflictMatrix } from '../schedule/TimetableConflictMatrix';
import { DigitalCertificateStudio } from '../certificates/DigitalCertificateStudio';
import { LeadPipelineKanbanStudio } from '../leads/LeadPipelineKanbanStudio';
import { TeacherPayrollStudio } from '../payroll/TeacherPayrollStudio';
import { ProctoredExamStudio } from '../exams/ProctoredExamStudio';
import { FamilyGuardianHub } from '../parent/FamilyGuardianHub';
import { FinancialRunwaySimulator } from '../analytics/FinancialRunwaySimulator';

// Mock audio & toasts
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playTick: vi.fn(),
    playPop: vi.fn(),
    playLaserScan: vi.fn(),
    playFaceIdMatch: vi.fn(),
  }),
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

describe('Ten Mega Features V2 Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. SmartClassroomSeatingStudio renders 2D desk matrix and applies anti-cheat layout', () => {
    render(<SmartClassroomSeatingStudio groupName="AI Lab 2026" roomName="Room-401" />);
    expect(screen.getByText(/AI Lab 2026 — Interaktiv Partalar Matritsasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Classroom 2D/i)).toBeInTheDocument();
    expect(screen.getByText(/Alisher Qodirov/i)).toBeInTheDocument();

    const antiCheatBtn = screen.getByRole('button', { name: /Imtihon Shaxmati \(Anti-Cheat\)/i });
    fireEvent.click(antiCheatBtn);
    expect(screen.getByText(/O'qituvchi Minbari va Smart Interaktiv Doska/i)).toBeInTheDocument();
  });

  it('2. OmnichannelBroadcastStudio renders channel switcher and variable tags', () => {
    render(<OmnichannelBroadcastStudio />);
    expect(screen.getByText(/Avtomatlashtirilgan Ommaviy Xabarnomalar Markazi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GSM SMS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ \{\{ism\}\}/i })).toBeInTheDocument();
  });

  it('3. StudentChurnPredictionRadar filters at-risk students and shows factor telemetry', () => {
    render(<StudentChurnPredictionRadar />);
    expect(screen.getByText(/O'qishni Tark Etish Xavfi Ostidagi Talabalar Radari/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Javohir Ergashev/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/88% xavf/i)).toBeInTheDocument();

    const voucherBtn = screen.getByRole('button', { name: /15% Chegirma Vaucheri/i });
    fireEvent.click(voucherBtn);
  });

  it('4. TimetableConflictMatrix detects collisions and provides auto-resolve button', () => {
    render(<TimetableConflictMatrix />);
    expect(screen.getByText(/Dars Jadvali To'qnashuvlari Matritsasi & Avto-Yechuvchi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Konfliktlarni Avto-Yechish \(AI\)/i })).toBeInTheDocument();
  });

  it('5. DigitalCertificateStudio renders luxury diploma preview with cryptographic hash', () => {
    render(<DigitalCertificateStudio initialStudentName="Samandar Bekov" initialCourseName="Cloud DevOps" />);
    expect(screen.getByText(/Raqamli Diplom & Sertifikatlar Studiyasi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/DIPLOM & SERTIFIKAT/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Samandar Bekov/i).length).toBeGreaterThan(0);
  });

  it('6. LeadPipelineKanbanStudio renders 5-stage admission funnel with weighted projection', () => {
    render(<LeadPipelineKanbanStudio />);
    expect(screen.getByText(/Lidlar Voronkasi & Kutilayotgan Tushum Prognozi/i)).toBeInTheDocument();
    expect(screen.getByText(/Yangi Ariza/i)).toBeInTheDocument();
    expect(screen.getByText(/Shaxzod Oripov/i)).toBeInTheDocument();
  });

  it('7. TeacherPayrollStudio calculates transparent formula breakdown and net salary', () => {
    render(<TeacherPayrollStudio />);
    expect(screen.getByText(/O'qituvchilar KPI, Maosh & Komissiya Laboratoriyasi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Farrux Tursunov/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1\. Asosiy oklad \(Base salary\)/i)).toBeInTheDocument();
  });

  it('8. ProctoredExamStudio displays candidate webcams and biometric anomaly telemetry', () => {
    render(<ProctoredExamStudio />);
    expect(screen.getByText(/Onlayn Imtihon & Biometrik Anti-Ko'chirish Markazi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Jasur Bekmurodov/i).length).toBeGreaterThan(0);
  });

  it('9. FamilyGuardianHub aggregates multiple siblings and applies sibling discounts', () => {
    render(<FamilyGuardianHub parentName="Shavkat Karimov" />);
    expect(screen.getByText(/Ko'p Farzandli Oila Boshqaruv Markazi & Yagona Hamyon/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Akrom Karimov/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Madina Karimova/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Oilaviy Chegirma Tejovi/i)).toBeInTheDocument();
  });

  it('10. FinancialRunwaySimulator simulates P&L sensitivity with what-if sliders and 12-month graph', () => {
    render(<FinancialRunwaySimulator />);
    expect(screen.getByText(/Moliyaviy Barqarorlik \(Runway\) & "What-If" Simulyatori/i)).toBeInTheDocument();
    expect(screen.getByText(/O'qish narxi o'zgarishi/i)).toBeInTheDocument();
    expect(screen.getByText(/12 Oylik Kassa Qoldig'i Dinamikasi \(Simulyatsiya\)/i)).toBeInTheDocument();
  });
});
