/**
 * Unit tests for the pure display helpers exported from the list pages.
 * These helpers keep presentation logic (badges, labels, deadlines) out of
 * the render path and are the first thing to regress when status enums or
 * level naming change — so they get their own focused suite.
 */
import { describe, it, expect} from'vitest';
import { formatStudentName as formatPaymentStudent, formatPaymentStatus, formatPaymentMethod} from'../Payments';
import { formatStudentName as formatStudentsStudent, getStudentStatusBadge} from'../Students';
import { formatDuration, getCourseStatusBadge, formatCourseLevel} from'../Courses';
import { formatDeadline, formatMaxScore, isDeadlinePast, isDeadlineSoon} from'../Homework';
import type { PaymentMethod} from'@/lib/types';

describe('Payments page formatters', () => {
 it('formats a student name from first and last name', () => {
 expect(formatPaymentStudent({ user: { firstName:'Ali', lastName:'Karimov'}} as any)).toBe('Ali Karimov');
});

 it('falls back to an em dash when the student or user is missing', () => {
 expect(formatPaymentStudent(undefined)).toBe('—');
 expect(formatPaymentStudent({ user: null} as any)).toBe('—');
 expect(formatPaymentStudent({ user: { firstName:'', lastName:''}} as any)).toBe('—');
});

 it('title-cases payment status and method', () => {
 expect(formatPaymentStatus('PAID')).toBe('Paid');
 expect(formatPaymentStatus('OVERDUE')).toBe('Overdue');
 expect(formatPaymentMethod('CASH')).toBe('Cash');
 // The formatter is string-based (tolerant of any casing); the cast
 // documents that unexpected values are normalized, not rejected.
 expect(formatPaymentMethod('BANK_TRANSFER' as PaymentMethod)).toBe('Bank_transfer');
});
});

describe('Students page formatters', () => {
 it('joins first and last name', () => {
 expect(formatStudentsStudent({ user: { firstName:'Dilnoza', lastName:'Rahimova'}} as any)).toBe('Dilnoza Rahimova');
});

 it('maps isActive to a status badge', () => {
 expect(getStudentStatusBadge(false)).toEqual({ color:'red', label:'enum.status.INACTIVE'});
 expect(getStudentStatusBadge(true)).toEqual({ color:'green', label:'enum.status.ACTIVE'});
 expect(getStudentStatusBadge(undefined)).toEqual({ color:'green', label:'enum.status.ACTIVE'});
 });
});

describe('Courses page formatters', () => {
 it('pluralizes duration months', () => {
 expect(formatDuration(1)).toBe('1 month');
 expect(formatDuration(12)).toBe('12 months');
});

 it('maps isActive to a course badge', () => {
 // GlassBadge variant names (legacy color names'green'/'slate' were
 // migrated to the variant system).
 expect(getCourseStatusBadge(true)).toEqual({ variant:'success', label:'Active'});
 expect(getCourseStatusBadge(false)).toEqual({ variant:'muted', label:'Inactive'});
});

 it('humanizes snake_case levels', () => {
 expect(formatCourseLevel('BEGINNER')).toBe('Beginner');
 expect(formatCourseLevel('UPPER_INTERMEDIATE')).toBe('Upper Intermediate');
 expect(formatCourseLevel(null)).toBe('—');
 expect(formatCourseLevel('')).toBe('—');
});
});

describe('Homework page formatters', () => {
 it('formats a deadline or returns an em dash', () => {
 expect(formatDeadline('2026-09-10T12:00:00Z')).not.toBe('—');
 expect(formatDeadline(null)).toBe('—');
 expect(formatDeadline(undefined)).toBe('—');
});

 it('formats max score with an em dash fallback', () => {
 expect(formatMaxScore(100)).toBe('100');
 expect(formatMaxScore(0)).toBe('0');
 expect(formatMaxScore(null)).toBe('—');
 expect(formatMaxScore(undefined)).toBe('—');
});

 it('detects past deadlines', () => {
 expect(isDeadlinePast('2020-01-01T00:00:00Z')).toBe(true);
 expect(isDeadlinePast('2099-01-01T00:00:00Z')).toBe(false);
 expect(isDeadlinePast(null)).toBe(false);
});

 it('detects deadlines within the next 3 days', () => {
 const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
 const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
 expect(isDeadlineSoon(soon)).toBe(true);
 expect(isDeadlineSoon(far)).toBe(false);
 expect(isDeadlineSoon(null)).toBe(false);
});
});
