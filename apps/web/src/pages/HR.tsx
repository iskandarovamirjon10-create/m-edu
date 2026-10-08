/**
 * M-EDU HRPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient HR tile + live chips (total/active/depts)
 *  - Ambient gradient orbs
 *  - Animated KPI bar (Total, Active, Terminated, Departments)
 *  - Premium rows with gradient avatar + contract chip + dept chip + salary
 *  - Icon-only actions (edit / terminate)
 *  - Premium modal with squircle FieldIcons + grouped sections
 *  - Terminate modal with warning banner
 *  - Shimmer skeleton (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved
 */

import { toLocalISOString } from '../lib/format';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { hrApi, usersApi } from '@/lib/api';
import {
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassField,
  GlassButton,
  GlassErrorState,
  useToast,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Employee, ContractType, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  hr: [
    'M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
    'M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2',
    'M12 12v4',
    'M10 14h4',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  briefcase: [
    'M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
    'M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  contract: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8', 'M16 17H8',
  ],
  badge: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  hash: [
    'M4 9h16', 'M4 15h16',
    'M10 3 8 21', 'M16 3l-2 18',
  ],
  creditCard: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'indigo' | 'rose';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)' },
};

const CONTRACT_TONE: Record<ContractType, Tone> = {
  FULL_TIME: 'emerald',
  PART_TIME: 'blue',
  CONTRACT: 'amber',
  INTERN: 'purple',
};

/* ============================================================================
 * TYPES + CONSTANTS (preserved)
 * ========================================================================== */

interface EmployeeFormState {
  userId: string;
  employeeNumber: string;
  position: string;
  department: string;
  contractType: ContractType | '';
  salary: string;
  hireDate: string;
  bankAccount: string;
  taxId: string;
}

const INITIAL_FORM: EmployeeFormState = {
  userId: '',
  employeeNumber: '',
  position: '',
  department: '',
  contractType: '',
  salary: '',
  hireDate: toLocalISOString(),
  bankAccount: '',
  taxId: '',
};

const CONTRACT_TYPES: ContractType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];

const CONTRACT_TYPE_LABEL_KEYS: Record<ContractType, string> = {
  FULL_TIME: 'hr.contractType.fullTime',
  PART_TIME: 'hr.contractType.partTime',
  CONTRACT: 'hr.contractType.contract',
  INTERN: 'hr.contractType.intern',
};

const DEPARTMENTS = [
  'Administration', 'Teaching', 'IT', 'Finance',
  'Human Resources', 'Marketing', 'Operations', 'Student Services',
];

const DEPARTMENT_LABEL_KEYS: Record<string, string> = {
  Administration: 'hr.department.administration',
  Teaching: 'hr.department.teaching',
  IT: 'hr.department.it',
  Finance: 'hr.department.finance',
  'Human Resources': 'hr.department.humanResources',
  Marketing: 'hr.department.marketing',
  Operations: 'hr.department.operations',
  'Student Services': 'hr.department.studentServices',
};

/* ============================================================================
 * HELPERS (preserved)
 * ========================================================================== */

function validateEmployeeForm(
  form: EmployeeFormState,
  isEdit: boolean,
): Partial<Record<keyof EmployeeFormState, string>> {
  const errors: Partial<Record<keyof EmployeeFormState, string>> = {};

  if (!isEdit) {
    if (!form.userId) errors.userId = 'hr.form.validation.userIdRequired';
    if (!form.employeeNumber.trim()) errors.employeeNumber = 'hr.form.validation.employeeNumberRequired';
    if (!form.hireDate) errors.hireDate = 'hr.form.validation.hireDateRequired';
    if (!form.contractType) errors.contractType = 'hr.form.validation.contractTypeRequired';
  }

  if (!form.position.trim()) errors.position = 'hr.form.validation.positionRequired';
  if (!form.department.trim()) errors.department = 'hr.form.validation.departmentRequired';
  if (!form.salary || isNaN(parseFloat(form.salary)) || parseFloat(form.salary) <= 0) {
    errors.salary = 'hr.form.validation.salaryInvalid';
  }

  return errors;
}

function employeeName(emp: Employee): string {
  if (emp.user) {
    return [emp.user.firstName, emp.user.lastName].filter(Boolean).join(' ') || '—';
  }
  return emp.employeeNumber || emp.id.slice(0, 8);
}

function employeeEmail(emp: Employee): string {
  return emp.user?.email || '—';
}

function getInitials(name: string): string {
  return (name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—');
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{n.toLocaleString()}</span>;
}

function KpiTile({
  label, value, icon, tone = 'blue',
}: {
  label: string; value: number; icon: string[]; tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function HRSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <div className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#00000008] p-4 last:border-0 dark:border-[#ffffff08]">
            <Shimmer className="h-12 w-12" radius="9999px" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" radius="0.5rem" />
              <Shimmer className="h-3 w-32" radius="0.5rem" />
            </div>
            <Shimmer className="hidden h-6 w-24 sm:block" radius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Employee avatar with gradient */
function EmployeeAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full text-white ring-2 ring-white/50 dark:ring-black/30"
      style={{
        width: size,
        height: size,
        background: avatarGradient(name),
        fontSize: size * 0.3,
        fontWeight: 700,
        letterSpacing: '0.02em',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 18px -6px rgba(0,0,0,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
      />
      <span className="relative">{getInitials(name)}</span>
    </div>
  );
}

/** Contract type chip */
function ContractChip({ type, label }: { type: ContractType; label: string }) {
  const tone = CONTRACT_TONE[type] ?? 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon paths={I.contract} size={9} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** Department chip */
function DepartmentChip({ name, label }: { name: string; label: string }) {
  const c = TONES.indigo;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon paths={I.building} size={9} strokeWidth={2.4} />
      {label || name}
    </span>
  );
}

/** Status badge with pulse */
function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  const tone: Tone = isActive ? 'emerald' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isActive && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Squircle leading icon */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function HRPage() {
  const { t } = useI18n();
  usePageTitle(t('hr.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EmployeeFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [terminateTarget, setTerminateTarget] = useState<Employee | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateError, setTerminateError] = useState<string | null>(null);

  /* ── Queries (preserved) ──────────────────────────────────────────── */
  const employees = useQuery({
    queryKey: ['hr-employees'],
    queryFn: () => hrApi.listEmployees({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const users = useQuery({
    queryKey: ['hr-users-for-employee'],
    queryFn: () => usersApi.list({ limit: 200 }) as Promise<Paginated<User>>,
    enabled: modalOpen && !editingId,
  });

  const data = employees.data as Paginated<Employee> | undefined;
  const employeeList = useMemo(() => data?.items || [], [data]);

  const userList = useMemo(
    () => (users.data as Paginated<User> | undefined)?.items || [],
    [users.data],
  );

  const filteredEmployees = useMemo(() => {
    let filtered = employeeList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((emp) => {
        const name = employeeName(emp).toLowerCase();
        const email = employeeEmail(emp).toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          (emp.position || '').toLowerCase().includes(q)
        );
      });
    }

    if (filterDepartment) {
      filtered = filtered.filter((emp) => emp.department === filterDepartment);
    }

    return filtered;
  }, [employeeList, searchQuery, filterDepartment]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = employeeList.length;
    const active = employeeList.filter((e) => e.isActive).length;
    const inactive = total - active;
    const departments = new Set(employeeList.map((e) => e.department).filter(Boolean)).size;
    return { total, active, inactive, departments };
  }, [employeeList]);

  /* ── Mutations (preserved) ────────────────────────────────────────── */
  const saveEmployee = useMutation({
    mutationFn: () => {
      const base = {
        position: form.position.trim(),
        department: form.department.trim(),
        salary: parseFloat(form.salary),
        bankAccount: form.bankAccount.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
      };

      if (editingId) {
        return hrApi.updateEmployee(editingId, base);
      }
      return hrApi.createEmployee({
        ...base,
        userId: form.userId,
        employeeNumber: form.employeeNumber.trim(),
        hireDate: form.hireDate,
        contractType: form.contractType,
      });
    },
    onSuccess: () => {
      push('success', editingId ? t('hr.employeeUpdated') : t('hr.employeeCreated'));
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      closeModal();
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const terminateEmployee = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hrApi.terminateEmployee(id, { reason }),
    onSuccess: () => {
      push('success', t('hr.employeeTerminated'));
      setTerminateTarget(null);
      setTerminateReason('');
      setTerminateError(null);
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  /* ── Handlers (preserved) ─────────────────────────────────────────── */
  const openModal = useCallback((employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id);
      setForm({
        userId: employee.userId || '',
        employeeNumber: employee.employeeNumber || '',
        position: employee.position || '',
        department: employee.department || '',
        contractType: employee.contractType,
        salary: employee.salary?.toString() || '',
        hireDate: (employee.hireDate || '').split('T')[0],
        bankAccount: employee.bankAccount || '',
        taxId: employee.taxId || '',
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const rawErrors = validateEmployeeForm(form, Boolean(editingId));
    const errors: Partial<Record<keyof EmployeeFormState, string>> = {};
    for (const [key, value] of Object.entries(rawErrors)) {
      if (value) errors[key as keyof EmployeeFormState] = t(value);
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveEmployee.mutate();
  }, [form, editingId, saveEmployee, t]);

  const handleTerminate = useCallback((employee: Employee) => {
    setTerminateTarget(employee);
    setTerminateReason('');
    setTerminateError(null);
  }, []);

  const confirmTerminate = useCallback(() => {
    if (!terminateTarget) return;
    if (!terminateReason.trim()) {
      setTerminateError(t('hr.terminationReasonRequired'));
      return;
    }
    terminateEmployee.mutate({ id: terminateTarget.id, reason: terminateReason.trim() });
  }, [terminateTarget, terminateReason, terminateEmployee, t]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (employees.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <HRSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (employees.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(employees.error)}
            onRetry={() => employees.refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5"
    >
      <AmbientOrbs />
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.hr} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('hr.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5856D6]">
                  <Icon paths={I.users} size={11} strokeWidth={2.5} />
                  {stats.total} total
                </span>
                {stats.active > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {stats.active} active
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('hr.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('hr.subtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => openModal()}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('hr.addEmployee')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      {employeeList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile label={t('hr.title')} value={stats.total} icon={I.users} tone="blue" />
          <KpiTile label={t('common.active')} value={stats.active} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('common.inactive')} value={stats.inactive} icon={I.xCircle} tone="gray" />
          <KpiTile label={t('hr.col.department')} value={stats.departments} icon={I.building} tone="purple" />
        </motion.div>
      )}

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="blue" />
              <GlassInput
                placeholder={t('hr.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11"
              />
            </div>
            <div className="relative sm:w-60">
              <FieldIcon icon={I.filter} tone="purple" />
              <GlassSelect
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                options={[
                  { value: '', label: t('hr.allDepartments') },
                  ...DEPARTMENTS.map((dept) => ({
                    value: dept,
                    label: DEPARTMENT_LABEL_KEYS[dept] ? t(DEPARTMENT_LABEL_KEYS[dept]) : dept,
                  })),
                ]}
                placeholder={t('hr.allDepartments')}
                className="pl-11"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          EMPLOYEES LIST
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        {filteredEmployees.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(0,122,255,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {searchQuery || filterDepartment ? t('hr.emptySearch') : t('hr.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {searchQuery || filterDepartment
                  ? t('hr.emptySearchHint')
                  : t('hr.emptyHint')}
              </p>
              {!searchQuery && !filterDepartment && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => openModal()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('hr.addEmployee')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {filteredEmployees.map((employee, idx) => {
              const name = employeeName(employee);
              const email = employeeEmail(employee);
              const deptLabel = employee.department
                ? DEPARTMENT_LABEL_KEYS[employee.department]
                  ? t(DEPARTMENT_LABEL_KEYS[employee.department])
                  : employee.department
                : '—';

              return (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#007AFF]/[0.03]"
                >
                  <EmployeeAvatar name={name} size={44} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {name}
                      </p>
                      <StatusBadge
                        isActive={employee.isActive}
                        label={employee.isActive ? t('common.active') : t('common.inactive')}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.mail} size={10} strokeWidth={2.2} className="opacity-60" />
                        {email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.briefcase} size={10} strokeWidth={2.2} className="opacity-60" />
                        {employee.position}
                      </span>
                      {employee.department && (
                        <DepartmentChip name={employee.department} label={deptLabel} />
                      )}
                      {employee.contractType && (
                        <ContractChip
                          type={employee.contractType}
                          label={
                            CONTRACT_TYPE_LABEL_KEYS[employee.contractType]
                              ? t(CONTRACT_TYPE_LABEL_KEYS[employee.contractType])
                              : employee.contractType
                          }
                        />
                      )}
                    </div>
                  </div>

                  <div className="hidden flex-col items-end sm:flex">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                      {t('hr.col.salary')}
                    </span>
                    <span className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-[#10B981]">
                      {formatCurrency(employee.salary)}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <motion.button
                      type="button"
                      onClick={() => openModal(employee)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.edit')}
                      title={t('common.edit')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                      style={{
                        background: 'rgba(0,122,255,0.10)',
                        color: '#007AFF',
                        border: '1px solid rgba(0,122,255,0.2)',
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <Icon paths={I.edit} size={13} strokeWidth={2} />
                    </motion.button>
                    {employee.isActive && (
                      <motion.button
                        type="button"
                        onClick={() => handleTerminate(employee)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('hr.terminate')}
                        title={t('hr.terminate')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                        style={{
                          background: 'rgba(255,59,48,0.10)',
                          color: '#FF3B30',
                          border: '1px solid rgba(255,59,48,0.2)',
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}>
                        <Icon paths={I.trash} size={13} strokeWidth={2} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ============================================================
          ADD / EDIT EMPLOYEE MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('hr.editEmployee') : t('hr.addEmployee')}
        wide
        footer={
          <>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={closeModal}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={saveEmployee.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  {saveEmployee.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={editingId ? I.check : I.plus} size={14} strokeWidth={2.5} />
                      {t('common.save')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </>
        }
      >
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingId
                ? t('hr.editNotice')
                : 'Fill in the employee details. User, number, position, department, and salary are required.'}
            </p>
          </div>

          {!editingId && (
            <>
              <div className="relative">
                <FieldIcon icon={I.user} tone="purple" />
                <GlassSelect
                  label={t('hr.form.user')}
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  options={[
                    { value: '', label: users.isLoading ? t('hr.loadingUsers') : t('hr.selectUser') },
                    ...userList.map((u) => ({
                      value: u.id,
                      label: [u.firstName, u.lastName].filter(Boolean).join(' ') + (u.email ? ` — ${u.email}` : ''),
                    })),
                  ]}
                  placeholder={t('hr.selectUser')}
                  error={formErrors.userId}
                  className="pl-11"
                />
              </div>

              <div className="relative">
                <FieldIcon icon={I.hash} tone="cyan" />
                <GlassInput
                  label={t('hr.form.employeeNumber')}
                  value={form.employeeNumber}
                  onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                  placeholder={t('hr.form.employeeNumberPlaceholder')}
                  error={formErrors.employeeNumber}
                  className="pl-11"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <FieldIcon icon={I.briefcase} tone="blue" />
              <GlassInput
                label={t('hr.form.position')}
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder={t('hr.form.positionPlaceholder')}
                error={formErrors.position}
                className="pl-11"
              />
            </div>

            <div className="relative">
              <FieldIcon icon={I.building} tone="indigo" />
              <GlassSelect
                label={t('hr.form.department')}
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                options={[
                  { value: '', label: t('hr.selectDepartment') },
                  ...DEPARTMENTS.map((dept) => ({
                    value: dept,
                    label: DEPARTMENT_LABEL_KEYS[dept] ? t(DEPARTMENT_LABEL_KEYS[dept]) : dept,
                  })),
                ]}
                placeholder={t('hr.selectDepartment')}
                error={formErrors.department}
                className="pl-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editingId && (
              <div className="relative">
                <FieldIcon icon={I.contract} tone="amber" />
                <GlassSelect
                  label={t('hr.form.contractType')}
                  value={form.contractType}
                  onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
                  options={[
                    { value: '', label: t('hr.selectContractType') },
                    ...CONTRACT_TYPES.map((type) => ({ value: type, label: t(CONTRACT_TYPE_LABEL_KEYS[type]) })),
                  ]}
                  placeholder={t('hr.selectContractType')}
                  error={formErrors.contractType}
                  className="pl-11"
                />
              </div>
            )}

            <div className="relative">
              <FieldIcon icon={I.wallet} tone="emerald" />
              <GlassInput
                label={t('hr.form.salary')}
                type="number"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                error={formErrors.salary}
                className="pl-11"
              />
            </div>
          </div>

          {!editingId && (
            <div className="relative">
              <FieldIcon icon={I.calendar} tone="green" />
              <GlassInput
                label={t('hr.form.hireDate')}
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                error={formErrors.hireDate}
                className="pl-11"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <FieldIcon icon={I.creditCard} tone="blue" />
              <GlassInput
                label={t('hr.form.bankAccount')}
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                placeholder={t('hr.form.bankAccountPlaceholder')}
                error={formErrors.bankAccount}
                className="pl-11"
              />
            </div>

            <div className="relative">
              <FieldIcon icon={I.shield} tone="purple" />
              <GlassInput
                label={t('hr.form.taxId')}
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                placeholder={t('hr.form.taxId')}
                error={formErrors.taxId}
                className="pl-11"
              />
            </div>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          TERMINATE MODAL
      ============================================================ */}
      <GlassModal
        open={terminateTarget !== null}
        onClose={() => setTerminateTarget(null)}
        title={t('hr.terminate')}
        footer={
          <>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="secondary"
                onClick={() => setTerminateTarget(null)}
                disabled={terminateEmployee.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="danger"
                onClick={confirmTerminate}
                disabled={terminateEmployee.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  {terminateEmployee.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.trash} size={14} strokeWidth={2.4} />
                      {t('hr.terminate')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </>
        }
      >
        <div className="space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF3B30]/15 text-[#FF3B30]">
              <Icon paths={I.warning} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-semibold leading-snug text-[#FF3B30]">
              {t('hr.terminationPrompt', {
                name: terminateTarget ? employeeName(terminateTarget) : '',
              })}
            </p>
          </div>

          <GlassField label={t('hr.rejectModal.reasonLabel')} required>
            <div className="relative">
              <FieldIcon icon={I.note} tone="red" />
              <GlassInput
                value={terminateReason}
                onChange={(e) => {
                  setTerminateReason(e.target.value);
                  if (terminateError) setTerminateError(null);
                }}
                placeholder={t('hr.rejectModal.reasonPlaceholder')}
                error={terminateError ?? undefined}
                autoFocus
                className="pl-11"
              />
            </div>
          </GlassField>

          <p className="text-[11.5px] font-medium text-[#86868B]">
            {t('hr.terminateConfirm')}
          </p>
        </div>
      </GlassModal>
    </motion.div>
  );
}