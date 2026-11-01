import { useAuth } from '@/auth/AuthContext';
/**
 * M-EDU GamificationHub — 
 *
 * Dizayn tamoyillari:
 *  · Liquid Glass 3-qatlam (chromatic fringe + specular + tint)
 *  · Spatial motion — spring physics, har bir harakat fizikaga asoslangan
 *  · Kinetik tipografiya — staggered char reveal
 *  · Particle systems — XP, coin, confetti
 *  · Ceremony moments — level up, rank reveal, reward claim
 *  · Haptic-ready — vibrate() calls (qo'llab-quvvatlangan qurilmalarda)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPageHeader } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { StudentSkillConstellationStudio } from '@/components/gamification/StudentSkillConstellationStudio';
import request from '@/lib/api';

/* ══════════════════════════════════════════════════════════════════
 * 1. TYPES
 * ══════════════════════════════════════════════════════════════════ */

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type LeagueZone = 'PROMOTION' | 'SAFE' | 'RELEGATION';

export const LEAGUE_CONFIG: Record<
  LeagueTier,
  { name: string; icon: string; minXp: number; color: string; badgeBg: string; perk: string }
> = {
  BRONZE: {
    name: 'Bronza Ligasi',
    icon: '🥉',
    minXp: 0,
    color: '#CD7F32',
    badgeBg: 'rgba(205,127,50,0.15)',
    perk: 'Boshlang‘ich daraja, har bir dars uchun standart XP',
  },
  SILVER: {
    name: 'Kumush Ligasi',
    icon: '🥈',
    minXp: 300,
    color: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.15)',
    perk: '+5% qo‘shimcha coinlar bonus va kumush nishon',
  },
  GOLD: {
    name: 'Oltin Ligasi',
    icon: '🥇',
    minXp: 700,
    color: '#F59E0B',
    badgeBg: 'rgba(245,158,11,0.15)',
    perk: '+10% coinlar va do‘konda eksklyuziv chegirmalar',
  },
  PLATINUM: {
    name: 'Platina Ligasi',
    icon: '💠',
    minXp: 1500,
    color: '#06B6D4',
    badgeBg: 'rgba(6,182,212,0.15)',
    perk: '+15% coinlar, mentor bilan VIP chat sessiyasi',
  },
  DIAMOND: {
    name: 'Olmos Ligasi',
    icon: '💎',
    minXp: 3000,
    color: '#8B5CF6',
    badgeBg: 'rgba(139,92,246,0.15)',
    perk: '+25% coinlar, premium chempionlik avatar ramkasi',
  },
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
  myLeague?: {
    tier: LeagueTier;
    xp: number;
    coins: number;
    level: number;
  } | null;
}


interface StudentStats {
  xp: number;
  coins: number;
  level: number;
  xpToNextLevel: number;
  rank: number | null;
  rankTotal: number;
  streak?: number;
  lastCheckIn?: string;
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
  category: string;
  icon: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: { current: number; total: number };
}

/* ══════════════════════════════════════════════════════════════════
 * 2. TOKENS
 * ══════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy:   { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth:   { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  gentle:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  bouncy:   { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_BACK = [0.34, 1.56, 0.64, 1] as const;

/* ══════════════════════════════════════════════════════════════════
 * 3. LIQUID GLASS PRIMITIVE
 * ══════════════════════════════════════════════════════════════════ */

interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  radius?: string;
  tint?: string;
  intensity?: number;
  elevated?: boolean;
  spotlight?: boolean;
}

function LiquidGlass({
  children,
  className = '',
  radius = '1.5rem',
  tint = 'transparent',
  elevated = false,
}: LiquidGlassProps) {
  return (
    <div
      className={`liquid-glass-card liquid-glass-surface relative overflow-hidden transition-all duration-300 ${
        elevated ? 'shadow-xl -translate-y-0.5' : 'shadow-sm'
      } ${className}`}
      style={{
        borderRadius: radius,
      }}
    >
      {tint !== 'transparent' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-colors duration-500"
          style={{ borderRadius: radius, background: tint }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4. XP PARTICLES — progress bar to'lganda oltin zarralar
 * ══════════════════════════════════════════════════════════════════ */

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  velocity: number;
  size: number;
  color: string;
  duration: number;
}

function XPParticles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const newParticles: Particle[] = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      x: 0,
      y: 0,
      angle: (Math.PI * 2 * i) / 24 + Math.random() * 0.3,
      velocity: 60 + Math.random() * 100,
      size: 3 + Math.random() * 5,
      color: ['#FFD60A', '#F59E0B', '#FF2D55', '#6366F1'][i % 4],
      duration: 0.8 + Math.random() * 0.6,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 1600);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!particles.length) return null;

  return (
    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            background: p.color,
            width: p.size,
            height: p.size,
            boxShadow: `0 0 10px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.velocity,
            y: Math.sin(p.angle) * p.velocity,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: p.duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. COIN FLIP — raqam o'zgarganda 3D flip
 * ══════════════════════════════════════════════════════════════════ */

function CoinValue({ value }: { value: number }) {
  const prevRef = useRef(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 600);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <motion.span
      animate={flipping ? { rotateX: [0, 360], scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.6, ease: EASE_OUT_BACK }}
      style={{ transformStyle: 'preserve-3d', display: 'inline-block' }}
    >
      {value.toLocaleString('uz-UZ')}
    </motion.span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. LEVEL RING — conic gradient progress
 * ══════════════════════════════════════════════════════════════════ */

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex h-[88px] w-[88px] items-center justify-center">
      {/* SVG progress ring */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <motion.circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke="url(#levelGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,214,10,0.6))' }}
        />
        <defs>
          <linearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD60A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FF2D55" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center content */}
      <div className="relative flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">LVL</span>
        <motion.span
          className="text-2xl font-black text-white"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING.bouncy, delay: 0.3 }}
        >
          {level}
        </motion.span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. STREAK FLAME — kun seriyasi
 * ══════════════════════════════════════════════════════════════════ */

function StreakFlame({ streak }: { streak: number }) {
  const { t } = useSafeI18n();
  return (
    <div className="relative flex items-center gap-3">
      <motion.div
        className="relative flex h-12 w-12 items-center justify-center text-2xl"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Glow behind flame */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)',
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <span className="relative">🔥</span>
      </motion.div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-orange-300">
          {t('gamification.dailyStreak')}
        </div>
        <div className="text-lg font-black text-white">
          {streak} kun
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. CONFETTI — sovrin sotib olinganda
 * ══════════════════════════════════════════════════════════════════ */

function Confetti({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    if (!trigger) return;
    setBursts([trigger]);
    const t = setTimeout(() => setBursts([]), 2500);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!bursts.length) return null;

  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1.8 + Math.random() * 1.2,
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 720 - 360,
    color: ['#FFD60A', '#FF2D55', '#6366F1', '#2563EB', '#10B981', '#F59E0B'][i % 6],
    drift: (Math.random() - 0.5) * 200,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: window.innerHeight + 40,
            x: p.drift,
            rotate: p.rotation,
            opacity: [1, 1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.5, 0, 0.8, 0.4],
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 9. PODIUM CEREMONY
 * ══════════════════════════════════════════════════════════════════ */

function PodiumStep({ entry, place, delay, onOpenSidecar }: { entry: LeaderboardEntry; place: 1 | 2 | 3; delay: number; onOpenSidecar?: () => void }) {
  const styles = {
    1: {
      emoji: '👑',
      height: 'h-40',
      gradient: 'from-amber-500/30 via-amber-400/20 to-transparent',
      border: 'border-amber-400/40',
      ring: 'ring-amber-400/40',
      shadow: 'shadow-[0_20px_60px_-15px_rgba(255,214,10,0.5)]',
      offset: 'sm:-translate-y-4',
      medalColor: 'text-amber-300',
    },
    2: {
      emoji: '🥈',
      height: 'h-32',
      gradient: 'from-slate-300/20 via-slate-400/10 to-transparent',
      border: 'border-slate-300/30',
      ring: 'ring-slate-300/30',
      shadow: 'shadow-[0_15px_40px_-10px_rgba(203,213,225,0.3)]',
      offset: 'sm:mt-6',
      medalColor: 'text-slate-300',
    },
    3: {
      emoji: '🥉',
      height: 'h-28',
      gradient: 'from-orange-700/25 via-orange-600/10 to-transparent',
      border: 'border-orange-500/30',
      ring: 'ring-orange-500/30',
      shadow: 'shadow-[0_15px_40px_-10px_rgba(234,88,12,0.3)]',
      offset: 'sm:mt-10',
      medalColor: 'text-orange-400',
    },
  }[place];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING.bouncy, delay }}
      className={`relative flex flex-col items-center cursor-pointer group ${styles.offset}`}
      onClick={onOpenSidecar}
    >
      <div className={`relative flex w-full flex-col items-center rounded-3xl border ${styles.border} bg-gradient-to-b ${styles.gradient} p-5 text-center backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl ${styles.shadow}`}>
        {/* Medal floating */}
        <motion.div
          className="mb-3 text-4xl"
          animate={{ y: [0, -6, 0], rotate: [0, -8, 8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          {styles.emoji}
        </motion.div>

        {/* Avatar */}
        <div className={`relative mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-lg font-black text-white ring-2 ${styles.ring}`}>
          {entry.studentName.charAt(0).toUpperCase()}
        </div>

        <div className="font-bold text-white text-sm truncate w-full">{entry.studentName}</div>
        <div className="text-[11px] text-slate-400 truncate w-full mb-3">{entry.groupName || 'Guruh'}</div>

        <div className={`rounded-xl bg-black/30 border ${styles.border} px-3 py-1.5 text-xs font-black ${styles.medalColor} mb-2`}>
          {entry.xp} XP · {entry.coins} 🪙
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSidecar?.();
          }}
          className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-md transition-all hover:bg-white/20"
        >
          ◨ Sidecar
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 10. REWARD CARD — shine effect + claim
 * ══════════════════════════════════════════════════════════════════ */

interface RewardCardProps {
  reward: RewardItem;
  canAfford: boolean;
  isPending: boolean;
  onClaim: () => void;
  index: number;
}

function RewardCard({ reward, canAfford, isPending, onClaim, index }: RewardCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.smooth, delay: index * 0.05 }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative"
    >
      <LiquidGlass
        radius="1.5rem"
        className="h-full p-5"
        elevated={hovered}
      >
        {/* Shine sweep */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20"
              initial={{ x: '-150%' }}
              animate={{ x: '150%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              style={{
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)',
                borderRadius: '1.5rem',
              }}
              aria-hidden
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between mb-3">
              <motion.span
                className="text-4xl"
                animate={hovered ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
                transition={SPRING.bouncy}
              >
                {reward.icon}
              </motion.span>
              <div className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-300">
                <span className="text-[10px]">🪙</span>
                {reward.costCoins}
              </div>
            </div>
            <h5 className="font-bold text-[#1D1D1F] dark:text-white text-[15px] tracking-tight">{reward.title}</h5>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {reward.description}
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 dark:border-white/10">
            <motion.button
              type="button"
              disabled={!canAfford || isPending}
              onClick={onClaim}
              whileHover={canAfford && !isPending ? { scale: 1.02 } : {}}
              whileTap={canAfford && !isPending ? { scale: 0.98 } : {}}
              className={`relative w-full overflow-hidden rounded-xl py-2.5 text-[12px] font-bold transition-all ${
                canAfford
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_15px_-4px_rgba(16,185,129,0.6)]'
                  : 'bg-black/[0.04] dark:bg-white/[0.05] text-[#64748B] dark:text-slate-500 cursor-not-allowed'
              }`}
              
              
              >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Sotib olinmoqda…
                </span>
              ) : canAfford ? (
                <span className="flex items-center justify-center gap-1.5">
                  Xarid qilish
                  <motion.span
                    animate={{ x: hovered ? 3 : 0 }}
                    transition={SPRING.snappy}
                  >
                    →
                  </motion.span>
                </span>
              ) : (
                <span>Yetarli emas ({reward.costCoins} 🪙 kerak)</span>
              )}
            </motion.button>
          </div>
        </div>
      </LiquidGlass>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 11. DAILY CHECK-IN
 * ══════════════════════════════════════════════════════════════════ */

function DailyCheckIn({ streak = 0 }: { streak?: number }) {
  const { t } = useSafeI18n();
  const days = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;
  const checkedIn = streak > 0;

  return (
    <LiquidGlass radius="1.5rem" className="p-4" spotlight={false}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            {t('gamification.dailyCheckIn')}
          </span>
        </div>
        <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400">
          {checkedIn ? '✓ Bajarildi' : 'Bugun kutilmoqda'}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const isPast = i < todayIndex;
          const isToday = i === todayIndex;
          const isDone = isPast || (isToday && checkedIn);
          return (
            <motion.div
              key={d}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING.smooth, delay: i * 0.04 }}
              className={`relative flex flex-col items-center gap-1 rounded-xl py-2 ${
                isToday ? 'ring-2 ring-amber-400/50' : ''
              }`}
            >
              <span className="text-[10px] font-bold uppercase text-[#64748B]">{d}</span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${
                  isDone
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]'
                    : isToday
                    ? 'bg-amber-400/20 text-amber-500 dark:text-amber-400 ring-1 ring-amber-400/40'
                    : 'bg-black/[0.04] dark:bg-white/[0.05] text-[#64748B]'
                }`}
              >
                {isDone ? '✓' : isToday ? '●' : '·'}
              </div>
            </motion.div>
          );
        })}
      </div>
    </LiquidGlass>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 12. ACHIEVEMENT BADGE
 * ══════════════════════════════════════════════════════════════════ */

function AchievementBadge({ achievement, index }: { achievement: Achievement; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING.bouncy, delay: index * 0.05 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center text-center"
    >
      <motion.div
        animate={achievement.unlocked && hovered ? { scale: 1.1, rotate: [0, -6, 6, 0] } : { scale: 1 }}
        transition={SPRING.bouncy}
        className={`relative flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${
          achievement.unlocked
            ? 'bg-gradient-to-br from-amber-400/30 to-orange-500/20 ring-1 ring-amber-400/40'
            : 'bg-black/[0.04] dark:bg-white/[0.05]'
        }`}
      >
        {achievement.unlocked && (
          <motion.span
            className="absolute inset-0 rounded-2xl"
            style={{ background: 'radial-gradient(circle, rgba(255,214,10,0.35), transparent 70%)' }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
        <span className={`relative ${!achievement.unlocked ? 'grayscale opacity-40' : ''}`}>
          {achievement.icon}
        </span>
        {!achievement.unlocked && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white ring-2 ring-white dark:ring-[#131622]">
            🔒
          </span>
        )}
      </motion.div>
      <div className={`mt-2 text-[11px] font-bold tracking-tight ${achievement.unlocked ? 'text-[#1D1D1F] dark:text-white' : 'text-[#64748B]'}`}>
        {achievement.title}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 13. MAIN PAGE
 * ══════════════════════════════════════════════════════════════════ */

export function GamificationHubPage() {
  const { user } = useAuth();
  const { t } = useSafeI18n();
  usePageTitle('M-Coins & Gamifikatsiya');
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'leagues' | 'store' | 'skillTree'>('leaderboard');
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<LeagueTier | 'ALL'>('ALL');
  const [xpParticleTrigger, setXpParticleTrigger] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Queries ── */
  const { data: myStats, refetch: refetchMe } = useQuery<StudentStats>({
    queryKey: ['gamification-me'],
    queryFn: () => request('/gamification/me'),
  });

  const { data: leaderboardData, isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery<{ items: LeaderboardEntry[] }>({
    queryKey: ['gamification-leaderboard'],
    queryFn: () => request('/gamification/leaderboard?limit=25'),
  });

  const { data: leagueOverview } = useQuery<LeagueOverviewResponse>({
    queryKey: ['gamification-leagues'],
    queryFn: () => request('/gamification/leagues'),
  });

  const { data: rewardsData, refetch: refetchRewards } = useQuery<{ items: RewardItem[] }>({
    queryKey: ['gamification-rewards'],
    queryFn: () => request('/gamification/rewards'),
  });

  const rewards = rewardsData?.items || [];
  const rawLeaderboard = leaderboardData?.items || [];
  const leaderboard = useMemo(() => {
    if (selectedLeagueFilter === 'ALL') return rawLeaderboard;
    return rawLeaderboard.filter((e) => e.league === selectedLeagueFilter);
  }, [rawLeaderboard, selectedLeagueFilter]);
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  /* ── Open student sidecar ── */
  const handleOpenStudentSidecar = (entry: LeaderboardEntry, rank?: number) => {
    playPop();
    const resolvedRank = rank ?? entry.rank;
    openSidecar({
      title: entry.studentName,
      subtitle: `${entry.groupName || 'Guruh'} • #${resolvedRank} o'rin`,
      badge: {
        text: `LVL ${entry.level}`,
        tone: resolvedRank <= 3 ? 'amber' : 'purple',
      },
      status: {
        label: resolvedRank <= 3 ? 'Top 3 Lider' : 'Faol Ishtirokchi',
        tone: resolvedRank <= 3 ? 'amber' : 'emerald',
      },
      metrics: [
        { label: 'Tajriba (XP)', value: `${entry.xp} XP` },
        { label: 'M-Coins', value: `${entry.coins} 🪙` },
        { label: 'Daraja', value: `Level ${entry.level}` },
        { label: 'O\'rin', value: `#${resolvedRank}` },
      ],
      details: [
        { label: 'Talaba ID', value: entry.studentId },
        { label: 'F.I.SH', value: entry.studentName },
        { label: 'Guruh', value: entry.groupName || 'Biriktirilmagan' },
        { label: 'M-Coins Balansi', value: `${entry.coins} ta tanga` },
        { label: 'Yutuqlar', value: resolvedRank === 1 ? '🥇 Chempion unvoni' : resolvedRank <= 3 ? '🏆 Podium sovrindori' : 'O\'quv yulduzi' },
      ],
      actions: [
        {
          label: 'Profilga o\'tish',
          variant: 'primary',
          onClick: () => {
            window.location.href = `/students/${entry.studentId}`;
          },
        },
      ],
    });
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setActiveTab('leaderboard');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setActiveTab('store');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        refetchMe();
        refetchLeaderboard();
        refetchRewards();
        push('info', 'Gamifikatsiya ma\'lumotlari yangilandi');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, refetchMe, refetchLeaderboard, refetchRewards, push]);

  /* ── Claim mutation ── */
  const claimMutation = useMutation({
    mutationFn: (rewardId: string) =>
      request(`/gamification/rewards/${rewardId}/claim`, { method: 'POST' }),
    onSuccess: (res: any) => {
      playSuccess();
      push('success', res?.message || '🎉 Sovrin muvaffaqiyatli xarid qilindi!');
      setConfettiTrigger(Date.now());
      // Haptic feedback (mobile)
      if ('vibrate' in navigator) navigator.vibrate?.([10, 30, 10]);
      queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
      queryClient.invalidateQueries({ queryKey: ['gamification-rewards'] });
    },
    onError: (err: any) => {
      playError();
      push('error', err?.message || 'Coinlar yetarli emas');
      if ('vibrate' in navigator) navigator.vibrate?.(80);
    },
  });

  const currentCoins = myStats?.coins ?? 0;
  const currentXp = myStats?.xp ?? 0;
  const currentLevel = myStats?.level ?? 1;
  const xpToNext = myStats?.xpToNextLevel ?? 100;
  const xpInLevel = 100 - xpToNext;
  const streak = myStats?.streak ?? 0;

  /* ── Categories from rewards ── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    rewards.forEach((r) => set.add(r.category));
    return ['all', ...Array.from(set)];
  }, [rewards]);

  /* ── Filtered rewards ── */
  const filteredRewards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rewards.filter((r) => {
      const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
      const matchQ = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [rewards, categoryFilter, searchQuery]);

  /* ── Milestone achievements (evaluated from genuine stats) ── */
  const achievements: Achievement[] = useMemo(() => [
    { id: '1', title: 'Ilk qadam', description: 'Birinchi darsni yakunlang', icon: '🎯', unlocked: currentXp > 0 },
    { id: '2', title: '5 kunlik', description: '5 kun ketma-ket kiring', icon: '🔥', unlocked: streak >= 5 },
    { id: '3', title: 'XP ustasi', description: '1000 XP to\'plang', icon: '⚡', unlocked: currentXp >= 1000, progress: { current: currentXp, total: 1000 } },
    { id: '4', title: 'Kollektsioner', description: '10 sovrin sotib oling', icon: '🎁', unlocked: false },
    { id: '5', title: 'Top-3', description: 'Reytingda top-3 ga kiring', icon: '🏆', unlocked: (myStats?.rank != null && myStats.rank > 0 && myStats.rank <= 3) },
    { id: '6', title: 'Boy', description: '5000 coin yig\'ing', icon: '💎', unlocked: currentCoins >= 5000, progress: { current: currentCoins, total: 5000 } },
  ], [streak, currentXp, currentCoins, myStats?.rank]);

  /* ── XP progress animation trigger ── */
  useEffect(() => {
    if (myStats?.xp) setXpParticleTrigger(Date.now());
  }, [myStats?.xp]);

  return (
    <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh variant="playful" />
      <Confetti trigger={confettiTrigger} />

      <GlassPageHeader
        title="M-Coins & Gamifikatsiya"
        subtitle="Darslarda faol bo'ling, ballar to'plang va qimmatbaho sovrinlarga ega bo'ling!"
      />

      {/* ═══════════ HERO STATS CARD ═══════════ */}
      <LiquidGlass radius="2rem" className="p-6" tint="rgba(88,86,214,0.05)" elevated>
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px]" aria-hidden />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" aria-hidden />

        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          {/* Level ring */}
          <div className="flex items-center gap-5 md:col-span-4">
            <LevelRing level={currentLevel} progress={(xpInLevel / 100) * 100} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-500 dark:text-amber-300">
                Daraja
              </div>
              <motion.div
                className="text-3xl font-black tracking-tight text-[#1D1D1F] dark:text-white"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.smooth, delay: 0.2 }}
              >
                {currentLevel}
              </motion.div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Faol o'quvchi</div>
            </div>
          </div>

          {/* Coins */}
          <div className="flex items-center gap-4 md:col-span-3">
            <motion.div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                background: 'linear-gradient(135deg, #FFD60A 0%, #F59E0B 100%)',
                boxShadow: '0 10px 30px -8px rgba(245,158,11,0.6)',
              }}
              animate={{ rotate: [0, -3, 3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              🪙
              <motion.span
                className="absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6), transparent 60%)' }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
            </motion.div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-500 dark:text-amber-300">
                {t('gamification.mCoinsBalance')}
              </div>
              <div className="text-3xl font-black tracking-tight text-[#1D1D1F] dark:text-white">
                <CoinValue value={currentCoins} />
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">{t('gamification.forPurchases')}</div>
            </div>
          </div>

          {/* XP Progress + streak + rank */}
          <div className="md:col-span-5 space-y-3">
            {/* XP bar */}
            <div className="relative">
              <div className="flex justify-between text-[11px] font-semibold mb-2">
                <span className="text-[#64748B] dark:text-slate-400">
                  {t('gamification.nextLevel')} <span className="text-indigo-500 dark:text-indigo-300 font-bold">{xpToNext} XP</span>
                </span>
                <span className="text-[#1D1D1F] dark:text-white font-bold tabular-nums">
                  {currentXp} / {(Math.floor(currentXp / 100) + 1) * 100}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 dark:bg-white/[0.08] p-[2px]">
                <motion.div
                  className="relative h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #5E5CE6 0%, #6366F1 100%)',
                    boxShadow: '0 0 20px rgba(94,92,230,0.5)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - xpToNext}%` }}
                  transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.3 }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/20 to-white/40" />
                </motion.div>
                {/* XP Particles */}
                <XPParticles trigger={xpParticleTrigger} />
              </div>
            </div>

            {/* Streak + Rank */}
            <div className="flex items-center justify-between pt-1">
              <StreakFlame streak={streak || 5} />
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
                  Reyting
                </div>
                <div className="text-lg font-black text-[#1D1D1F] dark:text-white">
                  #{myStats?.rank || 1}
                  <span className="text-[11px] font-semibold text-[#64748B] ml-1">
                    / {myStats?.rankTotal || 128}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LiquidGlass>

      {/* ═══════════ DAILY CHECK-IN + ACHIEVEMENTS ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyCheckIn streak={streak || 5} />

        <LiquidGlass radius="1.5rem" className="p-4" spotlight={false}>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Yutuqlar
            </span>
            <span className="text-[11px] font-bold text-[#1D1D1F] dark:text-white">
              {achievements.filter((a) => a.unlocked).length} / {achievements.length}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-1">
            {achievements.map((a, i) => (
              <AchievementBadge key={a.id} achievement={a} index={i} />
            ))}
          </div>
        </LiquidGlass>
      </div>

      {/* ═══════════ TABS ═══════════ */}
      <div className="flex items-center justify-center gap-2">
        <TabButton
          active={activeTab === 'leaderboard'}
          onClick={() => {
            playTick();
            setActiveTab('leaderboard');
          }}
          icon="🏆"
          label="Reyting" />
        <TabButton
          active={activeTab === 'leagues'}
          onClick={() => {
            playTick();
            setActiveTab('leagues');
          }}
          icon="🛡️"
          label="Ligalar & Mavsum" />
        <TabButton
          active={activeTab === 'store'}
          onClick={() => {
            playTick();
            setActiveTab('store');
          }}
          icon="🛍️"
          label="M-Coins Do'koni" />
        <TabButton
          active={activeTab === 'skillTree'}
          onClick={() => {
            playTick();
            setActiveTab('skillTree');
          }}
          icon="⚡"
          label="Mahorat Shajarasi (Skill Tree)" />
      </div>

      {/* ═══════════ TAB: LEADERBOARD ═══════════ */}
      <AnimatePresence mode="wait">
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="space-y-6"
          >
            {/* Season Status Bar */}
            {leagueOverview?.season && (
              <LiquidGlass radius="1.25rem" className="p-4 border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-lg shadow-md shadow-amber-500/20">
                      🏆
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          {leagueOverview.season.title}
                        </span>
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                          {leagueOverview.season.daysRemaining} kun qoldi
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        Top {leagueOverview.season.promotionZonePct}% yuqori ligaga ko‘tariladi • Pastki {leagueOverview.season.relegationZonePct}% tushish xavfida
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <span>Mavsum yakuni: oy oxiri</span>
                  </div>
                </div>
              </LiquidGlass>
            )}

            {/* League Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setSelectedLeagueFilter('ALL');
                }}
                className={`min-h-[36px] rounded-xl px-3 py-1.5 font-bold transition-all ${
                  selectedLeagueFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                }`}
              >
                Barchasi ({rawLeaderboard.length})
              </button>
              {(['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as LeagueTier[]).map((tier) => {
                const conf = LEAGUE_CONFIG[tier];
                const count = rawLeaderboard.filter((e) => e.league === tier).length;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      playTick();
                      setSelectedLeagueFilter(tier);
                    }}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      selectedLeagueFilter === tier
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                    }`}
                  >
                    <span>{conf.icon}</span>
                    <span>{conf.name.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 pb-2 items-end">
                {top3[1] && <PodiumStep entry={top3[1]} place={2} delay={0.1} onOpenSidecar={() => handleOpenStudentSidecar(top3[1], 2)} />}
                {top3[0] && <PodiumStep entry={top3[0]} place={1} delay={0} onOpenSidecar={() => handleOpenStudentSidecar(top3[0], 1)} />}
                {top3[2] && <PodiumStep entry={top3[2]} place={3} delay={0.2} onOpenSidecar={() => handleOpenStudentSidecar(top3[2], 3)} />}
              </div>
            )}

            {/* Rest of the table */}
            <LiquidGlass radius="1.5rem" className="p-5">
              <div className="flex items-center justify-between mb-4 px-1">
                <h4 className="font-bold text-sm text-[#1D1D1F] dark:text-white tracking-tight">
                  {t('gamification.generalRating')}
                </h4>
                <span className="text-[11px] font-bold text-[#64748B]">
                  Jami {leaderboard.length} ishtirokchi
                </span>
              </div>

              <div className="space-y-1.5">
                {loadingLeaderboard ? (
                  <SkeletonRows count={5} />
                ) : leaderboard.length === 0 ? (
                  <EmptyState
                    icon="🏆"
                    title="Reyting bo'sh"
                    description="Birinchi bo'lib XP to'plang va reytingda ko'rinilsin!"
                  />
                ) : (
                  rest.map((entry, idx) => (
                    <LeaderRow
                      key={entry.studentId}
                      entry={entry}
                      rank={idx + 4}
                      index={idx}
                      onOpenSidecar={() => handleOpenStudentSidecar(entry, idx + 4)}
                    />
                  ))
                )}
              </div>
            </LiquidGlass>
          </motion.div>
        )}


        {/* ═══════════ TAB: LEAGUES & QUESTS ═══════════ */}
        {activeTab === 'leagues' && (
          <motion.div
            key="leagues"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="space-y-6"
          >
            {/* Season Progression Header */}
            <LiquidGlass radius="1.5rem" className="p-6 border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-surface-900/40 to-purple-950/20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                    Oylik Liga Tizimi
                  </span>
                  <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                    {leagueOverview?.season.title || "2026-yil Mavsumi"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Har bir to‘plangan XP sizni yuqori ligaga va nufuzli mukofotlarga yaqinlashtiradi.
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-center">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-300 tabular-nums">
                    {leagueOverview?.season.daysRemaining || 5} kun
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Mavsum tugashiga
                  </div>
                </div>
              </div>
            </LiquidGlass>

            {/* League Tiers Ladder */}
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 px-1">
                Ligalarning 5 Bosqichi
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {leagueOverview?.leagues.map((lg) => {
                  const isCurrent = myStats?.league === lg.tier;
                  return (
                    <LiquidGlass
                      key={lg.tier}
                      radius="1.25rem"
                      className={`p-4 border transition-all ${
                        isCurrent
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                          : 'border-slate-200/80 dark:border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                            style={{ backgroundColor: lg.badgeBg }}
                          >
                            {lg.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900 dark:text-white">
                                {lg.name}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                  Sizning Ligangiz
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {lg.perk}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                            {lg.minXp === 0 ? '0+' : `${lg.minXp}+ XP`}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            {lg.studentsCount} nafar talaba
                          </div>
                        </div>
                      </div>
                    </LiquidGlass>
                  );
                })}
              </div>
            </div>

            {/* Daily Quests Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 px-1">
                Kunlik O‘quv Missiyalari (Quests)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {leagueOverview?.dailyQuests.map((q) => (
                  <LiquidGlass key={q.id} radius="1.25rem" className="p-4 border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-2xl">{q.icon}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                            +{q.xp} XP
                          </span>
                          <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                            +{q.coins} 🪙
                          </span>
                        </div>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {q.title}
                      </h5>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {q.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span>✓ Avtomatik qayd etiladi</span>
                    </div>
                  </LiquidGlass>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ TAB: STORE ═══════════ */}
        {activeTab === 'store' && (
          <motion.div
            key="store"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="space-y-4"
          >
            {/* Info banner */}
            <LiquidGlass radius="1.5rem" className="p-4" tint="rgba(94,92,230,0.04)" spotlight={false}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-2xl ring-1 ring-indigo-500/30">
                    🛍️
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-[#1D1D1F] dark:text-white tracking-tight">
                      M-Coins Do'koni
                    </h4>
                    <p className="text-[12px] text-[#64748B] dark:text-slate-400">
                      Tangalarni real sovg'alarga almashtiring
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Balans
                  </div>
                  <div className="text-xl font-black text-amber-500 dark:text-amber-300">
                    <CoinValue value={currentCoins} /> 🪙
                  </div>
                </div>
              </div>
            </LiquidGlass>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Sovrin qidirish…"
                  className="w-full rounded-full border border-slate-200/80 dark:border-slate-800 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] py-2.5 pl-10 pr-4 text-[13px] outline-none placeholder:text-[#64748B] focus:border-indigo-400/40 focus:bg-white dark:focus:bg-white/[0.08]"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold tracking-tight transition-all ${
                      categoryFilter === cat
                        ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] shadow-lg'
                        : 'bg-black/[0.04] dark:bg-white/[0.05] text-[#64748B] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-white/[0.08]'
                    }`}
                    
                    
                    >
                    {cat === 'all' ? 'Hammasi' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Rewards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRewards.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon="🔍"
                    title="Sovrin topilmadi"
                    description="Filtrlarni o'zgartirib ko'ring yoki qidiruvni tozalang"
                  />
                </div>
              ) : (
                filteredRewards.map((reward, i) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    canAfford={currentCoins >= reward.costCoins}
                    isPending={claimMutation.isPending && claimMutation.variables === reward.id}
                    onClaim={() => claimMutation.mutate(reward.id)}
                    index={i}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════════ TAB: SKILL TREE (CONSTELLATION MAP) ═══════════ */}
        {activeTab === 'skillTree' && (
          <motion.div
            key="skillTree"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="space-y-6"
          >
            <StudentSkillConstellationStudio
              studentName={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || "Talaba"}
              studentLevel={myStats?.level || 7}
              onSkillUnlocked={(_id, _xp, coins) => {
                setXpParticleTrigger(Date.now());
                if (coins > 50) setConfettiTrigger(Date.now());
                void refetchMe();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 14. SUPPORTING COMPONENTS
 * ══════════════════════════════════════════════════════════════════ */

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING.snappy}
      className={`relative flex items-center gap-2 rounded-2xl px-6 py-3 text-[13px] font-bold tracking-tight transition-colors ${
        active ? 'text-white' : 'text-[#64748B] dark:text-slate-400 hover:text-[#1D1D1F] dark:hover:text-white'
      }`}
      
      
      >
      {active && (
        <motion.span
          layoutId="tabPill"
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #5E5CE6 0%, #6366F1 100%)',
            boxShadow: '0 10px 30px -8px rgba(94,92,230,0.5)',
          }}
          transition={SPRING.smooth}
        />
      )}
      <span className="relative z-10 text-base">{icon}</span>
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

function LeaderRow({ entry, rank, index, onOpenSidecar }: { entry: LeaderboardEntry; rank: number; index: number; onOpenSidecar?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.smooth, delay: Math.min(index * 0.03, 0.4) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpenSidecar}
      className="liquid-glass-surface flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 shrink-0 text-[13px] font-black tabular-nums text-[#64748B]">
          #{rank}
        </span>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-[12px] font-black text-[#1D1D1F] dark:text-white ring-1 ring-black/[0.06] dark:ring-white/10">
          {entry.studentName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-[#1D1D1F] dark:text-white tracking-tight">
            {entry.studentName}
          </div>
          {entry.groupName && (
            <div className="truncate text-[11px] text-[#64748B]">{entry.groupName}</div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {entry.league && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              backgroundColor: LEAGUE_CONFIG[entry.league]?.badgeBg || 'rgba(0,0,0,0.05)',
              color: LEAGUE_CONFIG[entry.league]?.color || '#6366F1',
            }}
          >
            <span>{LEAGUE_CONFIG[entry.league]?.icon}</span>
            <span className="hidden sm:inline">{LEAGUE_CONFIG[entry.league]?.name.split(' ')[0]}</span>
          </span>
        )}
        {entry.zone === 'PROMOTION' ? (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400" title="Ko‘tarilish zonasi">
            <span>⬆️</span>
          </span>
        ) : entry.zone === 'RELEGATION' ? (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-black text-rose-600 dark:text-rose-400" title="Tushish xavfi">
            <span>⚠️</span>
          </span>
        ) : null}
        <span className="text-[12px] font-bold tabular-nums text-[#1D1D1F] dark:text-white">
          {entry.xp} XP
        </span>
        <motion.span
          className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-black tabular-nums text-amber-500 dark:text-amber-300"
          animate={hovered ? { scale: 1.05 } : { scale: 1 }}
          transition={SPRING.snappy}
        >
          {entry.coins} 🪙
        </motion.span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSidecar?.();
          }}
          className="rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm transition-all hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Tafsilotlar (Sidecar)"
        >
          ◨
        </button>
      </div>
    </motion.div>
  );
}

function SkeletonRows({ count }: { count: number }) {

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-3"
        >
          <div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-800 dark:bg-white/[0.06] animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 dark:bg-white/[0.06] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800 dark:bg-white/[0.06] animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
          </div>
          <div className="h-6 w-16 rounded-xl bg-slate-200 dark:bg-slate-800 dark:bg-white/[0.06] animate-pulse" />
        </div>
      ))}
    </>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING.smooth}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        className="mb-4 text-5xl opacity-40"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon}
      </motion.div>
      <h5 className="text-[14px] font-bold text-[#1D1D1F] dark:text-white tracking-tight">{title}</h5>
      <p className="mt-1 max-w-xs text-[12px] text-[#64748B]">{description}</p>
    </motion.div>
  );
}

export default GamificationHubPage;