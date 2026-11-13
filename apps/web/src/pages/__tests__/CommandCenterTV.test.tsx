import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandCenterTV } from '../CommandCenterTV';

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    stats: vi.fn().mockResolvedValue({
      activeStudents: 142,
      totalStudents: 180,
    }),
  },
  paymentsApi: {
    getSummary: vi.fn().mockResolvedValue({
      totalCollected: 18450000,
      collectionRate: 98,
    }),
  },
  groupsApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'grp-1',
          name: 'Frontend Pro-24',
          room: 'Xona 101',
          isActive: true,
          studentsCount: 18,
          maxStudents: 20,
          teacher: { firstName: 'Jasur', lastName: 'Rahimov' },
          course: { name: 'React & TypeScript' },
        },
      ],
      total: 1,
    }),
  },
  attendanceApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'att-1',
          student: { firstName: 'Azizbek', lastName: 'Qodirov' },
          group: { name: 'Frontend Pro-24' },
          markedAt: new Date().toISOString(),
          source: 'FACE_RECOGNITION',
        },
      ],
      total: 1,
    }),
  },
}));

describe('CommandCenterTV Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders command center wall display with metrics, room matrix, and turnstile stream', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CommandCenterTV />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/M-EDU COMMAND CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE TELEMETRY/i)).toBeInTheDocument();
    expect(screen.getByText(/Bino Ichidagi O'quvchilar/i)).toBeInTheDocument();
    expect(screen.getByText(/Bugungi Kassa Tushumi/i)).toBeInTheDocument();
    expect(screen.getByText(/Jonli Dars Xonalari/i)).toBeInTheDocument();
    expect(screen.getByText(/Turniket Face ID Aniqligi/i)).toBeInTheDocument();
    expect(screen.getByText(/Xonalar & Mashg'ulotlar Holati/i)).toBeInTheDocument();
    expect(screen.getByText(/Turniket Jonli Oqimi/i)).toBeInTheDocument();

    // Verify real data rendered
    expect((await screen.findAllByText(/Frontend Pro-24/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Azizbek Qodirov/i)).toBeInTheDocument();
  });
});
