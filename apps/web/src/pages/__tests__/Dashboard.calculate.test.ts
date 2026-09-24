/**
 * Regression test: payment totals arrive as Prisma-Decimal STRINGS.
 * calculatePaidShare must coerce numerically (previously string
 * concatenation made the collection-rate always ~100%).
 */
import { describe, it, expect} from'vitest';
import { calculatePaidShare} from'../Dashboard';
import type { DashboardStats} from'@/lib/types';

function stats(paid: unknown, pending: unknown, overdue: unknown): DashboardStats {
 return {
 totalPaid: paid as number, totalPending: pending as number, totalOverdue: overdue as number,
 totalStudents: 0, activeStudents: 0, totalTeachers: 0, activeGroups: 0,
 monthlyRevenue: [], recentPayments: [], totalLeads: 0, wonLeads: 0,
 newLeadsThisMonth: 0, conversionRate: 0, upcomingFollowUps: [], attendanceStats: [], leadByStage: [],
};
}

describe('calculatePaidShare (Decimal-as-string)', () => {
 it('computes the correct share from string totals', () => {
 expect(calculatePaidShare(stats('1200.00','500.00','0'))).toBe(71);
 expect(calculatePaidShare(stats('0','0','0'))).toBe(0);
});

 it('handles numeric totals too', () => {
 expect(calculatePaidShare(stats(1200, 300, 0))).toBe(80);
});

 it('returns 0 when nothing is paid', () => {
 expect(calculatePaidShare(stats('0','100.00','50.00'))).toBe(0);
});
});
