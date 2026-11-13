import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import request from '@/lib/api';
import { useToast } from '@/components/ui/GlassToast';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { ArenaQuestionsStudio } from '@/components/arena/ArenaQuestionsStudio';
import { ArenaBattleStage } from '@/components/arena/ArenaBattleStage';
import { ArenaAcademicDiagnostics } from '@/components/arena/ArenaAcademicDiagnostics';
import { ArenaMistakeVault } from '@/components/arena/ArenaMistakeVault';
import { ArenaBlitzSurvival } from '@/components/arena/ArenaBlitzSurvival';
import { ArenaTournamentsHub } from '@/components/arena/ArenaTournamentsHub';
import { ArenaAiCoachModal } from '@/components/arena/ArenaAiCoachModal';
import { ArenaTeacherChallengeModal } from '@/components/arena/ArenaTeacherChallengeModal';
import {
  Swords,
  Users,
  Award,
  Brain,
  Trophy,
  Zap,
  RotateCcw,
  Compass,
  Crown,
  GraduationCap,
} from 'lucide-react';
import '@/styles/arena-liquid.css';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export type RarityType = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ArenaTabType =
  | 'battle'
  | 'blitz'
  | 'tournaments'
  | 'diagnostics'
  | 'mistakes'
  | 'studio'
  | 'titles'
  | 'questions'
  | 'leaderboard';
export type AvatarPoseType = 'default' | 'battle' | 'victory';
export type FilterStatusType = 'ALL' | 'UNLOCKED' | 'LOCKED';

export interface ArenaAvatar {
  id: string;
  slug: string;
  name: string;
  title: string;
  description: string;
  element: string;
  rarity: RarityType;
  thumbnailUrl: string;
  defaultRenderUrl: string;
  battleRenderUrl: string;
  victoryRenderUrl: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ArenaTitle {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: RarityType;
  requirementType: string;
  requirementValue: number;
}

export interface DuelProfile {
  id: string;
  studentId: string;
  rating: number;
  peakRating: number;
  totalDuels: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestStreak: number;
  activeAvatar?: ArenaAvatar | null;
  activeTitle?: ArenaTitle | null;
  student: {
    user: {
      firstName: string;
      lastName: string;
      avatar?: string | null;
    };
  };
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws?: number;
  totalDuels?: number; // Fixed missing field from original code
  winRate: number;
  winStreak: number;
  activeAvatar?: ArenaAvatar | null;
  activeTitle?: ArenaTitle | null;
}

interface MyArenaProfileResponse {
  profile: DuelProfile;
  unlockedAvatarsCount: number;
  earnedTitlesCount: number;
  unlockedAvatars: Array<{ avatar: ArenaAvatar }>;
  earnedTitles: Array<{ title: ArenaTitle }>;
}

// ============================================================================
// DESIGN TOKENS & CONSTANTS
// ============================================================================

const RARITY_CONFIG: Record<
  RarityType,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    glow: string;
    badgeGradient: string;
  }
> = {
  COMMON: {
    label: 'Oddiy',
    border: 'border-slate-300 dark:border-slate-500/40',
    bg: 'bg-slate-100/80 dark:bg-slate-500/10',
    text: 'text-slate-700 dark:text-slate-300',
    glow: 'rgba(148, 163, 184, 0.25)',
    badgeGradient: 'from-slate-500 to-slate-600',
  },
  RARE: {
    label: 'Noyob',
    border: 'border-cyan-400/70 dark:border-cyan-500/50',
    bg: 'bg-cyan-50/90 dark:bg-cyan-500/15',
    text: 'text-cyan-700 dark:text-cyan-300',
    glow: 'rgba(6, 182, 212, 0.38)',
    badgeGradient: 'from-cyan-500 to-blue-600',
  },
  EPIC: {
    label: 'Epik',
    border: 'border-purple-400/70 dark:border-purple-500/50',
    bg: 'bg-purple-50/90 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    glow: 'rgba(168, 85, 247, 0.42)',
    badgeGradient: 'from-purple-500 to-fuchsia-600',
  },
  LEGENDARY: {
    label: 'Afsonaviy',
    border: 'border-amber-400/80 dark:border-amber-500/60',
    bg: 'bg-amber-50/90 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    glow: 'rgba(245, 158, 11, 0.5)',
    badgeGradient: 'from-amber-400 via-orange-500 to-rose-500',
  },
};

const RANK_TIERS = [
  { name: 'Bronza Liga', min: 0, max: 1099, icon: '🥉', color: 'text-amber-700 dark:text-amber-500', bar: 'from-amber-700 to-amber-500' },
  { name: 'Kumush Liga', min: 1100, max: 1299, icon: '🥈', color: 'text-slate-500 dark:text-slate-300', bar: 'from-slate-400 to-slate-200' },
  { name: 'Oltin Liga', min: 1300, max: 1549, icon: '🥇', color: 'text-amber-500 dark:text-amber-400', bar: 'from-amber-400 to-yellow-300' },
  { name: 'Platina Liga', min: 1550, max: 1799, icon: '💠', color: 'text-cyan-600 dark:text-cyan-400', bar: 'from-cyan-500 to-teal-400' },
  { name: 'Kiber Olmos', min: 1800, max: 2099, icon: '💎', color: 'text-blue-600 dark:text-blue-400', bar: 'from-blue-500 to-indigo-400' },
  { name: 'Grandmaster', min: 2100, max: 9999, icon: '👑', color: 'text-rose-600 dark:text-rose-400', bar: 'from-rose-500 via-purple-500 to-amber-400' },
];

function getRankTierInfo(rating = 1000) {
  const tier = RANK_TIERS.find((t) => rating >= t.min && rating <= t.max) || RANK_TIERS[0];
  const nextTier = RANK_TIERS[RANK_TIERS.indexOf(tier) + 1];
  const progress = nextTier
    ? Math.min(100, Math.max(0, Math.round(((rating - tier.min) / (nextTier.min - tier.min)) * 100)))
    : 100;
  return { tier, nextTier, progress };
}

function getRequirementProgress(title: ArenaTitle, profile?: DuelProfile | null) {
  const target = Math.max(1, title.requirementValue || 1);
  if (!profile) {
    return { current: 0, target, percent: 0, label: `${target} ta ko‘rsatkich` };
  }

  const type = (title.requirementType || '').toUpperCase();
  let current = 0;
  let unit = 'ta';

  if (type.includes('WIN') && !type.includes('STREAK')) {
    current = profile.wins;
    unit = 'g‘alaba';
  } else if (type.includes('STREAK')) {
    current = Math.max(profile.winStreak, profile.bestStreak);
    unit = 'seriya';
  } else if (type.includes('RATING') || type.includes('ELO')) {
    current = Math.max(profile.rating, profile.peakRating);
    unit = 'reyting';
  } else if (type.includes('DUEL') || type.includes('MATCH') || type.includes('BATTLE')) {
    current = profile.totalDuels;
    unit = 'jang';
  } else {
    current = profile.wins;
    unit = 'ball';
  }

  const percent = Math.min(100, Math.round((current / target) * 100));
  return {
    current,
    target,
    percent,
    label: `${Math.min(current, target)} / ${target} ${unit}`,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MindArenaPage() {
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const { play } = usePremiumSound();
  const { haptic } = useTelegram();

  // Navigation & Interactive UI States
  const [activeTab, setActiveTab] = useState<ArenaTabType>('battle');
  const [selectedPose, setSelectedPose] = useState<AvatarPoseType>('default');
  const [inspectedAvatarId, setInspectedAvatarId] = useState<string | null>(null);
  const [isAiCoachOpen, setIsAiCoachOpen] = useState(false);
  const [isTeacherChallengeOpen, setIsTeacherChallengeOpen] = useState(false);

  // Filters & Search States
  const [rarityFilter, setRarityFilter] = useState<'ALL' | RarityType>('ALL');
  const [statusFilter, setStatusFilter] = useState<FilterStatusType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

  // 1. Fetch current student duel profile
  const {
    data: myData,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery<MyArenaProfileResponse>({
    queryKey: ['arena-my-profile'],
    queryFn: () => request('/arena/profiles/me'),
  });

  // 2. Fetch full catalog of avatars
  const { data: avatarsCatalog = [], isLoading: isAvatarsLoading } = useQuery<ArenaAvatar[]>({
    queryKey: ['arena-avatars-catalog'],
    queryFn: () => request('/arena/avatars'),
  });

  // 3. Fetch full catalog of titles
  const { data: titlesCatalog = [], isLoading: isTitlesLoading } = useQuery<ArenaTitle[]>({
    queryKey: ['arena-titles-catalog'],
    queryFn: () => request('/arena/titles'),
  });

  // 4. Fetch leaderboard
  const {
    data: leaderboard = [],
    isLoading: isLeaderboardLoading,
    isFetching: isLeaderboardFetching,
    refetch: refetchLeaderboard,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['arena-leaderboard'],
    queryFn: () => request('/arena/profiles/leaderboard?limit=25'),
    enabled: activeTab === 'leaderboard',
  });

  const profile = myData?.profile;
  const activeAvatar = profile?.activeAvatar;
  const activeTitle = profile?.activeTitle;

  // Sync inspected avatar in 3D Studio with activeAvatar on initial load
  useEffect(() => {
    if (!inspectedAvatarId && activeAvatar?.id) {
      setInspectedAvatarId(activeAvatar.id);
    } else if (!inspectedAvatarId && avatarsCatalog.length > 0) {
      setInspectedAvatarId(avatarsCatalog[0].id);
    }
  }, [activeAvatar?.id, avatarsCatalog, inspectedAvatarId]);

  // Memoized Sets for O(1) lookup without re-allocating on every render
  const unlockedAvatarIds = useMemo(
    () => new Set(myData?.unlockedAvatars?.map((ua) => ua.avatar.id) || []),
    [myData?.unlockedAvatars]
  );

  const earnedTitleIds = useMemo(
    () => new Set(myData?.earnedTitles?.map((et) => et.title.id) || []),
    [myData?.earnedTitles]
  );

  // Currently previewed avatar on the 3D Hologram Stage
  const previewAvatar = useMemo(() => {
    if (inspectedAvatarId) {
      const found = avatarsCatalog.find((a) => a.id === inspectedAvatarId);
      if (found) return found;
    }
    return activeAvatar || avatarsCatalog[0] || null;
  }, [inspectedAvatarId, avatarsCatalog, activeAvatar]);

  // Filtered Avatars
  const filteredAvatars = useMemo(() => {
    return avatarsCatalog.filter((avatar) => {
      const matchesRarity = rarityFilter === 'ALL' || avatar.rarity === rarityFilter;
      const isUnlocked = unlockedAvatarIds.has(avatar.id) || avatar.isDefault;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'UNLOCKED' && isUnlocked) ||
        (statusFilter === 'LOCKED' && !isUnlocked);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        avatar.name.toLowerCase().includes(q) ||
        avatar.title.toLowerCase().includes(q) ||
        avatar.element.toLowerCase().includes(q);

      return matchesRarity && matchesStatus && matchesSearch;
    });
  }, [avatarsCatalog, rarityFilter, statusFilter, searchQuery, unlockedAvatarIds]);

  // Filtered Titles
  const filteredTitles = useMemo(() => {
    return titlesCatalog.filter((title) => {
      const matchesRarity = rarityFilter === 'ALL' || title.rarity === rarityFilter;
      const isEarned = earnedTitleIds.has(title.id);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'UNLOCKED' && isEarned) ||
        (statusFilter === 'LOCKED' && !isEarned);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        title.name.toLowerCase().includes(q) ||
        title.description.toLowerCase().includes(q);

      return matchesRarity && matchesStatus && matchesSearch;
    });
  }, [titlesCatalog, rarityFilter, statusFilter, searchQuery, earnedTitleIds]);

  // Filtered Leaderboard
  const filteredLeaderboard = useMemo(() => {
    const q = leaderboardSearch.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.activeAvatar?.name.toLowerCase().includes(q) ||
        entry.activeTitle?.name.toLowerCase().includes(q)
    );
  }, [leaderboard, leaderboardSearch]);

  // Avatar Selection Mutation
  const selectAvatarMutation = useMutation({
    mutationFn: (avatarId: string) =>
      request('/arena/profiles/select-avatar', {
        method: 'POST',
        body: JSON.stringify({ avatarId }),
      }),
    onSuccess: (_, avatarId) => {
      play('success');
      haptic('impactLight');
      setInspectedAvatarId(avatarId);
      queryClient.invalidateQueries({ queryKey: ['arena-my-profile'] });
      toast('success', 'Avatar Faollashtirildi', 'Tanlangan kiber-jangchi jangga shay holatga keltirildi!');
    },
    onError: (err: unknown) => {
      play('error');
      haptic('notificationError');
      const message = err instanceof Error ? err.message : 'Avatarni tanlab bo‘lmadi';
      toast('error', 'Xatolik yuz berdi', message);
    },
  });

  // Title Selection Mutation
  const selectTitleMutation = useMutation({
    mutationFn: (titleId: string) =>
      request('/arena/profiles/select-title', {
        method: 'POST',
        body: JSON.stringify({ titleId }),
      }),
    onSuccess: () => {
      play('success');
      haptic('impactLight');
      queryClient.invalidateQueries({ queryKey: ['arena-my-profile'] });
      toast('success', 'Unvon O‘rnatildi', 'Faxriy unvon profilingizga muvaffaqiyatli biriktirildi!');
    },
    onError: (err: unknown) => {
      play('error');
      haptic('notificationError');
      const message = err instanceof Error ? err.message : 'Unvonni biriktirib bo‘lmadi';
      toast('error', 'Xatolik yuz berdi', message);
    },
  });

  // Helpers
  const getPoseUrl = (avatar?: ArenaAvatar | null) => {
    if (!avatar) return '/avatars/arena/cyber-scholar/default.png';
    if (selectedPose === 'battle') return avatar.battleRenderUrl || avatar.defaultRenderUrl;
    if (selectedPose === 'victory') return avatar.victoryRenderUrl || avatar.defaultRenderUrl;
    return avatar.defaultRenderUrl;
  };

  const handleTabChange = (tab: ArenaTabType) => {
    if (tab === activeTab) return;
    play('tick');
    haptic('selection');
    setSearchQuery('');
    setRarityFilter('ALL');
    setStatusFilter('ALL');
    setActiveTab(tab);
  };

  const winRatePercent = useMemo(() => {
    if (!profile || profile.totalDuels === 0) return 0;
    return Math.round((profile.wins / profile.totalDuels) * 100);
  }, [profile]);

  const rankInfo = useMemo(() => getRankTierInfo(profile?.rating ?? 1000), [profile?.rating]);
  const previewRarityStyle = RARITY_CONFIG[previewAvatar?.rarity || 'COMMON'];
  const isPreviewUnlocked = previewAvatar
    ? unlockedAvatarIds.has(previewAvatar.id) || previewAvatar.isDefault
    : true;
  const isPreviewActive = previewAvatar && activeAvatar?.id === previewAvatar.id;

  const TABS: Array<{
    id: ArenaTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    pulse?: boolean;
  }> = [
    { id: 'battle', label: 'Jonli Jang (1v1)', icon: Swords, pulse: true },
    { id: 'blitz', label: 'Tezyurar Blitz (Survival)', icon: Zap },
    { id: 'tournaments', label: 'Sinflar Turniri', icon: Trophy },
    { id: 'diagnostics', label: 'Bilim Tahlili & Kvestlar', icon: Compass },
    { id: 'mistakes', label: 'Xatolar Laboratoriyasi', icon: RotateCcw },
    { id: 'studio', label: '3D Qahramonlar Studiyasi', icon: Users, badge: avatarsCatalog.length },
    { id: 'titles', label: 'Unvonlar & Yutuqlar', icon: Award, badge: titlesCatalog.length },
    { id: 'questions', label: 'Savollar Banki & AI', icon: Brain },
    { id: 'leaderboard', label: 'Chempionlar Reytingi', icon: Crown },
  ];

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-w-0 mx-auto space-y-6 px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-[max(6rem,env(safe-area-inset-bottom))] relative font-sans text-slate-900 dark:text-white select-none">
      {/* Ambient Aurora Mesh Background */}
      <AuroraMesh variant="corporate" opacity={0.65} />

      {/* =====================================================================
          TOP HEADER BANNER — Adaptive Chromatic Liquid Glass
      ===================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="arena-glass rounded-3xl p-5 sm:p-6 md:p-8 border border-black/[0.06] dark:border-white/10 relative overflow-hidden shadow-sm dark:shadow-2xl"
      >
        {/* Subtle decorative ambient glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-30 dark:opacity-40 transition-all duration-700"
          style={{ background: previewRarityStyle.glow }}
        />

        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 relative z-10">
          {/* Brand Title & Active Fighter Mini-Badge */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 text-xl sm:text-2xl">
                  ⚡
                </span>
                <span>Mind Arena</span>
              </h1>
              <span className="jewel-pill jewel-blue text-[11px] font-extrabold uppercase tracking-wider">
                PRO ENGINE v3.0
              </span>
              {activeTitle && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                  <span>{activeTitle.icon}</span>
                  <span>{activeTitle.name}</span>
                </span>
              )}
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed">
              Intellektual jang maydoni, interaktiv 3D Cyber qahramonlar studiyasi va AI savollar laboratoriyasi. Haqiqiy vaqt rejimida aql duellarida kuch sinashing!
            </p>

            {/* Quick Action Cockpit Pills */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  play('pop');
                  haptic('selection');
                  setIsAiCoachOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold arena-btn border border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 active:scale-95 transition-all shadow-xs"
              >
                <Brain className="w-3.5 h-3.5 text-purple-500" />
                <span>AI Murabbiy Kognitiv Tahlili</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  play('pop');
                  haptic('selection');
                  setIsTeacherChallengeOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold arena-btn border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 active:scale-95 transition-all shadow-xs"
              >
                <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                <span>O‘qituvchi Maxsus Duel Vazifasi (PIN)</span>
              </button>
            </div>
          </div>

          {/* Right: Telemetry Duel Stats & Rank Division Progress */}
          {isProfileLoading ? (
            <div className="w-full xl:w-auto grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 w-32 rounded-2xl bg-slate-200/70 dark:bg-white/5" />
              ))}
            </div>
          ) : (
            profile && (
              <div className="w-full xl:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Rank Division Card */}
                <div className="arena-inset px-4 py-3 rounded-2xl border border-black/[0.06] dark:border-white/10 flex flex-col justify-between min-w-[200px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${rankInfo.tier.color}`}>
                      <span>{rankInfo.tier.icon}</span>
                      <span>{rankInfo.tier.name}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Peak: ⚡{profile.peakRating}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rankInfo.progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${rankInfo.tier.bar}`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                      <span>{profile.rating} ELO</span>
                      <span>
                        {rankInfo.nextTier ? `${rankInfo.nextTier.min} gacha` : 'MAX LIGA'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Numeric Stats Dock */}
                <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4 arena-inset px-4 sm:px-5 py-3 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-sm">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Reyting
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-amber-500 dark:text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                      ⚡ {profile.rating}
                    </div>
                  </div>

                  <div className="hidden sm:block h-8 w-px bg-black/[0.08] dark:bg-white/10" />

                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      G‘alaba ({winRatePercent}%)
                    </div>
                    <div className="text-sm sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {profile.wins} <span className="text-slate-400 font-normal">/</span> {profile.totalDuels}
                    </div>
                  </div>

                  <div className="hidden sm:block h-8 w-px bg-black/[0.08] dark:bg-white/10" />

                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Streak (Max {profile.bestStreak})
                    </div>
                    <div className="text-sm sm:text-lg font-extrabold text-rose-500 dark:text-rose-400 flex items-center justify-center gap-1 mt-0.5">
                      🔥 {profile.winStreak}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* ===================================================================
            TAB NAVIGATION DOCK (Apple Vision Segmented Liquid Pill)
        =================================================================== */}
        <div
          role="tablist"
          aria-label="Mind Arena bo‘limlari"
          className="arena-scroll-x flex items-center gap-2 mt-6 pt-4 border-t border-black/[0.06] dark:border-white/10 overflow-x-auto no-scrollbar"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 shrink-0 outline-none ${
                  isSelected
                    ? 'text-white font-extrabold shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white arena-inset'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="arenaActiveTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 shadow-lg shadow-blue-500/25"
                  />
                )}
                <TabIcon
                  className={`w-4 h-4 relative z-10 ${
                    tab.pulse && isSelected ? 'animate-pulse' : ''
                  }`}
                />
                <span className="relative z-10">{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span
                    className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-black/[0.06] dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* =====================================================================
          MAIN DYNAMIC CONTENT AREA WITH SMOOTH TAB TRANSITIONS
      ===================================================================== */}
      <div className="w-full min-h-[520px]">
        <AnimatePresence mode="wait">
          {/* -----------------------------------------------------------------
              TAB 0: REALTIME LIVE 1v1 BATTLE ARENA
          ----------------------------------------------------------------- */}
          {activeTab === 'battle' && (
            <motion.div
              key="tab-battle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaBattleStage
                myDuelProfile={profile}
                onOpenMistakes={() => handleTabChange('mistakes')}
                onOpenAiCoach={() => setIsAiCoachOpen(true)}
                onOpenTeacherChallenge={() => setIsTeacherChallengeOpen(true)}
              />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 0.1: TEZYURAR BLITZ & SURVIVAL MARAFON
          ----------------------------------------------------------------- */}
          {activeTab === 'blitz' && (
            <motion.div
              key="tab-blitz"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaBlitzSurvival />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 0.2: GURUHLAR & SINFLAR TURNIRI HUB
          ----------------------------------------------------------------- */}
          {activeTab === 'tournaments' && (
            <motion.div
              key="tab-tournaments"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaTournamentsHub />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 0.1: ACADEMIC DIAGNOSTICS & DAILY KNOWLEDGE BOUNTIES
          ----------------------------------------------------------------- */}
          {activeTab === 'diagnostics' && (
            <motion.div
              key="tab-diagnostics"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaAcademicDiagnostics />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 0.2: MISTAKE VAULT & SPATIAL MASTERY DRILL
          ----------------------------------------------------------------- */}
          {activeTab === 'mistakes' && (
            <motion.div
              key="tab-mistakes"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaMistakeVault />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 1: 3D AVATARS STUDIO (With Interactive Hologram Inspector)
          ----------------------------------------------------------------- */}
          {activeTab === 'studio' && (
            <motion.div
              key="tab-studio"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start"
            >
              {/* Left Column: Interactive 3D Fighter Stage (Sticky on Desktop) */}
              <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col gap-4">
                <div className="arena-glass rounded-3xl p-6 border border-black/[0.06] dark:border-white/10 relative overflow-hidden text-center flex flex-col items-center shadow-lg">
                  {/* Ambient radial aura matching inspected character's rarity */}
                  <div
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-3xl opacity-50 transition-all duration-500"
                    style={{ background: previewRarityStyle.glow }}
                  />

                  {/* Top Status & Rarity Header inside Stage */}
                  <div className="w-full flex items-center justify-between gap-2 relative z-10">
                    {isPreviewActive ? (
                      <div className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>FAOL JANGCHI</span>
                      </div>
                    ) : isPreviewUnlocked ? (
                      <div className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                        <span>👁️ KO‘RIB CHIQILMOQDA</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
                        <span>🔒 QULFLANGAN MODEL</span>
                      </div>
                    )}

                    {previewAvatar && (
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${previewRarityStyle.bg} ${previewRarityStyle.text} ${previewRarityStyle.border}`}
                      >
                        {previewAvatar.rarity} • {previewAvatar.element}
                      </span>
                    )}
                  </div>

                  {/* Pose Selector Segmented Control */}
                  <div className="flex items-center gap-1 arena-inset p-1 rounded-2xl mt-5 mb-2 relative z-10 border border-black/[0.05] dark:border-white/10">
                    {(
                      [
                        { id: 'default', label: 'Standart', icon: '🧍' },
                        { id: 'battle', label: 'Jang Rejimi', icon: '⚔️' },
                        { id: 'victory', label: 'G‘alaba', icon: '🏆' },
                      ] as const
                    ).map((pose) => {
                      const isPoseSelected = selectedPose === pose.id;
                      return (
                        <button
                          key={pose.id}
                          onClick={() => {
                            play('switch');
                            haptic('selection');
                            setSelectedPose(pose.id);
                          }}
                          className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                            isPoseSelected
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {isPoseSelected && (
                            <motion.div
                              layoutId="studioPosePill"
                              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                              className="absolute inset-0 rounded-xl bg-white dark:bg-white/20 shadow-sm"
                            />
                          )}
                          <span className="relative z-10">{pose.icon}</span>
                          <span className="relative z-10">{pose.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3D Character Floating Display */}
                  <div className="relative w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center my-2 z-10">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`${previewAvatar?.id || 'default'}-${selectedPose}`}
                        src={getPoseUrl(previewAvatar)}
                        alt={previewAvatar?.name || 'Active Avatar'}
                        initial={{ opacity: 0, scale: 0.88, y: 14, rotateY: -12 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: [0, -6, 0],
                          rotateY: 0,
                        }}
                        exit={{ opacity: 0, scale: 0.92, y: -10 }}
                        transition={{
                          opacity: { duration: 0.25 },
                          scale: { duration: 0.3 },
                          y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
                        }}
                        className={`w-full h-full object-contain drop-shadow-[0_22px_35px_rgba(0,122,255,0.28)] dark:drop-shadow-[0_22px_42px_rgba(6,182,212,0.45)] ${
                          !isPreviewUnlocked ? 'grayscale-[35%] contrast-110' : ''
                        }`}
                      />
                    </AnimatePresence>

                    {/* Holographic Pedestal Ring */}
                    <div className="pointer-events-none absolute bottom-2 w-44 h-6 rounded-full bg-gradient-to-r from-blue-500/20 via-cyan-400/40 to-blue-500/20 blur-md border border-cyan-400/30" />
                  </div>

                  {/* Character Lore & Bio */}
                  <div className="relative z-10 space-y-1.5 max-w-sm">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {previewAvatar?.name || 'Cyber Scholar'}
                    </h3>
                    <p className="text-blue-600 dark:text-cyan-400 font-bold text-xs sm:text-sm">
                      {previewAvatar?.title || 'Neyron Tarmoq Arxitektori'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed pt-1">
                      {previewAvatar?.description ||
                        'Intellektual duellarda yuqori tezlik va aniqlik bilan harakat qiluvchi kiber-jangchi.'}
                    </p>
                  </div>

                  {/* Direct Action Button inside Stage */}
                  {previewAvatar && (
                    <div className="w-full mt-5 pt-4 border-t border-black/[0.06] dark:border-white/10 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3">
                      {activeTitle ? (
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl arena-inset border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-bold">
                          <span>{activeTitle.icon}</span>
                          <span className="truncate max-w-[160px]">{activeTitle.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Unvon tanlanmagan</span>
                      )}

                      {isPreviewActive ? (
                        <span className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          ✓ JANGGA SHAY
                        </span>
                      ) : isPreviewUnlocked ? (
                        <button
                          onClick={() => selectAvatarMutation.mutate(previewAvatar.id)}
                          disabled={selectAvatarMutation.isPending}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {selectAvatarMutation.isPending &&
                          selectAvatarMutation.variables === previewAvatar.id
                            ? 'Faollashtirilmoqda...'
                            : '⚡ Jangchini Faollashtirish'}
                        </button>
                      ) : (
                        <span className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-black/[0.06] dark:border-white/10">
                          🔒 Duellarda g‘olib bo‘lib oching
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Game Modes Info Card */}
                <div className="p-5 rounded-3xl arena-inset border border-blue-500/20 dark:border-cyan-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                      Arena O‘yin Rejimlari
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:bg-cyan-500/20 dark:text-cyan-300">
                      LIVE SERVER
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTabChange('battle')}
                      className="p-3.5 rounded-2xl arena-glass border border-blue-500/30 hover:border-blue-500 text-center transition-all group"
                    >
                      <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">⚔️</div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Solo 1v1</div>
                      <div className="text-[11px] text-blue-600 dark:text-cyan-400 font-semibold">
                        Jangga kirish →
                      </div>
                    </button>
                    <div className="p-3.5 rounded-2xl arena-glass border border-black/[0.06] dark:border-white/10 text-center opacity-75">
                      <div className="text-2xl mb-1">🛡️</div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Team 2v2</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        Tez kunda
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Filterable Avatars Catalog Grid */}
              <div className="lg:col-span-7 space-y-4">
                {/* Catalog Header & Filter Bar */}
                <div className="arena-glass rounded-3xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/10 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>🎨</span> Kiber Avatarlar Katalogi
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Istalgan kartani bosib 3D sahnada sinab ko‘ring
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl arena-inset text-xs font-bold text-slate-600 dark:text-slate-300 border border-black/[0.05] dark:border-white/10">
                      Ochilgan:{' '}
                      <strong className="text-blue-600 dark:text-cyan-400">
                        {unlockedAvatarIds.size}
                      </strong>{' '}
                      / {avatarsCatalog.length}
                    </div>
                  </div>

                  {/* Search & Filter Pills */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Jangchi nomi yoki stixiyasi bo‘yicha qidirish..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-semibold arena-inset border border-black/[0.06] dark:border-white/10 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        🔍
                      </span>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 arena-inset p-1 rounded-xl border border-black/[0.05] dark:border-white/10">
                      {(
                        [
                          { id: 'ALL', label: 'Barchasi' },
                          { id: 'UNLOCKED', label: 'Ochilgan' },
                          { id: 'LOCKED', label: 'Qulflangan' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setStatusFilter(st.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            statusFilter === st.id
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rarity Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                    {(['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRarityFilter(r)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 border ${
                          rarityFilter === r
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                            : 'arena-inset text-slate-500 dark:text-slate-400 border-black/[0.05] dark:border-white/10 hover:border-slate-400'
                        }`}
                      >
                        {r === 'ALL' ? 'Barcha Darajalar' : RARITY_CONFIG[r].label} ({r})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avatars Grid */}
                {isAvatarsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className="h-64 rounded-3xl arena-glass animate-pulse border border-black/[0.05] dark:border-white/10 p-4"
                      />
                    ))}
                  </div>
                ) : filteredAvatars.length === 0 ? (
                  <div className="arena-glass rounded-3xl p-10 text-center border border-black/[0.06] dark:border-white/10 space-y-2">
                    <div className="text-3xl">🕵️‍♂️</div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      Hech qanday avatar topilmadi
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Qidiruv so‘zini yoki filtrni o‘zgartirib ko‘ring.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {filteredAvatars.map((avatar) => {
                      const isUnlocked = unlockedAvatarIds.has(avatar.id) || avatar.isDefault;
                      const isActive = activeAvatar?.id === avatar.id;
                      const isInspected = previewAvatar?.id === avatar.id;
                      const rarityStyle = RARITY_CONFIG[avatar.rarity] || RARITY_CONFIG.COMMON;
                      const isThisLoading =
                        selectAvatarMutation.isPending &&
                        selectAvatarMutation.variables === avatar.id;

                      return (
                        <motion.div
                          key={avatar.id}
                          layout
                          whileHover={{ y: -4 }}
                          onClick={() => {
                            play('tick');
                            haptic('selection');
                            setInspectedAvatarId(avatar.id);
                          }}
                          className={`cursor-pointer relative rounded-3xl p-4 flex flex-col justify-between transition-all border arena-glass ${
                            isActive
                              ? 'border-emerald-500 dark:border-emerald-400 shadow-md shadow-emerald-500/15'
                              : isInspected
                              ? 'border-blue-500 dark:border-cyan-400 shadow-md shadow-blue-500/20'
                              : 'border-black/[0.06] dark:border-white/10 hover:border-black/[0.15] dark:hover:border-white/25'
                          }`}
                        >
                          {/* Top Badges */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${rarityStyle.bg} ${rarityStyle.text} ${rarityStyle.border}`}
                            >
                              {avatar.rarity}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {avatar.element}
                            </span>
                          </div>

                          {/* Avatar Thumbnail */}
                          <div className="w-full h-32 flex items-center justify-center my-1 relative">
                            <img
                              src={avatar.thumbnailUrl || avatar.defaultRenderUrl}
                              alt={avatar.name}
                              loading="lazy"
                              decoding="async"
                              className={`w-28 h-28 object-contain transition-transform duration-300 hover:scale-110 drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] ${
                                !isUnlocked ? 'grayscale-[55%] opacity-80' : ''
                              }`}
                            />
                            {!isUnlocked && (
                              <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-md">
                                🔒
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="text-center mb-3">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {avatar.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {avatar.title}
                            </p>
                          </div>

                          {/* Action Button */}
                          {isActive ? (
                            <button
                              disabled
                              className="w-full py-2 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default"
                            >
                              ✓ FAOL JANGCHI
                            </button>
                          ) : isUnlocked ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                play('tick');
                                selectAvatarMutation.mutate(avatar.id);
                              }}
                              disabled={selectAvatarMutation.isPending}
                              className="w-full py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {isThisLoading ? 'Yuklanmoqda...' : 'Tanlash'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-black/[0.04] dark:border-white/5 flex items-center justify-center gap-1"
                            >
                              👁️ 3D Ko‘rish
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 2: TITLES & ACHIEVEMENTS (With Real-time Progress Bars)
          ----------------------------------------------------------------- */}
          {activeTab === 'titles' && (
            <motion.div
              key="tab-titles"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Titles Filter & Summary Header */}
              <div className="arena-glass rounded-3xl p-5 border border-black/[0.06] dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🎖️</span> Faxriy Unvonlar & Yutuqlar
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Duellarda g‘alaba qozonib maxsus unvonlarni oching va profilingizga taqing
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Unvon qidirish..."
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold arena-inset border border-black/[0.06] dark:border-white/10 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 flex-1 sm:w-52"
                  />
                  <div className="px-3.5 py-2 rounded-xl arena-inset text-xs font-bold border border-black/[0.05] dark:border-white/10">
                    Qo‘lga kiritilgan:{' '}
                    <strong className="text-purple-600 dark:text-purple-400">
                      {earnedTitleIds.size}
                    </strong>{' '}
                    / {titlesCatalog.length}
                  </div>
                </div>
              </div>

              {/* Titles Grid */}
              {isTitlesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="h-48 rounded-3xl arena-glass animate-pulse border border-black/[0.05] dark:border-white/10 p-5"
                    />
                  ))}
                </div>
              ) : filteredTitles.length === 0 ? (
                <div className="arena-glass rounded-3xl p-10 text-center border border-black/[0.06] dark:border-white/10">
                  <p className="text-sm font-bold text-slate-500">Mos unvonlar topilmadi.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTitles.map((title) => {
                    const isEarned = earnedTitleIds.has(title.id);
                    const isActive = activeTitle?.id === title.id;
                    const rarityStyle = RARITY_CONFIG[title.rarity] || RARITY_CONFIG.COMMON;
                    const reqProgress = getRequirementProgress(title, profile);
                    const isThisLoading =
                      selectTitleMutation.isPending &&
                      selectTitleMutation.variables === title.id;

                    return (
                      <motion.div
                        key={title.id}
                        whileHover={{ y: -3 }}
                        className={`p-5 rounded-3xl arena-glass border transition-all flex flex-col justify-between ${
                          isActive
                            ? 'border-purple-500 dark:border-purple-400 shadow-lg shadow-purple-500/20'
                            : 'border-black/[0.06] dark:border-white/10'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="w-12 h-12 rounded-2xl arena-inset flex items-center justify-center text-2xl border border-black/[0.05] dark:border-white/10">
                              {title.icon}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${rarityStyle.bg} ${rarityStyle.text} ${rarityStyle.border}`}
                            >
                              {title.rarity}
                            </span>
                          </div>

                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                            {title.name}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                            {title.description}
                          </p>

                          {/* Requirement Progress Bar for Locked Titles */}
                          {!isEarned && (
                            <div className="mb-4 p-3 rounded-2xl arena-inset border border-black/[0.04] dark:border-white/5">
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                                <span className="text-slate-500 dark:text-slate-400">
                                  Yutuq jarayoni:
                                </span>
                                <span className="text-purple-600 dark:text-purple-400">
                                  {reqProgress.label} ({reqProgress.percent}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500"
                                  style={{ width: `${reqProgress.percent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {isActive ? (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-xl text-xs font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                          >
                            ✓ FAOL UNVON
                          </button>
                        ) : isEarned ? (
                          <button
                            onClick={() => {
                              play('tick');
                              selectTitleMutation.mutate(title.id);
                            }}
                            disabled={selectTitleMutation.isPending}
                            className="w-full py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            {isThisLoading ? 'Biriktirilmoqda...' : 'Unvonni Taqish'}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-black/[0.04] dark:border-white/5 cursor-not-allowed"
                          >
                            🔒 Yutuq Bajarilmagan
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 3: QUESTIONS BANK & AI GENERATOR
          ----------------------------------------------------------------- */}
          {activeTab === 'questions' && (
            <motion.div
              key="tab-questions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ArenaQuestionsStudio />
            </motion.div>
          )}

          {/* -----------------------------------------------------------------
              TAB 4: LEADERBOARD (With Top-3 Podium & Current User Highlight)
          ----------------------------------------------------------------- */}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="tab-leaderboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Top-3 Champions Podium Showcase */}
              {!isLeaderboardLoading && leaderboard.length >= 3 && !leaderboardSearch && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
                  {[leaderboard[1], leaderboard[0], leaderboard[2]].map((champ, idx) => {
                    if (!champ) return null;
                    const isFirst = champ.rank === 1;
                    const medal = champ.rank === 1 ? '🥇' : champ.rank === 2 ? '🥈' : '🥉';
                    const totalGames =
                      champ.totalDuels ?? champ.wins + champ.losses + (champ.draws ?? 0);

                    return (
                      <motion.div
                        key={champ.studentId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`arena-glass rounded-3xl p-5 border text-center relative overflow-hidden flex flex-col items-center ${
                          isFirst
                            ? 'md:-translate-y-3 border-amber-400/70 dark:border-amber-400/50 shadow-xl shadow-amber-500/15'
                            : 'border-black/[0.06] dark:border-white/10'
                        }`}
                      >
                        <div className="text-3xl mb-1">{medal}</div>
                        <div className="w-16 h-16 rounded-2xl arena-inset p-1.5 border border-black/[0.08] dark:border-white/10 mb-2">
                          {champ.activeAvatar ? (
                            <img
                              src={champ.activeAvatar.thumbnailUrl}
                              alt={champ.activeAvatar.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">
                              👤
                            </div>
                          )}
                        </div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white truncate max-w-full">
                          {champ.name}
                        </h4>
                        {champ.activeTitle && (
                          <span className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            {champ.activeTitle.icon} {champ.activeTitle.name}
                          </span>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs font-bold">
                          <span className="text-amber-500 dark:text-amber-400 font-black text-sm">
                            ⚡ {champ.rating}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {champ.wins}/{totalGames} ({champ.winRate}%)
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Leaderboard Table Container */}
              <div className="arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 overflow-hidden shadow-sm dark:shadow-2xl">
                <div className="p-5 sm:p-6 border-b border-black/[0.06] dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>🏆</span> Mind Arena Chempionlar Jadvali
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tashkilotingiz o‘quvchilari o‘rtasidagi eng kuchli intellektual duelchilar TOP-25 reytingi
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={leaderboardSearch}
                      onChange={(e) => setLeaderboardSearch(e.target.value)}
                      placeholder="Duelchi ismini qidirish..."
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold arena-inset border border-black/[0.06] dark:border-white/10 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 flex-1 sm:w-56"
                    />
                    <button
                      onClick={() => {
                        play('tick');
                        refetchLeaderboard();
                        refetchProfile();
                      }}
                      disabled={isLeaderboardFetching}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold arena-inset border border-black/[0.06] dark:border-white/10 hover:border-blue-500 transition-all"
                      title="Reytingni yangilash"
                    >
                      {isLeaderboardFetching ? '⏳' : '🔄 Yangilash'}
                    </button>
                  </div>
                </div>

                {isLeaderboardLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="h-14 w-full rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-black/[0.06] dark:border-white/10 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/80 dark:bg-black/30">
                          <th className="py-4 px-5">O‘rin</th>
                          <th className="py-4 px-5">O‘quvchi</th>
                          <th className="py-4 px-5">Faol Avatar</th>
                          <th className="py-4 px-5">Unvoni</th>
                          <th className="py-4 px-5 text-center">Duel Reyting</th>
                          <th className="py-4 px-5 text-center">G‘alaba / Jami</th>
                          <th className="py-4 px-5 text-center">G‘alaba %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                        {filteredLeaderboard.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                              Hozircha duel ishtirokchilari topilmadi.
                            </td>
                          </tr>
                        ) : (
                          filteredLeaderboard.map((entry) => {
                            const isMe = profile?.studentId === entry.studentId;
                            const totalGames =
                              entry.totalDuels ??
                              entry.wins + entry.losses + (entry.draws ?? 0);

                            return (
                              <tr
                                key={entry.studentId}
                                className={`transition-colors ${
                                  isMe
                                    ? 'bg-blue-500/[0.08] dark:bg-cyan-500/[0.12] font-semibold'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                                }`}
                              >
                                <td className="py-4 px-5 font-black text-base whitespace-nowrap">
                                  {entry.rank === 1
                                    ? '🥇 1'
                                    : entry.rank === 2
                                    ? '🥈 2'
                                    : entry.rank === 3
                                    ? '🥉 3'
                                    : `#${entry.rank}`}
                                </td>
                                <td className="py-4 px-5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span>{entry.name}</span>
                                    {isMe && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white">
                                        SIZ
                                      </span>
                                    )}
                                    {entry.winStreak >= 3 && (
                                      <span
                                        className="text-xs text-rose-500 font-extrabold"
                                        title={`${entry.winStreak} ta ketma-ket g‘alaba`}
                                      >
                                        🔥{entry.winStreak}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-5 whitespace-nowrap">
                                  {entry.activeAvatar ? (
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={entry.activeAvatar.thumbnailUrl}
                                        alt={entry.activeAvatar.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-8 h-8 rounded-lg object-contain bg-slate-100 dark:bg-black/40 p-0.5 border border-black/[0.08] dark:border-white/10"
                                      />
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {entry.activeAvatar.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-4 px-5 whitespace-nowrap">
                                  {entry.activeTitle ? (
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                                      {entry.activeTitle.icon} {entry.activeTitle.name}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-4 px-5 text-center font-black text-amber-500 dark:text-amber-400 whitespace-nowrap">
                                  ⚡ {entry.rating}
                                </td>
                                <td className="py-4 px-5 text-center text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                                  {entry.wins} / {totalGames}
                                </td>
                                <td className="py-4 px-5 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    {entry.winRate}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Coach Cognitive Telemetry & Personalized Roadmap Modal */}
      <ArenaAiCoachModal
        isOpen={isAiCoachOpen}
        onClose={() => setIsAiCoachOpen(false)}
        duelSummary={{
          totalRounds: 5,
          correctCount: profile?.wins ? Math.min(5, profile.wins) : 4,
          avgSpeedSec: 6.8,
          subject: 'Aralash Fanlar',
        }}
      />

      {/* Teacher Challenge Generator & Submission Gradebook Modal */}
      <ArenaTeacherChallengeModal
        isOpen={isTeacherChallengeOpen}
        onClose={() => setIsTeacherChallengeOpen(false)}
        onLaunchChallenge={(pin) => {
          setIsTeacherChallengeOpen(false);
          handleTabChange('battle');
          toast('success', 'Topshiriq Faollashtirildi', `PIN: ${pin} bo‘yicha duel tayyorlandi!`);
        }}
      />
    </div>
  );
}

export { MindArenaPage as MindArena, MindArenaPage as default };