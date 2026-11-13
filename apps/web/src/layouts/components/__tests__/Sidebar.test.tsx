import { describe, it, expect } from 'vitest';
import {
  ENTERPRISE_DOMAINS,
  isRouteAllowedForRole,
  ALL_ITEMS_MAP,
  WORKSPACE_DOMAIN_NAV,
  ACADEMIC_DOMAIN_NAV,
  TEACHER_STUDIO_DOMAIN_NAV,
  FINANCE_DOMAIN_NAV,
  CRM_DOMAIN_NAV,
  STUDENT_EXPERIENCE_DOMAIN_NAV,
  PEOPLE_DOMAIN_NAV,
  PLATFORM_CONTROL_DOMAIN_NAV,
} from '@/layouts/components/Sidebar';

describe('M-EDU V3 Enterprise Navigation Architecture', () => {
  it('defines exactly 8 enterprise navigation domains', () => {
    expect(ENTERPRISE_DOMAINS).toHaveLength(8);
    const domainIds = ENTERPRISE_DOMAINS.map((d) => d.id);
    expect(domainIds).toEqual([
      'workspace',
      'academic',
      'teacher',
      'finance',
      'crm',
      'student',
      'people',
      'platform',
    ]);
  });

  it('correctly maps all verified existing routes within domains', () => {
    // 1. Workspace
    expect(WORKSPACE_DOMAIN_NAV.map((i) => i.to)).toContain('/');
    expect(WORKSPACE_DOMAIN_NAV.map((i) => i.to)).toContain('/search');
    expect(WORKSPACE_DOMAIN_NAV.map((i) => i.to)).toContain('/notifications');
    expect(WORKSPACE_DOMAIN_NAV.map((i) => i.to)).toContain('/ai-copilot');

    // 2. Academic
    expect(ACADEMIC_DOMAIN_NAV.map((i) => i.to)).toContain('/students');
    expect(ACADEMIC_DOMAIN_NAV.map((i) => i.to)).toContain('/groups');
    expect(ACADEMIC_DOMAIN_NAV.map((i) => i.to)).toContain('/attendance');
    expect(ACADEMIC_DOMAIN_NAV.map((i) => i.to)).toContain('/grades');
    expect(ACADEMIC_DOMAIN_NAV.map((i) => i.to)).toContain('/academic-risk');

    // 3. Teacher Studio
    expect(TEACHER_STUDIO_DOMAIN_NAV.map((i) => i.to)).toContain('/teacher-cockpit');
    expect(TEACHER_STUDIO_DOMAIN_NAV.map((i) => i.to)).toContain('/schedule');
    expect(TEACHER_STUDIO_DOMAIN_NAV.map((i) => i.to)).toContain('/homework');

    // 4. Finance
    expect(FINANCE_DOMAIN_NAV.map((i) => i.to)).toContain('/payments');
    expect(FINANCE_DOMAIN_NAV.map((i) => i.to)).toContain('/invoices');
    expect(FINANCE_DOMAIN_NAV.map((i) => i.to)).toContain('/expenses');
    expect(FINANCE_DOMAIN_NAV.map((i) => i.to)).toContain('/reconciliation');
    expect(FINANCE_DOMAIN_NAV.map((i) => i.to)).toContain('/financial-analytics');

    // 5. CRM
    expect(CRM_DOMAIN_NAV.map((i) => i.to)).toContain('/leads');
    expect(CRM_DOMAIN_NAV.map((i) => i.to)).toContain('/crm-analytics');
    expect(CRM_DOMAIN_NAV.map((i) => i.to)).toContain('/communication-history');

    // 6. Student
    expect(STUDENT_EXPERIENCE_DOMAIN_NAV.map((i) => i.to)).toContain('/study');
    expect(STUDENT_EXPERIENCE_DOMAIN_NAV.map((i) => i.to)).toContain('/gamification');
    expect(STUDENT_EXPERIENCE_DOMAIN_NAV.map((i) => i.to)).toContain('/arena');

    // 7. People
    expect(PEOPLE_DOMAIN_NAV.map((i) => i.to)).toContain('/teachers');
    expect(PEOPLE_DOMAIN_NAV.map((i) => i.to)).toContain('/hr');
    expect(PEOPLE_DOMAIN_NAV.map((i) => i.to)).toContain('/users');
    expect(PEOPLE_DOMAIN_NAV.map((i) => i.to)).toContain('/branches');

    // 8. Platform Control
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/settings');
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/cameras');
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/face');
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/system-health');
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/observability');
    expect(PLATFORM_CONTROL_DOMAIN_NAV.map((i) => i.to)).toContain('/audit');
  });

  it('preserves strict RBAC permissions across roles', () => {
    // Admin has access to management, finance, and platform
    expect(isRouteAllowedForRole('/payments', 'ADMIN')).toBe(true);
    expect(isRouteAllowedForRole('/system-health', 'ADMIN')).toBe(true);
    expect(isRouteAllowedForRole('/students', 'ADMIN')).toBe(true);

    // Teacher cannot access finance or system health, but can access classroom tools
    expect(isRouteAllowedForRole('/payments', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/system-health', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/teacher-cockpit', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/attendance', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/grades', 'TEACHER')).toBe(true);

    // Student cannot access staff, finance or teacher cockpit
    expect(isRouteAllowedForRole('/teacher-cockpit', 'STUDENT')).toBe(false);
    expect(isRouteAllowedForRole('/payments', 'STUDENT')).toBe(false);
    expect(isRouteAllowedForRole('/study', 'STUDENT')).toBe(true);
    expect(isRouteAllowedForRole('/gamification', 'STUDENT')).toBe(true);
    expect(isRouteAllowedForRole('/arena', 'STUDENT')).toBe(true);

    // Parent can only access parent portal and communication
    expect(isRouteAllowedForRole('/parent-portal', 'PARENT')).toBe(true);
    expect(isRouteAllowedForRole('/payments', 'PARENT')).toBe(false);
    expect(isRouteAllowedForRole('/students', 'PARENT')).toBe(false);

    // SuperAdmin / Platform Owner exclusivity
    expect(isRouteAllowedForRole('/super-admin', 'PLATFORM_OWNER')).toBe(true);
    expect(isRouteAllowedForRole('/super-admin', 'ADMIN')).toBe(false);
  });

  it('populates ALL_ITEMS_MAP for canonical lookup', () => {
    expect(ALL_ITEMS_MAP.size).toBeGreaterThan(40);
    expect(ALL_ITEMS_MAP.get('/students')?.label).toBe('Students');
    expect(ALL_ITEMS_MAP.get('/payments')?.label).toBe('Payments');
    expect(ALL_ITEMS_MAP.get('/teacher-cockpit')?.label).toBe('Teacher Cockpit');
  });
});
