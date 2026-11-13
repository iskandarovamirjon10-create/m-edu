/**
 * M-EDU GamificationHub — v2 (Senior rewrite)
 *
 * Asosiy o'zgarishlar (v1 → v2):
 *  · Soxta ma'lumotlar olib tashlandi (streak||5, rank||1, rankTotal||128, daysRemaining||5, level||7)
 *  · XP / level hisob-kitobi bitta manbadan (computeLevelProgress) — progress bar va "x / y" endi mos
 *  · Klaviatura: Ctrl/Cmd+R brauzer yangilashini buzmaydi; 1–4 tablar, "/" qidiruv, "R" yangilash
 *  · Tab holati URL'da (?tab=store) — ulashish va "orqaga" tugmasi ishlaydi; ARIA tablist + ←/→
 *  · Confetti/zarralar render paytida Math.random() ishlatmaydi (useMemo), reduced-motion hurmat qilinadi
 *  · Sotib olish: tasdiqlash dialogi, optimistik coin ayirish + rollback, ikki marta bosishdan himoya
 *  · Kupon kodi faqat xariddan keyin ko'rsatiladi (copy tugmasi bilan)
 *  · Level-up marosimi, XP faqat OSHGANDA zarralar, animatsiyalangan sanoqlar
 *  · Haqiqiy kunlik check-in mantiqi (lastCheckIn + streak), check-in tugmasi
 *  · Liga yo'li: keyingi ligagacha qancha XP qolgani, mavsum progress bari
 *  · Sevimlilar (wishlist) + "maqsad" progress, saralash, "faqat olish mumkinlari", deferred qidiruv
 *  · Reyting: davr (hafta/oy/hammasi), "Siz" belgisi, o'z o'rningiz podiumdan tashqarida bo'lsa ham ko'rinadi
 *  · Natijani ulashish (Web Share / clipboard)
 *  · Har bir so'rov uchun xato holati + qayta urinish; skeleton'lar
 *  · Admin forma: validatsiya, rasm hajmi chegarasi, nofaol sovrinlar yashiriladi
 *  · Navigatsiya: window.location.href o'rniga navigate() (to'liq sahifa qayta yuklanmaydi)
 *
 * Backend bilan bog'liq (ixtiyoriy) kutilgan maydonlar — fayl oxiridagi izohga qarang.
 */

import { useAuth } from '@/auth/AuthContext';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassPageHeader } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlassModal } from '@/components/ui/GlassModal';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { StudentSkillConstellationStudio } from '@/components/gamification/StudentSkillConstellationStudio';
import request from '@/lib/api';

/* ══════════════════════════════════════════════════════════════════
 * 1. TYPES & CONFIG
 * ══════════════════════════════════════════════════════════════════ */

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type LeagueZone = 'PROMOTION' | 'SAFE' | 'RELEGATION';
type LeaderboardPeriod = 'week' | 'month' | 'all';
type RewardSort = 'default' | 'price-asc' | 'price-desc';

export const TIER_ORDER: readonly LeagueTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

export const LEAGUE_CONFIG: Record<
  LeagueTier,
  { name: string; icon: string; minXp: number; color: string; badgeBg: string; perk: string }
> = {
  BRONZE: { name: 'Bronza Ligasi', icon: '🥉', minXp: 0, color: '#CD7F32', badgeBg: 'rgba(205,127,50,0.15)', perk: 'Boshlang‘ich daraja, har bir dars uchun standart XP' },
  SILVER: { name: 'Kumush Ligasi', icon: '🥈', minXp: 300, color: '#94A3B8', badgeBg: 'rgba(148,163,184,0.15)', perk: '+5% qo‘shimcha coinlar bonus va kumush nishon' },
  GOLD: { name: 'Oltin Ligasi', icon: '🥇', minXp: 700, color: '#F59E0B', badgeBg: 'rgba(245,158,11,0.15)', perk: '+10% coinlar va do‘konda eksklyuziv chegirmalar' },
  PLATINUM: { name: 'Platina Ligasi', icon: '💠', minXp: 1500, color: '#06B6D4', badgeBg: 'rgba(6,182,212,0.15)', perk: '+15% coinlar, mentor bilan VIP chat sessiyasi' },
  DIAMOND: { name: 'Olmos Ligasi', icon: '💎', minXp: 3000, color: '#8B5CF6', badgeBg: 'rgba(139,92,246,0.15)', perk: '+25% coinlar, premium chempionlik avatar ramkasi' },
};

export interface LeagueItem {
  tier: LeagueTier;
  name: string;
  icon: string;
  minXp: number;
  color: string;
  badgeBg: string;
  perk: string;
  studentsCount: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  xp: number;
  coins: number;
  icon: string;
  /** ixtiyoriy: backend progress qaytarsa ko'rsatiladi */
  progress?: { current: number; total: number };
  completed?: boolean;
}

export interface LeagueOverviewResponse {
  season: {
    id: string;
    title: string;
    daysRemaining: number;
    totalDays: number;
    promotionZonePct: number;
    relegationZonePct: number;
  };
  leagues: LeagueItem[];
  dailyQuests: DailyQuest[];
  myLeague?: { tier: LeagueTier; xp: number; coins: number; level: number } | null;
}

interface StudentStats {
  xp: number;
  coins: number;
  level: number;
  xpToNextLevel: number;
  /** ixtiyoriy: bitta level necha XP ekani (default 100) */
  levelSpan?: number;
  rank: number | null;
  rankTotal: number;
  streak?: number;
  lastCheckIn?: string | null;
  purchasesCount?: number;
  league?: LeagueTier;
  zone?: LeagueZone;
  seasonDaysRemaining?: number;
}

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  avatar: string | null;
  groupId: string | null;
  groupName: string | null;
  xp: number;
  coins: number;
  level: number;
  league?: LeagueTier;
  zone?: LeagueZone;
}

interface RewardItem {
  id: string;
  title: string;
  description: string;
  costCoins: number;
  type?: 'PRODUCT' | 'COUPON' | string;
  category: string;
  icon: string;
  imageUrl?: string | null;
  stock?: number | null;
  couponCode?: string | null;
  isActive?: boolean;
}

interface ClaimResponse {
  message?: string;
  couponCode?: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: { current: number; total: number };
}

const LEVEL_SPAN_DEFAULT = 100;
const MAX_IMAGE_BYTES = 1_500_000;

const CATEGORY_LABELS: Record<string, string> = {
  MERCH: 'Merch / Kiyim',
  DISCOUNT: 'Chegirma',
  BOOK: 'Kitoblar',
  PERK: 'Imtiyozlar',
  OTHER: 'Boshqa',
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'Hafta',
  month: 'Oy',
  all: 'Hammasi',
};

const TABS = [
  { id: 'leaderboard', icon: '🏆', label: 'Reyting' },
  { id: 'leagues', icon: '🛡️', label: 'Ligalar & Mavsum' },
  { id: 'store', icon: '🛍️', label: 'M-Coins Do‘koni' },
  { id: 'skillTree', icon: '⚡', label: 'Mahorat shajarasi' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const QUERY_KEYS = {
  me: ['gamification-me'] as const,
  leaderboard: (period: LeaderboardPeriod) => ['gamification-leaderboard', period] as const,
  leagues: ['gamification-leagues'] as const,
  rewards: ['gamification-rewards'] as const,
  orgStats: ['gamification-org-stats'] as const,
};

/* ══════════════════════════════════════════════════════════════════
 * 2. PURE HELPERS (test qilish oson — hech qanday React yo'q)
 * ══════════════════════════════════════════════════════════════════ */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const fmt = (n: number) => n.toLocaleString('uz-UZ');
const isTabId = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

/** XP/level progress — progress bar, halqa va "x / y" matni BIR manbadan hisoblanadi. */
export function computeLevelProgress(xp: number, xpToNext: number, levelSpan = LEVEL_SPAN_DEFAULT) {
  const span = Math.max(1, levelSpan);
  const remaining = clamp(xpToNext, 0, span);
  return {
    pct: clamp(((span - remaining) / span) * 100, 0, 100),
    remaining,
    nextThreshold: xp + remaining,
  };
}

export function getLeagueProgress(xp: number, serverTier?: LeagueTier | null) {
  const derived = [...TIER_ORDER].reverse().find((t) => xp >= LEAGUE_CONFIG[t].minXp) ?? 'BRONZE';
  const tier = serverTier ?? derived;
  const next = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1] ?? null;
  if (!next) return { tier, next: null as LeagueTier | null, pct: 100, remaining: 0 };
  const from = LEAGUE_CONFIG[tier].minXp;
  const to = LEAGUE_CONFIG[next].minXp;
  return {
    tier,
    next: next as LeagueTier | null,
    pct: clamp(((xp - from) / Math.max(1, to - from)) * 100, 0, 100),
    remaining: Math.max(0, to - xp),
  };
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Haftaning (Du…Ya) har bir kuni uchun check-in holati. */
export function buildWeekStatus(streak: number, lastCheckIn?: string | null, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 = Du
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);

  let checkedToday: boolean;
  let lastDay: Date | null;
  if (lastCheckIn) {
    const parsed = new Date(lastCheckIn);
    lastDay = Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    checkedToday = lastDay ? dayKey(lastDay) === dayKey(today) : false;
  } else {
    // backend lastCheckIn bermasa — streak > 0 bo'lsa bugun belgilangan deb olamiz
    checkedToday = streak > 0;
    lastDay = streak > 0 ? today : null;
  }

  const labels = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  const days = labels.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const diff = lastDay ? Math.round((lastDay.getTime() - date.getTime()) / 86_400_000) : -1;
    return {
      label,
      isToday: i === dow,
      isFuture: date.getTime() > today.getTime(),
      done: diff >= 0 && diff < streak,
    };
  });
  return { days, checkedToday };
}

/* ══════════════════════════════════════════════════════════════════
 * 3. MOTION TOKENS & HOOKS
 * ══════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Raqam o'zgarganda silliq sanash (reduced-motion bo'lsa — darhol). */
function useCountUp(target: number, duration = 900) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    if (reduce || valueRef.current === target) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const from = valueRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      valueRef.current = Math.round(from + (target - from) * eased);
      setValue(valueRef.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  return value;
}

/** Faqat qiymat OSHGANDA (birinchi yuklashda emas) true bo'ladigan trigger. */
function useIncreaseTrigger(value: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    if (value === undefined) return;
    if (prev.current !== undefined && value > prev.current) setTrigger(Date.now());
    prev.current = value;
  }, [value]);
  return trigger;
}

/** localStorage'da Set saqlash (try/catch — private mode va SSR uchun xavfsiz). */
function usePersistentSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });

  const toggle = useCallback(
    (id: string) => {
      setSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* storage to'la yoki o'chirilgan — jim o'tamiz */
        }
        return next;
      });
    },
    [key],
  );

  return [set, toggle] as const;
}

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(pattern);
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════
 * 4. PRIMITIVES
 * ══════════════════════════════════════════════════════════════════ */

function LiquidGlass({
  children,
  className = '',
  radius = '1.5rem',
  tint = 'transparent',
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  radius?: string;
  tint?: string;
  elevated?: boolean;
}) {
  return (
    <div
      className={`liquid-glass-card liquid-glass-surface relative overflow-hidden transition-all duration-300 ${
        elevated ? 'shadow-xl -translate-y-0.5' : 'shadow-sm'
      } ${className}`}
      style={{ borderRadius: radius }}
    >
      {tint !== 'transparent' && (
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ borderRadius: radius, background: tint }} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function ProgressBar({ pct, tone = 'indigo', label }: { pct: number; tone?: 'indigo' | 'amber' | 'emerald'; label: string }) {
  const reduce = useReducedMotion();
  const gradient = {
    indigo: 'linear-gradient(90deg, #5E5CE6 0%, #6366F1 100%)',
    amber: 'linear-gradient(90deg, #F59E0B 0%, #FFD60A 100%)',
    emerald: 'linear-gradient(90deg, #10B981 0%, #14B8A6 100%)',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 p-[2px] dark:bg-white/[0.08]"
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: gradient }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${clamp(pct, 0, 100)}%` }}
        transition={{ duration: reduce ? 0 : 1, ease: EASE_OUT_EXPO }}
      />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] font-semibold text-rose-600 dark:text-rose-300">
      <span>⚠️ {message}</span>
      <button type="button" onClick={onRetry} className="rounded-lg border border-rose-500/40 px-3 py-1 font-bold hover:bg-rose-500/10">
        Qayta urinish
      </button>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-black/[0.04] p-3 dark:border-white/[0.06]">
          <div className="h-4 w-8 animate-pulse rounded bg-slate-200 dark:bg-white/[0.06]" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-white/[0.06]" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-black/[0.04] dark:bg-white/[0.04]" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-xl bg-slate-200 dark:bg-white/[0.06]" />
        </div>
      ))}
    </>
  );
}

function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-5xl opacity-40" aria-hidden>{icon}</div>
      <h5 className="text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">{title}</h5>
      <p className="mt-1 max-w-xs text-[12px] text-[#64748B]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. EFFECTS: XP PARTICLES, CONFETTI
 * ══════════════════════════════════════════════════════════════════ */

const PARTICLE_COLORS = ['#FFD60A', '#F59E0B', '#FF2D55', '#6366F1'];
const CONFETTI_COLORS = ['#FFD60A', '#FF2D55', '#6366F1', '#2563EB', '#10B981', '#F59E0B'];

function XPParticles({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  const particles = useMemo(
    () =>
      trigger
        ? Array.from({ length: 24 }, (_, i) => ({
            id: `${trigger}-${i}`,
            angle: (Math.PI * 2 * i) / 24 + Math.random() * 0.3,
            velocity: 60 + Math.random() * 100,
            size: 3 + Math.random() * 5,
            color: PARTICLE_COLORS[i % 4],
            duration: 0.8 + Math.random() * 0.6,
          }))
        : [],
    [trigger],
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger || reduce) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(timer);
  }, [trigger, reduce]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{ background: p.color, width: p.size, height: p.size, boxShadow: `0 0 10px ${p.color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(p.angle) * p.velocity, y: Math.sin(p.angle) * p.velocity, opacity: 0, scale: 0.3 }}
          transition={{ duration: p.duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function Confetti({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  // Tasodifiy qiymatlar faqat trigger o'zgarganda hisoblanadi (v1'da har render'da qayta chizilardi)
  const pieces = useMemo(
    () =>
      trigger
        ? Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 0.3,
            duration: 1.8 + Math.random() * 1.2,
            size: 6 + Math.random() * 10,
            rotation: Math.random() * 720 - 360,
            color: CONFETTI_COLORS[i % 6],
            drift: (Math.random() - 0.5) * 200,
          }))
        : [],
    [trigger],
  );

  useEffect(() => {
    if (!trigger || reduce) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [trigger, reduce]);

  if (!visible) return null;
  const fall = typeof window !== 'undefined' ? window.innerHeight + 40 : 900;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={`${trigger}-${p.id}`}
          className="absolute top-0"
          style={{ left: `${p.x}%`, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: 2 }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: fall, x: p.drift, rotate: p.rotation, opacity: [1, 1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.5, 0, 0.8, 0.4] }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. HERO WIDGETS
 * ══════════════════════════════════════════════════════════════════ */

function CoinValue({ value }: { value: number }) {
  const shown = useCountUp(value);
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (prev.current !== value) {
      setPulse((p) => p + 1);
      prev.current = value;
    }
  }, [value]);

  return (
    <motion.span
      key={pulse}
      animate={!reduce && pulse > 0 ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.5 }}
      style={{ display: 'inline-block' }}
      aria-label={`${fmt(value)} coin`}
    >
      {fmt(shown)}
    </motion.span>
  );
}

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const reduce = useReducedMotion();
  const gradientId = `lvl-${useId().replace(/:/g, '')}`;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(progress, 0, 100) / 100) * circumference;

  return (
    <div className="relative flex h-[88px] w-[88px] items-center justify-center" role="img" aria-label={`Level ${level}, ${Math.round(progress)} foiz`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD60A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FF2D55" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="4" />
        <motion.circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.2, ease: EASE_OUT_EXPO }}
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,214,10,0.6))' }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-300/80">LVL</span>
        <span className="text-2xl font-black text-[#1D1D1F] dark:text-white">{level}</span>
      </div>
    </div>
  );
}

function StreakFlame({ streak }: { streak: number }) {
  const { t } = useSafeI18n();
  const reduce = useReducedMotion();
  const active = streak > 0;
  return (
    <div className="relative flex items-center gap-3">
      <motion.div
        className={`relative flex h-12 w-12 items-center justify-center text-2xl ${active ? '' : 'grayscale opacity-50'}`}
        animate={active && !reduce ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {active && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)' }}
            animate={reduce ? {} : { scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
        <span className="relative">🔥</span>
      </motion.div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-300">
          {t('gamification.dailyStreak')}
        </div>
        <div className="text-lg font-black text-[#1D1D1F] dark:text-white">{streak} kun</div>
      </div>
    </div>
  );
}

function LeagueProgressCard({ xp, serverTier }: { xp: number; serverTier?: LeagueTier }) {
  const p = useMemo(() => getLeagueProgress(xp, serverTier), [xp, serverTier]);
  const cur = LEAGUE_CONFIG[p.tier];
  const nxt = p.next ? LEAGUE_CONFIG[p.next] : null;
  return (
    <LiquidGlass radius="1.5rem" className="p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold tracking-[0.14em] text-[#64748B]">Liga yo‘li</span>
        <span className="text-[11px] font-bold" style={{ color: cur.color }}>{cur.icon} {cur.name}</span>
      </div>
      <ProgressBar pct={p.pct} tone="amber" label="Keyingi ligagacha progress" />
      <p className="mt-2.5 px-1 text-[12px] text-[#64748B] dark:text-slate-400">
        {nxt ? (
          <>Keyingi liga — <b className="text-[#1D1D1F] dark:text-white">{nxt.icon} {nxt.name}</b>: yana <b className="tabular-nums text-amber-600 dark:text-amber-300">{fmt(p.remaining)} XP</b></>
        ) : (
          'Siz eng yuqori ligadasiz — chempionlik unvonini saqlang! 👑'
        )}
      </p>
    </LiquidGlass>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. DAILY CHECK-IN & ACHIEVEMENTS & QUESTS
 * ══════════════════════════════════════════════════════════════════ */

function DailyCheckIn({
  streak,
  lastCheckIn,
  onCheckIn,
  pending,
}: {
  streak: number;
  lastCheckIn?: string | null;
  onCheckIn: () => void;
  pending: boolean;
}) {
  const { t } = useSafeI18n();
  const { days, checkedToday } = useMemo(() => buildWeekStatus(streak, lastCheckIn), [streak, lastCheckIn]);

  return (
    <LiquidGlass radius="1.5rem" className="p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{t('gamification.dailyCheckIn')}</span>
        {checkedToday ? (
          <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400">✓ Bajarildi</span>
        ) : (
          <button
            type="button"
            onClick={onCheckIn}
            disabled={pending}
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-orange-500/20 transition hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? 'Belgilanmoqda…' : 'Bugunni belgilash'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <div key={d.label} className={`flex flex-col items-center gap-1 rounded-xl py-2 ${d.isToday ? 'ring-2 ring-amber-400/50' : ''}`}>
            <span className="text-[10px] font-bold uppercase text-[#64748B]">{d.label}</span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${
                d.done
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]'
                  : d.isToday
                  ? 'bg-amber-400/20 text-amber-500 ring-1 ring-amber-400/40 dark:text-amber-400'
                  : d.isFuture
                  ? 'bg-black/[0.03] text-[#64748B]/50 dark:bg-white/[0.03]'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
              aria-label={d.done ? 'Bajarilgan' : d.isToday ? 'Bugun' : d.isFuture ? 'Kelgusi' : 'O‘tkazib yuborilgan'}
            >
              {d.done ? '✓' : d.isToday ? '●' : d.isFuture ? '·' : '×'}
            </div>
          </div>
        ))}
      </div>
    </LiquidGlass>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const { progress, unlocked } = achievement;
  const pct = progress ? clamp((progress.current / progress.total) * 100, 0, 100) : 0;
  return (
    <div
      className="relative flex flex-col items-center text-center"
      title={`${achievement.title}: ${achievement.description}${progress && !unlocked ? ` (${fmt(Math.min(progress.current, progress.total))}/${fmt(progress.total)})` : ''}`}
    >
      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${
          unlocked ? 'bg-gradient-to-br from-amber-400/30 to-orange-500/20 ring-1 ring-amber-400/40' : 'bg-black/[0.04] dark:bg-white/[0.05]'
        }`}
      >
        <span className={!unlocked ? 'opacity-40 grayscale' : ''}>{achievement.icon}</span>
        {!unlocked && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[9px] text-white ring-2 ring-white dark:ring-[#131622]" aria-hidden>🔒</span>
        )}
      </div>
      <div className={`mt-1.5 text-[11px] font-bold tracking-tight ${unlocked ? 'text-[#1D1D1F] dark:text-white' : 'text-[#64748B]'}`}>
        {achievement.title}
      </div>
      {progress && !unlocked && (
        <div className="mt-1 h-1 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function QuestCard({ quest }: { quest: DailyQuest }) {
  const pct = quest.progress ? clamp((quest.progress.current / Math.max(1, quest.progress.total)) * 100, 0, 100) : null;
  return (
    <LiquidGlass radius="1.25rem" className="flex flex-col justify-between border border-slate-200/80 p-4 dark:border-white/[0.08]">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-2xl" aria-hidden>{quest.icon}</span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400">+{quest.xp} XP</span>
            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">+{quest.coins} 🪙</span>
          </div>
        </div>
        <h5 className="text-xs font-bold text-slate-900 dark:text-white">{quest.title}</h5>
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{quest.description}</p>
      </div>
      <div className="mt-3 border-t border-black/[0.05] pt-3 dark:border-white/[0.06]">
        {pct !== null && quest.progress && (
          <div className="mb-2">
            <ProgressBar pct={pct} tone="emerald" label={`${quest.title} progressi`} />
            <div className="mt-1 text-right text-[10px] font-bold tabular-nums text-slate-500">{quest.progress.current}/{quest.progress.total}</div>
          </div>
        )}
        <div className={`text-[10px] font-bold ${quest.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {quest.completed ? '✓ Bajarildi' : 'Avtomatik qayd etiladi'}
        </div>
      </div>
    </LiquidGlass>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. LEADERBOARD
 * ══════════════════════════════════════════════════════════════════ */

const PODIUM_STYLES = {
  1: { emoji: '👑', gradient: 'from-amber-500/30 via-amber-400/20 to-transparent', border: 'border-amber-400/40', ring: 'ring-amber-400/40', shadow: 'shadow-[0_20px_60px_-15px_rgba(255,214,10,0.5)]', offset: 'sm:-translate-y-4', medal: 'text-amber-500 dark:text-amber-300' },
  2: { emoji: '🥈', gradient: 'from-slate-300/20 via-slate-400/10 to-transparent', border: 'border-slate-300/30', ring: 'ring-slate-300/30', shadow: 'shadow-[0_15px_40px_-10px_rgba(203,213,225,0.3)]', offset: 'sm:mt-6', medal: 'text-slate-500 dark:text-slate-300' },
  3: { emoji: '🥉', gradient: 'from-orange-700/25 via-orange-600/10 to-transparent', border: 'border-orange-500/30', ring: 'ring-orange-500/30', shadow: 'shadow-[0_15px_40px_-10px_rgba(234,88,12,0.3)]', offset: 'sm:mt-10', medal: 'text-orange-500 dark:text-orange-400' },
} as const;

function PodiumStep({ entry, place, delay, isMe, onOpen }: { entry: LeaderboardEntry; place: 1 | 2 | 3; delay: number; isMe: boolean; onOpen: () => void }) {
  const s = PODIUM_STYLES[place];
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING.bouncy, delay }}
      className={`relative flex flex-col items-center ${s.offset}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${place}-o‘rin: ${entry.studentName}, ${entry.xp} XP. Tafsilotlarni ochish`}
        className={`group relative flex w-full flex-col items-center rounded-3xl border ${s.border} bg-gradient-to-b ${s.gradient} p-5 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${s.shadow} ${isMe ? 'ring-2 ring-indigo-500/60' : ''}`}
      >
        <div className="mb-3 text-4xl" aria-hidden>{s.emoji}</div>
        <div className={`relative mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white/20 to-white/5 text-lg font-black text-[#1D1D1F] ring-2 dark:text-white ${s.ring}`}>
          {entry.avatar ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : entry.studentName.charAt(0).toUpperCase()}
        </div>
        <div className="flex w-full items-center justify-center gap-1.5">
          <span className="truncate text-sm font-bold text-[#1D1D1F] dark:text-white">{entry.studentName}</span>
          {isMe && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black text-white">Siz</span>}
        </div>
        <div className="mb-3 w-full truncate text-[11px] text-slate-500 dark:text-slate-400">{entry.groupName || 'Guruh'}</div>
        <div className={`rounded-xl border bg-black/10 px-3 py-1.5 text-xs font-black tabular-nums dark:bg-black/30 ${s.border} ${s.medal}`}>
          {fmt(entry.xp)} XP · {fmt(entry.coins)} 🪙
        </div>
      </button>
    </motion.div>
  );
}

function LeaderRow({ entry, index, isMe, onOpen }: { entry: LeaderboardEntry; index: number; isMe: boolean; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const league = entry.league ? LEAGUE_CONFIG[entry.league] : null;
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={onKey}
      onClick={onOpen}
      initial={reduce ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.4) }}
      className={`liquid-glass-surface flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
        isMe ? 'border-indigo-500/60 bg-indigo-500/[0.06]' : 'border-slate-200/80 dark:border-slate-800/80'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-9 shrink-0 text-[13px] font-black tabular-nums text-[#64748B]">#{entry.rank}</span>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-[12px] font-black text-[#1D1D1F] ring-1 ring-black/[0.06] dark:text-white dark:ring-white/10">
          {entry.avatar ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : entry.studentName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">{entry.studentName}</span>
            {isMe && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black text-white">Siz</span>}
          </div>
          {entry.groupName && <div className="truncate text-[11px] text-[#64748B]">{entry.groupName}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {league && entry.league && (
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: league.badgeBg, color: league.color }}>
            <span aria-hidden>{league.icon}</span>
            <span className="hidden sm:inline">{league.name.split(' ')[0]}</span>
          </span>
        )}
        {entry.zone === 'PROMOTION' && <span className="hidden rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] sm:inline-flex" title="Ko‘tarilish zonasi" aria-label="Ko‘tarilish zonasi">⬆️</span>}
        {entry.zone === 'RELEGATION' && <span className="hidden rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] sm:inline-flex" title="Tushish xavfi" aria-label="Tushish xavfi">⚠️</span>}
        <span className="text-[12px] font-bold tabular-nums text-[#1D1D1F] dark:text-white">{fmt(entry.xp)} XP</span>
        <span className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-black tabular-nums text-amber-600 dark:text-amber-300">
          {fmt(entry.coins)} 🪙
        </span>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 9. STORE
 * ══════════════════════════════════════════════════════════════════ */

const isOutOfStock = (r: RewardItem) => r.stock !== null && r.stock !== undefined && r.stock <= 0;

function RewardCard({
  reward, coins, locked, isPending, wished, index, isAdmin,
  onClaim, onToggleWish, onEdit, onDelete,
}: {
  reward: RewardItem;
  coins: number;
  locked: boolean;
  isPending: boolean;
  wished: boolean;
  index: number;
  isAdmin: boolean;
  onClaim: () => void;
  onToggleWish: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const reduce = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);
  const canAfford = coins >= reward.costCoins;
  const soldOut = isOutOfStock(reward);
  const missing = Math.max(0, reward.costCoins - coins);
  const showImage = Boolean(reward.imageUrl) && !imgFailed;
  const typeLabel = reward.type === 'COUPON' ? '🎟️ Kupon' : '📦 Tovar';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.04, 0.4) }}
      className="group relative"
    >
      <LiquidGlass radius="1.5rem" className="h-full p-5 transition-transform duration-300 group-hover:-translate-y-1.5">
        <div className="flex h-full flex-col justify-between">
          <div>
            {showImage ? (
              <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-900/10 dark:border-white/10 dark:bg-black/20">
                <img
                  src={reward.imageUrl ?? ''}
                  alt={reward.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImgFailed(true)}
                />
                <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                  <span aria-hidden>{reward.icon || '🎁'}</span><span>{reward.type === 'COUPON' ? 'Kupon' : 'Tovar'}</span>
                </div>
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-xl border border-amber-500/40 bg-black/75 px-2.5 py-1 text-xs font-black text-amber-300 backdrop-blur-md">
                  <span className="text-[10px]" aria-hidden>🪙</span>{fmt(reward.costCoins)}
                </div>
              </div>
            ) : (
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-4xl" aria-hidden>{reward.icon || '🎁'}</span>
                  <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[10.5px] font-bold text-[#64748B] dark:bg-white/[0.08] dark:text-slate-300">{typeLabel}</span>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-300">
                  <span className="text-[10px]" aria-hidden>🪙</span>{fmt(reward.costCoins)}
                </div>
              </div>
            )}

            <div className="mt-1 flex items-start justify-between gap-2">
              <h5 className="text-[15px] font-bold leading-snug tracking-tight text-[#1D1D1F] dark:text-white">{reward.title}</h5>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleWish}
                  aria-pressed={wished}
                  aria-label={wished ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[13px] transition ${wished ? 'border-rose-400/60 bg-rose-500/10 text-rose-500' : 'border-slate-200 text-slate-400 hover:text-rose-500 dark:border-white/10'}`}
                >
                  {wished ? '♥' : '♡'}
                </button>
                {isAdmin && (
                  <>
                    <button type="button" onClick={onEdit} aria-label="Tahrirlash" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-[12px] transition hover:border-indigo-400 dark:border-white/10 dark:bg-white/5">✏️</button>
                    <button type="button" onClick={onDelete} aria-label="O‘chirish" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-[12px] transition hover:border-rose-400 dark:border-white/10 dark:bg-white/5">🗑️</button>
                  </>
                )}
              </div>
            </div>

            {isAdmin && reward.isActive === false && (
              <span className="mt-1 inline-block rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-500">Yashirin (nofaol)</span>
            )}

            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#64748B] dark:text-slate-400">{reward.description}</p>

            {reward.stock !== null && reward.stock !== undefined && (
              <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${reward.stock > 0 && reward.stock <= 3 ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <span>📦 Omborda:</span>
                <span className="font-bold">{reward.stock > 0 ? `${reward.stock} dona` : 'Tugagan'}</span>
              </p>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-white/10">
            {!canAfford && !soldOut && (
              <div className="mb-2.5">
                <ProgressBar pct={(coins / reward.costCoins) * 100} tone="amber" label="Sovrin uchun yig‘ilgan coinlar" />
                <div className="mt-1 text-[10.5px] font-semibold text-[#64748B]">Yana <b className="tabular-nums text-amber-600 dark:text-amber-300">{fmt(missing)} 🪙</b> kerak</div>
              </div>
            )}
            <motion.button
              type="button"
              disabled={!canAfford || isPending || soldOut || locked}
              onClick={onClaim}
              whileTap={canAfford && !isPending && !locked ? { scale: 0.98 } : undefined}
              className={`w-full rounded-xl py-2.5 text-[12px] font-bold transition-all ${
                canAfford && !soldOut
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_15px_-4px_rgba(16,185,129,0.6)] disabled:opacity-60'
                  : 'cursor-not-allowed bg-black/[0.04] text-[#64748B] dark:bg-white/[0.05] dark:text-slate-500'
              }`}
            >
              {isPending ? 'Sotib olinmoqda…' : soldOut ? 'Omborda tugagan' : canAfford ? 'Xarid qilish →' : `Yetarli emas (${fmt(reward.costCoins)} 🪙 kerak)`}
            </motion.button>
          </div>
        </div>
      </LiquidGlass>
    </motion.div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-[11px] font-semibold text-rose-500">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-[#64748B]">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-black/[0.02] px-3.5 py-2 text-sm outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/[0.04]';
const PRESET_ICONS = ['🎁', '👕', '☕', '📚', '🎒', '🎧', '🎟️', '⭐', '🥇', '💻'];

function RewardFormModal({ open, onClose, initialData, onSave, isSaving }: {
  open: boolean;
  onClose: () => void;
  initialData?: RewardItem | null;
  onSave: (data: Partial<RewardItem>) => void;
  isSaving?: boolean;
}) {
  const { push } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costCoins, setCostCoins] = useState('100');
  const [type, setType] = useState<'PRODUCT' | 'COUPON'>('PRODUCT');
  const [category, setCategory] = useState('MERCH');
  const [icon, setIcon] = useState('🎁');
  const [imageUrl, setImageUrl] = useState('');
  const [stock, setStock] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTitle(initialData?.title ?? '');
    setDescription(initialData?.description ?? '');
    setCostCoins(String(initialData?.costCoins ?? 100));
    setType(initialData?.type === 'COUPON' ? 'COUPON' : 'PRODUCT');
    setCategory(initialData?.category ?? 'MERCH');
    setIcon(initialData?.icon ?? '🎁');
    setImageUrl(initialData?.imageUrl ?? '');
    setStock(initialData?.stock != null ? String(initialData.stock) : '');
    setCouponCode(initialData?.couponCode ?? '');
    setIsActive(initialData?.isActive !== false);
  }, [initialData, open]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Nomini kiriting';
    const cost = Number(costCoins);
    if (!Number.isInteger(cost) || cost < 1) e.cost = 'Narx butun son va kamida 1 bo‘lishi kerak';
    if (stock.trim() !== '') {
      const s = Number(stock);
      if (!Number.isInteger(s) || s < 0) e.stock = 'Ombor soni 0 yoki undan katta butun son';
    }
    if (type === 'COUPON' && !couponCode.trim()) e.coupon = 'Kupon kodini kiriting';
    if (imageUrl && !/^(https:\/\/|data:image\/)/i.test(imageUrl)) e.image = 'Rasm havolasi https:// bilan boshlanishi kerak';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      costCoins: Number(costCoins),
      type,
      category,
      icon: icon || '🎁',
      imageUrl: imageUrl.trim() || null,
      stock: stock.trim() === '' ? null : Number(stock),
      couponCode: type === 'COUPON' ? couponCode.trim() : null,
      isActive,
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return push('error', 'Faqat rasm fayli yuklash mumkin');
    if (file.size > MAX_IMAGE_BYTES) return push('error', 'Rasm hajmi 1.5 MB dan oshmasligi kerak — havola ishlating');
    const reader = new FileReader();
    reader.onload = (ev) => typeof ev.target?.result === 'string' && setImageUrl(ev.target.result);
    reader.onerror = () => push('error', 'Faylni o‘qib bo‘lmadi');
    reader.readAsDataURL(file);
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={initialData ? 'Mukofotni tahrirlash' : 'Yangi mukofot qo‘shish'}
      description="O‘quvchilar M-Coin yordamida ushbu tovar yoki kuponni xarid qilishlari mumkin."
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
        <div>
          <span className="mb-1.5 block text-[12px] font-bold text-slate-700 dark:text-slate-300">Mukofot turi</span>
          <div className="grid grid-cols-2 gap-2">
            {([['PRODUCT', '📦', 'Moddiy tovar', '🎁'], ['COUPON', '🎟️', 'Chegirma kuponi', '🎟️']] as const).map(([val, emoji, label, defIcon]) => (
              <button
                key={val}
                type="button"
                aria-pressed={type === val}
                onClick={() => {
                  setType(val);
                  if (PRESET_ICONS.includes(icon) && (icon === '🎁' || icon === '🎟️')) setIcon(defIcon);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                  type === val ? (val === 'PRODUCT' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : 'border-amber-500 bg-amber-500/10 text-amber-500') : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
                }`}
              >
                <span className="text-base" aria-hidden>{emoji}</span><span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Mukofot nomi *" error={errors.title}>
          <input className={INPUT_CLS} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: M-EDU brend termos yoki 10% chegirma" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Narxi (M-Coin) *" error={errors.cost}>
            <input type="number" min={1} step={1} inputMode="numeric" className={`${INPUT_CLS} font-bold text-amber-600 dark:text-amber-400`} value={costCoins} onChange={(e) => setCostCoins(e.target.value)} />
          </Field>
          <Field label="Kategoriya">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${INPUT_CLS} bg-white dark:bg-slate-900`}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        {type === 'COUPON' && (
          <Field label="Kupon / promo-kod *" error={errors.coupon} hint="Kod faqat xariddan keyin o‘quvchiga ko‘rsatiladi.">
            <input className={`${INPUT_CLS} font-mono font-bold tracking-wider`} value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="CHEGIRMA15" />
          </Field>
        )}

        <Field label="Ombordagi soni" error={errors.stock} hint="Cheksiz bo‘lsa bo‘sh qoldiring.">
          <input type="number" min={0} step={1} inputMode="numeric" className={INPUT_CLS} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Cheksiz" />
        </Field>

        <div>
          <span className="mb-1 block text-[12px] font-bold text-slate-700 dark:text-slate-300">Belgi / emoji</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_ICONS.map((ic) => (
              <button key={ic} type="button" aria-label={`Belgi ${ic}`} aria-pressed={icon === ic} onClick={() => setIcon(ic)} className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition ${icon === ic ? 'scale-110 border-indigo-500 bg-indigo-500/15 shadow-sm' : 'border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5'}`}>{ic}</button>
            ))}
            <input aria-label="Boshqa emoji" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} className="w-14 rounded-xl border border-slate-200 bg-transparent py-1.5 text-center text-base outline-none dark:border-white/10" />
          </div>
        </div>

        <Field label="Rasm" error={errors.image} hint="Havola yoki fayl (maks. 1.5 MB).">
          <div className="flex gap-2">
            <input type="url" className={`${INPUT_CLS} flex-1`} value={imageUrl.startsWith('data:') ? '' : imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            <span className="flex shrink-0 cursor-pointer items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5">
              Fayl tanlash
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </span>
          </div>
        </Field>
        {imageUrl && (
          <div className="relative aspect-[16/8] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <img src={imageUrl} alt="Oldindan ko‘rish" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setImageUrl('')} className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur">✕ Tozalash</button>
          </div>
        )}

        <Field label="Qisqa tavsif">
          <textarea rows={2} maxLength={240} className={INPUT_CLS} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Sovrin haqida qo‘shimcha ma’lumot…" />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
          Do‘konda ko‘rinsin (faol)
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-200/80 pt-3 dark:border-white/10">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-[#64748B] transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5">Bekor qilish</button>
          <button type="submit" disabled={isSaving} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
            {isSaving ? 'Saqlanmoqda…' : initialData ? 'O‘zgarishlarni saqlash' : 'Sovrinni qo‘shish'}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 10. TAB BAR (ARIA + klaviatura)
 * ══════════════════════════════════════════════════════════════════ */

function TabBar({ active, onChange, onArena }: { active: TabId; onChange: (id: TabId) => void; onArena: () => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === active);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:justify-center">
      <div role="tablist" aria-label="Gamifikatsiya bo‘limlari" onKeyDown={onKey} className="flex shrink-0 items-center gap-1">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => { refs.current[tab.id] = el; }}
              id={`gm-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`gm-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[13px] font-bold tracking-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 md:px-5 ${
                selected ? 'text-white' : 'text-[#64748B] hover:text-[#1D1D1F] dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="gm-tab-pill"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #5E5CE6 0%, #6366F1 100%)', boxShadow: '0 10px 30px -8px rgba(94,92,230,0.5)' }}
                  transition={SPRING.smooth}
                />
              )}
              <span className="relative z-10 text-base" aria-hidden>{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onArena}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-rose-500/20 px-4 py-2 text-xs font-black text-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all hover:scale-105 active:scale-95 dark:text-cyan-300 md:text-sm"
      >
        <span aria-hidden>⚔️</span><span>Mind Arena</span>
        <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-black text-rose-500 dark:text-rose-300">3D</span>
      </button>
    </div>
  );
}

function ExecutiveOrgStats({
  stats,
  onAddReward,
}: {
  stats: {
    participants: number;
    totalXp: number;
    totalCoins: number;
    maxLevel: number;
  };
  onAddReward: () => void;
}) {
  return (
    <LiquidGlass radius="1.5rem" className="p-5 border border-indigo-500/20" tint="rgba(99,102,241,0.06)" elevated>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500 text-lg">
            📊
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              Executive Gamification Telemetry
            </div>
            <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white">
              Tashkilot bo‘yicha maktab miqyosidagi ko‘rsatkichlar
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddReward}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95"
        >
          <span>＋</span> Yangi sovrin qo‘shish
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white/50 p-3 border border-slate-200/50 dark:bg-white/[0.04] dark:border-white/5">
          <div className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">Faol o‘quvchilar</div>
          <div className="text-2xl font-black text-[#1D1D1F] dark:text-white tracking-tight">
            {stats.participants}
          </div>
        </div>
        <div className="rounded-xl bg-white/50 p-3 border border-slate-200/50 dark:bg-white/[0.04] dark:border-white/5">
          <div className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">Jami berilgan XP</div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
            {stats.totalXp.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-white/50 p-3 border border-slate-200/50 dark:bg-white/[0.04] dark:border-white/5">
          <div className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">Aylanmadagi M-Coins</div>
          <div className="text-2xl font-black text-amber-500 dark:text-amber-300 tracking-tight">
            🪙 {stats.totalCoins.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-white/50 p-3 border border-slate-200/50 dark:bg-white/[0.04] dark:border-white/5">
          <div className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">Eng yuqori daraja</div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            Level {stats.maxLevel}
          </div>
        </div>
      </div>
    </LiquidGlass>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 11. MAIN PAGE
 * ══════════════════════════════════════════════════════════════════ */

export function GamificationHubPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useSafeI18n();
  usePageTitle('M-Coins & Gamifikatsiya');
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { playTick, playPop, playError, playCelebration } = usePremiumSound();

  const myId = (user as { id?: string } | null)?.id;
  const isAdmin = Boolean(user && ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'PLATFORM_OWNER'].includes((user as { role?: string }).role as string));

  /* ── UI state ── */
  const rawTab = searchParams.get('tab');
  const activeTab: TabId = isTabId(rawTab) ? rawTab : 'leaderboard';
  const setActiveTab = useCallback(
    (id: TabId) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [leagueFilter, setLeagueFilter] = useState<LeagueTier | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [sort, setSort] = useState<RewardSort>('default');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [onlyWished, setOnlyWished] = useState(false);
  const [xpBurst, setXpBurst] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [rewardToBuy, setRewardToBuy] = useState<RewardItem | null>(null);
  const [rewardToDelete, setRewardToDelete] = useState<RewardItem | null>(null);
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [couponReveal, setCouponReveal] = useState<{ title: string; code: string } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const [wishlist, toggleWish] = usePersistentSet(`medu:gm:wishlist:${myId ?? 'anon'}`);

  /* ── Queries ── */
  const meQ = useQuery<StudentStats>({ queryKey: QUERY_KEYS.me, queryFn: () => request('/gamification/me'), staleTime: 15_000 });
  const lbQ = useQuery<{ items: LeaderboardEntry[] }>({
    queryKey: QUERY_KEYS.leaderboard(period),
    queryFn: () => request(`/gamification/leaderboard?limit=25&period=${period}`),
    staleTime: 30_000,
    refetchInterval: activeTab === 'leaderboard' ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const leaguesQ = useQuery<LeagueOverviewResponse>({ queryKey: QUERY_KEYS.leagues, queryFn: () => request('/gamification/leagues'), staleTime: 60_000 });
  const rewardsQ = useQuery<{ items: RewardItem[] }>({ queryKey: QUERY_KEYS.rewards, queryFn: () => request('/gamification/rewards'), staleTime: 30_000 });
  const orgStatsQ = useQuery<{
    participants: number;
    totalXp: number;
    totalCoins: number;
    maxLevel: number;
  }>({
    queryKey: QUERY_KEYS.orgStats,
    queryFn: () => request('/gamification/stats'),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const myStats = meQ.data;
  const orgStats = orgStatsQ.data;
  const leagueOverview = leaguesQ.data;
  const rawLeaderboard = useMemo(() => lbQ.data?.items ?? [], [lbQ.data]);
  const allRewards = useMemo(() => rewardsQ.data?.items ?? [], [rewardsQ.data]);
  const rewards = useMemo(() => (isAdmin ? allRewards : allRewards.filter((r) => r.isActive !== false)), [allRewards, isAdmin]);

  const currentCoins = myStats?.coins ?? 0;
  const currentXp = myStats?.xp ?? 0;
  const currentLevel = myStats?.level ?? 1;
  const streak = myStats?.streak ?? 0;
  const levelProg = useMemo(
    () => computeLevelProgress(currentXp, myStats?.xpToNextLevel ?? LEVEL_SPAN_DEFAULT, myStats?.levelSpan),
    [currentXp, myStats?.xpToNextLevel, myStats?.levelSpan],
  );
  const xpShown = useCountUp(currentXp);

  /* ── Efektlar: XP oshganda zarralar, level oshganda marosim ── */
  const xpIncrease = useIncreaseTrigger(myStats?.xp);
  useEffect(() => { if (xpIncrease) setXpBurst(xpIncrease); }, [xpIncrease]);

  const prevLevel = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!myStats) return;
    if (prevLevel.current !== undefined && myStats.level > prevLevel.current) {
      setLevelUp(myStats.level);
      setConfettiTrigger(Date.now());
      playCelebration();
      vibrate([15, 40, 15, 40, 30]);
    }
    prevLevel.current = myStats.level;
  }, [myStats, playCelebration]);

  /* ── Leaderboard derived ── */
  const leaderboard = useMemo(
    () => (leagueFilter === 'ALL' ? rawLeaderboard : rawLeaderboard.filter((e) => e.league === leagueFilter)),
    [rawLeaderboard, leagueFilter],
  );
  const leagueCounts = useMemo(() => {
    const map = new Map<LeagueTier, number>();
    rawLeaderboard.forEach((e) => e.league && map.set(e.league, (map.get(e.league) ?? 0) + 1));
    return map;
  }, [rawLeaderboard]);
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const isMe = useCallback(
    (e: LeaderboardEntry) => (myId ? e.studentId === myId : myStats?.rank != null && e.rank === myStats.rank),
    [myId, myStats?.rank],
  );
  const meInList = rawLeaderboard.some(isMe);

  /* ── Sidecar ── */
  const handleOpenStudentSidecar = useCallback(
    (entry: LeaderboardEntry) => {
      playPop();
      const rank = entry.rank;
      openSidecar({
        title: entry.studentName,
        subtitle: `${entry.groupName || 'Guruh'} • #${rank} o‘rin`,
        badge: { text: `LVL ${entry.level}`, tone: rank <= 3 ? 'amber' : 'purple' },
        status: { label: rank <= 3 ? 'Top 3 lider' : 'Faol ishtirokchi', tone: rank <= 3 ? 'amber' : 'emerald' },
        metrics: [
          { label: 'Tajriba (XP)', value: `${fmt(entry.xp)} XP` },
          { label: 'M-Coins', value: `${fmt(entry.coins)} 🪙` },
          { label: 'Daraja', value: `Level ${entry.level}` },
          { label: 'O‘rin', value: `#${rank}` },
        ],
        details: [
          { label: 'Talaba ID', value: entry.studentId },
          { label: 'F.I.SH', value: entry.studentName },
          { label: 'Guruh', value: entry.groupName || 'Biriktirilmagan' },
          { label: 'Yutuqlar', value: rank === 1 ? '🥇 Chempion unvoni' : rank <= 3 ? '🏆 Podium sovrindori' : 'O‘quv yulduzi' },
        ],
        actions: [{ label: 'Profilga o‘tish', variant: 'primary', onClick: () => navigate(`/students/${entry.studentId}`) }],
      });
    },
    [navigate, playPop],
  );

  /* ── Ulashish ── */
  const handleShare = useCallback(async () => {
    const text = `M-EDU'da men ${currentLevel}-levelman: ${fmt(currentXp)} XP, ${myStats?.rank ? `#${myStats.rank}` : '—'} o‘rin, ${streak} kunlik seriya! 🔥`;
    try {
      if (navigator.share) await navigator.share({ title: 'M-EDU natijam', text });
      else if (await copyText(text)) push('success', 'Natija nusxalandi');
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  }, [currentLevel, currentXp, myStats?.rank, streak, push]);

  /* ── Mutations ── */
  const refreshAll = useCallback(() => {
    void meQ.refetch();
    void lbQ.refetch();
    void rewardsQ.refetch();
    void leaguesQ.refetch();
  }, [meQ, lbQ, rewardsQ, leaguesQ]);

  const claimMutation = useMutation<ClaimResponse, Error, RewardItem, { prev?: StudentStats }>({
    mutationFn: (reward) => request(`/gamification/rewards/${reward.id}/claim`, { method: 'POST' }),
    onMutate: async (reward) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.me });
      const prev = queryClient.getQueryData<StudentStats>(QUERY_KEYS.me);
      if (prev) queryClient.setQueryData<StudentStats>(QUERY_KEYS.me, { ...prev, coins: Math.max(0, prev.coins - reward.costCoins) });
      return { prev };
    },
    onSuccess: (res, reward) => {
      playCelebration();
      push('success', res?.message || '🎉 Sovrin muvaffaqiyatli xarid qilindi!');
      setConfettiTrigger(Date.now());
      vibrate([10, 30, 10]);
      const code = res?.couponCode ?? (reward.type === 'COUPON' ? reward.couponCode : null);
      if (code) setCouponReveal({ title: reward.title, code });
    },
    onError: (err, _reward, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEYS.me, ctx.prev); // rollback
      playError();
      push('error', err?.message || 'Xaridni amalga oshirib bo‘lmadi');
      vibrate(80);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rewards });
    },
  });

  const checkInMutation = useMutation<unknown, Error, void>({
    mutationFn: () => request('/gamification/check-in', { method: 'POST' }),
    onSuccess: () => {
      playPop();
      push('success', 'Bugungi kun belgilandi! 🔥');
      setXpBurst(Date.now());
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
    },
    onError: (err) => {
      playError();
      push('error', err?.message || 'Belgilashda xatolik');
    },
  });

  const closeForm = () => { setIsFormOpen(false); setEditingReward(null); };
  const invalidateRewards = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rewards });

  const createRewardMutation = useMutation({
    mutationFn: (data: Partial<RewardItem>) => request('/gamification/rewards', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { push('success', 'Yangi sovrin qo‘shildi!'); void invalidateRewards(); closeForm(); },
    onError: (err: Error) => push('error', err?.message || 'Sovrin qo‘shishda xatolik'),
  });
  const updateRewardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RewardItem> }) => request(`/gamification/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { push('success', 'O‘zgarishlar saqlandi!'); void invalidateRewards(); closeForm(); },
    onError: (err: Error) => push('error', err?.message || 'Tahrirlashda xatolik'),
  });
  const deleteRewardMutation = useMutation({
    mutationFn: (id: string) => request(`/gamification/rewards/${id}`, { method: 'DELETE' }),
    onSuccess: () => { push('success', 'Sovrin o‘chirildi'); void invalidateRewards(); },
    onError: (err: Error) => push('error', err?.message || 'O‘chirishda xatolik'),
  });

  /* ── Klaviatura (modifikatorlar bilan to'qnashmaydi) ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // Ctrl+R va boshqalarni buzmaymiz
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const idx = Number(e.key);
      if (idx >= 1 && idx <= TABS.length) {
        e.preventDefault();
        playTick();
        setActiveTab(TABS[idx - 1].id);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        refreshAll();
        push('info', 'Ma’lumotlar yangilanmoqda…');
      } else if (e.key === '/' && activeTab === 'store') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playTick, refreshAll, push, setActiveTab, activeTab]);

  /* ── Do'kon: kategoriyalar, filtr, saralash ── */
  const categories = useMemo(() => ['all', ...Array.from(new Set(rewards.map((r) => r.category)))], [rewards]);
  const filteredRewards = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();
    const list = rewards.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (onlyAffordable && (r.costCoins > currentCoins || isOutOfStock(r))) return false;
      if (onlyWished && !wishlist.has(r.id)) return false;
      return !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    });
    if (sort === 'price-asc') return [...list].sort((a, b) => a.costCoins - b.costCoins);
    if (sort === 'price-desc') return [...list].sort((a, b) => b.costCoins - a.costCoins);
    return list;
  }, [rewards, categoryFilter, onlyAffordable, onlyWished, deferredQuery, sort, currentCoins, wishlist]);

  /* ── Yutuqlar (faqat haqiqiy statistikadan) ── */
  const achievements: Achievement[] = useMemo(() => {
    const purchases = myStats?.purchasesCount ?? 0;
    const tierIdx = TIER_ORDER.indexOf(getLeagueProgress(currentXp, myStats?.league).tier);
    return [
      { id: 'first', title: 'Ilk qadam', description: 'Birinchi XP ni qo‘lga kiriting', icon: '🎯', unlocked: currentXp > 0 },
      { id: 'streak5', title: '5 kunlik', description: '5 kun ketma-ket kiring', icon: '🔥', unlocked: streak >= 5, progress: { current: streak, total: 5 } },
      { id: 'streak30', title: 'Oylik sodiq', description: '30 kunlik seriya', icon: '📅', unlocked: streak >= 30, progress: { current: streak, total: 30 } },
      { id: 'xp1000', title: 'XP ustasi', description: '1000 XP to‘plang', icon: '⚡', unlocked: currentXp >= 1000, progress: { current: currentXp, total: 1000 } },
      { id: 'collector', title: 'Kollektsioner', description: '10 sovrin sotib oling', icon: '🎁', unlocked: purchases >= 10, progress: { current: purchases, total: 10 } },
      { id: 'top3', title: 'Top-3', description: 'Reytingda top-3 ga kiring', icon: '🏆', unlocked: myStats?.rank != null && myStats.rank > 0 && myStats.rank <= 3 },
      { id: 'gold', title: 'Oltin liga', description: 'Oltin ligaga yeting', icon: '🥇', unlocked: tierIdx >= TIER_ORDER.indexOf('GOLD') },
      { id: 'rich', title: 'Boy', description: '5000 coin yig‘ing', icon: '💎', unlocked: currentCoins >= 5000, progress: { current: currentCoins, total: 5000 } },
    ];
  }, [streak, currentXp, currentCoins, myStats?.rank, myStats?.league, myStats?.purchasesCount]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const season = leagueOverview?.season;
  const seasonPct = season ? clamp(((season.totalDays - season.daysRemaining) / Math.max(1, season.totalDays)) * 100, 0, 100) : 0;
  const studentName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Talaba';

  /* ══════════ RENDER ══════════ */
  return (
    <div className="page-container relative space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh variant="playful" />
      <Confetti trigger={confettiTrigger} />

      <GlassPageHeader
        title="M-Coins & Gamifikatsiya"
        subtitle="Darslarda faol bo‘ling, ballar to‘plang va qimmatbaho sovrinlarga ega bo‘ling!"
      />

      {isAdmin && orgStats && (
        <ExecutiveOrgStats
          stats={orgStats}
          onAddReward={() => {
            setEditingReward(null);
            setIsFormOpen(true);
          }}
        />
      )}

      {meQ.isError && <ErrorBanner message="Statistikani yuklab bo‘lmadi." onRetry={() => void meQ.refetch()} />}

      {/* ═══ HERO ═══ */}
      <LiquidGlass radius="2rem" className="p-6" tint="rgba(88,86,214,0.05)" elevated>
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" aria-hidden />

        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          <div className="flex items-center gap-5 md:col-span-4">
            <LevelRing level={currentLevel} progress={levelProg.pct} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-500 dark:text-amber-300">Daraja</div>
              <div className="text-3xl font-black tracking-tight text-[#1D1D1F] dark:text-white">{currentLevel}</div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">{studentName}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 md:col-span-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ background: 'linear-gradient(135deg, #FFD60A 0%, #F59E0B 100%)', boxShadow: '0 10px 30px -8px rgba(245,158,11,0.6)' }} aria-hidden>🪙</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-500 dark:text-amber-300">{t('gamification.mCoinsBalance')}</div>
              <div className="text-3xl font-black tracking-tight text-[#1D1D1F] dark:text-white">
                {meQ.isLoading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-slate-200 dark:bg-white/10" /> : <CoinValue value={currentCoins} />}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">{t('gamification.forPurchases')}</div>
            </div>
          </div>

          <div className="space-y-3 md:col-span-5">
            <div className="relative">
              <div className="mb-2 flex justify-between text-[11px] font-semibold">
                <span className="text-[#64748B] dark:text-slate-400">
                  {t('gamification.nextLevel')} <span className="font-bold text-indigo-500 dark:text-indigo-300">{fmt(levelProg.remaining)} XP</span>
                </span>
                <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-white">{fmt(xpShown)} / {fmt(levelProg.nextThreshold)}</span>
              </div>
              <div className="relative">
                <ProgressBar pct={levelProg.pct} label="Keyingi levelgacha XP" />
                <XPParticles trigger={xpBurst} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <StreakFlame streak={streak} />
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">Reyting</div>
                  <div className="text-lg font-black text-[#1D1D1F] dark:text-white">
                    {myStats?.rank ? `#${myStats.rank}` : '—'}
                    {myStats?.rankTotal ? <span className="ml-1 text-[11px] font-semibold text-[#64748B]">/ {fmt(myStats.rankTotal)}</span> : null}
                  </div>
                </div>
                <button type="button" onClick={handleShare} aria-label="Natijani ulashish" title="Natijani ulashish" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">↗</button>
              </div>
            </div>
          </div>
        </div>
      </LiquidGlass>

      {/* ═══ CHECK-IN + LIGA + YUTUQLAR ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <DailyCheckIn streak={streak} lastCheckIn={myStats?.lastCheckIn} onCheckIn={() => checkInMutation.mutate()} pending={checkInMutation.isPending} />
          <LeagueProgressCard xp={currentXp} serverTier={myStats?.league} />
        </div>

        <LiquidGlass radius="1.5rem" className="p-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Yutuqlar</span>
            <span className="text-[11px] font-bold tabular-nums text-[#1D1D1F] dark:text-white">{unlockedCount} / {achievements.length}</span>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {achievements.map((a) => <AchievementBadge key={a.id} achievement={a} />)}
          </div>
        </LiquidGlass>
      </div>

      <TabBar active={activeTab} onChange={(id) => { playTick(); setActiveTab(id); }} onArena={() => navigate('/arena')} />

      {/* ═══ PANELS ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === 'leaderboard' && (
          <motion.div key="leaderboard" id="gm-panel-leaderboard" role="tabpanel" aria-labelledby="gm-tab-leaderboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING.smooth} className="space-y-6">
            {lbQ.isError && <ErrorBanner message="Reytingni yuklab bo‘lmadi." onRetry={() => void lbQ.refetch()} />}

            {season && (
              <LiquidGlass radius="1.25rem" className="border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-lg shadow-md shadow-amber-500/20" aria-hidden>🏆</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-wider text-slate-900 dark:text-white">{season.title}</span>
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400">{season.daysRemaining} kun qoldi</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Top {season.promotionZonePct}% yuqori ligaga ko‘tariladi • Pastki {season.relegationZonePct}% tushish xavfida
                      </p>
                    </div>
                  </div>
                  <div className="w-full sm:w-48"><ProgressBar pct={seasonPct} label="Mavsum o‘tgan qismi" /></div>
                </div>
              </LiquidGlass>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Davr" className="inline-flex rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
                {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => (
                  <button key={p} type="button" aria-pressed={period === p} onClick={() => { playTick(); setPeriod(p); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === p ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-500'}`}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(['ALL', ...[...TIER_ORDER].reverse()] as (LeagueTier | 'ALL')[]).map((tier) => {
                  const conf = tier === 'ALL' ? null : LEAGUE_CONFIG[tier];
                  const count = tier === 'ALL' ? rawLeaderboard.length : leagueCounts.get(tier) ?? 0;
                  return (
                    <button
                      key={tier}
                      type="button"
                      aria-pressed={leagueFilter === tier}
                      onClick={() => { playTick(); setLeagueFilter(tier); }}
                      className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${leagueFilter === tier ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-slate-300'}`}
                    >
                      {conf && <span aria-hidden>{conf.icon}</span>}
                      <span>{conf ? conf.name.split(' ')[0] : 'Barchasi'}</span>
                      <span className="text-[10px] opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {top3.length > 0 && (
              <div className="grid grid-cols-1 items-end gap-4 pb-2 pt-6 sm:grid-cols-3">
                {top3[1] && <PodiumStep entry={top3[1]} place={2} delay={0.1} isMe={isMe(top3[1])} onOpen={() => handleOpenStudentSidecar(top3[1])} />}
                {top3[0] && <PodiumStep entry={top3[0]} place={1} delay={0} isMe={isMe(top3[0])} onOpen={() => handleOpenStudentSidecar(top3[0])} />}
                {top3[2] && <PodiumStep entry={top3[2]} place={3} delay={0.2} isMe={isMe(top3[2])} onOpen={() => handleOpenStudentSidecar(top3[2])} />}
              </div>
            )}

            <LiquidGlass radius="1.5rem" className="p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <h4 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-white">{t('gamification.generalRating')}</h4>
                <span className="text-[11px] font-bold text-[#64748B]">Jami {leaderboard.length} ishtirokchi</span>
              </div>
              <div className="space-y-1.5">
                {lbQ.isLoading ? (
                  <SkeletonRows count={5} />
                ) : leaderboard.length === 0 ? (
                  <EmptyState
                    icon="🏆"
                    title={leagueFilter === 'ALL' ? 'Reyting hozircha bo‘sh' : 'Bu ligada ishtirokchilar yo‘q'}
                    description={leagueFilter === 'ALL' ? 'Birinchi bo‘lib XP to‘plang va reytingda ko‘rining.' : 'Boshqa ligani tanlang yoki filtrni tozalang.'}
                    action={leagueFilter !== 'ALL' ? <button type="button" onClick={() => setLeagueFilter('ALL')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10">Filtrni tozalash</button> : undefined}
                  />
                ) : (
                  rest.map((entry, idx) => <LeaderRow key={entry.studentId} entry={entry} index={idx} isMe={isMe(entry)} onOpen={() => handleOpenStudentSidecar(entry)} />)
                )}
              </div>

              {/* O'z o'rningiz top-25 dan tashqarida bo'lsa ham ko'rinadi */}
              {!meInList && myStats?.rank != null && leagueFilter === 'ALL' && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-indigo-500/40 bg-indigo-500/[0.07] p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 text-[13px] font-black tabular-nums text-indigo-500">#{myStats.rank}</span>
                    <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-white">{studentName} <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black text-white">Siz</span></span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-[#1D1D1F] dark:text-white">{fmt(currentXp)} XP</span>
                </div>
              )}
            </LiquidGlass>
          </motion.div>
        )}

        {activeTab === 'leagues' && (
          <motion.div key="leagues" id="gm-panel-leagues" role="tabpanel" aria-labelledby="gm-tab-leagues" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING.smooth} className="space-y-6">
            {leaguesQ.isError && <ErrorBanner message="Liga ma’lumotlarini yuklab bo‘lmadi." onRetry={() => void leaguesQ.refetch()} />}

            <LiquidGlass radius="1.5rem" className="border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-surface-900/40 to-purple-950/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Oylik liga tizimi</span>
                  <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{season?.title ?? (leaguesQ.isLoading ? 'Yuklanmoqda…' : 'Joriy mavsum')}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Har bir to‘plangan XP sizni yuqori ligaga va nufuzli mukofotlarga yaqinlashtiradi.</p>
                </div>
                {season && (
                  <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-center">
                    <div className="text-2xl font-black tabular-nums text-indigo-600 dark:text-indigo-300">{season.daysRemaining} kun</div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Mavsum tugashiga</div>
                  </div>
                )}
              </div>
              {season && <div className="mt-4"><ProgressBar pct={seasonPct} label="Mavsum o‘tgan qismi" /></div>}
            </LiquidGlass>

            <div className="space-y-3">
              <h4 className="px-1 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Ligalarning 5 bosqichi</h4>
              <div className="grid grid-cols-1 gap-3">
                {leaguesQ.isLoading && <SkeletonRows count={3} />}
                {leagueOverview?.leagues.map((lg) => {
                  const isCurrent = (myStats?.league ?? getLeagueProgress(currentXp).tier) === lg.tier;
                  const reached = currentXp >= lg.minXp;
                  return (
                    <LiquidGlass key={lg.tier} radius="1.25rem" className={`border p-4 transition-all ${isCurrent ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30' : 'border-slate-200/80 dark:border-white/[0.08]'} ${!reached ? 'opacity-80' : ''}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm" style={{ backgroundColor: lg.badgeBg }} aria-hidden>{lg.icon}</div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-black text-slate-900 dark:text-white">{lg.name}</span>
                              {isCurrent && <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Sizning ligangiz</span>}
                              {reached && !isCurrent && <span className="text-[10px] font-bold text-emerald-500">✓ Erishilgan</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{lg.perk}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{lg.minXp === 0 ? '0+' : `${fmt(lg.minXp)}+ XP`}</div>
                          <div className="text-[10px] font-bold text-slate-400">{fmt(lg.studentsCount)} nafar talaba</div>
                        </div>
                      </div>
                    </LiquidGlass>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="px-1 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Kunlik o‘quv missiyalari</h4>
              {leagueOverview && leagueOverview.dailyQuests.length === 0 ? (
                <EmptyState icon="🎯" title="Bugun missiyalar yo‘q" description="Yangi missiyalar ertaga paydo bo‘ladi." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {leagueOverview?.dailyQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'store' && (
          <motion.div key="store" id="gm-panel-store" role="tabpanel" aria-labelledby="gm-tab-store" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING.smooth} className="space-y-4">
            {rewardsQ.isError && <ErrorBanner message="Do‘kon ma’lumotlarini yuklab bo‘lmadi." onRetry={() => void rewardsQ.refetch()} />}

            <LiquidGlass radius="1.5rem" className="p-4" tint="rgba(94,92,230,0.04)">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-2xl ring-1 ring-indigo-500/30" aria-hidden>🛍️</div>
                  <div>
                    <h4 className="text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">M-Coins do‘koni</h4>
                    <p className="text-[12px] text-[#64748B] dark:text-slate-400">Tangalarni real sovg‘alarga almashtiring</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Balans</div>
                  <div className="text-xl font-black text-amber-500 dark:text-amber-300"><CoinValue value={currentCoins} /> 🪙</div>
                </div>
              </div>
            </LiquidGlass>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
                  </span>
                  <input
                    ref={searchRef}
                    type="search"
                    aria-label="Sovrin qidirish"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Sovrin qidirish… (/)"
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-black/[0.03] pl-9 pr-3 text-sm outline-none placeholder:text-[#64748B] focus:border-indigo-400/40 focus:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-white/10 dark:bg-white/[0.05] dark:focus:bg-white/[0.08]"
                  />
                </div>
                <select aria-label="Saralash" value={sort} onChange={(e) => setSort(e.target.value as RewardSort)} className="h-10 rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-white/10 dark:bg-slate-900">
                  <option value="default">Odatiy tartib</option>
                  <option value="price-asc">Narx: arzondan qimmatga</option>
                  <option value="price-desc">Narx: qimmatdan arzonga</option>
                </select>
                {isAdmin && (
                  <button type="button" onClick={() => { setEditingReward(null); setIsFormOpen(true); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-[var(--shadow-brand)] transition-[background-color,transform] hover:bg-[var(--primary-hover)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">
                    <span aria-hidden>➕</span><span>Yangi sovrin</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button key={cat} type="button" aria-pressed={categoryFilter === cat} onClick={() => setCategoryFilter(cat)} className={`h-9 shrink-0 rounded-full px-3.5 text-[12px] font-bold tracking-tight transition-all ${categoryFilter === cat ? 'bg-[#1D1D1F] text-white shadow-lg dark:bg-white dark:text-[#1D1D1F]' : 'bg-black/[0.04] text-[#64748B] hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]'}`}>
                    {cat === 'all' ? 'Hammasi' : CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px shrink-0 bg-slate-300/60 dark:bg-white/10" aria-hidden />
                <button type="button" aria-pressed={onlyAffordable} onClick={() => setOnlyAffordable((v) => !v)} className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all ${onlyAffordable ? 'bg-emerald-500 text-white' : 'bg-black/[0.04] text-[#64748B] dark:bg-white/[0.05]'}`}>Olsam bo‘ladi</button>
                <button type="button" aria-pressed={onlyWished} onClick={() => setOnlyWished((v) => !v)} className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all ${onlyWished ? 'bg-rose-500 text-white' : 'bg-black/[0.04] text-[#64748B] dark:bg-white/[0.05]'}`}>♥ Sevimlilar ({wishlist.size})</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rewardsQ.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/[0.05]" />)
              ) : filteredRewards.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon="🔍"
                    title="Sovrin topilmadi"
                    description="Filtrlarni o‘zgartirib ko‘ring yoki qidiruvni tozalang."
                    action={<button type="button" onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setOnlyAffordable(false); setOnlyWished(false); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10">Hammasini tozalash</button>}
                  />
                </div>
              ) : (
                filteredRewards.map((reward, i) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    coins={currentCoins}
                    locked={claimMutation.isPending}
                    isPending={claimMutation.isPending && claimMutation.variables?.id === reward.id}
                    wished={wishlist.has(reward.id)}
                    index={i}
                    isAdmin={isAdmin}
                    onClaim={() => setRewardToBuy(reward)}
                    onToggleWish={() => { playTick(); toggleWish(reward.id); }}
                    onEdit={() => { setEditingReward(reward); setIsFormOpen(true); }}
                    onDelete={() => setRewardToDelete(reward)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'skillTree' && (
          <motion.div key="skillTree" id="gm-panel-skillTree" role="tabpanel" aria-labelledby="gm-tab-skillTree" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING.smooth} className="space-y-6">
            <StudentSkillConstellationStudio
              studentName={studentName}
              studentLevel={currentLevel}
              onSkillUnlocked={(_id, _xp, coins) => {
                setXpBurst(Date.now());
                if (coins > 50) setConfettiTrigger(Date.now());
                void meQ.refetch();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MODALLAR ═══ */}
      <RewardFormModal
        open={isFormOpen}
        onClose={closeForm}
        initialData={editingReward}
        isSaving={createRewardMutation.isPending || updateRewardMutation.isPending}
        onSave={(data) => (editingReward ? updateRewardMutation.mutate({ id: editingReward.id, data }) : createRewardMutation.mutate(data))}
      />

      <ConfirmDialog
        open={rewardToBuy !== null}
        onClose={() => setRewardToBuy(null)}
        onConfirm={async () => {
          if (!rewardToBuy) return;
          const reward = rewardToBuy;
          setRewardToBuy(null);
          claimMutation.mutate(reward);
        }}
        title="Xaridni tasdiqlang"
        description={rewardToBuy ? `${fmt(rewardToBuy.costCoins)} 🪙 hisobingizdan yechiladi. Qolgan balans: ${fmt(Math.max(0, currentCoins - rewardToBuy.costCoins))} 🪙.` : ''}
        itemName={rewardToBuy?.title}
        confirmLabel="Xarid qilish"
        tone="primary"
      />

      <ConfirmDialog
        open={rewardToDelete !== null}
        onClose={() => setRewardToDelete(null)}
        onConfirm={async () => {
          if (!rewardToDelete) return;
          await deleteRewardMutation.mutateAsync(rewardToDelete.id);
          setRewardToDelete(null);
        }}
        title="Sovrinni o‘chirish"
        description="Bu sovrin do‘kondan butunlay o‘chiriladi. Amalni qaytarib bo‘lmaydi."
        itemName={rewardToDelete?.title}
        confirmLabel="O‘chirish"
        tone="danger"
        loading={deleteRewardMutation.isPending}
      />

      <GlassModal open={couponReveal !== null} onClose={() => setCouponReveal(null)} title="Kuponingiz tayyor 🎟️" description={couponReveal?.title} size="sm">
        <div className="space-y-4 pt-1 text-center">
          <div className="select-all rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-500/10 px-4 py-5 font-mono text-2xl font-black tracking-[0.2em] text-amber-600 dark:text-amber-300">{couponReveal?.code}</div>
          <p className="text-[12px] text-[#64748B]">Kodni saqlab qo‘ying — u qayta ko‘rsatilmasligi mumkin.</p>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(couponReveal?.code ?? '');
              push(ok ? 'success' : 'error', ok ? 'Kod nusxalandi' : 'Nusxalab bo‘lmadi — kodni qo‘lda belgilang');
            }}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20"
          >
            Kodni nusxalash
          </button>
        </div>
      </GlassModal>

      <GlassModal open={levelUp !== null} onClose={() => setLevelUp(null)} title="Yangi daraja! 🎉" description="Tabriklaymiz — siz yuqoriga ko‘tarildingiz." size="sm">
        <div className="space-y-3 pt-1 text-center">
          <div className="text-6xl font-black text-amber-500">{levelUp}</div>
          <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Level {levelUp} ga yetdingiz!</p>
          <div className="flex gap-2">
            <button type="button" onClick={handleShare} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold dark:border-white/10">Ulashish ↗</button>
            <button type="button" onClick={() => setLevelUp(null)} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-xs font-bold text-white">Davom etish</button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}

export default GamificationHubPage;

/* ══════════════════════════════════════════════════════════════════
 * BACKEND BILAN BOG'LIQ IZOH (frontend shularsiz ham ishlaydi, lekin to'liq ochilishi uchun)
 *
 *  1. POST /gamification/check-in           → kunlik belgilash (yo'q bo'lsa, toast'da xato chiqadi)
 *  2. GET  /gamification/leaderboard?period → 'week' | 'month' | 'all' (qo'llab-quvvatlanmasa e'tiborsiz qoladi)
 *  3. GET  /gamification/me                 → ixtiyoriy: lastCheckIn, purchasesCount, levelSpan
 *  4. GET  /gamification/leagues            → dailyQuests[].progress / .completed (ixtiyoriy)
 *  5. XAVFSIZLIK: GET /gamification/rewards kupon kodini (couponCode) FAQAT admin'ga qaytarsin.
 *     Talabaga kod faqat POST .../claim javobida kelsin — aks holda har kim kodni
 *     tarmoq javobidan ko'rib, coin to'lamay olishi mumkin.
 *  6. isAdmin tekshiruvi faqat UI uchun; POST/PATCH/DELETE endpointlarda rolni serverda majburiy tekshiring.
 * ══════════════════════════════════════════════════════════════════ */