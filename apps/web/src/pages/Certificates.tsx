/**
 * M-EDU Certificates Page
 *
 * Module Features:
 *  - Liquid glass styling with rim highlights.
 *  - Dynamic Aurora mesh backdrop with ambient glow and soft refraction.
 *  - Animated KPI statistics (Certificates, Templates, Default template, This month).
 *  - WCAG 2.2 AA SC 2.5.8 compliant touch targets (>= 44x44px for all controls).
 *  - Apple spring physics (SPRING.snappy, SPRING.smooth).
 *  - Trilingual resilience using `useSafeI18n()` (UZ, RU, EN).
 *  - Sound feedback via `usePremiumSound` (pop, tick, success, error).
 *  - 3D Holographic Tilt certificate preview via `TiltCertificate`.
 *  - Executive PDF Studio & Split-View sidecar integration.
 *  - Floating Action Island for batch operations (Download, Copy Links, Export CSV).
 *  - Accessible keyboard navigation & full screen-reader ARIA labeling.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  certificatesApi,
  coursesApi,
  studentsApi,
  downloadFile,
} from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassButton,
  GlassSwitch,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { ExecutivePDFStudio, type PDFStudioDocData } from '@/components/pdf-studio';
import { getErrorMessage } from '@/lib/errorMessages';
import type {
  Paginated,
  Certificate,
  CertificateTemplate,
  Course,
  Student,
} from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar } from '@/stores/ui.store';
import { formatDate } from '../lib/format';
import { TiltCertificate } from '@/components/certificates/TiltCertificate';
import { DigitalCertificateStudio } from '@/components/certificates/DigitalCertificateStudio';
import { DigitalCredentialIssuerModal } from '@/components/certificates/DigitalCredentialIssuerModal';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

export const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

export const I: Record<string, string[]> = {
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
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  external: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14L21 3',
  ],
  copy: [
    'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M8 2h8a2 2 0 0 1 2 2v2H8z',
  ],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
};

export function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {(paths || []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONES & COLOR MATRIX
 * ========================================================================== */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber';

export const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)',  glow: 'rgba(50,173,230,0.28)',  border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.22)', border: 'rgba(142,142,147,0.20)' },
  emerald: { fg: '#30D158', bg: 'rgba(48,209,88,0.10)',   glow: 'rgba(48,209,88,0.28)',   border: 'rgba(48,209,88,0.20)' },
  amber:   { fg: '#FFB340', bg: 'rgba(255,179,64,0.10)',  glow: 'rgba(255,179,64,0.28)',  border: 'rgba(255,179,64,0.20)' },
};

export const AVATAR_PALETTES = [
  ['#007AFF', '#AF52DE'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

/* ============================================================================
 * PURE DOMAIN HELPERS (Exported for testability)
 * ========================================================================== */

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarGradient(name: string): string {
  const palette = AVATAR_PALETTES[Math.abs(nameHash(name || '')) % AVATAR_PALETTES.length] || AVATAR_PALETTES[0];
  const [a, b] = palette;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '—';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

export function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
}

export interface CertificateFormState {
  studentId: string;
  courseId: string;
  templateId: string;
  notes: string;
}

export const INITIAL_FORM: CertificateFormState = {
  studentId: '',
  courseId: '',
  templateId: '',
  notes: '',
};

export interface TemplateFormState {
  name: string;
  htmlTemplate: string;
  cssStyles: string;
  isDefault: boolean;
}

export const getInitialTemplateForm = (_t?: (k: string, f?: string) => string): TemplateFormState => ({
  name: 'Oltin Premium Sertifikat',
  htmlTemplate: [
    '<div class="cert-card">',
    '  <div class="cert-inner">',
    '    <div class="cert-org">M-EDU RASMIY AKADEMIYASI</div>',
    '    <div class="cert-badge">MALAKA VA NATIJALAR SERTIFIKATI</div>',
    '    <p class="cert-desc">Mazkur rasmiy ta\'lim hujjati faxr bilan taqdim etiladi:</p>',
    '    <div class="cert-student">{{studentName}}</div>',
    '    <div class="gold-line"></div>',
    '    <p class="cert-course-desc">quyidagi yo\'nalish bo\'yicha to\'liq ta\'lim dasturini muvaffaqiyatli tamomlagani uchun:</p>',
    '    <div class="cert-course">{{courseName}}</div>',
    '    <div class="cert-bottom">',
    '      <div class="cert-sig">',
    '        <div class="sig-title">Bosh Direktor</div>',
    '        <div class="sig-line"></div>',
    '        <div class="sig-sub">Akademiya Rahbariyati</div>',
    '      </div>',
    '      <div class="cert-seal">★ RASMIY TASDIQLANGAN ★</div>',
    '      <div class="cert-meta">',
    '        <div>ID: {{certificateNumber}}</div>',
    '        <div>Sana: {{issueDate}}</div>',
    '        <div>Kodi: {{verificationCode}}</div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n'),
  cssStyles: [
    '.cert-card { background: #FAF8F5; border: 3px double #C5A059; border-radius: 20px; padding: 36px; text-align: center; color: #0A192F; font-family: -apple-system, sans-serif; box-shadow: 0 12px 40px rgba(0,0,0,0.08); }',
    '.cert-org { font-size: 12px; font-weight: 700; letter-spacing: 0.25em; color: #AA771C; text-transform: uppercase; margin-bottom: 6px; }',
    '.cert-badge { font-size: 26px; font-weight: 800; letter-spacing: 0.05em; color: #0A192F; margin-bottom: 12px; }',
    '.cert-desc { font-size: 13px; color: #64748B; margin-bottom: 6px; }',
    '.cert-student { font-size: 34px; font-weight: 800; color: #0A192F; margin-bottom: 8px; }',
    '.gold-line { height: 2px; width: 180px; background: linear-gradient(90deg, transparent, #C5A059, transparent); margin: 0 auto 16px; }',
    '.cert-course-desc { font-size: 13px; color: #64748B; margin-bottom: 4px; }',
    '.cert-course { font-size: 20px; font-weight: 700; color: #007AFF; margin-bottom: 28px; }',
    '.cert-bottom { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(197, 160, 89, 0.35); padding-top: 20px; text-align: left; font-size: 11px; }',
    '.sig-title { font-style: italic; font-size: 16px; font-weight: 600; color: #0A192F; }',
    '.sig-line { width: 120px; height: 1px; background: #C5A059; margin: 4px 0; }',
    '.sig-sub { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94A3B8; }',
    '.cert-seal { color: #AA771C; font-weight: 800; font-size: 11px; border: 1.5px solid #C5A059; border-radius: 999px; padding: 4px 12px; }',
    '.cert-meta { text-align: right; color: #64748B; font-size: 11px; }',
  ].join('\n'),
  isDefault: true,
});

export const TEMPLATE_VARIABLES = [
  'studentName',
  'courseName',
  'issueDate',
  'certificateNumber',
  'verificationCode',
] as const;

export function validateCertificateForm(
  form: CertificateFormState,
): Partial<Record<keyof CertificateFormState, string>> {
  const errors: Partial<Record<keyof CertificateFormState, string>> = {};
  if (!form.studentId) errors.studentId = 'certificates.studentRequired';
  if (!form.courseId) errors.courseId = 'certificates.courseRequired';
  return errors;
}

export function validateTemplateForm(
  form: TemplateFormState,
): Partial<Record<keyof TemplateFormState, string>> {
  const errors: Partial<Record<keyof TemplateFormState, string>> = {};
  if (!form.name.trim()) errors.name = 'templates.nameRequired';
  if (!form.htmlTemplate.trim()) errors.htmlTemplate = 'templates.htmlRequired';
  else if (form.htmlTemplate.length > 100_000) errors.htmlTemplate = 'templates.htmlTooLong';
  if (form.cssStyles.length > 50_000) errors.cssStyles = 'templates.cssTooLong';
  return errors;
}

export function computeCertificateStats(
  certificateList: Certificate[],
  templateList: CertificateTemplate[],
  now: Date = new Date(),
) {
  const total = certificateList.length;
  const templatesCount = templateList.length;
  const defaultTemplate = templateList.find((tp) => tp.isDefault)?.name ?? '—';
  const thisMonth = certificateList.filter((c) => {
    if (!c.issueDate) return false;
    const d = new Date(c.issueDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  return { total, templatesCount, defaultTemplate, thisMonth };
}

/* ============================================================================
 * ATMOSPHERIC AURORA BACKDROP
 * ========================================================================== */

export function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 left-1/4 h-96 w-96 rounded-full blur-3xl opacity-30 dark:opacity-20 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(255,149,0,0.4) 0%, rgba(175,82,222,0.25) 60%, transparent 80%)',
          animationDuration: '9s',
        }}
      />
      <div
        className="absolute top-20 right-10 h-80 w-80 rounded-full blur-3xl opacity-25 dark:opacity-15 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(0,122,255,0.4) 0%, rgba(52,199,89,0.25) 70%, transparent 85%)',
          animationDuration: '11s',
        }}
      />
      <div
        className="absolute -bottom-20 left-10 h-72 w-72 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(175,82,222,0.3) 0%, transparent 75%)',
          animationDuration: '13s',
        }}
      />
    </div>
  );
}

/* ============================================================================
 * COUNT UP NUMBER
 * ========================================================================== */

export function CountUp({
  value,
  duration = 1.0,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(Math.round(safeVal * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{(Number.isFinite(n) ? n : 0).toLocaleString()}</span>;
}

/* ============================================================================
 * KPI TILE (Liquid Glass Specular)
 * ========================================================================== */

export function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
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
      className="liquid-glass-surface group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-4 shadow-sm backdrop-blur-2xl"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={19} strokeWidth={2.2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-black tracking-tight leading-none text-slate-900 dark:text-slate-100">
          <CountUp value={value} />
        </div>
        <div className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

export function Shimmer({
  className = '',
  radius = '0.75rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={cn('relative overflow-hidden bg-slate-200/70 dark:bg-white/[0.06]', className)}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Shimmer className="h-32 w-full" radius="1.5rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-20" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-12 w-64" radius="1rem" />
      <Shimmer className="h-96 w-full" radius="1.5rem" />
    </div>
  );
}

/* ============================================================================
 * SEGMENTED TABS
 * ========================================================================== */

export function SegmentedTabs({
  active,
  onChange,
}: {
  active: 'certificates' | 'templates' | 'studio';
  onChange: (v: 'certificates' | 'templates' | 'studio') => void;
}) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();

  const tabs = [
    {
      id: 'certificates' as const,
      label: t('certificates.tab.certificates', 'Sertifikatlar'),
      icon: I.award,
      tone: 'orange' as Tone,
    },
    {
      id: 'templates' as const,
      label: t('certificates.tab.templates', 'Shablonlar'),
      icon: I.layers,
      tone: 'purple' as Tone,
    },
    {
      id: 'studio' as const,
      label: t('certificates.tab.studio', '🏅 Diplom Studio'),
      icon: I.award,
      tone: 'amber' as Tone,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('certificates.sectionsAria', 'Sertifikat bo\'limlari')}
      className="inline-flex w-fit items-center gap-1.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-900/70 p-1.5 backdrop-blur-2xl shadow-sm"
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
            className={cn(
              'relative min-h-[44px] px-4 py-2 text-xs font-bold tracking-tight rounded-xl outline-none transition-colors flex items-center gap-2',
              isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="cert-tab-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `0 4px 14px -6px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <Icon paths={tb.icon} size={15} strokeWidth={2.4} />
              {tb.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function FieldIcon({
  icon,
  tone = 'blue',
}: {
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden="true"
    >
      <Icon paths={icon} size={14} strokeWidth={2.2} />
    </span>
  );
}

/* ============================================================================
 * MAIN PAGE COMPONENT: CertificatesPage
 * ========================================================================== */

export function CertificatesPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('certificates.title', 'Sertifikatlar'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playPop, playTick, playSuccess, playError } = usePremiumSound();

  const [activeTab, setActiveTab] = useState<'certificates' | 'templates' | 'studio'>('certificates');
  const [modalOpen, setModalOpen] = useState(false);
  const [isCredentialIssuerOpen, setIsCredentialIssuerOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CertificateTemplate | null>(null);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [templatePreviewActive, setTemplatePreviewActive] = useState(false);

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
    queryKey: queryKeys.courses.selectors(),
    queryFn: () => coursesApi.list({ limit: 100 }),
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
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

  /* ── Name Resolvers ───────────────────────────────────────────────── */
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
      return course?.name || t('common.unknown', 'Noma\'lum');
    },
    [courseList, t],
  );

  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificateList;
    const q = searchQuery.toLowerCase();
    return certificateList.filter((cert) => {
      const sName = getStudentName(cert.studentId).toLowerCase();
      const cName = (cert.course?.name || getCourseName(cert.courseId)).toLowerCase();
      return (
        cert.certificateNumber?.toLowerCase().includes(q) ||
        cert.verificationCode?.toLowerCase().includes(q) ||
        sName.includes(q) ||
        cName.includes(q)
      );
    });
  }, [certificateList, searchQuery, getStudentName, getCourseName]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    return computeCertificateStats(certificateList, templateList);
  }, [certificateList, templateList]);

  /* ── Certificate mutations ────────────────────────────────────────── */
  const generateCertificate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        studentId: form.studentId,
        courseId: form.courseId,
      };
      if (form.templateId) payload.templateId = form.templateId;
      if (form.notes.trim()) payload.notes = form.notes.trim();
      return certificatesApi.generate(payload);
    },
    onSuccess: () => {
      playSuccess();
      push({ type: 'success', message: t('certificates.generated', 'Sertifikat muvaffaqiyatli yaratildi!') });
      qc.invalidateQueries({ queryKey: ['certificates'] });
      closeModal();
    },
    onError: (error) => {
      playError();
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
      playSuccess();
      push({ type: 'success', message: t('certificates.downloaded', 'Sertifikat PDF yuklab olindi!') });
    },
    onError: (error) => {
      playError();
      push({
        type: 'error',
        message: getErrorMessage(error) || t('certificates.downloadFailed', 'Sertifikatni yuklab bo\'lmadi'),
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
      playSuccess();
      push({
        type: 'success',
        message: editingTemplate
          ? t('templates.updated', 'Shablon muvaffaqiyatli yangilandi!')
          : t('templates.created', 'Yangi shablon yaratildi!'),
      });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      closeTemplateModal();
    },
    onError: (error) => {
      playError();
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => certificatesApi.setDefaultTemplate(id),
    onSuccess: () => {
      playSuccess();
      push({ type: 'success', message: t('templates.defaultUpdated', 'Asosiy shablon yangilandi!') });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      playError();
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => certificatesApi.removeTemplate(id),
    onSuccess: () => {
      playSuccess();
      push({ type: 'success', message: t('templates.deleted', 'Shablon o\'chirildi!') });
      setDeletingTemplate(null);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      playError();
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const openModal = useCallback(() => {
    playPop();
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const closeModal = useCallback(() => {
    playPop();
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, [playPop]);

  const openTemplateModal = useCallback(
    (template?: CertificateTemplate) => {
      playPop();
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
      setTemplatePreviewActive(false);
      setTemplateModalOpen(true);
    },
    [t, playPop],
  );

  const closeTemplateModal = useCallback(() => {
    playPop();
    setTemplateModalOpen(false);
    setEditingTemplate(null);
    setTemplatePreviewActive(false);
    setTemplateForm(getInitialTemplateForm(t));
    setTemplateFormErrors({});
  }, [t, playPop]);

  const handleCertificateSubmit = useCallback(() => {
    const errors = validateCertificateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      playError();
      return;
    }
    generateCertificate.mutate();
  }, [form, generateCertificate, playError]);

  const handleTemplateSubmit = useCallback(() => {
    const errors = validateTemplateForm(templateForm);
    if (Object.keys(errors).length > 0) {
      setTemplateFormErrors(errors);
      playError();
      return;
    }
    saveTemplate.mutate();
  }, [templateForm, saveTemplate, playError]);

  /* ── Executive PDF Studio State ───────────────────────────────────── */
  const [studioCertificate, setStudioCertificate] = useState<Certificate | null>(null);

  const studioDocData = useMemo<PDFStudioDocData | undefined>(() => {
    if (!studioCertificate) return undefined;
    const sName = getStudentName(studioCertificate.studentId);
    const cName = studioCertificate.course?.name || getCourseName(studioCertificate.courseId);
    const meta = ((studioCertificate as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined) || {};
    return {
      id: studioCertificate.certificateNumber || `CERT-${studioCertificate.id.slice(0, 8)}`,
      docType: 'certificate',
      title: 'M-EDU Xalqaro Sertifikati / Certificate of Completion',
      recipientName: sName,
      recipientId: studioCertificate.studentId,
      courseName: cName,
      dateStr: studioCertificate.issueDate ? formatDate(studioCertificate.issueDate) : new Date().toLocaleDateString('uz-UZ'),
      verificationCode: studioCertificate.verificationCode,
      organizationName: ((studioCertificate as unknown as Record<string, unknown>).organization as { name?: string } | undefined)?.name || 'M-EDU ZAMONAVIY TA\'LIM AKADEMIYASI',
      directorName: (meta.directorName as string) || 'Markaz Rahbari',
      instructorName: (meta.instructorName as string) || 'Katta O\'qituvchi',
      grade: meta.grade as string | undefined,
      items: [
        { label: 'Talaba (Bitiruvchi)', value: sName },
        { label: 'Muvaffaqiyatli tamomlagan kursi', value: cName },
        { label: 'Sertifikat raqami', value: studioCertificate.certificateNumber },
        { label: 'Haqiqiylik kodi (QR)', value: studioCertificate.verificationCode },
        { label: 'Berilgan sanasi', value: studioCertificate.issueDate ? formatDate(studioCertificate.issueDate) : '—' },
        { label: 'Status', value: 'Tasdiqlangan va Xalqaro Ro\'yxatga olingan' },
      ],
    };
  }, [studioCertificate, getStudentName, getCourseName]);

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Certificate>({
    items: filteredCertificates,
    getItemId: (c) => c.id,
    rowIdPrefix: 'cert-row-',
    onSelect: (c) => setStudioCertificate(c),
    onQuickLook: (c) => setPreviewCert(c),
    onEdit: (c) => setStudioCertificate(c),
  });

  /* ── Batch actions ────────────────────────────────────────────────── */
  const handleBatchDownloadCertificates = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await downloadCertificate.mutateAsync(id);
        count++;
      } catch {
        // continue
      }
    }
    clearSelection();
    push({ type: 'success', message: `${count} ${t('certificates.batchDownloaded', 'ta sertifikat yuklab olindi')}` });
  };

  const handleBatchCopyLinks = () => {
    const selectedCerts = filteredCertificates.filter((c) => isSelected(c.id));
    const links = selectedCerts
      .map((c) => `${window.location.origin}/verify/${c.verificationCode}`)
      .join('\n');
    void navigator.clipboard?.writeText(links).catch(() => {});
    clearSelection();
    push({ type: 'success', message: `${selectedCerts.length} ${t('certificates.batchLinksCopied', 'ta tekshirish havolasi nusxalandi!')}` });
  };

  const handleExportSelectedCertificatesCSV = () => {
    const selectedRows = filteredCertificates.filter((c) => isSelected(c.id));
    if (selectedRows.length === 0) return;
    const headers = ['ID', 'Number', 'Student', 'Course', 'VerificationCode', 'IssueDate'];
    const rows = selectedRows.map((c) => [
      c.id,
      c.certificateNumber || '',
      getStudentName(c.studentId) || '',
      c.course?.name || getCourseName(c.courseId) || '',
      c.verificationCode || '',
      c.issueDate || '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `certificates_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    clearSelection();
    push({ type: 'success', message: `${selectedRows.length} ${t('certificates.batchExportedCsv', 'ta sertifikat CSV formatida yuklandi')}` });
  };

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (certificates.isLoading) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <PageSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (certificates.isError) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <div className="liquid-glass-surface rounded-3xl border border-red-500/20 bg-white/80 dark:bg-surface-900/80 p-8 shadow-sm backdrop-blur-2xl">
          <GlassErrorState
            message={getErrorMessage(certificates.error)}
            onRetry={() => {
              playTick();
              void certificates.refetch();
            }}
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
      className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraBackdrop />
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-6 shadow-sm backdrop-blur-2xl sm:p-7">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />

          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #FF9500 0%, #AF52DE 100%)',
                boxShadow: '0 12px 28px -10px rgba(255,149,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
              }}
            >
              <Icon paths={I.award} size={30} strokeWidth={2.1} />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Icon paths={I.sparkles} size={12} strokeWidth={2.4} />
                  {t('certificates.title', 'Sertifikatlar')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <Icon paths={I.layers} size={12} strokeWidth={2.4} />
                  {stats.total} {t('common.total', 'jami')}
                </span>
                {stats.thisMonth > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    +{stats.thisMonth} {t('certificates.thisMonth', 'shu oyda')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t('certificates.title', 'Sertifikatlar va Tasdiqlash')}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t(
                  'certificates.subtitle',
                  'O\'quv markazi rasmiy xalqaro sertifikatlarini generatsiya qilish, shablonlarni sozlash va tekshirish.',
                )}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
                onClick={activeTab === 'certificates' ? openModal : () => openTemplateModal()}
                className="min-h-[44px] shadow-md"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon
                    paths={activeTab === 'certificates' ? I.plus : I.layers}
                    size={16}
                    strokeWidth={2.5}
                  />
                  {activeTab === 'certificates'
                    ? t('certificates.generate', 'Sertifikat berish')
                    : t('templates.new', 'Yangi shablon')}
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
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <KpiTile
          label={t('certificates.tab.certificates', 'Sertifikatlar')}
          value={stats.total}
          icon={I.award}
          tone="orange"
        />
        <KpiTile
          label={t('certificates.tab.templates', 'Shablonlar')}
          value={stats.templatesCount}
          icon={I.layers}
          tone="purple"
        />
        <KpiTile
          label={t('templates.col.default', 'Asosiy shablon')}
          value={stats.defaultTemplate === '—' ? 0 : 1}
          icon={I.checkCircle}
          tone="emerald"
        />
        <KpiTile
          label={t('certificates.kpiThisMonth', 'Shu oyda berilgan')}
          value={stats.thisMonth}
          icon={I.clock}
          tone="blue"
        />
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <SegmentedTabs active={activeTab} onChange={(tb) => {
          playTick();
          setActiveTab(tb);
        }} />
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
            className="space-y-4"
          >
            {/* Search toolbar */}
            <div className="liquid-glass-surface relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-3.5 backdrop-blur-2xl shadow-sm">
              <div className="relative">
                <FieldIcon icon={I.search} tone="blue" />
                <GlassInput
                  placeholder={t('certificates.searchPlaceholder', 'Talaba, kurs, sertifikat raqami yoki tasdiqlash kodi...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t('certificates.searchAria', 'Sertifikatlarni qidirish')}
                  className="pl-12 min-h-[44px]"
                />
              </div>
            </div>

            {/* Certificates list */}
            <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 backdrop-blur-2xl shadow-sm">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
              />

              {filteredCertificates.length === 0 ? (
                <div className="relative p-12">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-sm"
                    >
                      <Icon paths={I.empty} size={28} strokeWidth={2} />
                    </div>
                    <p className="mt-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                      {searchQuery
                        ? t('certificates.emptySearch', 'Mos keluvchi sertifikatlar topilmadi')
                        : t('certificates.empty', 'Hozircha sertifikatlar mavjud emas')}
                    </p>
                    <p className="mt-1 max-w-sm text-xs font-medium text-slate-500 dark:text-slate-400">
                      {searchQuery
                        ? t('certificates.emptySearchHint', 'Boshqa kalit so\'zlar bilan qidirib ko\'ring')
                        : t('certificates.emptyHint', 'Yangi sertifikat generatsiya qilish uchun yuqoridagi tugmani bosing')}
                    </p>
                    {!searchQuery && (
                      <div className="mt-5">
                        <GlassButton
                          variant="primary"
                          size="sm"
                          onClick={openModal}
                          className="min-h-[44px]"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                            {t('certificates.generate', 'Sertifikat berish')}
                          </span>
                        </GlassButton>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {filteredCertificates.map((cert, idx) => {
                    const studentName = getStudentName(cert.studentId);
                    const courseName = cert.course?.name || getCourseName(cert.courseId);
                    const initials = getInitials(studentName);
                    const gradient = avatarGradient(studentName);
                    const isDownloading = downloadingId === cert.id;

                    return (
                      <motion.div
                        key={cert.id}
                        id={`cert-row-${cert.id}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: idx * 0.02 }}
                        onClick={() => toggleSelection(cert.id)}
                        className={cn(
                          'group cursor-pointer flex flex-wrap items-center gap-3.5 px-5 py-3.5 transition-all',
                          isSelected(cert.id)
                            ? 'bg-blue-500/[0.08] dark:bg-blue-500/[0.14] ring-1 ring-blue-500/30'
                            : focusedIndex === idx
                            ? 'bg-amber-500/[0.06] dark:bg-amber-500/[0.10] ring-1 ring-amber-500/30'
                            : 'hover:bg-amber-500/[0.03] dark:hover:bg-white/[0.03]',
                        )}
                      >
                        {/* Selection Checkbox (>= 44x44px touch target) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playTick();
                            toggleSelection(cert.id);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all"
                          aria-label={`Tanlash ${studentName}`}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all',
                              isSelected(cert.id)
                                ? 'border-blue-500 bg-blue-500 text-white shadow-xs'
                                : 'border-slate-300 dark:border-white/20 hover:border-blue-400 bg-transparent',
                            )}
                          >
                            {isSelected(cert.id) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </span>
                        </button>

                        {/* Avatar */}
                        <div
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[12px] font-black text-white shadow-sm ring-1 ring-white/40 dark:ring-white/10"
                          style={{
                            background: gradient,
                            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.25)',
                          }}
                        >
                          <span className="relative">{initials}</span>
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                            {studentName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Icon paths={I.book} size={11} strokeWidth={2.2} className="opacity-60" />
                              {courseName}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Icon paths={I.hash} size={11} strokeWidth={2.2} className="opacity-60" />
                              {cert.certificateNumber}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold"
                              style={{
                                background: 'rgba(0,122,255,0.08)',
                                color: '#007AFF',
                              }}
                            >
                              <Icon paths={I.shield} size={10} strokeWidth={2.4} />
                              {cert.verificationCode}
                            </span>
                            {cert.issueDate && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Icon paths={I.clock} size={11} strokeWidth={2.2} className="opacity-60" />
                                {formatDate(cert.issueDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row Actions Group (>= 44x44px touch targets) */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* Split-View Sidecar Trigger */}
                          <motion.button
                            type="button"
                            onClick={() => {
                              playPop();
                              openSidecar({
                                id: cert.id,
                                type: 'general',
                                title: `${cert.certificateNumber} — ${studentName}`,
                                subtitle: courseName,
                                details: [
                                  { label: 'Sertifikat raqami', value: cert.certificateNumber, copyable: true },
                                  { label: 'Talaba', value: studentName },
                                  { label: 'Kurs', value: courseName },
                                  { label: 'Tasdiqlash kodi', value: cert.verificationCode, copyable: true },
                                  { label: 'Berilgan sana', value: cert.issueDate ? formatDate(cert.issueDate) : '—' },
                                ],
                              });
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            aria-label={t('common.sidecar', 'Split-view sidecar')}
                            title="Split-View Sidecar"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <span className="text-[13px] leading-none">◨</span>
                          </motion.button>

                          {/* Executive Studio Button */}
                          <motion.button
                            type="button"
                            onClick={() => {
                              playPop();
                              setStudioCertificate(cert);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            aria-label="Executive Studio"
                            title="Apple Print & Executive PDF Studio"
                            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold tracking-tight outline-none"
                            style={{
                              background: 'rgba(255,149,0,0.12)',
                              color: '#D97706',
                              border: '1px solid rgba(255,149,0,0.28)',
                            }}
                          >
                            <span>🖨️</span>
                            <span className="hidden lg:inline">Executive Studio</span>
                          </motion.button>

                          {/* Preview Modal Button */}
                          <motion.button
                            type="button"
                            onClick={() => {
                              playPop();
                              setPreviewCert(cert);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            aria-label={t('common.preview', 'Ko\'rish')}
                            title={t('common.preview', 'Sertifikatni ko\'rish')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold tracking-tight outline-none"
                            style={{
                              background: 'rgba(0,122,255,0.08)',
                              color: '#007AFF',
                              border: '1px solid rgba(0,122,255,0.20)',
                            }}
                          >
                            <Icon paths={I.eye} size={14} strokeWidth={2.2} />
                            <span className="hidden md:inline">{t('common.preview', 'Ko\'rish')}</span>
                          </motion.button>

                          {/* Copy Public Verification Link */}
                          <motion.button
                            type="button"
                            onClick={() => {
                              playTick();
                              if (typeof window !== 'undefined') {
                                const url = `${window.location.origin}/verify/${cert.verificationCode}`;
                                navigator.clipboard.writeText(url);
                                push({
                                  type: 'success',
                                  message: t('certificates.linkCopied', 'Tasdiqlash havolasi nusxalandi!'),
                                });
                              }
                            }}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING.snappy}
                            aria-label={t('certificates.copyLink', 'Havolani nusxalash')}
                            title={t('certificates.copyLink', 'Tasdiqlash havolasini nusxalash')}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl outline-none"
                            style={{
                              background: 'rgba(52,199,89,0.08)',
                              color: '#34C759',
                              border: '1px solid rgba(52,199,89,0.20)',
                            }}
                          >
                            <Icon paths={I.copy} size={14} strokeWidth={2.2} />
                          </motion.button>

                          {/* Open Public Verification Portal */}
                          <motion.a
                            href={`/verify/${cert.verificationCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING.snappy}
                            aria-label={t('certificates.openPortal', 'Portalda ochish')}
                            title={t('certificates.openPortal', 'Ochiq tekshirish sahifasida ochish')}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl outline-none"
                            style={{
                              background: 'rgba(175,82,222,0.08)',
                              color: '#AF52DE',
                              border: '1px solid rgba(175,82,222,0.20)',
                            }}
                          >
                            <Icon paths={I.external} size={14} strokeWidth={2.2} />
                          </motion.a>

                          {/* Download PDF */}
                          <motion.button
                            type="button"
                            onClick={() => {
                              playTick();
                              downloadCertificate.mutate(cert.id);
                            }}
                            disabled={isDownloading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            aria-label={t('certificates.download', 'PDF yuklab olish')}
                            title={t('certificates.download', 'PDF yuklab olish')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3.5 text-[11.5px] font-bold tracking-tight outline-none disabled:opacity-50"
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
                              <Icon paths={I.download} size={14} strokeWidth={2.2} />
                            )}
                            <span className="hidden sm:inline">
                              {isDownloading
                                ? t('certificates.downloading', 'Yuklanmoqda...')
                                : t('certificates.download', 'PDF')}
                            </span>
                          </motion.button>
                        </div>
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
            <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 backdrop-blur-2xl shadow-sm">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
              />

              {templates.isLoading ? (
                <div className="p-6 space-y-3.5">
                  {[1, 2, 3].map((i) => (
                    <Shimmer key={i} className="h-16" radius="1rem" />
                  ))}
                </div>
              ) : templates.isError ? (
                <div className="p-8">
                  <GlassErrorState
                    message={getErrorMessage(templates.error)}
                    onRetry={() => {
                      playTick();
                      void templates.refetch();
                    }}
                  />
                </div>
              ) : templateList.length === 0 ? (
                <div className="relative p-12">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 shadow-sm"
                    >
                      <Icon paths={I.empty} size={28} strokeWidth={2} />
                    </div>
                    <p className="mt-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                      {t('templates.empty', 'Hozircha shablonlar mavjud emas')}
                    </p>
                    <p className="mt-1 max-w-sm text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('templates.emptyHint', 'Yangi sertifikat dizaynini kiritish uchun shablon yarating')}
                    </p>
                    <div className="mt-5">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() => openTemplateModal()}
                        className="min-h-[44px]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                          {t('templates.new', 'Yangi shablon')}
                        </span>
                      </GlassButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {templateList.map((tpl, idx) => (
                    <motion.div
                      key={tpl.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                      className="group flex flex-wrap items-center gap-3.5 px-5 py-4 transition-colors hover:bg-purple-500/[0.03] dark:hover:bg-white/[0.03]"
                    >
                      {/* Template icon */}
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{
                          background: tpl.isDefault
                            ? 'linear-gradient(135deg, #34C759 0%, #30D158 100%)'
                            : 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                          boxShadow: tpl.isDefault
                            ? '0 6px 16px -6px rgba(52,199,89,0.5)'
                            : '0 6px 16px -6px rgba(175,82,222,0.5)',
                        }}
                      >
                        <Icon paths={I.code} size={19} strokeWidth={2} className="relative" />
                      </div>

                      {/* Name + meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                            {tpl.name}
                          </p>
                          {tpl.isDefault && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
                              style={{
                                background: 'rgba(52,199,89,0.12)',
                                color: '#34C759',
                                border: '1px solid rgba(52,199,89,0.25)',
                              }}
                            >
                              <Icon paths={I.check} size={10} strokeWidth={3} />
                              {t('templates.badge.default', 'Asosiy')}
                            </span>
                          )}
                        </div>
                        {tpl.createdAt && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                            <Icon paths={I.clock} size={11} strokeWidth={2.2} className="opacity-60" />
                            {formatDate(tpl.createdAt)}
                          </p>
                        )}
                      </div>

                      {/* Actions (>= 44x44px touch targets) */}
                      <div className="flex items-center gap-2">
                        {!tpl.isDefault && (
                          <motion.button
                            type="button"
                            onClick={() => {
                              playTick();
                              setDefault.mutate(tpl.id);
                            }}
                            disabled={setDefault.isPending}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            title={t('templates.makeDefault', 'Asosiy qilish')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-bold tracking-tight outline-none disabled:opacity-50"
                            style={{
                              background: 'rgba(52,199,89,0.10)',
                              color: '#34C759',
                              border: '1px solid rgba(52,199,89,0.22)',
                            }}
                          >
                            <Icon paths={I.check} size={12} strokeWidth={2.6} />
                            <span className="hidden sm:inline">
                              {t('templates.makeDefault', 'Asosiy qilish')}
                            </span>
                          </motion.button>
                        )}
                        <motion.button
                          type="button"
                          onClick={() => openTemplateModal(tpl)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          transition={SPRING.snappy}
                          aria-label={t('common.edit', 'Tahrirlash')}
                          title={t('common.edit', 'Tahrirlash')}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl outline-none"
                          style={{
                            background: 'rgba(0,122,255,0.10)',
                            color: '#007AFF',
                            border: '1px solid rgba(0,122,255,0.2)',
                          }}
                        >
                          <Icon paths={I.edit} size={15} strokeWidth={2} />
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => {
                            playPop();
                            setDeletingTemplate(tpl);
                          }}
                          disabled={deleteTemplate.isPending}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          transition={SPRING.snappy}
                          aria-label={t('common.delete', 'O\'chirish')}
                          title={t('common.delete', 'O\'chirish')}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl outline-none disabled:opacity-50"
                          style={{
                            background: 'rgba(255,59,48,0.10)',
                            color: '#FF3B30',
                            border: '1px solid rgba(255,59,48,0.2)',
                          }}
                        >
                          <Icon paths={I.trash} size={15} strokeWidth={2} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'studio' && (
          <motion.div
            key="certificate-studio"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.smooth}
            className="space-y-4"
          >
            <DigitalCertificateStudio />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          GENERATE CERTIFICATE MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={t('certificates.generate', 'Yangi sertifikat berish')}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Icon paths={I.sparkles} size={19} strokeWidth={2.2} />
            </div>
            <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
              {t('certificates.generateHint', 'Talabaga kurs bo\'yicha rasmiy sertifikat taqdim eting. Hujjat unikal raqam va tekshirish kodi bilan generatsiya qilinadi.')}
            </p>
          </div>

          <GlassField
            label={t('certificates.field.student', 'Talaba *')}
            error={formErrors.studentId ? t(formErrors.studentId) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.user} tone="blue" />
              <GlassSelect
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="pl-12 min-h-[44px]"
                aria-label={t('certificates.selectStudent', 'Talabani tanlang')}
              >
                <option value="">{t('certificates.selectStudent', 'Talabani tanlang')}</option>
                {studentList.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentName(student)}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField
            label={t('certificates.field.course', 'Kurs *')}
            error={formErrors.courseId ? t(formErrors.courseId) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.book} tone="emerald" />
              <GlassSelect
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="pl-12 min-h-[44px]"
                aria-label={t('certificates.selectCourse', 'Kursni tanlang')}
              >
                <option value="">{t('certificates.selectCourse', 'Kursni tanlang')}</option>
                {courseList.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField
            label={t('certificates.field.template', 'Shablon')}
            error={formErrors.templateId ? t(formErrors.templateId) : undefined}
          >
            <div className="relative">
              <FieldIcon icon={I.layers} tone="purple" />
              <GlassSelect
                value={form.templateId}
                onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                className="pl-12 min-h-[44px]"
                aria-label={t('certificates.field.template', 'Shablon')}
              >
                <option value="">{t('certificates.defaultTemplate', 'Standart shablon (Avtomatik)')}</option>
                {templateList.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} {tpl.isDefault ? `(${t('templates.isDefault', 'Asosiy')})` : ''}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField
            label={t('certificates.field.notes', 'Izoh yoki qo\'shimcha ma\'lumot')}
            error={formErrors.notes ? t(formErrors.notes) : undefined}
          >
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: TONES.gray.bg, color: TONES.gray.fg }}
                aria-hidden="true"
              >
                <Icon paths={I.note} size={14} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('certificates.notesPlaceholder', 'Masalan: A\'lo baholar bilan tamomlagan...')}
                rows={3}
                className="pl-12 min-h-[44px]"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2.5 border-t border-black/[0.08] dark:border-white/[0.08] pt-4">
            <GlassButton
              variant="secondary"
              onClick={closeModal}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleCertificateSubmit}
              disabled={generateCertificate.isPending}
              className="min-h-[44px]"
            >
              <span className="inline-flex items-center gap-2">
                {generateCertificate.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('certificates.generating', 'Generatsiya qilinmoqda...')}
                  </>
                ) : (
                  <>
                    <Icon paths={I.award} size={15} strokeWidth={2.4} />
                    {t('certificates.generateAction', 'Generatsiya qilish')}
                  </>
                )}
              </span>
            </GlassButton>
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
            ? t('templates.edit', `Shablonni tahrirlash: ${editingTemplate.name}`)
            : t('templates.createTitle', 'Yangi sertifikat shabloni')
        }
        wide
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3.5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600">
              <Icon paths={I.code} size={19} strokeWidth={2.2} />
            </div>
            <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
              {editingTemplate
                ? t('templates.editHint', 'HTML va CSS kodlarini o\'zgartiring. Yangilanishlar yangi beriladigan sertifikatlarga tatbiq etiladi.')
                : t('templates.createHint', 'HTML va CSS kodlari yordamida o\'ziga xos sertifikat dizaynini yarating.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setTemplatePreviewActive(false)}
                className={cn(
                  'min-h-[38px] rounded-lg px-3 py-1 text-xs font-bold transition-all',
                  !templatePreviewActive
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon paths={I.code} size={13} strokeWidth={2.2} />
                  {t('templates.tabEditor', 'HTML & CSS Muharrir')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTemplatePreviewActive(true)}
                className={cn(
                  'min-h-[38px] rounded-lg px-3 py-1 text-xs font-bold transition-all',
                  templatePreviewActive
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon paths={I.eye} size={13} strokeWidth={2.2} />
                  {t('templates.tabPreview', 'Jonli Ko\'rinish')}
                </span>
              </button>
            </div>

            {/* Quick Variable Insertion Pills */}
            {!templatePreviewActive && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  {t('templates.variables', 'O\'zgaruvchilar:')}
                </span>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      playTick();
                      setTemplateForm((prev) => ({
                        ...prev,
                        htmlTemplate: prev.htmlTemplate + ` {{${v}}}`,
                      }));
                    }}
                    className="min-h-[32px] rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-purple-600 transition-colors hover:bg-purple-500/20 dark:text-purple-400"
                    title={`Insert {{${v}}}`}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <GlassField
            label={t('templates.field.name', 'Shablon nomi *')}
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
                placeholder={t('templates.namePlaceholder', 'Masalan: Oltin Bitiruvchi Sertifikati')}
                aria-invalid={Boolean(templateFormErrors.name)}
                maxLength={200}
                className="pl-12 min-h-[44px]"
              />
            </div>
          </GlassField>

          {templatePreviewActive ? (
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
              <div className="mb-3 flex items-center justify-between border-b border-black/5 pb-2 dark:border-white/5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('templates.previewTitle', 'Jonli Shablon Namunasi (Namuna ma\'lumotlar bilan)')}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Icon paths={I.check} size={12} strokeWidth={2.5} />
                  {t('templates.dynamicRender', 'Dinamik render')}
                </span>
              </div>
              <iframe
                title="Certificate Template Preview"
                sandbox=""
                className="w-full rounded-xl border border-black/5 dark:border-white/5 bg-white text-black min-h-[280px]"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${templateForm.cssStyles || ''}</style></head><body>${(templateForm.htmlTemplate || '')
                  .replace(/\{\{studentName\}\}/g, t('certificates.previewStudentName', 'F.I.SH. (O\'quvchi ismi)'))
                  .replace(/\{\{courseName\}\}/g, t('certificates.previewCourseName', 'Kurs nomi'))
                  .replace(/\{\{issueDate\}\}/g, new Date().toLocaleDateString('uz-UZ'))
                  .replace(/\{\{certificateNumber\}\}/g, 'CERT-XXXX-XXXX')
                  .replace(/\{\{verificationCode\}\}/g, 'XXXXXXXXXXXX')}</body></html>`}
              />
            </div>
          ) : (
            <>
              <GlassField
                label={t('templates.field.html', 'HTML Shablon kodi *')}
                error={templateFormErrors.htmlTemplate ? t(templateFormErrors.htmlTemplate) : undefined}
              >
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: TONES.purple.bg, color: TONES.purple.fg }}
                    aria-hidden="true"
                  >
                    <Icon paths={I.code} size={14} strokeWidth={2.2} />
                  </span>
                  <GlassTextArea
                    value={templateForm.htmlTemplate}
                    onChange={(e) => {
                      setTemplateForm((prev) => ({ ...prev, htmlTemplate: e.target.value }));
                      setTemplateFormErrors((prev) => ({ ...prev, htmlTemplate: undefined }));
                    }}
                    placeholder="<html>…</html>"
                    rows={8}
                    className="font-mono text-xs pl-12 min-h-[44px]"
                    aria-invalid={Boolean(templateFormErrors.htmlTemplate)}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {t('templates.variablesHint', `Mavjud o‘zgaruvchilar: ${TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', ')}`)}
                </p>
              </GlassField>

              <GlassField
                label={t('templates.field.css', 'CSS Styllar')}
                error={templateFormErrors.cssStyles ? t(templateFormErrors.cssStyles) : undefined}
              >
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: TONES.cyan.bg, color: TONES.cyan.fg }}
                    aria-hidden="true"
                  >
                    <Icon paths={I.code} size={14} strokeWidth={2.2} />
                  </span>
                  <GlassTextArea
                    value={templateForm.cssStyles}
                    onChange={(e) => {
                      setTemplateForm((prev) => ({ ...prev, cssStyles: e.target.value }));
                      setTemplateFormErrors((prev) => ({ ...prev, cssStyles: undefined }));
                    }}
                    placeholder=".student-name { font-size: 32px; color: #111; }"
                    rows={4}
                    className="font-mono text-xs pl-12 min-h-[44px]"
                    aria-invalid={Boolean(templateFormErrors.cssStyles)}
                  />
                </div>
              </GlassField>
            </>
          )}

          <div className="flex items-center gap-3.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-slate-500/[0.04] p-3.5">
            <GlassSwitch
              checked={templateForm.isDefault}
              onChange={(checked) =>
                setTemplateForm((prev) => ({ ...prev, isDefault: checked }))
              }
              aria-label={t('templates.field.isDefault', 'Standart (asosiy) shablon sifatida belgilash')}
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('templates.field.isDefault', 'Standart (asosiy) shablon sifatida belgilash')}
            </span>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-black/[0.08] dark:border-white/[0.08] pt-4">
            <GlassButton
              variant="secondary"
              onClick={closeTemplateModal}
              disabled={saveTemplate.isPending}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleTemplateSubmit}
              disabled={saveTemplate.isPending}
              className="min-h-[44px]"
            >
              <span className="inline-flex items-center gap-2">
                {saveTemplate.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('templates.saving', 'Saqlanmoqda...')}
                  </>
                ) : (
                  <>
                    <Icon paths={I.check} size={15} strokeWidth={2.5} />
                    {editingTemplate
                      ? t('templates.saveChanges', 'O\'zgarishlarni saqlash')
                      : t('templates.createAction', 'Shablonni yaratish')}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          DELETE TEMPLATE CONFIRM
      ============================================================ */}
      <GlassModal
        open={Boolean(deletingTemplate)}
        onClose={() => setDeletingTemplate(null)}
        title={t('templates.deleteTitle', 'Shablonni o\'chirish')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3.5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
              <Icon paths={I.warning} size={19} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-red-600 dark:text-red-400">
                {t('templates.deleteConfirm', `"${deletingTemplate?.name ?? ''}" shablonini o‘chirmoqchimisiz?`)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('templates.deleteHint', 'Bu amalni qaytarib bo‘lmaydi. Ushbu shablon asosida yaratilgan mavjud sertifikatlar saqlanib qoladi.')}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-black/[0.08] dark:border-white/[0.08] pt-4">
            <GlassButton
              variant="secondary"
              onClick={() => setDeletingTemplate(null)}
              disabled={deleteTemplate.isPending}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="danger"
              onClick={() => deletingTemplate && deleteTemplate.mutate(deletingTemplate.id)}
              disabled={deleteTemplate.isPending}
              className="min-h-[44px]"
            >
              <span className="inline-flex items-center gap-2">
                {deleteTemplate.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('templates.deleting', 'O\'chirilmoqda...')}
                  </>
                ) : (
                  <>
                    <Icon paths={I.trash} size={15} strokeWidth={2.4} />
                    {t('templates.deleteAction', 'Ha, o\'chirilsin')}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          CERTIFICATE PREVIEW MODAL (3D Holographic Tilt Card)
      ============================================================ */}
      <GlassModal
        open={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        title={t('certificates.previewTitle', 'Sertifikat Namoyishi — M-EDU rasmiy hujjati')}
        wide
      >
        {previewCert && (
          <div className="space-y-6">
            {/* 3D Holographic Tilt Card */}
            <TiltCertificate
              data={{
                certificateNumber: previewCert.certificateNumber,
                verificationCode: previewCert.verificationCode,
                organizationName: ((previewCert as unknown as Record<string, unknown>).organization as { name?: string } | undefined)?.name || 'M-EDU ZAMONAVIY TA\'LIM AKADEMIYASI',
                student: {
                  name: getStudentName(previewCert.studentId),
                },
                course: {
                  name: previewCert.course?.name || getCourseName(previewCert.courseId),
                },
                issueDate: previewCert.issueDate,
                directorName: (((previewCert as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined)?.directorName as string) || 'Markaz Rahbari',
                instructorName: (((previewCert as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined)?.instructorName as string) || 'Katta O\'qituvchi',
              }}
            />

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.08] dark:border-white/[0.08] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Copy Verification Link */}
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    playTick();
                    if (typeof window !== 'undefined') {
                      const url = `${window.location.origin}/verify/${previewCert.verificationCode}`;
                      navigator.clipboard.writeText(url);
                      push({
                        type: 'success',
                        message: t('certificates.linkCopied', 'Tasdiqlash havolasi nusxalandi!'),
                      });
                    }
                  }}
                  className="min-h-[44px]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon paths={I.copy} size={15} strokeWidth={2.2} />
                    {t('certificates.copyLink', 'Havolani nusxalash')}
                  </span>
                </GlassButton>

                {/* Open in Verification Portal */}
                <a
                  href={`/verify/${previewCert.verificationCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-purple-500/20 bg-purple-500/10 px-3.5 text-xs font-bold text-purple-600 transition-colors hover:bg-purple-500/20 dark:text-purple-400"
                >
                  <Icon paths={I.external} size={14} strokeWidth={2.2} />
                  {t('certificates.openPortal', 'Portalda ochish')}
                </a>

                {/* Print button */}
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    playTick();
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="min-h-[44px]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon paths={I.printer} size={15} strokeWidth={2.2} />
                    {t('certificates.printAction', 'Chop etish (Print)')}
                  </span>
                </GlassButton>
              </div>

              <div className="flex items-center gap-2">
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    playTick();
                    downloadCertificate.mutate(previewCert.id);
                  }}
                  disabled={downloadingId === previewCert.id}
                  className="min-h-[44px]"
                >
                  <span className="inline-flex items-center gap-2">
                    {downloadingId === previewCert.id ? (
                      <motion.span
                        className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <Icon paths={I.download} size={15} strokeWidth={2.2} />
                    )}
                    {downloadingId === previewCert.id
                      ? t('certificates.downloading', 'Yuklanmoqda...')
                      : t('certificates.downloadPdf', 'Rasmiy PDF yuklab olish')}
                  </span>
                </GlassButton>

                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreviewCert(null)}
                  className="min-h-[44px]"
                >
                  {t('common.close', 'Yopish')}
                </GlassButton>
              </div>
            </div>
          </div>
        )}
      </GlassModal>

      {/* Floating Action Island for Bulk Certificate Operations */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClear={() => {
          playTick();
          clearSelection();
        }}
        actions={[
          {
            label: t('certificates.batchDownload', 'Barchasini yuklab olish'),
            icon: '📥',
            onClick: handleBatchDownloadCertificates,
            variant: 'primary',
            shortcutBadge: 'd',
          },
          {
            label: t('certificates.batchCopyLinks', 'Havolalarni nusxalash'),
            icon: '🔗',
            onClick: handleBatchCopyLinks,
            shortcutBadge: 'c',
          },
          {
            label: t('certificates.batchExportCsv', 'Eksport (CSV)'),
            icon: '📊',
            onClick: handleExportSelectedCertificatesCSV,
            shortcutBadge: 'e',
          },
        ]}
      />

      {/* Executive PDF Studio Modal */}
      <DigitalCredentialIssuerModal
        isOpen={isCredentialIssuerOpen}
        onClose={() => setIsCredentialIssuerOpen(false)}
      />

      <ExecutivePDFStudio
        open={Boolean(studioCertificate)}
        onClose={() => setStudioCertificate(null)}
        initialData={studioDocData}
      />
    </motion.div>
  );
}

export default CertificatesPage;
