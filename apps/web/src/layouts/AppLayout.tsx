/**
 * M-EDU AppLayout — iOS 27 Liquid Glass "Vision Pro" Edition v6 (PATCHED)
 *
 * 🔧 v5 → v6 FIXES:
 *  - AnimatePresence: motion.div wrapper + top-level exit delay (sheet endi slide-out qiladi)
 *  - backdropVariants: real fade (0 → 1 → 0)
 *  - mobileSheetVariants: invalid `opacity: 1.3` olib tashlandi
 *  - useScroll({ container: mainRef }) — header parallaks ishlaydi
 *  - !user → /login redirect (privilege escalation fix)
 *  - Profile button → navigate('/settings') + dead `whileHover="hover"` removed
 *  - role.replace(/_/g, ' ') — barcha `_`ni almashtiradi
 *  - React 19 type: RefObject<HTMLInputElement | null>
 *  - MobileSearchSheet: focus trap qo‘shildi
 *  - useNow(30_000) — TopBar va LiveClock bir xil vaqtda yangilanadi
 *  - Mobile topbar: focus-visible:ring-2 qo‘shildi
 *  - Barcha buttonlarda type="button"
 *  - willChange faqat animatsiya davomida (route transition)
 *  - i18n: loading, skip-to-content
 *  - aria-hidden on decorative online dot
 */

import {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useMotionValue, useSpring,
  useScroll, useTransform, type MotionValue, type Variants,
} from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalAiCopilot } from '@/components/ai';
import { GlobalCalculator } from '@/components/calculator';
import { setCalculatorOpen } from '@/stores/ui.store';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { initials, fullName } from '@/lib/format';
import { useTheme } from '../hooks/useTheme';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy:   { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth:   { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:     { type: 'spring', stiffness: 240, damping: 28, mass: 1.0 },
  magnetic: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ============================================================================
 * REDUCED MOTION HOOK
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ============================================================================
 * SHARED "NOW" HOOK — TopBar va LiveClock bir xil vaqtda yangilanadi
 * ========================================================================== */

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      setNow(new Date());
      intervalId = setInterval(() => setNow(new Date()), intervalMs);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs]);
  return now;
}

/* ============================================================================
 * VARIANTS — v6: to‘g‘ri fade qiymatlari
 * ========================================================================== */

const navListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.028, delayChildren: 0.05 } },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/** v6: mobile sheet — opacity olib tashlandi (x bilan boshqariladi) */
const mobileSheetVariants: Variants = {
  hidden: { x: '-100%', scale: 0.94 },
  visible: {
    x: 0, scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 32, mass: 0.85 },
  },
  exit: {
    x: '-100%', scale: 0.94,
    transition: { duration: 0.3, ease: EASE_APPLE },
  },
};

/** v6: backdrop — real fade */
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.28, ease: EASE_APPLE } },
  exit: { opacity: 0, transition: { duration: 0.22, ease: EASE_APPLE } },
};

/** v6: top-level mobile menu wrapper — AnimatePresence uchun direct motion child */
const mobileMenuWrapperVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: {
    opacity: 1,
    transition: { duration: 0.35, ease: EASE_APPLE }, // children exit tugashini kutadi
  },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface NavItem {
  to: string;
  labelKey: string;
  label: string;
  iconPath: string[];
  end?: boolean;
  accent?: AccentKey;
}

type AccentKey = 'blue' | 'purple' | 'pink' | 'green' | 'orange' | 'rainbow';

/* ============================================================================
 * ICONS (unchanged)
 * ========================================================================== */

const I: Record<string, string[]> = {
  dashboard: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  ai: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z', 'M18.5 3.5v3', 'M20 5h-3', 'M5.5 18v2.5', 'M6.75 19.25h-2.5'],
  students: ['M22 9 12 4 2 9l10 5z', 'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5', 'M22 9v6'],
  teachers: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M16 10l2 2 4-4'],
  groups: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  courses: ['M12 7v14', 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  subjects: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', 'M9 7h6', 'M9 11h6'],
  curriculum: ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  assignments: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z', 'M9 12l2 2 4-4'],
  assessment: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  attendance: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M9 15l2 2 4-4'],
  face: ['M9 3H5a2 2 0 0 0-2 2v4', 'M15 3h4a2 2 0 0 1 2 2v4', 'M21 15v4a2 2 0 0 1-2 2h-4', 'M9 21H5a2 2 0 0 1-2-2v-4', 'M9.5 10v.5', 'M14.5 10v.5', 'M9 15a4 4 0 0 0 6 0'],
  library: ['M4 4v16', 'M9 4v16', 'M14 4v16', 'M17.5 5.2 21 19.5', 'M2 20h20'],
  exams: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
  payments: ['M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M1 10h22', 'M6 15h2'],
  invoices: ['M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z', 'M9 7h6', 'M9 11h6', 'M9 15h4'],
  reports: ['M4 20V4', 'M4 20h17', 'M9 20v-7', 'M14 20V8', 'M19 20v-4'],
  homework: ['M13 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18 2l4 4-9 9-4 1 1-4z'],
  cert: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M8.2 13.9 7 22l5-3 5 3-1.2-8.1'],
  chat: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z'],
  executive: ['M21.2 15.9A10 10 0 1 1 8 2.8', 'M22 12A10 10 0 0 0 12 2v10z'],
  financial: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  payroll: ['M20 12V8H6a2 2 0 0 1 0-4h12v4', 'M4 6v12c0 1.1.9 2 2 2h14v-4', 'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  leads: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 12h.01'],
  parentPortal: ['M3 11 12 3l9 8', 'M5 9.5V21h14V9.5', 'M9 21v-6h6v6'],
  hr: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M8 10h4', 'M8 14h4', 'M8 18h4', 'M16 10h.01', 'M16 14h.01', 'M16 18h.01'],
  automation: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  followUp: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z', 'M15 2h6v6', 'M21 2l-6 6'],
  branches: ['M3 21h18', 'M5 21V8l7-5 7 5v13', 'M9 21v-6h6v6', 'M10 12h.01', 'M14 12h.01'],
  inventory: ['M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
  expenses: ['M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z', 'M9 12h6'],
  cameras: ['M23 7l-7 5 7 5V7z', 'M1 5h15v14H1z'],
  anomaly: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  governance: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  audit: ['M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  calculator: ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8 7h8', 'M8 11h.01', 'M12 11h.01', 'M16 11h.01', 'M8 15h.01', 'M12 15h.01', 'M16 15h.01'],
};

const PRIMARY_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', label: 'Dashboard', iconPath: I.dashboard, end: true, accent: 'blue' },
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
  { to: '/students', labelKey: 'nav.students', label: 'Students', iconPath: I.students, accent: 'blue' },
  { to: '/teachers', labelKey: 'nav.teachers', label: 'Teachers', iconPath: I.teachers, accent: 'purple' },
  { to: '/groups', labelKey: 'nav.groups', label: 'Groups', iconPath: I.groups, accent: 'blue' },
  { to: '/courses', labelKey: 'nav.courses', label: 'Courses', iconPath: I.courses, accent: 'orange' },
  { to: '/subjects', labelKey: 'nav.subjects', label: 'Subjects', iconPath: I.subjects, accent: 'blue' },
  { to: '/curriculum', labelKey: 'nav.curriculum', label: 'Curriculum', iconPath: I.curriculum, accent: 'purple' },
  { to: '/assignments', labelKey: 'nav.assignments', label: 'Assignments', iconPath: I.assignments, accent: 'pink' },
  { to: '/assessment', labelKey: 'nav.assessment', label: 'Assessment', iconPath: I.assessment, accent: 'green' },
  { to: '/attendance', labelKey: 'nav.attendance', label: 'Attendance', iconPath: I.attendance, accent: 'green' },
  { to: '/face', labelKey: 'nav.faceRecognition', label: 'Face Recognition', iconPath: I.face, accent: 'purple' },
  { to: '/library', labelKey: 'nav.library', label: 'Library', iconPath: I.library, accent: 'orange' },
  { to: '/exams', labelKey: 'nav.exams', label: 'Exams', iconPath: I.exams, accent: 'pink' },
  { to: '/payments', labelKey: 'nav.payments', label: 'Payments', iconPath: I.payments, accent: 'green' },
  { to: '/invoices', labelKey: 'nav.invoices', label: 'Invoices', iconPath: I.invoices, accent: 'green' },
  { to: '/reports', labelKey: 'nav.reports', label: 'Reports', iconPath: I.reports, accent: 'blue' },
  { to: '/homework', labelKey: 'nav.homework', label: 'Homework', iconPath: I.homework, accent: 'pink' },
  { to: '/certificates', labelKey: 'nav.certificates', label: 'Certificates', iconPath: I.cert, accent: 'orange' },
  { to: '/chat', labelKey: 'nav.chat', label: 'Chat', iconPath: I.chat, accent: 'blue' },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/executive-dashboard', labelKey: 'nav.executiveDashboard', label: 'Executive Dashboard', iconPath: I.executive, accent: 'purple' },
  { to: '/financial-analytics', labelKey: 'nav.financialAnalytics', label: 'Financial Analytics', iconPath: I.financial, accent: 'green' },
  { to: '/payroll-analytics', labelKey: 'nav.payrollAnalytics', label: 'Payroll Analytics', iconPath: I.payroll, accent: 'green' },
  { to: '/crm-analytics', labelKey: 'nav.crmAnalytics', label: 'CRM Analytics', iconPath: I.leads, accent: 'blue' },
  { to: '/parent-portal', labelKey: 'nav.parentPortal', label: 'Parent Portal', iconPath: I.parentPortal, accent: 'orange' },
  { to: '/hr', labelKey: 'nav.hrPayroll', label: 'HR & Payroll', iconPath: I.hr, accent: 'purple' },
  { to: '/payroll', labelKey: 'nav.payrollRuns', label: 'Payroll Runs', iconPath: I.payroll, accent: 'green' },
  { to: '/automation', labelKey: 'nav.automation', label: 'Automation', iconPath: I.automation, accent: 'orange' },
  { to: '/follow-up-automation', labelKey: 'nav.followUpRules', label: 'Follow-Up Rules', iconPath: I.followUp, accent: 'orange' },
  { to: '/branches', labelKey: 'nav.branches', label: 'Branches', iconPath: I.branches, accent: 'blue' },
  { to: '/inventory', labelKey: 'nav.inventory', label: 'Inventory', iconPath: I.inventory, accent: 'orange' },
  { to: '/expenses', labelKey: 'nav.expenses', label: 'Expenses', iconPath: I.expenses, accent: 'pink' },
  { to: '/leads', labelKey: 'nav.leads', label: 'Leads', iconPath: I.leads, accent: 'blue' },
  { to: '/cameras', labelKey: 'nav.cameras', label: 'Cameras', iconPath: I.cameras, accent: 'purple' },
  { to: '/anomaly-detection', labelKey: 'nav.anomalyDetection', label: 'Anomaly Detection', iconPath: I.anomaly, accent: 'pink' },
  { to: '/data-governance', labelKey: 'nav.dataGovernance', label: 'Data Governance', iconPath: I.governance, accent: 'purple' },
  { to: '/users', labelKey: 'nav.users', label: 'Users', iconPath: I.users, accent: 'blue' },
  { to: '/audit', labelKey: 'nav.audit', label: 'Audit Log', iconPath: I.audit, accent: 'purple' },
  { to: '/settings', labelKey: 'nav.settings', label: 'Settings', iconPath: I.settings, accent: 'purple' },
];

const HIDDEN_FOR_STUDENT = new Set([
  '/teachers', '/users', '/expenses', '/cameras', '/audit',
  '/settings', '/homework', '/leads', '/hr', '/inventory',
  '/invoices', '/reports', '/executive-dashboard', '/financial-analytics',
  '/payroll-analytics', '/crm-analytics', '/parent-portal', '/payroll',
  '/automation', '/follow-up-automation', '/branches', '/anomaly-detection',
  '/data-governance', '/ai-copilot'
]);

const ACCENTS: Record<AccentKey, { from: string; to: string; glow: string }> = {
  blue:    { from: '#007AFF', to: '#5856D6', glow: 'rgba(0,122,255,0.35)' },
  purple:  { from: '#5856D6', to: '#AF52DE', glow: 'rgba(88,86,214,0.35)' },
  pink:    { from: '#FF2D55', to: '#AF52DE', glow: 'rgba(255,45,85,0.35)' },
  green:   { from: '#34C759', to: '#32ADE6', glow: 'rgba(52,199,89,0.35)' },
  orange:  { from: '#FF9500', to: '#FF2D55', glow: 'rgba(255,149,0,0.35)' },
  rainbow: { from: '#007AFF', to: '#FF2D55', glow: 'rgba(175,82,222,0.45)' },
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function getGreetingKey(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'nav.greetingNight';
  if (h < 12) return 'nav.greetingMorning';
  if (h < 17) return 'nav.greetingAfternoon';
  if (h < 22) return 'nav.greetingEvening';
  return 'nav.greetingNight';
}

/* ============================================================================
 * CURSOR TRACKER
 * ========================================================================== */

function useGlobalCursor(enabled = true) {
  const mx = useMotionValue(-1000);
  const my = useMotionValue(-1000);
  const sx = useSpring(mx, SPRING.magnetic);
  const sy = useSpring(my, SPRING.magnetic);

  useEffect(() => {
    if (!enabled) return;
    const isFinePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
    if (!isFinePointer) return;

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mx, my, enabled]);

  return { x: sx, y: sy };
}

/* ============================================================================
 * GLASS SURFACE — High-performance zero-rerender spotlight via CSS vars
 * ========================================================================== */

interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  radius?: string;
  spotlight?: boolean;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

function GlassSurface({
  children,
  className = '',
  radius = '2rem',
  spotlight = true,
  style,
  as: Tag = 'div',
  ...rest
}: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafId = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!spotlight || reduced || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (((e.clientX - r.left) / r.width) * 100).toFixed(2);
      const y = (((e.clientY - r.top) / r.height) * 100).toFixed(2);
      el.style.setProperty('--spot-x', `${x}%`);
      el.style.setProperty('--spot-y', `${y}%`);
      el.style.setProperty('--spot-opacity', '1');
    });
  }, [spotlight, reduced]);

  const onPointerLeave = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (ref.current) {
      ref.current.style.setProperty('--spot-opacity', '0');
    }
  }, []);

  return (
    <Tag
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        backdropFilter: 'blur(32px) saturate(160%)',
        ...style,
      }}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), ' +
            'inset 0 -1px 0 rgba(255,255,255,0.08), ' +
            'inset 1px 0 0 rgba(255,255,255,0.12), ' +
            'inset -1px 0 0 rgba(255,255,255,0.12)',
        }}
      />
      {spotlight && !reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            borderRadius: radius,
            opacity: 'var(--spot-opacity, 0)',
            background:
              'radial-gradient(550px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(255,255,255,0.22), transparent 45%)',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-15"
        style={{
          borderRadius: radius,
          background:
            'linear-gradient(90deg, rgba(255,0,80,0.04) 0%, transparent 8%, transparent 92%, rgba(0,120,255,0.04) 100%)',
        }}
      />
      {children}
    </Tag>
  );
}

/* ============================================================================
 * MAGNETIC
 * ========================================================================== */

function Magnetic({
  children,
  strength = 0.35,
  className = '',
  disabled = false,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING.magnetic);
  const sy = useSpring(y, SPRING.magnetic);
  const reduced = usePrefersReducedMotion();
  const isDisabled = disabled || reduced;

  const onMove = (e: React.MouseEvent) => {
    if (isDisabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={`inline-flex ${className}`}
    >
      {children}
    </motion.span>
  );
}

/* ============================================================================
 * ICONS
 * ========================================================================== */

const STROKE_BASE = 1.75;
const STROKE_ACTIVE = 2.15;

function StaticIcon({ paths, className = '' }: { paths: string[]; className?: string }) {
  return (
    <svg
      className={`h-[1.25rem] w-[1.25rem] shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_BASE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function AnimatedIcon({
  paths,
  isActive,
  accent = 'blue',
}: {
  paths: string[];
  isActive?: boolean;
  accent?: AccentKey;
}) {
  const c = ACCENTS[accent];
  const reduced = usePrefersReducedMotion();
  const glow = isActive ? c.glow : 'transparent';

  return (
    <svg
      className="h-[1.25rem] w-[1.25rem] shrink-0 transition-[filter,transform] duration-300 ease-out"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isActive ? STROKE_ACTIVE : STROKE_BASE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: isActive && !reduced ? 'scale(1.08)' : 'scale(1)',
        filter: isActive ? `drop-shadow(0 0 6px ${glow})` : 'none',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * AMBIENT PARTICLES
 * ========================================================================== */

function AmbientParticles() {
  const reduced = usePrefersReducedMotion();
  const particles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 6,
      duration: 12 + Math.random() * 12,
      drift: (Math.random() - 0.5) * 60,
    })),
    [],
  );
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-white/60 dark:bg-white/30"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -60, 0], x: [0, p.drift, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ============================================================================
 * LIVE CLOCK — v6: shared useNow()
 * ========================================================================== */

function LiveClock() {
  const reduced = usePrefersReducedMotion();
  const now = useNow(30_000);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <span className="tabular-nums tracking-tight inline-flex items-center gap-1.5">
      <motion.span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: '#34C759' }}
        animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      {hh}
      <motion.span
        animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-[1px]"
      >
        :
      </motion.span>
      {mm}
    </span>
  );
}

/* ============================================================================
 * BRAND
 * ========================================================================== */

function Brand({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-3 no-underline group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 rounded-xl"
    >
      <Magnetic strength={0.4}>
        <motion.div whileTap={{ scale: 0.92 }}>
          <MeduLogo size={size === 'sm' ? 'sm' : 'md'} alt="" className="drop-shadow-sm" />
        </motion.div>
      </Magnetic>
      <span
        className={[
          'font-semibold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]',
          size === 'sm' ? 'text-[17px]' : 'text-[19px]',
        ].join(' ')}
      >
        M-EDU
      </span>
    </Link>
  );
}

/* ============================================================================
 * NAV ITEMS
 * ========================================================================== */

function NavItems({
  role,
  onNavigate,
  layoutIdScope = 'desktop',
}: {
  role: string;
  onNavigate?: () => void;
  layoutIdScope?: string;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const normalizedRole = role?.toUpperCase() ?? '';

  const renderItem = (item: NavItem) => {
    if (normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)) return null;
    const accent = item.accent ?? 'blue';
    const c = ACCENTS[accent];
    const isAi = accent === 'rainbow';

    return (
      <motion.div key={item.to} variants={navItemVariants}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'group relative flex items-center gap-3.5',
              'px-3.5 py-2.5 rounded-[0.875rem]',
              'text-[14px] tracking-tight outline-none',
              'transition-colors duration-300 ease-out',
              'focus-visible:ring-2 focus-visible:ring-[#007AFF]/50',
              isActive
                ? 'text-[#1D1D1F] font-bold dark:text-white'
                : 'text-[#86868B] font-medium hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <>
                  <motion.span
                    layoutId={`${layoutIdScope}-activeNavPill`}
                    className="absolute inset-0 rounded-[0.875rem]"
                    style={{
                      background: `linear-gradient(135deg, ${c.from}22 0%, ${c.to}22 100%)`,
                      boxShadow: `0 8px 24px -8px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.5)`,
                      border: `1px solid ${c.from}33`,
                    }}
                    transition={reduced ? { duration: 0 } : SPRING.smooth}
                    aria-hidden
                  />
                  <motion.span
                    layoutId={`${layoutIdScope}-activeNavSpecular`}
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[0.875rem]"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent)' }}
                    transition={reduced ? { duration: 0 } : SPRING.smooth}
                    aria-hidden
                  />
                </>
              )}

              {!isActive && (
                <span className="pointer-events-none absolute inset-0 rounded-[0.875rem] bg-transparent transition-colors duration-300 group-hover:bg-black/[0.045] dark:group-hover:bg-white/[0.06]" />
              )}

              <Magnetic strength={0.18}>
                <span className="relative z-10 flex-shrink-0 flex items-center justify-center">
                  {isAi && !reduced && (
                    <motion.span
                      className="absolute -inset-1 -z-10 rounded-full blur-md"
                      style={{
                        background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)',
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      aria-hidden
                    />
                  )}
                  <AnimatedIcon paths={item.iconPath} isActive={isActive} accent={accent} />
                </span>
              </Magnetic>

              <span className="relative z-10 flex-1 truncate">{t(item.labelKey) || item.label}</span>

              {isAi && !isActive && (
                <motion.span
                  className="relative z-10 h-1.5 w-1.5 rounded-full"
                  style={{ background: c.from }}
                  animate={reduced ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                />
              )}
            </>
          )}
        </NavLink>
      </motion.div>
    );
  };

  const visibleSecondary = SECONDARY_NAV.filter(
    (item) => !(normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)),
  );

  return (
    <nav
      className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 scrollbar-thin"
      style={{
        WebkitOverflowScrolling: 'touch',
        transform: 'translateZ(0)',
        scrollBehavior: 'smooth',
        maskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
      }}
      aria-label={t('a11y.mainNav')}
    >
      <motion.div variants={navListVariants} initial="hidden" animate="visible" className="space-y-1">
        {PRIMARY_NAV.map(renderItem)}

        {visibleSecondary.length > 0 && (
          <div className="mt-6 border-t border-[#00000010] pt-5 dark:border-[#ffffff10]">
            <p className="mb-2.5 px-3.5 text-[11px] font-bold uppercase tracking-widest text-[#86868B]/70">
              {t('nav.administration')}
            </p>
            {visibleSecondary.map(renderItem)}
          </div>
        )}
      </motion.div>
    </nav>
  );
}

/* ============================================================================
 * THEME TOGGLE
 * ========================================================================== */

function ThemeToggle() {
  const { setTheme, isDark } = useTheme();
  const { t } = useI18n();
  const persist = usePersistSettings();
  const label = isDark ? t('a11y.switchToLight') : t('a11y.switchToDark');

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    persist({ theme: next });
  }, [isDark, setTheme, persist]);

  return (
    <Magnetic strength={0.3}>
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.9, rotate: -12 }}
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className="relative rounded-full p-2.5 text-[#86868B] outline-none transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/5 dark:hover:text-[#F5F5F7]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isDark ? 'dark' : 'light'}
            initial={{ y: -22, opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 22, opacity: 0, rotate: 90, scale: 0.7 }}
            transition={{ duration: 0.28, ease: EASE_APPLE }}
          >
            {isDark ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </Magnetic>
  );
}

/* ============================================================================
 * ANIMATED OUTLET
 * ========================================================================== */

function AnimatedOutlet() {
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (reduced) return;
    setAnimating(true);
    const id = setTimeout(() => setAnimating(false), 600);
    return () => clearTimeout(id);
  }, [location.pathname, reduced]);

  if (reduced) return <Outlet />;

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 12, filter: 'blur(8px)', scale: 0.985 }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: 0.45, ease: EASE_APPLE }}
      style={{
        minHeight: 1,
        willChange: animating ? 'opacity, transform, filter' : 'auto',
      }}
    >
      <Outlet />
    </motion.div>
  );
}

/* ============================================================================
 * FOCUS TRAP
 * ========================================================================== */

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));

    const first = getFocusable()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, ref]);
}

/* ============================================================================
 * BODY SCROLL LOCK
 * ========================================================================== */

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [locked]);
}

/* ============================================================================
 * MOBILE SEARCH SHEET — v6: focus trap & scroll lock qo‘shildi
 * ========================================================================== */

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (query: string) => void;
}

function MobileSearchSheet({ open, onClose, onSubmit }: SearchSheetProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState('');

  useFocusTrap(containerRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    setValue('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search"
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-20 lg:hidden"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={{
            hidden: { opacity: 1 },
            visible: { opacity: 1 },
            exit: { opacity: 1, transition: { duration: 0.28, ease: EASE_APPLE } },
          }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
            variants={backdropVariants}
            aria-hidden
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.searchPlaceholder') || 'Search'}
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.96 }}
            transition={SPRING.smooth}
            className="relative w-full max-w-md"
          >
            <GlassSurface
              className="border border-[#ffffff60] bg-white/90 shadow-2xl dark:border-[#ffffff15] dark:bg-[#1c1c1e90]"
              radius="1.5rem"
            >
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <StaticIcon paths={I.search} className="h-5 w-5 text-[#86868B]" />
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t('nav.searchPlaceholder') || 'Search…'}
                  className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-[#86868B]"
                  aria-label={t('nav.searchPlaceholder') || 'Search'}
                  type="search"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[#86868B] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/10"
                  aria-label={t('a11y.closeSearch') || 'Close search'}
                >
                  <StaticIcon paths={I.close} className="h-4 w-4" />
                </button>
              </form>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
 * TOP BAR (Desktop)
 * ========================================================================== */

interface TopBarProps {
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchSubmit: (q: string) => void;
  userFullName: string;
  userInitials: string;
  userRole: string;
  orgName: string;
  headerY: MotionValue<number>;
  headerScale: MotionValue<number>;
  onCommandPalette: () => void;
  onProfileClick: () => void;
}

function TopBar({
  search, setSearch, searchRef, isSearchFocused, setIsSearchFocused,
  onSearchKeyDown, onSearchSubmit, userFullName, userInitials, userRole, orgName,
  headerY, headerScale, onCommandPalette, onProfileClick,
}: TopBarProps) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const now = useNow(60_000); // v6: greeting har daqiqada yangilanadi
  const greeting = t(getGreetingKey(now)) || 'Welcome';
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent),
    [],
  );
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  return (
    <motion.header
      style={{ y: headerY, scale: headerScale }}
      className="mx-4 mb-3 mt-4 hidden shrink-0 lg:flex"
    >
      <GlassSurface
        className="flex w-full items-center gap-4 border border-[#ffffff60] bg-[#ffffff70] shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-[#ffffff10] dark:bg-[#1c1c1e70] dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        radius="1.75rem"
      >
        <div className="flex w-full items-center gap-4 px-5 py-3">
          <div className="hidden min-w-[200px] flex-col xl:flex">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">
              <LiveClock /> · {greeting}
            </span>
            <span className="mt-0.5 truncate text-[14px] font-semibold leading-tight tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {orgName}
            </span>
          </div>

          <span className="hidden h-8 w-px bg-[#00000012] dark:bg-[#ffffff12] xl:block" aria-hidden />

          <motion.form
            className="relative max-w-xl flex-1"
            animate={{ maxWidth: isSearchFocused ? '680px' : '560px' }}
            transition={reduced ? { duration: 0 } : SPRING.smooth}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit(search);
            }}
          >
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]">
              <StaticIcon paths={I.search} className="h-[18px] w-[18px]" />
            </span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              type="search"
              placeholder={t('nav.searchPlaceholder') || 'Search anything…'}
              className="w-full rounded-full border border-transparent bg-[#00000008] py-2.5 pl-11 pr-20 text-[14px] font-medium tracking-tight text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:bg-[#ffffff10] dark:text-[#F5F5F7] dark:focus:border-[#0A84FF]/40 dark:focus:bg-[#1C1C1E]"
              aria-label={t('nav.searchPlaceholder') || 'Search'}
            />
            <button
              type="button"
              onClick={onCommandPalette}
              className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-md border border-[#00000015] bg-[#00000005] px-2 py-1 text-[11px] font-bold text-[#86868B] transition-colors hover:bg-[#00000010] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:border-[#ffffff20] dark:bg-[#ffffff10] dark:hover:bg-[#ffffff18]"
              aria-label={`Open command palette (${shortcutLabel})`}
              title={`Open command palette (${shortcutLabel})`}
            >
              {shortcutLabel}
              {!reduced && (
                <motion.span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                  aria-hidden
                />
              )}
            </button>
          </motion.form>

          <div className="ml-auto flex items-center gap-1.5">
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCalculatorOpen(true)}
                className="rounded-full p-2.5 text-[#86868B] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/5 dark:hover:text-[#F5F5F7]"
                title={t('nav.calculator') || 'Calculator'}
                aria-label={t('nav.calculator') || 'Calculator'}
              >
                <StaticIcon paths={I.calculator} className="h-[18px] w-[18px]" />
              </motion.button>
            </Magnetic>

            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsMenu />

            <span className="mx-2 h-8 w-px bg-[#00000015] dark:bg-[#ffffff15]" aria-hidden />

            <motion.button
              type="button"
              onClick={onProfileClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/[0.06]"
              aria-label={userFullName}
            >
              <div className="relative">
                <motion.div
                  className="relative h-10 w-10 rounded-full p-[2px]"
                  animate={reduced ? undefined : { rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)',
                    }}
                    aria-hidden
                  />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-[14px] font-bold text-white ring-2 ring-white/60 dark:ring-black/50">
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent"
                      aria-hidden
                    />
                    <span className="relative">{userInitials}</span>
                  </div>
                </motion.div>
                <motion.span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#1c1c1e]"
                  style={{ background: '#34C759' }}
                  animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                />
              </div>
              <div className="hidden flex-col text-left xl:flex">
                <span className="text-[13px] font-semibold leading-tight tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {userFullName}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-[#86868B]">
                  {userRole.replace(/_/g, ' ')}
                </span>
              </div>
            </motion.button>
          </div>
        </div>
      </GlassSurface>
    </motion.header>
  );
}

/* ============================================================================
 * MAIN: AppLayout — v6
 * ========================================================================== */

export function AppLayout() {
  const { user, logout, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useFocusTrap(mobileMenuRef, mobileMenuOpen);
  useBodyScrollLock(mobileMenuOpen || mobileSearchOpen);

  /* v6: parallaks endi mainRef ichidagi scroll’ga bog‘langan */
  const { scrollY } = useScroll({ container: mainRef });
  const headerY = useTransform(scrollY, [0, 80], [0, -6]);
  const headerScale = useTransform(scrollY, [0, 80], [1, 0.985]);

  const cursor = useGlobalCursor();
  const orb1X = useTransform(cursor.x, (v: number) => v * -0.008);
  const orb1Y = useTransform(cursor.y, (v: number) => v * -0.008);
  const orb2X = useTransform(cursor.x, (v: number) => v * 0.006);
  const orb2Y = useTransform(cursor.y, (v: number) => v * 0.006);

  /* v6: user null bo‘lsa — login’ga */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }, [logout, navigate]);

  const handleSearchSubmit = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) {
        searchRef.current?.focus();
        return;
      }
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearch('');
      searchRef.current?.blur();
    },
    [navigate],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchSubmit(search);
      } else if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    },
    [search, handleSearchSubmit],
  );

  const handleCommandPalette = useCallback(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      }),
    );
  }, []);

  const handleMobileSearchSubmit = useCallback(
    (q: string) => navigate(`/search?q=${encodeURIComponent(q)}`),
    [navigate],
  );

  const handleProfileClick = useCallback(() => navigate('/settings'), [navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
    if (mainRef.current) {
      if (typeof mainRef.current.scrollTo === 'function') {
        mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        mainRef.current.scrollTop = 0;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const userRole = user?.role || '';
  const userFullName = user ? fullName(user.firstName, user.lastName) : '';
  const userInitials = user ? initials(user.firstName, user.lastName) : '?';
  const orgName = user?.organization?.name || 'Education Center';

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F5F5F7] dark:bg-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-[#007AFF]/20 border-t-[#007AFF]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-[13px] font-medium text-[#86868B]">
            {t('common.loadingSession') || 'Loading session…'}
          </p>
        </div>
      </div>
    );
  }

  /* v6: user yo‘q — redirect kutayapmiz */
  if (!user) return null;

  return (
    <div
      className="fixed inset-0 flex bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#000000] dark:text-[#F5F5F7]"
      style={{ overflow: 'hidden' }}
    >
      <AmbientParticles />

      <motion.div
        aria-hidden
        className="pointer-events-none fixed -z-10 h-[36rem] w-[36rem] rounded-full opacity-[0.06] dark:opacity-[0.10]"
        style={{
          left: cursor.x,
          top: cursor.y,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, #007AFF 0%, #5856D6 40%, transparent 70%)',
        }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <motion.div
          style={{ x: orb1X, y: orb1Y }}
          animate={
            reduced
              ? undefined
              : { opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95], rotate: [0, 5, -5, 0] }
          }
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-[10%] -top-[10%] h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-[#007AFF]/10 to-[#5856D6]/10 blur-[100px] dark:from-[#0A84FF]/15 dark:to-[#5E5CE6]/15"
        />
        <motion.div
          style={{ x: orb2X, y: orb2Y }}
          animate={
            reduced
              ? undefined
              : { opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95], rotate: [0, -5, 5, 0] }
          }
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute right-[5%] top-[20%] h-[35rem] w-[35rem] rounded-full bg-gradient-to-bl from-[#32ADE6]/10 to-[#34C759]/10 blur-[120px] dark:from-[#64D2FF]/10 dark:to-[#30D158]/10"
        />
      </div>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[1rem] focus:bg-[#007AFF] focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-[0_8px_30px_rgba(0,122,255,0.4)] focus:outline-none"
      >
        {t('a11y.skipToContent') || 'Skip to content'}
      </a>

      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] flex-col p-3.5 lg:flex">
        <GlassSurface
          className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#ffffff60] bg-[#ffffff80] shadow-[0_8px_40px_rgba(0,0,0,0.04)] dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:shadow-[0_10px_50px_rgba(0,0,0,0.4)]"
          radius="2rem"
        >
          <div className="flex h-[4.5rem] shrink-0 items-center border-b border-[#00000010] px-6 dark:border-[#ffffff10]">
            <Brand />
          </div>

          <div className="shrink-0 border-b border-[#00000010] px-6 py-4 dark:border-[#ffffff10]">
            <p className="truncate text-[15px] font-semibold tracking-tight">{orgName}</p>
            <p className="mt-0.5 text-[12px] font-medium capitalize text-[#86868B]">
              {userRole.replace(/_/g, ' ').toLowerCase()}
            </p>
          </div>

          <NavItems role={userRole} layoutIdScope="desktop" />

          <div className="shrink-0 border-t border-[#00000010] p-3.5 dark:border-[#ffffff10]">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="group flex w-full items-center gap-3.5 rounded-[1rem] px-3.5 py-2.5 text-[14px] font-semibold tracking-tight text-[#86868B] outline-none transition-colors hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] focus-visible:ring-2 focus-visible:ring-[#FF3B30]/50"
            >
              <StaticIcon paths={I.logout} className="transition-transform group-hover:-translate-x-1" />
              {t('nav.logout')}
            </motion.button>
          </div>
        </GlassSurface>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center lg:hidden">
        <GlassSurface
          className="m-2.5 flex h-full w-full items-center justify-between border border-[#ffffff60] bg-[#ffffff90] px-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-[#ffffff15] dark:bg-[#1c1c1e90] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          radius="1.5rem"
        >
          <Brand size="sm" />
          <div className="flex items-center gap-1.5">
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileSearchOpen(true)}
                className="rounded-full p-2 text-[#86868B] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
                aria-label={t('nav.searchPlaceholder') || 'Search'}
              >
                <StaticIcon paths={I.search} />
              </motion.button>
            </Magnetic>
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setCalculatorOpen(true)}
                className="rounded-full p-2 text-[#86868B] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
                aria-label={t('nav.calculator') || 'Calculator'}
              >
                <StaticIcon paths={I.calculator} />
              </motion.button>
            </Magnetic>
            <ThemeToggle />
            <NotificationsMenu />
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9, rotate: -8 }}
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-full p-2 text-[#1D1D1F] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#F5F5F7]"
                aria-label="Menu"
              >
                <StaticIcon paths={I.menu} className="h-6 w-6" />
              </motion.button>
            </Magnetic>
          </div>
        </GlassSurface>
      </header>

      {/* MOBILE MENU — v6: motion.div wrapper, exit ishlaydi */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            className="fixed inset-0 z-[60] lg:hidden"
            variants={mobileMenuWrapperVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              variants={mobileSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute left-0 top-0 ml-2.5 mt-2.5 h-[calc(100dvh-20px)] w-[290px]"
            >
              <GlassSurface
                className="flex flex-1 h-full min-h-0 flex-col overflow-hidden border border-[#ffffff60] bg-[#ffffff90] shadow-[20px_0_40px_rgba(0,0,0,0.2)] dark:border-[#ffffff15] dark:bg-[#1c1c1e90]"
                radius="2rem"
              >
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#00000010] px-6 dark:border-[#ffffff10]">
                  <Brand />
                  <Magnetic strength={0.4}>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9, rotate: 90 }}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-full bg-black/5 p-2 text-[#86868B] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:bg-white/10 dark:text-[#F5F5F7]"
                      aria-label="Close menu"
                    >
                      <StaticIcon paths={I.close} />
                    </motion.button>
                  </Magnetic>
                </div>
                <div className="shrink-0 border-b border-[#00000010] px-6 py-4 dark:border-[#ffffff10]">
                  <p className="truncate text-[15px] font-semibold tracking-tight">{orgName}</p>
                  <p className="mt-0.5 text-[12px] font-medium capitalize text-[#86868B]">
                    {userRole.replace(/_/g, ' ').toLowerCase()}
                  </p>
                </div>
                <NavItems role={userRole} onNavigate={() => setMobileMenuOpen(false)} layoutIdScope="mobile" />
                <div className="shrink-0 border-t border-[#00000010] p-4 dark:border-[#ffffff10]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2.5 rounded-[1rem] bg-[#FF3B30]/10 px-4 py-3 text-[14px] font-bold text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/20 focus-visible:ring-2 focus-visible:ring-[#FF3B30]/50"
                  >
                    <StaticIcon paths={I.logout} />
                    {t('nav.logout')}
                  </button>
                </div>
              </GlassSurface>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileSearchSheet
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        onSubmit={handleMobileSearchSubmit}
      />

      {/* MAIN COLUMN */}
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col lg:pl-[290px]">
        <TopBar
          search={search}
          setSearch={setSearch}
          searchRef={searchRef}
          isSearchFocused={isSearchFocused}
          setIsSearchFocused={setIsSearchFocused}
          onSearchKeyDown={handleSearchKeyDown}
          onSearchSubmit={handleSearchSubmit}
          userFullName={userFullName}
          userInitials={userInitials}
          userRole={userRole}
          orgName={orgName}
          headerY={headerY}
          headerScale={headerScale}
          onCommandPalette={handleCommandPalette}
          onProfileClick={handleProfileClick}
        />

        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-12 pt-24 outline-none scrollbar-thin lg:px-8 lg:pb-10 lg:pt-2"
          style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', transform: 'translateZ(0)' }}
        >
          <AnimatedOutlet />
        </main>
      </div>

      <CommandPalette />
      <GlobalAiCopilot />
      <GlobalCalculator />
    </div>
  );
}

export default AppLayout;