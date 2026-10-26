/**
 * Regression coverage for the Daily Pulse derivation:
 * attendance mix, revenue coercion and the "today" task window.
 */
import { describe, it, expect } from 'vitest';
import { computeDailyPulse, type DailyPulse } from '../DailyPulseStrip';
import type { DashboardStats } from '@/lib/types';

function source(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    activeGroups: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    monthlyRevenue: [],
    recentPayments: [],
    totalLeads: 0,
    wonLeads: 0,
    newLeadsThisMonth: 0,
    conversionRate: 0,
    attendanceRate: 0,
    upcomingFollowUps: [],
    attendanceStats: [],
    leadByStage: [],
    ...overrides,
  } as DashboardStats;
}

const NOON = new Date(2026, 9, 25, 12, 0, 0);

function followUp(id: string, scheduledAt: string) {
  return { id, scheduledAt } as unknown as DashboardStats['upcomingFollowUps'][number];
}

describe('computeDailyPulse', () => {
  it('sums the attendance mix and computes the in-class rate', () => {
    const pulse: DailyPulse = computeDailyPulse(
      source({
        todayAttendanceStats: [
          { status: 'PRESENT', count: 8 },
          { status: 'LATE', count: 2 },
          { status: 'ABSENT', count: 2 },
          { status: 'EXCUSED', count: 3 },
        ],
      }),
      NOON,
    );

    expect(pulse.present).toBe(8);
    expect(pulse.late).toBe(2);
    expect(pulse.absent).toBe(2);
    expect(pulse.excused).toBe(3);
    expect(pulse.marked).toBe(15);
    expect(pulse.inClass).toBe(10);
    expect(pulse.attendanceRate).toBe(67);
  });

  it('returns a null rate when nothing was marked today', () => {
    const pulse = computeDailyPulse(source(), NOON);
    expect(pulse.attendanceRate).toBeNull();
    expect(pulse.marked).toBe(0);
  });

  it('splits follow-ups into due-today vs overdue and ignores future days', () => {
    const pulse = computeDailyPulse(
      source({
        upcomingFollowUps: [
          followUp('overdue', new Date(2026, 9, 24, 9, 0, 0).toISOString()),
          followUp('due-late', new Date(2026, 9, 25, 18, 0, 0).toISOString()),
          followUp('due-early', new Date(2026, 9, 25, 8, 0, 0).toISOString()),
          followUp('tomorrow', new Date(2026, 9, 26, 9, 0, 0).toISOString()),
          { id: 'unscheduled' } as unknown as DashboardStats['upcomingFollowUps'][number],
        ],
        leadByStage: [{ stage: 'NEW', count: 4 }],
      }),
      NOON,
    );

    expect(pulse.tasksOverdue).toBe(1);
    expect(pulse.tasksDue).toBe(3);
    expect(pulse.newLeads).toBe(4);
  });

  it('coerces numeric strings returned for aggregate revenue fields', () => {
    const pulse = computeDailyPulse(
      source({
        todayRevenue: '1250000' as unknown as number,
        todayPaymentsCount: '3' as unknown as number,
        todayLessonsCount: '6' as unknown as number,
      }),
      NOON,
    );

    expect(pulse.revenueToday).toBe(1_250_000);
    expect(pulse.paymentsToday).toBe(3);
    expect(pulse.lessonsToday).toBe(6);
  });
});
