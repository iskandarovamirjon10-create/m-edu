/**
 * M-EDU DocumentsPage — 
 *
 * Module Features:
 *  - Hero header with gradient documents tile + live chips (total/categories)
 *  - Ambient gradient orbs — suite-consistent
 *  - Animated KPI bar (Total, Categories, Storage, Recent)
 *  - Premium filter toolbar with squircle leading icons
 *  - Premium document rows: file-type tile + category chip + tags + meta
 *  - Icon-only actions (open / edit / delete)
 *  - Premium modal with squircle FieldIcons + validation
 *  - Shimmer skeleton (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved (queries, mutations, validators, i18n)
 */

import { formatDate } from '@/lib/format';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import {
  GlassErrorState,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTextArea,
  GlassModal,
  GlassField,
  ConfirmDialog,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useToast } from '@/components/ui/GlassToast';
import { documentsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

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
  documents: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h5',
  ],
  filePdf: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 13h1.5a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9v-2z',
    'M9 17h1',
    'M13 13v4',
  ],
  fileImage: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 15l2-2 3 3 2-2 3 3',
    'M10 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  ],
  fileCode: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M10 13l-2 2 2 2',
    'M14 13l2 2-2 2',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
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
  externalLink: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  tag: [
    'M20.59 13.41 12 22l-8.59-8.59A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.41.59L22 12a2 2 0 0 1 0 2.83z',
    'M7 7h.01',
  ],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'indigo';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)' },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  indigo:  { fg: '#6366F1', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)' },
};

const CATEGORY_TONE: Record<string, Tone> = {
  CONTRACT: 'blue',
  ID: 'cyan',
  CERTIFICATE: 'emerald',
  REPORT: 'purple',
  INVOICE: 'orange',
  POLICY: 'indigo',
  CURRICULUM: 'green',
  MEDIA: 'purple',
  OTHER: 'gray',
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  tags?: string[];
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  expiresAt?: string;
}

const CATEGORIES = [
  { value: '', labelKey: 'documents.category.all' },
  { value: 'CONTRACT', labelKey: 'documents.category.CONTRACT' },
  { value: 'ID', labelKey: 'documents.category.ID' },
  { value: 'CERTIFICATE', labelKey: 'documents.category.CERTIFICATE' },
  { value: 'REPORT', labelKey: 'documents.category.REPORT' },
  { value: 'INVOICE', labelKey: 'documents.category.INVOICE' },
  { value: 'POLICY', labelKey: 'documents.category.POLICY' },
  { value: 'CURRICULUM', labelKey: 'documents.category.CURRICULUM' },
  { value: 'MEDIA', labelKey: 'documents.category.MEDIA' },
  { value: 'OTHER', labelKey: 'documents.category.OTHER' },
];

const CREATE_CATEGORIES = CATEGORIES.filter((c) => c.value !== '');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CreateForm {
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  tags: string;
}

const EMPTY_FORM: CreateForm = {
  title: '',
  description: '',
  category: 'OTHER',
  fileUrl: '',
  mimeType: 'application/octet-stream',
  fileSize: 0,
  tags: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function fileIconForMime(mime: string): string[] {
  if (!mime) return I.file;
  if (mime.includes('pdf')) return I.filePdf;
  if (mime.startsWith('image/')) return I.fileImage;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('code')) return I.fileCode;
  return I.file;
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DOC_PALETTES = [
  ['#2563EB', '#6366F1'],
  ['#6366F1', '#FF2D55'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#FF2D55'],
  ['#6366F1', '#6366F1'],
  ['#0284C7', '#2563EB'],
];

function docGradient(title: string): string {
  const palette = DOC_PALETTES[Math.abs(nameHash(title || '')) % DOC_PALETTES.length] || DOC_PALETTES[0];
  const [a, b] = palette;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return <AuroraMesh variant="subtle" />;
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
  label, value, icon, tone = 'blue', stringValue,
}: {
  label: string; value?: number; icon: string[]; tone?: Tone; stringValue?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
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
          {typeof value === 'number' ? <CountUp value={value} /> : stringValue}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
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

function DocumentsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-black/[0.06] p-4 last:border-0 dark:border-white/[0.08]">
            <Shimmer className="h-12 w-12" radius="0.75rem" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" radius="0.5rem" />
              <Shimmer className="h-3 w-32" radius="0.5rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTypeTile({ title, mime }: { title: string; mime: string }) {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
      style={{
        background: docGradient(title),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
      />
      <Icon paths={fileIconForMime(mime)} size={20} strokeWidth={2} className="relative" />
    </div>
  );
}

function CategoryChip({ category, label }: { category: string; label: string }) {
  const tone = CATEGORY_TONE[category] ?? 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <Icon paths={I.tag} size={9} strokeWidth={2.4} />
      {label}
    </span>
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

function TextAreaFieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
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

export function DocumentsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('documents.title'));
  const queryClient = useQueryClient();
  const toast = useToast();
  const { playPop } = usePremiumSound();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenDocSidecar = (doc: Document) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: doc.id,
      title: doc.title,
      subtitle: `${doc.category} · v${doc.version}`,
      badge: {
        text: doc.category,
        tone: 'blue',
      },
      metrics: [
        { label: 'Hajmi', value: formatSize(doc.fileSize) },
        { label: 'Versiya', value: `v${doc.version}` },
        { label: 'Format', value: doc.mimeType.split('/')[1]?.toUpperCase() || 'FILE' },
      ],
      details: [
        { label: 'Hujjat ID', value: doc.id, copyable: true },
        { label: 'Nomi', value: doc.title },
        { label: 'Kategoriya', value: doc.category },
        { label: 'Tavsif', value: doc.description || '—' },
        { label: 'MIME Type', value: doc.mimeType },
        { label: 'Yuklangan', value: formatDate(doc.uploadedAt) },
        { label: 'Yuklagan', value: doc.uploadedBy || 'Tizim' },
        { label: 'Teglar', value: doc.tags?.join(', ') || '—' },
      ],
      primaryAction: {
        label: t('common.open') || 'Ochish',
        onExecute: () => {
          window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
        },
      },
    };
    openSidecar(sidecarData);
  };

  /* ── Queries ──────────────────────────────────────────────────────── */
  const docsQuery = useQuery({
    queryKey: ['documents', search, category],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      return documentsApi.list(params) as Promise<{ items: Document[]; total: number }>;
    },
  });

  /* ── Mutations ────────────────────────────────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      toast.success(t('documents.deleted'));
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(t('documents.deleteFailed'), getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateForm, 'tags'> & { tags: string[] }) =>
      editingId
        ? documentsApi.update(editingId, data)
        : documentsApi.create(data),
    onSuccess: () => {
      toast.success(editingId ? t('documents.updated') : t('documents.added'));
      setCreateOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const items: Document[] = docsQuery.data?.items ?? [];

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = items.length;
    const categories = new Set(items.map((d) => d.category)).size;
    const totalSize = items.reduce((sum, d) => sum + (d.fileSize || 0), 0);
    const now = new Date();
    const recent = items.filter((d) => {
      if (!d.uploadedAt) return false;
      const diff = now.getTime() - new Date(d.uploadedAt).getTime();
      return diff < 1000 * 60 * 60 * 24 * 7; // last 7 days
    }).length;
    return { total, categories, totalSize, recent };
  }, [items]);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError(t('homework.titleRequired'));
      return;
    }
    if (!form.fileUrl.trim()) {
      setFormError(t('documents.fileUrlRequired'));
      return;
    }
    try {
      new URL(form.fileUrl.trim());
    } catch {
      setFormError(t('documents.fileUrlInvalid'));
      return;
    }
    const tags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    setFormError(null);
    const { tags: tagsCsv, ...rest } = form;
    void tagsCsv;
    createMutation.mutate({
      ...rest,
      title: form.title.trim(),
      fileUrl: form.fileUrl.trim(),
      tags,
    });
  };

  const openCreate = () => {
    setCreateOpen(true);
    setEditingId(null);
    setFormError(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (doc: Document) => {
    setEditingId(doc.id);
    setForm({
      title: doc.title,
      description: doc.description || '',
      category: doc.category,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      tags: (doc.tags || []).join(', '),
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const closeModal = () => {
    setCreateOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (docsQuery.isLoading && !docsQuery.data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card" />
        <DocumentsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (docsQuery.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('documents.loadFailed')}
            message={getErrorMessage(docsQuery.error)}
            onRetry={() => docsQuery.refetch()}
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
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AmbientOrbs />
      {toast.toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
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
                background: 'linear-gradient(135deg, #0284C7 0%, #6366F1 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(2,132,199,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.documents} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0284C7]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0284C7]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('documents.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} files
                </span>
                {stats.recent > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {stats.recent} new this week
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('documents.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
                {t('documents.pageSubtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
                onClick={openCreate}
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
                  {t('documents.add')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      {items.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile label={t('documents.title')} value={stats.total} icon={I.documents} tone="cyan" />
          <KpiTile label="Categories" value={stats.categories} icon={I.layers} tone="purple" />
          <KpiTile
            label="Total size"
            stringValue={formatSize(stats.totalSize)}
            icon={I.database}
            tone="orange"
          />
          <KpiTile label="Recent 7d" value={stats.recent} icon={I.clock} tone="emerald" />
        </motion.div>
      )}

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="blue" />
              <GlassInput
                placeholder={t('documents.searchPlaceholder')}
                aria-label={t('documents.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                className="pl-11"
              />
            </div>
            <div className="relative sm:w-56">
              <FieldIcon icon={I.filter} tone="orange" />
              <GlassSelect
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t('documents.filterByCategory')}
                className="pl-11"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </GlassSelect>
            </div>
            <div className="text-[12.5px] font-semibold tabular-nums text-[#64748B] sm:ml-2 sm:shrink-0">
              {docsQuery.data ? t('documents.count', { n: docsQuery.data.total }) : '—'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          DOCUMENTS LIST
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
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

        {items.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0284C7]/10 text-[#0284C7]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(2,132,199,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {search || category ? t('documents.emptySearch') : t('documents.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#64748B]">
                {search || category
                  ? t('documents.emptySearchMessage')
                  : t('documents.emptyMessage')}
              </p>
              {!search && !category && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={openCreate}
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
                        {t('documents.add')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
            {items.map((doc, idx) => {
              const categoryKey = `documents.category.${doc.category}`;
              const categoryLabel = t(categoryKey);
              const displayCategory = categoryLabel === categoryKey ? doc.category : categoryLabel;

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#0284C7]/[0.03]"
                >
                  <FileTypeTile title={doc.title} mime={doc.mimeType} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {doc.title}
                      </p>
                      <CategoryChip category={doc.category} label={displayCategory} />
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        style={{
                          background: 'rgba(0,0,0,0.04)',
                          color: '#64748B',
                        }}
                      >
                        v{doc.version}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="mt-0.5 truncate text-[11.5px] font-medium text-[#64748B]">
                        {doc.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#64748B]">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.database} size={10} strokeWidth={2.2} className="opacity-60" />
                        {formatSize(doc.fileSize)}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                        {formatDate(doc.uploadedAt)}
                      </span>
                      {doc.tags && doc.tags.length > 0 && (
                        <span className="flex flex-wrap items-center gap-1">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: 'rgba(99,102,241,0.10)',
                                color: '#6366F1',
                              }}
                            >
                              <Icon paths={I.tag} size={8} strokeWidth={2.4} />
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span
                              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: 'rgba(0,0,0,0.04)',
                                color: '#64748B',
                              }}
                            >
                              +{doc.tags.length - 3}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenDocSidecar(doc)}
                      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-black/[0.08] bg-black/[0.03] text-xs font-semibold text-slate-700 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:text-sky-400 transition-all shadow-sm"
                      title="macOS Split-View Sidecar (◨)"
                    >
                      <span className="text-sm">◨</span>
                    </button>
                    <motion.button
                      type="button"
                      onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                      whileHover={{ scale: 1.08, y: -1 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.open')}
                      title={t('common.open')}
                      className="flex h-11 w-11 items-center justify-center rounded-xl outline-none"
                      style={{
                        background: 'rgba(2,132,199,0.10)',
                        color: '#0284C7',
                        border: '1px solid rgba(2,132,199,0.2)',
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <Icon paths={I.externalLink} size={15} strokeWidth={2} />
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => openEdit(doc)}
                      disabled={createMutation.isPending}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.edit')}
                      title={t('common.edit')}
                      className="flex h-11 w-11 items-center justify-center rounded-xl outline-none disabled:opacity-50"
                      style={{
                        background: 'rgba(37,99,235,0.10)',
                        color: '#2563EB',
                        border: '1px solid rgba(37,99,235,0.2)',
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <Icon paths={I.edit} size={15} strokeWidth={2} />
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                      disabled={deleteMutation.isPending}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      className="flex h-11 w-11 items-center justify-center rounded-xl outline-none disabled:opacity-50"
                      style={{
                        background: 'rgba(239,68,68,0.10)',
                        color: '#EF4444',
                        border: '1px solid rgba(239,68,68,0.2)',
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
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ============================================================
          DELETE CONFIRM
      ============================================================ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        description={
          deleteTarget
            ? t('documents.deleteConfirm', { title: deleteTarget.title })
            : ''
        }
        loading={deleteMutation.isPending}
      />

      {/* ============================================================
          CREATE / EDIT MODAL
      ============================================================ */}
      <GlassModal
        open={createOpen}
        onClose={closeModal}
        title={editingId ? t('documents.editTitle') : t('documents.add')}
        wide
      >
        <form onSubmit={handleCreate} className="space-y-5" noValidate>
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#0284C733] bg-[#0284C7]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0284C7]/15 text-[#0284C7]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingId
                ? 'Update the document metadata. Changes apply immediately.'
                : 'Upload a new document. Title and file URL are required.'}
            </p>
          </div>

          {/* Title */}
          <GlassField label={t('documents.field.title')} required>
            <div className="relative">
              <FieldIcon icon={I.documents} tone="cyan" />
              <GlassInput
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t('documents.titlePlaceholder')}
                disabled={createMutation.isPending}
                className="pl-11"
                autoFocus
              />
            </div>
          </GlassField>

          {/* Description */}
          <GlassField label={t('documents.field.description')}>
            <div className="relative">
              <TextAreaFieldIcon icon={I.note} tone="gray" />
              <GlassTextArea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('common.optional')}
                disabled={createMutation.isPending}
                rows={2}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Category */}
            <GlassField label={t('documents.field.category')}>
              <div className="relative">
                <FieldIcon icon={I.tag} tone="purple" />
                <GlassSelect
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  disabled={createMutation.isPending}
                  className="pl-11"
                >
                  {CREATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            {/* MIME type */}
            <GlassField label={t('documents.field.mimeType')}>
              <div className="relative">
                <FieldIcon icon={I.fileCode} tone="indigo" />
                <GlassInput
                  value={form.mimeType}
                  onChange={(e) => setForm((f) => ({ ...f, mimeType: e.target.value }))}
                  placeholder="application/pdf"
                  disabled={createMutation.isPending}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          {/* File URL */}
          <GlassField label={t('documents.field.fileUrl')} required>
            <div className="relative">
              <FieldIcon icon={I.link} tone="blue" />
              <GlassInput
                value={form.fileUrl}
                onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://storage.example.com/files/contract.pdf"
                disabled={createMutation.isPending}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* File size */}
            <GlassField label={t('documents.field.fileSize')}>
              <div className="relative">
                <FieldIcon icon={I.database} tone="orange" />
                <GlassInput
                  type="number"
                  min={0}
                  value={form.fileSize || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fileSize: Number(e.target.value) || 0 }))
                  }
                  placeholder="0"
                  disabled={createMutation.isPending}
                  className="pl-11"
                />
              </div>
            </GlassField>

            {/* Tags */}
            <GlassField label={t('documents.field.tags')} hint={t('documents.tagsHint')}>
              <div className="relative">
                <FieldIcon icon={I.tag} tone="emerald" />
                <GlassInput
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="contract, 2026"
                  disabled={createMutation.isPending}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          {formError && (
            <p className="text-sm font-medium" style={{ color: 'var(--state-error)' }} role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={createMutation.isPending}
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
              <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
                <span className="inline-flex items-center gap-2">
                  {createMutation.isPending ? (
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
                      {editingId ? t('common.save') : t('documents.add')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>
    </motion.div>
  );
}