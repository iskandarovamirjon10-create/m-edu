/**
 * M-EDU LibraryPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient library tile + live chips (Total/In Stock)
 *  - Ambient gradient orbs (blue + purple drift) — consistent with suite
 *  - Animated KPI bar (Total, Available, Categories, In Stock %) with count-up
 *  - Premium card rows with book-cover gradient + category chip + availability
 *  - Squircle FieldIcons in modal
 *  - Shimmer skeletons (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { libraryApi } from '@/lib/api';
import {
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassTextArea,
  GlassField,
  GlassErrorState,
  GlassButton,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, LibraryBook } from '@/lib/types';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
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
  library: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  bookOpen: [
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
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
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  hash: [
    'M4 9h16', 'M4 15h16',
    'M10 3 8 21', 'M16 3l-2 18',
  ],
  tag: [
    'M20.59 13.41 12 22l-8.59-8.59A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.41.59L22 12a2 2 0 0 1 0 2.83z',
    'M7 7h.01',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  pin: [
    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  globe: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  image: [
    'M3 3h18v18H3z',
    'M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'M21 15l-5-5L5 21',
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

const CATEGORY_TONES: Tone[] = ['blue', 'purple', 'emerald', 'orange', 'cyan', 'red', 'green', 'amber'];

const CATEGORY_TONE_MAP: Record<string, Tone> = {
  FICTION: 'purple',
  NON_FICTION: 'blue',
  REFERENCE: 'cyan',
  EDUCATIONAL: 'emerald',
  SCIENCE: 'blue',
  HISTORY: 'amber',
  BIOGRAPHY: 'orange',
  TECHNOLOGY: 'cyan',
  BUSINESS: 'emerald',
  ART: 'purple',
  OTHER: 'gray',
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface BookFormState {
  title: string;
  author: string;
  isbn: string;
  barcode: string;
  category: string;
  quantity: string;
  location: string;
  publisher: string;
  publishedYear: string;
  language: string;
  description: string;
  coverImage: string;
}

const INITIAL_FORM: BookFormState = {
  title: '',
  author: '',
  isbn: '',
  barcode: '',
  category: '',
  quantity: '1',
  location: '',
  publisher: '',
  publishedYear: '',
  language: '',
  description: '',
  coverImage: '',
};

const CATEGORIES = [
  'FICTION',
  'NON_FICTION',
  'REFERENCE',
  'EDUCATIONAL',
  'SCIENCE',
  'HISTORY',
  'BIOGRAPHY',
  'TECHNOLOGY',
  'BUSINESS',
  'ART',
  'OTHER',
];

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function validateBookForm(form: BookFormState): Partial<Record<keyof BookFormState, string>> {
  const errors: Partial<Record<keyof BookFormState, string>> = {};

  if (!form.title.trim()) errors.title = 'library.form.validation.titleRequired';
  if (!form.barcode.trim()) errors.barcode = 'library.form.validation.barcodeRequired';
  if (!form.category.trim()) errors.category = 'library.form.validation.categoryRequired';
  if (form.quantity && (isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 1)) {
    errors.quantity = 'library.form.validation.quantityMin';
  }

  return errors;
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const BOOK_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function bookGradient(title: string): string {
  const [a, b] = BOOK_PALETTES[nameHash(title) % BOOK_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function categoryTone(category: string): Tone {
  return CATEGORY_TONE_MAP[category] ?? CATEGORY_TONES[nameHash(category) % CATEGORY_TONES.length];
}

function bookInitials(title: string): string {
  return (title
    .split(/\s+/)
    .filter((w) => !['the', 'a', 'an', 'of', 'and', '&'].includes(w.toLowerCase()))
    .map((w) => w.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || title.charAt(0).toUpperCase());
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
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({
  value, duration = 1.1, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
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

  return <span className="tabular-nums">{n.toLocaleString()}{suffix}</span>;
}

function KpiTile({
  label, value, icon, tone = 'blue', stringValue,
}: {
  label: string;
  value?: number;
  icon: string[];
  tone?: Tone;
  stringValue?: string;
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
          {typeof value === 'number' ? <CountUp value={value} /> : stringValue}
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

function LibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[88px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#00000008] p-4 last:border-0 dark:border-[#ffffff08]">
            <Shimmer className="h-12 w-12" radius="0.75rem" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" radius="0.5rem" />
              <Shimmer className="h-3 w-32" radius="0.5rem" />
            </div>
            <Shimmer className="hidden h-6 w-20 sm:block" radius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Book cover tile — gradient derived from title */
function BookCover({ title, size = 48 }: { title: string; size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{
        width: size,
        height: size,
        background: bookGradient(title),
        fontSize: size * 0.32,
        letterSpacing: '0.02em',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
      />
      <span className="relative">{bookInitials(title)}</span>
    </div>
  );
}

/** Category chip — tone-aware */
function CategoryChip({ category, label }: { category: string; label: string }) {
  const tone = categoryTone(category);
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.tag} size={9} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** Availability badge with pulse */
function AvailabilityBadge({ available, total }: { available: number; total: number }) {
  const tone: Tone = available > 0 ? 'emerald' : 'red';
  const c = TONES[tone];
  const isAvailable = available > 0;
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isAvailable && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {available} / {total}
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
 * PAGE
 * ========================================================================== */

export function LibraryPage() {
  const { t } = useI18n();
  usePageTitle(t('library.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<BookFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BookFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────── */
  const books = useQuery({
    queryKey: ['library-books'],
    queryFn: () => libraryApi.listBooks({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = books.data as Paginated<LibraryBook> | undefined;
  const bookList = useMemo(() => data?.items || [], [data]);

  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return bookList;
    const q = searchQuery.toLowerCase();
    return bookList.filter(
      (book) =>
        book.title.toLowerCase().includes(q) ||
        book.author?.toLowerCase().includes(q) ||
        book.isbn?.toLowerCase().includes(q) ||
        book.barcode.toLowerCase().includes(q),
    );
  }, [bookList, searchQuery]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = bookList.length;
    const totalCopies = bookList.reduce((s, b) => s + (b.quantity || 0), 0);
    const availableCopies = bookList.reduce((s, b) => s + (b.availableQuantity || 0), 0);
    const categories = new Set(bookList.map((b) => b.category)).size;
    const inStockPct = totalCopies ? Math.round((availableCopies / totalCopies) * 100) : 0;
    return { total, totalCopies, availableCopies, categories, inStockPct };
  }, [bookList]);

  /* ── Save mutation ────────────────────────────────────────────────── */
  const saveBook = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        barcode: form.barcode.trim(),
        category: form.category.trim(),
        quantity: form.quantity ? parseInt(form.quantity) : 1,
      };

      if (form.author.trim()) payload.author = form.author.trim();
      if (form.isbn.trim()) payload.isbn = form.isbn.trim();
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.publisher.trim()) payload.publisher = form.publisher.trim();
      if (form.publishedYear) payload.publishedYear = parseInt(form.publishedYear);
      if (form.language.trim()) payload.language = form.language.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.coverImage.trim()) payload.coverImage = form.coverImage.trim();

      if (editingId) {
        return libraryApi.updateBook(editingId, payload);
      } else {
        return libraryApi.createBook(payload);
      }
    },
    onSuccess: () => {
      push('success', editingId ? t('library.bookUpdated') : t('library.bookCreated'));
      qc.invalidateQueries({ queryKey: ['library-books'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  /* ── Delete mutation ──────────────────────────────────────────────── */
  const deleteBook = useMutation({
    mutationFn: (id: string) => libraryApi.deleteBook(id),
    onSuccess: () => {
      push('success', t('library.bookDeleted'));
      qc.invalidateQueries({ queryKey: ['library-books'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const openModal = useCallback((book?: LibraryBook) => {
    if (book) {
      setEditingId(book.id);
      setForm({
        title: book.title,
        author: book.author || '',
        isbn: book.isbn || '',
        barcode: book.barcode,
        category: book.category,
        quantity: book.quantity.toString(),
        location: book.location || '',
        publisher: book.publisher || '',
        publishedYear: book.publishedYear?.toString() || '',
        language: book.language || '',
        description: book.description || '',
        coverImage: book.coverImage || '',
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
    const errors = validateBookForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveBook.mutate();
  }, [form, saveBook]);

  const handleFormField = useCallback(
    (field: keyof BookFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (books.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <LibrarySkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (books.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(books.error)}
            onRetry={() => books.refetch()}
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
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(175,82,222,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.library} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#AF52DE]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('library.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} titles
                </span>
                {stats.availableCopies > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                    {stats.availableCopies} in stock
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('library.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('library.pageDescription')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
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
                  {t('library.addBook')}
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
        <KpiTile label={t('library.title')} value={stats.total} icon={I.bookOpen} tone="blue" />
        <KpiTile
          label={t('library.col.available')}
          value={stats.availableCopies}
          icon={I.checkCircle}
          tone="emerald"
        />
        <KpiTile label={t('library.col.category')} value={stats.categories} icon={I.tag} tone="purple" />
        <KpiTile
          label="In Stock"
          stringValue={`${stats.inStockPct}%`}
          icon={I.book}
          tone="orange"
        />
      </motion.div>

      {/* ============================================================
          SEARCH TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div className="relative">
            <FieldIcon icon={I.search} tone="blue" />
            <GlassInput
              placeholder={t('library.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          BOOKS LIST
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
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        <AnimatePresence mode="wait">
          {filteredBooks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.smooth}
              className="relative p-10"
            >
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
                  {searchQuery ? t('library.emptySearch') : t('library.empty')}
                </p>
                <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                  {searchQuery
                    ? t('certificates.emptySearchHint')
                    : t('library.emptyMessage')}
                </p>
                {!searchQuery && (
                  <div className="mt-5">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <GlassButton
                        type="button"
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
                          {t('library.addBook')}
                        </span>
                      </GlassButton>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]"
            >
              {filteredBooks.map((book) => {
                const categoryKey = `library.category.${book.category}`;
                const categoryLabel = t(categoryKey);
                const displayCategory = categoryLabel === categoryKey
                  ? book.category.replace(/_/g, ' ')
                  : categoryLabel;

                return (
                  <motion.div
                    key={book.id}
                    variants={rowVariants}
                    className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#AF52DE]/[0.03]"
                  >
                    {/* Book cover */}
                    <BookCover title={book.title} size={48} />

                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {book.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                        {book.author && (
                          <span className="inline-flex items-center gap-1">
                            <Icon paths={I.user} size={10} strokeWidth={2.2} className="opacity-60" />
                            {book.author}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Icon paths={I.hash} size={10} strokeWidth={2.2} className="opacity-60" />
                          {book.barcode}
                        </span>
                        {book.location && (
                          <span className="inline-flex items-center gap-1">
                            <Icon paths={I.pin} size={10} strokeWidth={2.2} className="opacity-60" />
                            {book.location}
                          </span>
                        )}
                        <CategoryChip category={book.category} label={displayCategory} />
                      </div>
                    </div>

                    {/* Quantity + availability */}
                    <div className="hidden flex-col items-end sm:flex">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                        {t('library.col.quantity')}
                      </span>
                      <span className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {book.quantity}
                      </span>
                    </div>

                    <AvailabilityBadge
                      available={book.availableQuantity}
                      total={book.quantity}
                    />

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <motion.button
                        type="button"
                        onClick={() => openModal(book)}
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
                      <motion.button
                        type="button"
                        onClick={() => setDeleteTarget(book.id)}
                        disabled={deleteBook.isPending && deleteBook.variables === book.id}
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ============================================================
          DELETE CONFIRM
      ============================================================ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBook.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('library.confirmDelete')}
        loading={deleteBook.isPending}
      />

      {/* ============================================================
          BOOK FORM MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('library.editBook') : t('library.addBook')}
        wide
        footer={
          <>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="secondary"
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
                onClick={handleSubmit}
                disabled={saveBook.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  {saveBook.isPending ? (
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
                      <Icon
                        paths={editingId ? I.check : I.plus}
                        size={14}
                        strokeWidth={2.5}
                      />
                      {t('common.save')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </>
        }
      >
        <div className="space-y-5">
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#AF52DE33] bg-[#AF52DE]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#AF52DE]/15 text-[#AF52DE]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingId
                ? 'Update the book details. Changes are reflected immediately.'
                : 'Fill in the book details. Title, barcode, and category are required.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('library.form.title')}
              required
              error={formErrors.title ? t(formErrors.title) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.book} tone="blue" />
                <GlassInput
                  value={form.title}
                  onChange={handleFormField('title')}
                  placeholder={t('library.form.titlePlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.author')}>
              <div className="relative">
                <FieldIcon icon={I.user} tone="purple" />
                <GlassInput
                  value={form.author}
                  onChange={handleFormField('author')}
                  placeholder={t('library.form.authorPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.isbn')}>
              <div className="relative">
                <FieldIcon icon={I.hash} tone="cyan" />
                <GlassInput
                  value={form.isbn}
                  onChange={handleFormField('isbn')}
                  placeholder={t('library.form.isbnPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField
              label={t('library.form.barcode')}
              required
              error={formErrors.barcode ? t(formErrors.barcode) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.tag} tone="orange" />
                <GlassInput
                  value={form.barcode}
                  onChange={handleFormField('barcode')}
                  placeholder={t('library.form.barcodePlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField
              label={t('library.form.category')}
              required
              error={formErrors.category ? t(formErrors.category) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.layers} tone="emerald" />
                <GlassSelect
                  value={form.category}
                  onChange={handleFormField('category')}
                  className="pl-11"
                >
                  <option value="">{t('library.form.selectCategory')}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{t(`library.category.${cat}`)}</option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField
              label={t('library.form.quantity')}
              error={formErrors.quantity ? t(formErrors.quantity) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.layers} tone="green" />
                <GlassInput
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={handleFormField('quantity')}
                  placeholder="1"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.location')}>
              <div className="relative">
                <FieldIcon icon={I.pin} tone="red" />
                <GlassInput
                  value={form.location}
                  onChange={handleFormField('location')}
                  placeholder={t('library.form.locationPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.publisher')}>
              <div className="relative">
                <FieldIcon icon={I.building} tone="purple" />
                <GlassInput
                  value={form.publisher}
                  onChange={handleFormField('publisher')}
                  placeholder={t('library.form.publisherPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.publishedYear')}>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="amber" />
                <GlassInput
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={form.publishedYear}
                  onChange={handleFormField('publishedYear')}
                  placeholder="2024"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('library.form.language')}>
              <div className="relative">
                <FieldIcon icon={I.globe} tone="cyan" />
                <GlassInput
                  value={form.language}
                  onChange={handleFormField('language')}
                  placeholder={t('library.form.languagePlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <GlassField label={t('library.form.description')}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: TONES.gray.bg, color: TONES.gray.fg }}
                aria-hidden
              >
                <Icon paths={I.note} size={12} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                rows={3}
                value={form.description}
                onChange={handleFormField('description')}
                placeholder={t('library.form.descriptionPlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <GlassField label={t('library.form.coverImage')}>
            <div className="relative">
              <FieldIcon icon={I.image} tone="purple" />
              <GlassInput
                value={form.coverImage}
                onChange={handleFormField('coverImage')}
                placeholder={t('library.form.coverPlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>
        </div>
      </GlassModal>
    </motion.div>
  );
}