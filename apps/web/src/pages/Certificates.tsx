/**
 * M-EDU CertificatesPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient award tile + live chips + refresh
 *  - Ambient gradient orbs (blue + purple drift) — suite-consistent
 *  - Animated KPI bar (Certificates, Templates, Default, This month)
 *  - Premium segmented tabs (layoutId sliding indicator)
 *  - Certificate rows: gradient avatar + number/verification chips + download
 *  - Template rows: name + default badge + actions
 *  - Premium modals with hint banners + squircle field icons
 *  - Shimmer skeletons (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved (mutations, queries, validators, i18n keys)
 */

import { formatDate } from '../lib/format';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  certificatesApi,
  coursesApi,
  studentsApi,
  downloadFile,
} from '@/lib/api';
import {
  GlassErrorState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassButton,
  GlassSwitch,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type {
  Paginated,
  Certificate,
  CertificateTemplate,
  Course,
  Student,
} from '@/lib/types';
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
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  certificate: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 15l2 2 4-4',
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
  ],
  hash: [
    'M4 9h16', 'M4 15h16',
    'M10 3 8 21', 'M16 3l-2 18',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
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
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  code: [
    'M16 18l6-6-6-6',
    'M8 6l-6 6 6 6',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber';

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
};

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function getInitials(name: string): string {
  return (
    name.split(/\s+/).map((p) => p.charAt(0)).filter(Boolean).slice(0, 2).join('').toUpperCase() || '—'
  );
}

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface CertificateFormState {
  studentId: string;
  courseId: string;
  notes: string;
}

const INITIAL_FORM: CertificateFormState = {
  studentId: '',
  courseId: '',
  notes: '',
};

interface TemplateFormState {
  name: string;
  htmlTemplate: string;
  cssStyles: string;
  isDefault: boolean;
}

const getInitialTemplateForm = (t: any): TemplateFormState => ({
  name: '',
  htmlTemplate: [
    '<html>',
    '  <body style="font-family: Georgia, serif; text-align: center;">',
    `    <h1>${t('certificates.template.title') || 'Certificate of Achievement'}</h1>`,
    `    <p>${t('certificates.template.certifies') || 'This certifies that'}</p>`,
    '    <div class="student-name">{{studentName}}</div>',
    `    <p>${t('certificates.template.completed') || 'has successfully completed'}</p>`,
    '    <div class="course-name">{{courseName}}</div>',
    `    <p>${t('certificates.template.issuedOn') || 'Issued on'} {{issueDate}} — ${t('certificates.template.certNum') || 'Certificate'} {{certificateNumber}}</p>`,
    '  </body>',
    '</html>',
  ].join('\n'),
  cssStyles: '',
  isDefault: false,
});

const TEMPLATE_VARIABLES = ['studentName', 'courseName', 'issueDate', 'certificateNumber', 'verificationCode'];

function validateCertificateForm(form: CertificateFormState): Partial<Record<keyof CertificateFormState, string>> {
  const errors: Partial<Record<keyof CertificateFormState, string>> = {};
  if (!form.studentId) errors.studentId = 'certificates.studentRequired';
  if (!form.courseId) errors.courseId = 'certificates.courseRequired';
  return errors;
}

function validateTemplateForm(form: TemplateFormState): Partial<Record<keyof TemplateFormState, string>> {
  const errors: Partial<Record<keyof TemplateFormState, string>> = {};
  if (!form.name.trim()) errors.name = 'templates.nameRequired';
  if (!form.htmlTemplate.trim()) errors.htmlTemplate = 'templates.htmlRequired';
  else if (form.htmlTemplate.length > 100_000) errors.htmlTemplate = 'templates.htmlTooLong';
  if (form.cssStyles.length > 50_000) errors.cssStyles = 'templates.cssTooLong';
  return errors;
}

function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
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

function CountUp({
  value, duration = 1.1,
}: { value: number; duration?: number }) {
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
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
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

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-12 w-64" radius="1rem" />
      <Shimmer className="h-96 w-full" radius="1.75rem" />
    </div>
  );
}

function SegmentedTabs({
  active,
  onChange,
}: {
  active: 'certificates' | 'templates';
  onChange: (v: 'certificates' | 'templates') => void;
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();

  const tabs = [
    { id: 'certificates' as const, label: t('certificates.tab.certificates'), icon: I.award, tone: 'blue' as Tone },
    { id: 'templates' as const, label: t('certificates.tab.templates'), icon: I.layers, tone: 'purple' as Tone },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('certificates.sectionsAria')}
      className="inline-flex w-fit items-center gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {tabs.map((tb) => {
        const isActive = active === tb.id;
        const c = TONES[tb.tone];
        return (
          <motion.button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tb.id)}
            whileHover={reduced ? undefined : { y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative overflow-hidden rounded-xl px-3.5 py-2 text-[12.5px] font-bold tracking-tight outline-none transition-colors"
            style={{ color: isActive ? c.fg : '#86868B' }}
          >
            {isActive && (
              <motion.span
                layoutId="cert-tab-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon paths={tb.icon} size={13} strokeWidth={2.4} />
              {tb.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

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

function useReducedMotion() {
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
 * MAIN PAGE
 * ========================================================================== */

export function CertificatesPage() {
  const { t } = useI18n();
  usePageTitle(t('certificates.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'certificates' | 'templates'>('certificates');
  const [modalOpen, setModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CertificateTemplate | null>(null);

  const [form, setForm] = useState<CertificateFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CertificateFormState, string>>>({});
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(getInitialTemplateForm(t));
  const [templateFormErrors, setTemplateFormErrors] = useState<Partial<Record<keyof TemplateFormState, string>>>({});
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────── */
  const certificates = useQuery({
    queryKey: ['certificates'],
    queryFn: () => certificatesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const templates = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: () => certificatesApi.listTemplates(),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list({ limit: 100 }),
  });

  const students = useQuery({
    queryKey: ['students'],
    queryFn: () => studentsApi.list({ limit: 100 }),
  });

  const certificateList = useMemo(() => {
    const d = certificates.data as unknown;
    return Array.isArray(d) ? (d as Certificate[]) : ((d as Paginated<Certificate> | null)?.items ?? []);
  }, [certificates.data]);

  const templateList = useMemo(() => {
    const d = templates.data as unknown;
    return Array.isArray(d) ? (d as CertificateTemplate[]) : ((d as Paginated<CertificateTemplate> | null)?.items ?? []);
  }, [templates.data]);

  const courseData = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => courseData?.items || [], [courseData]);

  const studentData = students.data as Paginated<Student> | undefined;
  const studentList = useMemo(() => studentData?.items || [], [studentData]);

  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificateList;
    const q = searchQuery.toLowerCase();
    return certificateList.filter(
      (cert) =>
        cert.certificateNumber?.toLowerCase().includes(q) ||
        cert.verificationCode?.toLowerCase().includes(q) ||
        cert.student?.user?.firstName?.toLowerCase().includes(q) ||
        cert.student?.user?.lastName?.toLowerCase().includes(q) ||
        cert.course?.name?.toLowerCase().includes(q),
    );
  }, [certificateList, searchQuery]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = certificateList.length;
    const templatesCount = templateList.length;
    const defaultTemplate = templateList.find((tp) => tp.isDefault)?.name ?? '—';
    const now = new Date();
    const thisMonth = certificateList.filter((c) => {
      if (!c.issueDate) return false;
      const d = new Date(c.issueDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, templatesCount, defaultTemplate, thisMonth };
  }, [certificateList, templateList]);

  /* ── Certificate mutations ────────────────────────────────────────── */
  const generateCertificate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        studentId: form.studentId,
        courseId: form.courseId,
      };
      if (form.notes.trim()) payload.notes = form.notes.trim();
      return certificatesApi.generate(payload);
    },
    onSuccess: () => {
      push({ type: 'success', message: t('certificates.generated') });
      qc.invalidateQueries({ queryKey: ['certificates'] });
      closeModal();
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadCertificate = useMutation({
    mutationFn: async (id: string) => {
      await downloadFile(`/certificates/${id}/download`, {
        method: 'POST',
        defaultFilename: 'certificate.pdf',
      });
    },
    onMutate: (id) => setDownloadingId(id),
    onSettled: () => setDownloadingId(null),
    onSuccess: () => {
      push({ type: 'success', message: t('certificates.downloaded') });
    },
    onError: (error) => {
      push({
        type: 'error',
        message: getErrorMessage(error) || t('certificates.downloadFailed', { status: 500 }),
      });
    },
  });

  /* ── Template mutations ───────────────────────────────────────────── */
  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: templateForm.name.trim(),
        htmlTemplate: templateForm.htmlTemplate,
      };
      if (templateForm.cssStyles.trim()) payload.cssStyles = templateForm.cssStyles.trim();
      payload.isDefault = templateForm.isDefault;

      return editingTemplate
        ? certificatesApi.updateTemplate(editingTemplate.id, payload)
        : certificatesApi.createTemplate(payload);
    },
    onSuccess: () => {
      push({ type: 'success', message: editingTemplate ? t('templates.updated') : t('templates.created') });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      closeTemplateModal();
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => certificatesApi.setDefaultTemplate(id),
    onSuccess: () => {
      push({ type: 'success', message: t('templates.defaultUpdated') });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => certificatesApi.removeTemplate(id),
    onSuccess: () => {
      push({ type: 'success', message: t('templates.deleted') });
      setDeletingTemplate(null);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const openModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const openTemplateModal = useCallback((template?: CertificateTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        htmlTemplate: template.htmlTemplate,
        cssStyles: template.cssStyles ?? '',
        isDefault: template.isDefault,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm(getInitialTemplateForm(t));
    }
    setTemplateFormErrors({});
    setTemplateModalOpen(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setTemplateModalOpen(false);
    setEditingTemplate(null);
    setTemplateForm(getInitialTemplateForm(t));
    setTemplateFormErrors({});
  }, []);

  const handleCertificateSubmit = useCallback(() => {
    const errors = validateCertificateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    generateCertificate.mutate();
  }, [form, generateCertificate]);

  const handleTemplateSubmit = useCallback(() => {
    const errors = validateTemplateForm(templateForm);
    if (Object.keys(errors).length > 0) {
      setTemplateFormErrors(errors);
      return;
    }
    saveTemplate.mutate();
  }, [templateForm, saveTemplate]);

  const getStudentName = useCallback(
    (studentId: string) => {
      const student = studentList.find((s) => s.id === studentId);
      return student ? formatStudentName(student) : '—';
    },
    [studentList],
  );

  const getCourseName = useCallback(
    (courseId?: string) => {
      if (!courseId) return '—';
      const course = courseList.find((c) => c.id === courseId);
      return course?.name || t('common.unknown');
    },
    [courseList, t],
  );

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (certificates.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <PageSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (certificates.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(certificates.error)}
            onRetry={() => certificates.refetch()}
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
                background: 'linear-gradient(135deg, #FF9500 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(255,149,0,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.award} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9500]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF9500]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Certificates
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} total
                </span>
                {stats.thisMonth > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                    +{stats.thisMonth} this month
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('certificates.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('certificates.subtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
                onClick={activeTab === 'certificates' ? openModal : () => openTemplateModal()}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon
                    paths={activeTab === 'certificates' ? I.plus : I.layers}
                    size={15}
                    strokeWidth={2.5}
                  />
                  {activeTab === 'certificates'
                    ? t('certificates.generate')
                    : t('templates.new')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile label={t('certificates.tab.certificates')} value={stats.total} icon={I.award} tone="orange" />
        <KpiTile label={t('certificates.tab.templates')} value={stats.templatesCount} icon={I.layers} tone="purple" />
        <KpiTile label={t('templates.col.default')} value={stats.defaultTemplate === '—' ? 0 : 1} icon={I.checkCircle} tone="emerald" />
        <KpiTile label="This month" value={stats.thisMonth} icon={I.clock} tone="blue" />
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <SegmentedTabs active={activeTab} onChange={setActiveTab} />
      </motion.div>

      {/* ============================================================
          CERTIFICATES TAB
      ============================================================ */}
      <AnimatePresence mode="wait">
        {activeTab === 'certificates' && (
          <motion.div
            key="certificates"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.smooth}
            className="space-y-5"
          >
            {/* Search toolbar */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
            >
              <div className="relative">
                <FieldIcon icon={I.search} tone="blue" />
                <GlassInput
                  placeholder={t('certificates.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t('certificates.searchAria')}
                  className="pl-11"
                />
              </div>
            </div>

            {/* Certificates list */}
            <div
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

              {filteredCertificates.length === 0 ? (
                <div className="relative p-10">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FF9500]/10 text-[#FF9500]"
                      style={{
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(255,149,0,0.4)',
                      }}
                    >
                      <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                    </div>
                    <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {searchQuery ? t('certificates.emptySearch') : t('certificates.empty')}
                    </p>
                    <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                      {searchQuery
                        ? t('certificates.emptySearchHint')
                        : t('certificates.emptyHint')}
                    </p>
                    {!searchQuery && (
                      <div className="mt-5">
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <GlassButton variant="primary" size="sm" onClick={openModal}>
                            <span className="inline-flex items-center gap-2">
                              <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                              {t('certificates.generate')}
                            </span>
                          </GlassButton>
                        </motion.div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
                  {filteredCertificates.map((cert, idx) => {
                    const studentName = getStudentName(cert.studentId);
                    const courseName = cert.course?.name || getCourseName(cert.courseId);
                    const initials = getInitials(studentName);
                    const gradient = avatarGradient(studentName);
                    const isDownloading = downloadingId === cert.id;

                    return (
                      <motion.div
                        key={cert.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                        className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#FF9500]/[0.03]"
                      >
                        {/* Avatar */}
                        <div
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
                          style={{
                            background: gradient,
                            boxShadow:
                              'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
                          }}
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-full"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                            }}
                          />
                          <span className="relative">{initials}</span>
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {studentName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                            <span className="inline-flex items-center gap-1">
                              <Icon paths={I.book} size={10} strokeWidth={2.2} className="opacity-60" />
                              {courseName}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Icon paths={I.hash} size={10} strokeWidth={2.2} className="opacity-60" />
                              {cert.certificateNumber}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                              style={{
                                background: 'rgba(0,122,255,0.08)',
                                color: '#007AFF',
                              }}
                            >
                              <Icon paths={I.shield} size={9} strokeWidth={2.4} />
                              {cert.verificationCode}
                            </span>
                            {cert.issueDate && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                                {formatDate(cert.issueDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Download */}
                        <motion.button
                          type="button"
                          onClick={() => downloadCertificate.mutate(cert.id)}
                          disabled={isDownloading}
                          whileHover={{ scale: 1.06, y: -1 }}
                          whileTap={{ scale: 0.94 }}
                          transition={SPRING.snappy}
                          aria-label={t('certificates.download')}
                          title={t('certificates.download')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold tracking-tight outline-none disabled:opacity-50"
                          style={{
                            background: 'rgba(255,149,0,0.10)',
                            color: '#FF9500',
                            border: '1px solid rgba(255,149,0,0.22)',
                          }}
                        >
                          {isDownloading ? (
                            <motion.span
                              className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                            />
                          ) : (
                            <Icon paths={I.download} size={13} strokeWidth={2.2} />
                          )}
                          <span className="hidden sm:inline">
                            {isDownloading ? t('certificates.downloading') : t('certificates.download')}
                          </span>
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================
            TEMPLATES TAB
        ============================================================ */}
        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.smooth}
          >
            <div
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

              {templates.isLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Shimmer key={i} className="h-16" radius="1rem" />
                  ))}
                </div>
              ) : templates.isError ? (
                <div className="p-8">
                  <GlassErrorState
                    message={getErrorMessage(templates.error)}
                    onRetry={() => templates.refetch()}
                  />
                </div>
              ) : templateList.length === 0 ? (
                <div className="relative p-10">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#AF52DE]/10 text-[#AF52DE]"
                      style={{
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(175,82,222,0.4)',
                      }}
                    >
                      <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                    </div>
                    <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {t('templates.empty')}
                    </p>
                    <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                      {t('templates.emptyHint')}
                    </p>
                    <div className="mt-5">
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <GlassButton variant="primary" size="sm" onClick={() => openTemplateModal()}>
                          <span className="inline-flex items-center gap-2">
                            <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                            {t('templates.new')}
                          </span>
                        </GlassButton>
                      </motion.div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
                  {templateList.map((tpl, idx) => (
                    <motion.div
                      key={tpl.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                      className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#AF52DE]/[0.03]"
                    >
                      {/* Template icon */}
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{
                          background: tpl.isDefault
                            ? 'linear-gradient(135deg, #10B981 0%, #34C759 100%)'
                            : 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                          boxShadow: tpl.isDefault
                            ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(16,185,129,0.5)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(175,82,222,0.5)',
                        }}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-xl"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                          }}
                        />
                        <Icon paths={I.code} size={18} strokeWidth={2} className="relative" />
                      </div>

                      {/* Name + meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {tpl.name}
                          </p>
                          {tpl.isDefault && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                background: 'rgba(16,185,129,0.12)',
                                color: '#10B981',
                                border: '1px solid rgba(16,185,129,0.25)',
                              }}
                            >
                              <Icon paths={I.check} size={9} strokeWidth={3} />
                              {t('templates.badge.default')}
                            </span>
                          )}
                        </div>
                        {tpl.createdAt && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#86868B]">
                            <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                            {formatDate(tpl.createdAt)}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        {!tpl.isDefault && (
                          <motion.button
                            type="button"
                            onClick={() => setDefault.mutate(tpl.id)}
                            disabled={setDefault.isPending}
                            whileHover={{ scale: 1.06, y: -1 }}
                            whileTap={{ scale: 0.94 }}
                            transition={SPRING.snappy}
                            title={t('templates.makeDefault')}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold tracking-tight outline-none disabled:opacity-50"
                            style={{
                              background: 'rgba(16,185,129,0.10)',
                              color: '#10B981',
                              border: '1px solid rgba(16,185,129,0.22)',
                            }}
                          >
                            <Icon paths={I.check} size={11} strokeWidth={2.6} />
                            <span className="hidden sm:inline">
                              {t('templates.makeDefault')}
                            </span>
                          </motion.button>
                        )}
                        <motion.button
                          type="button"
                          onClick={() => openTemplateModal(tpl)}
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
                        >
                          <Icon paths={I.edit} size={13} strokeWidth={2} />
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => setDeletingTemplate(tpl)}
                          disabled={deleteTemplate.isPending}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          transition={SPRING.snappy}
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none disabled:opacity-50"
                          style={{
                            background: 'rgba(255,59,48,0.10)',
                            color: '#FF3B30',
                            border: '1px solid rgba(255,59,48,0.2)',
                          }}
                        >
                          <Icon paths={I.trash} size={13} strokeWidth={2} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          GENERATE CERTIFICATE MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={t('certificates.generate')}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-[#FF950033] bg-[#FF9500]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF9500]/15 text-[#FF9500]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('certificates.generateHint')}
            </p>
          </div>

          <GlassField
            label={t('certificates.field.student')}
            error={formErrors.studentId ? t(formErrors.studentId) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.user} tone="blue" />
              <GlassSelect
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="pl-11"
              >
                <option value="">{t('certificates.selectStudent')}</option>
                {studentList.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentName(student)}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField
            label={t('certificates.field.course')}
            error={formErrors.courseId ? t(formErrors.courseId) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.book} tone="emerald" />
              <GlassSelect
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="pl-11"
              >
                <option value="">{t('certificates.selectCourse')}</option>
                {courseList.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField
            label={t('certificates.field.notes')}
            error={formErrors.notes ? t(formErrors.notes) : undefined}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: TONES.gray.bg, color: TONES.gray.fg }}
                aria-hidden
              >
                <Icon paths={I.note} size={12} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('certificates.notesPlaceholder')}
                rows={3}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton variant="secondary" onClick={closeModal}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="primary"
                onClick={handleCertificateSubmit}
                disabled={generateCertificate.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {generateCertificate.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('certificates.generating')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.award} size={14} strokeWidth={2.4} />
                      {t('certificates.generateAction')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          TEMPLATE CREATE / EDIT MODAL
      ============================================================ */}
      <GlassModal
        open={templateModalOpen}
        onClose={closeTemplateModal}
        title={
          editingTemplate
            ? t('templates.edit', { name: editingTemplate.name })
            : t('templates.createTitle')
        }
        wide
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-[#AF52DE33] bg-[#AF52DE]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#AF52DE]/15 text-[#AF52DE]">
              <Icon paths={I.code} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingTemplate
                ? 'Update the HTML and CSS. Changes apply to new certificates.'
                : 'Create a new certificate template with HTML and CSS.'}
            </p>
          </div>

          <GlassField
            label={t('templates.field.name')}
            error={templateFormErrors.name ? t(templateFormErrors.name) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.layers} tone="purple" />
              <GlassInput
                value={templateForm.name}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, name: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={t('templates.namePlaceholder')}
                aria-invalid={Boolean(templateFormErrors.name)}
                maxLength={200}
                className="pl-11"
              />
            </div>
          </GlassField>

          <GlassField
            label={t('templates.field.html')}
            error={templateFormErrors.htmlTemplate ? t(templateFormErrors.htmlTemplate) : undefined}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: TONES.purple.bg, color: TONES.purple.fg }}
                aria-hidden
              >
                <Icon paths={I.code} size={12} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                value={templateForm.htmlTemplate}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, htmlTemplate: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, htmlTemplate: undefined }));
                }}
                placeholder="<html>…</html>"
                rows={10}
                className="font-mono text-xs pl-11"
                aria-invalid={Boolean(templateFormErrors.htmlTemplate)}
              />
            </div>
            <p className="text-xs text-[#86868B] mt-1">
              {t('templates.variablesHint', {
                variables: TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', '),
              })}
            </p>
          </GlassField>

          <GlassField
            label={t('templates.field.css')}
            error={templateFormErrors.cssStyles ? t(templateFormErrors.cssStyles) : undefined}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: TONES.cyan.bg, color: TONES.cyan.fg }}
                aria-hidden
              >
                <Icon paths={I.code} size={12} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                value={templateForm.cssStyles}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, cssStyles: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, cssStyles: undefined }));
                }}
                placeholder=".student-name { font-size: 32px; color: #111; }"
                rows={4}
                className="font-mono text-xs pl-11"
                aria-invalid={Boolean(templateFormErrors.cssStyles)}
              />
            </div>
          </GlassField>

          <div className="flex items-center gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] px-4 py-3 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
            <GlassSwitch
              checked={templateForm.isDefault}
              onChange={(checked) =>
                setTemplateForm((prev) => ({ ...prev, isDefault: checked }))
              }
              aria-label={t('templates.field.isDefault')}
            />
            <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('templates.field.isDefault')}
            </span>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="secondary"
                onClick={closeTemplateModal}
                disabled={saveTemplate.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="primary"
                onClick={handleTemplateSubmit}
                disabled={saveTemplate.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {saveTemplate.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('templates.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {editingTemplate ? t('templates.saveChanges') : t('templates.createAction')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          DELETE TEMPLATE CONFIRM
      ============================================================ */}
      <GlassModal
        open={Boolean(deletingTemplate)}
        onClose={() => setDeletingTemplate(null)}
        title={t('templates.deleteTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF3B30]/15 text-[#FF3B30]">
              <Icon paths={I.warning} size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-[#FF3B30]">
                {t('templates.deleteConfirm', { name: deletingTemplate?.name ?? '' })}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-[#86868B]">
                {t('templates.deleteHint')}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="secondary"
                onClick={() => setDeletingTemplate(null)}
                disabled={deleteTemplate.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="danger"
                onClick={() => deletingTemplate && deleteTemplate.mutate(deletingTemplate.id)}
                disabled={deleteTemplate.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {deleteTemplate.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('templates.deleting')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.trash} size={14} strokeWidth={2.4} />
                      {t('templates.deleteAction')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>
    </motion.div>
  );
}
