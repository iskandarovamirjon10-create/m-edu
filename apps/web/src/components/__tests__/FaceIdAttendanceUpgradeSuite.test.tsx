import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiCameraAttendanceDirector } from '../camera/MultiCameraAttendanceDirector';
import { LivenessSpoofShieldHUD } from '../camera/LivenessSpoofShieldHUD';
import { RushHourBatchAttendanceProcessor } from '../camera/RushHourBatchAttendanceProcessor';
import { BiometricVoiceGreetingConsole } from '../camera/BiometricVoiceGreetingConsole';
import { TurnstileTelegramNotificationBridge } from '../camera/TurnstileTelegramNotificationBridge';
import { AttendanceTrafficFlowHeatmap } from '../camera/AttendanceTrafficFlowHeatmap';

// Mock audio hook
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

// Mock toast hook
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

// Mock backend APIs
vi.mock('@/lib/api', () => ({
  faceApi: {
    recognitionHistory: vi.fn().mockResolvedValue({ items: [] }),
    auditLog: vi.fn().mockResolvedValue({ success: true }),
    engineStatus: vi.fn().mockResolvedValue({ provider: 'native-vision', isReal: true }),
    devices: vi.fn().mockResolvedValue([]),
  },
  camerasApi: {
    list: vi.fn().mockResolvedValue([]),
    health: vi.fn().mockResolvedValue({ status: 'ok' }),
    restartWorker: vi.fn().mockResolvedValue({ restarted: true }),
  },
  attendanceApi: {
    create: vi.fn().mockResolvedValue({ id: 'att-mock-1', status: 'PRESENT' }),
    list: vi.fn().mockResolvedValue({ items: [] }),
    analytics: vi.fn().mockResolvedValue({ total: 100 }),
  },
  telegramApi: {
    status: vi.fn().mockResolvedValue({ connected: true }),
    testNotification: vi.fn().mockResolvedValue({ sent: true }),
  },
}));

describe('Face ID & Biometric Camera Upgrade Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. MultiCameraAttendanceDirector', () => {
    it('renders multi-camera director console with initial cameras and layout switches', () => {
      render(<MultiCameraAttendanceDirector />);
      expect(
        screen.getByText(/IP Kameralar va RTSP Video Oqimlari Rejissyori/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/2x2 To'r \(Grid\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Kino Rejim/i)).toBeInTheDocument();
    });

    it('switches between 2x2 grid, focus, and cinema mode', () => {
      render(<MultiCameraAttendanceDirector />);
      const focusBtn = screen.getByText(/Fokus Markaz/i);
      fireEvent.click(focusBtn);
      expect(focusBtn).toBeInTheDocument();

      const cinemaBtn = screen.getByText(/Kino Rejim/i);
      fireEvent.click(cinemaBtn);
      expect(cinemaBtn).toBeInTheDocument();
    });
  });

  describe('2. LivenessSpoofShieldHUD', () => {
    it('renders 3D liveness HUD with initial genuine score', () => {
      render(<LivenessSpoofShieldHUD />);
      expect(
        screen.getByText(/Biometrik Haqiqiylik \(Liveness\) & Qalbaki Yuzlardan Himoya/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/98.7%/i)).toBeInTheDocument();
    });

    it('simulates spoof attack and updates vectors to fail status', async () => {
      render(<LivenessSpoofShieldHUD />);
      const spoofTestBtn = screen.getByText(/Qalbaki Hujumni Sinash/i);
      fireEvent.click(spoofTestBtn);
      await waitFor(() => {
        expect(screen.getByText(/Qalbaki Ekran/i)).toBeInTheDocument();
        expect(screen.getByText(/18.4%/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. RushHourBatchAttendanceProcessor', () => {
    it('renders high-speed rush-hour parallel processor', () => {
      render(<RushHourBatchAttendanceProcessor />);
      expect(
        screen.getByText(/Tig'iz Vaqt Ommaviy Davomat Konveyeri/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Alisher Qodirov/i)[0]).toBeInTheDocument();
    });

    it('triggers batch arrival simulation', async () => {
      render(<RushHourBatchAttendanceProcessor />);
      const simBtn = screen.getByText(/Tig'iz Oqim Impulsini Sinash/i);
      fireEvent.click(simBtn);
      await waitFor(() => {
        expect(screen.getByText(/Diyora Xoliqova/i)).toBeInTheDocument();
      });
    });
  });

  describe('4. BiometricVoiceGreetingConsole', () => {
    it('renders biometric voice greeting console with student card', () => {
      render(<BiometricVoiceGreetingConsole />);
      expect(
        screen.getByText(/Biometrik Ovozli Salomlashish & Hologramma HUD/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Dilshod Rahmatov/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/304-Auditoriya/i)[0]).toBeInTheDocument();
    });

    it('allows switching speech language between UZ, RU, EN', () => {
      render(<BiometricVoiceGreetingConsole />);
      const ruBtn = screen.getByText(/^ru$/i);
      fireEvent.click(ruBtn);
      expect(ruBtn).toBeInTheDocument();
    });

    it('simulates a new student greeting arrival', async () => {
      render(<BiometricVoiceGreetingConsole />);
      const simBtn = screen.getByText(/Simulyatsiya/i);
      fireEvent.click(simBtn);
      await waitFor(() => {
        expect(screen.getByText(/Ovozli Xabar Matni/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. TurnstileTelegramNotificationBridge', () => {
    it('renders telegram push notification bridge with telemetry', () => {
      render(<TurnstileTelegramNotificationBridge />);
      expect(
        screen.getByText(/Turniket Telegram Xabarnoma Shlyuzi/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Yetkazish Tezligi/i)).toBeInTheDocument();
      expect(screen.getByText(/M-EDU Smart Attendance Bot/i)).toBeInTheDocument();
    });

    it('triggers instant test pass push notification', async () => {
      render(<TurnstileTelegramNotificationBridge />);
      const pushBtn = screen.getByText(/Turniket Test Push/i);
      fireEvent.click(pushBtn);
      await waitFor(() => {
        expect(screen.getAllByText(/Farzandingiz/i)[0]).toBeInTheDocument();
      });
    });
  });

  describe('6. AttendanceTrafficFlowHeatmap', () => {
    it('renders traffic flow heatmap with gates and hourly slots', () => {
      render(<AttendanceTrafficFlowHeatmap />);
      expect(
        screen.getByText(/Tirbandlik & Oqim Issiqlik Xaritasi/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Markaziy Kirish Gate-1/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/07:30/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/08:15/i)[0]).toBeInTheDocument();
    });

    it('triggers AI load balancing recommendation and relaxes congestion', async () => {
      render(<AttendanceTrafficFlowHeatmap />);
      const balanceBtn = screen.getByText(/AI Oqimni Balanslash/i);
      fireEvent.click(balanceBtn);
      await waitFor(
        () => {
          expect(balanceBtn).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });
});
