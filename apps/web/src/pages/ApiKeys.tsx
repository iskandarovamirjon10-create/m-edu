/**
 * M-EDU API Keys Page
 * Developer API key provisioning, access scopes, rate limits, and audit logs.
 */

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type FormEvent,
  type SVGProps,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useToasts, ConfirmDialog } from '@/components/ui';
import { apiKeysApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { openSidecar } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS ( Physics)
 * ========================================================================== */

const SPRING_PHYSICS = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  rateLimit: number;
  usageCount: number;
  createdAt: string;
}

export interface UsageStats {
  keys: ApiKeyItem[];
  totalUsage: number;
  activeCount: number;
  totalCount: number;
}

export type StatusFilter = 'ALL' | 'ACTIVE' | 'REVOKED';

export const ALL_SCOPES = [
  'students:read', 'students:write',
  'teachers:read', 'teachers:write',
  'groups:read', 'groups:write',
  'courses:read', 'courses:write',
  'attendance:read', 'attendance:write',
  'payments:read', 'payments:write',
  'expenses:read', 'expenses:write',
  'grades:read', 'grades:write',
  'homework:read', 'homework:write',
  'leads:read', 'leads:write',
  'reports:read',
  'analytics:read',
  'settings:read', 'settings:write',
  'users:read',
] as const;

export const SCOPE_CATEGORIES: Record<string, string[]> = {
  Academic: ['students:read', 'students:write', 'teachers:read', 'teachers:write', 'groups:read', 'groups:write', 'courses:read', 'courses:write', 'grades:read', 'grades:write', 'homework:read', 'homework:write', 'attendance:read', 'attendance:write'],
  Operations: ['leads:read', 'leads:write', 'reports:read', 'analytics:read'],
  Finance: ['payments:read', 'payments:write', 'expenses:read', 'expenses:write'],
  System: ['settings:read', 'settings:write', 'users:read'],
};

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export function formatKeyDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function isKeyExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function getStatusTone(isActive: boolean, expiresAt: string | null | undefined): {
  label: string;
  badgeStyle: string;
  dotStyle: string;
} {
  if (!isActive) {
    return {
      label: 'Revoked',
      badgeStyle: 'bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400',
      dotStyle: 'bg-rose-500',
    };
  }
  if (isKeyExpired(expiresAt)) {
    return {
      label: 'Expired',
      badgeStyle: 'bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400',
      dotStyle: 'bg-amber-500',
    };
  }
  return {
    label: 'Active',
    badgeStyle: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400',
    dotStyle: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
  };
}

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
  key: [
    'M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1.5-1.5L10 7 8.5 5.5 7 7l-1.5-1.5L4 7a5 5 0 1 0 7.07 7.07l9.93-9.93a1 1 0 0 0 0-1.41l-2-2a1 1 0 0 0-1.41 0z',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  check: ['M20 6L9 17l-5-5'],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  activity: [
    'M22 12h-4l-3 9L9 3l-3 9H2',
  ],
  search: [
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
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
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * AURORA MESH BACKGROUND (Atmospheric Canvas)
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-blue-500/12 via-indigo-500/8 to-transparent blur-[120px] dark:from-blue-600/16 dark:via-indigo-600/10" />
      <div className="absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-teal-500/12 via-emerald-500/8 to-transparent blur-[120px] dark:from-teal-600/16 dark:via-emerald-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/6 to-transparent blur-[110px] dark:from-purple-600/14" />
    </div>
  );
}

/* ============================================================================
 * COUNT UP COMPONENT
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.85,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums font-semibold">
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function ApiKeysSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-12 w-full rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function ApiKeysPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('apiKeys.title') || 'API & Webhook Integrations');

  const queryClient = useQueryClient();
  const { push: toast } = useToasts();
  const reduced = usePrefersReducedMotion();
  const { playTick, playPop, playSuccess } = usePremiumSound();

  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const [form, setForm] = useState({
    name: '',
    scopes: [] as string[],
    expiresAt: '',
    rateLimit: 1000,
  });

  /* ── Queries ── */
  const { data: keys = [], isLoading, error, refetch } = useQuery<ApiKeyItem[]>({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list() as Promise<ApiKeyItem[]>,
  });

  const { data: stats } = useQuery<UsageStats>({
    queryKey: ['api-keys-usage'],
    queryFn: () => apiKeysApi.usageStats() as Promise<UsageStats>,
  });

  /* ── Filtered Keys ── */
  const filteredKeys = useMemo(() => {
    let list = keys;
    if (activeFilter === 'ACTIVE') {
      list = list.filter((k) => k.isActive && !isKeyExpired(k.expiresAt));
    } else if (activeFilter === 'REVOKED') {
      list = list.filter((k) => !k.isActive || isKeyExpired(k.expiresAt));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.keyPrefix.toLowerCase().includes(q) ||
          k.scopes.some((s) => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [keys, activeFilter, searchQuery]);

  /* ── Mutations ── */
  const createMutation = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: form.name.trim(),
        scopes: form.scopes,
        expiresAt: form.expiresAt || undefined,
        rateLimit: form.rateLimit,
      }),
    onSuccess: (data: any) => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setGeneratedKey(data.key);
      setShowCreate(false);
      setForm({ name: '', scopes: [], expiresAt: '', rateLimit: 1000 });
      toast('success', t('apiKeys.created') || 'API Key generated successfully');
    },
    onError: (err: any) => {
      toast('error', getErrorMessage(err));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setRevokeTarget(null);
      toast('success', t('apiKeys.revokedSuccess') || 'API key revoked');
    },
    onError: (err: any) => {
      toast('error', getErrorMessage(err));
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.rotate(id),
    onSuccess: (data: any) => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setGeneratedKey(data.key);
      toast('success', t('apiKeys.rotatedSuccess') || 'Key rotated successfully');
    },
    onError: (err: any) => {
      toast('error', getErrorMessage(err));
    },
  });

  const toggleScope = (scope: string) => {
    playTick();
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const copyKey = () => {
    if (generatedKey) {
      playTick();
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  /* ── Open Sidecar Detail Inspector ── */
  const handleInspectKey = useCallback(
    (key: ApiKeyItem) => {
      playPop();
      const statusTone = getStatusTone(key.isActive, key.expiresAt);

      openSidecar({
        id: key.id,
        type: 'general',
        title: key.name,
        subtitle: `Prefix: ${key.keyPrefix} • Rate Limit: ${key.rateLimit} req/min`,
        badge: {
          text: statusTone.label,
          tone: statusTone.label === 'Active' ? 'emerald' : statusTone.label === 'Expired' ? 'amber' : 'rose',
        },
        avatar: {
          text: key.name.slice(0, 2).toUpperCase(),
          color: key.isActive ? '#3B82F6' : '#F43F5E',
        },
        metrics: [
          {
            label: 'Usage Count',
            value: key.usageCount.toLocaleString(),
          },
          {
            label: 'Rate Limit',
            value: `${key.rateLimit} /min`,
          },
        ],
        details: [
          {
            label: 'Token Prefix',
            value: key.keyPrefix,
            copyable: true,
          },
          {
            label: 'Authorized Scopes',
            value: key.scopes.join(', '),
          },
          {
            label: 'Created At',
            value: formatKeyDate(key.createdAt),
          },
          {
            label: 'Last Used',
            value: formatKeyDate(key.lastUsedAt),
          },
          {
            label: 'Expires',
            value: formatKeyDate(key.expiresAt),
          },
        ],
        actions: key.isActive
          ? [
              {
                label: t('apiKeys.rotate') || 'Rotate Key',
                variant: 'primary',
                onClick: () => rotateMutation.mutate(key.id),
              },
              {
                label: t('apiKeys.revoke') || 'Revoke Key',
                variant: 'danger',
                onClick: () => setRevokeTarget(key),
              },
            ]
          : undefined,
      });
    },
    [t, playPop, rotateMutation]
  );

  /* ── Keyboard Shortcuts (J / K, C, Enter) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < filteredKeys.length ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredKeys.length - 1));
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        playPop();
        setShowCreate(true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredKeys[focusedIndex]) {
          handleInspectKey(filteredKeys[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredKeys, focusedIndex, handleInspectKey, playTick, playPop]);

  /* ── Loading & Error States ── */
  if (isLoading && !keys.length) {
    return (
      <div className="relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <ApiKeysSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-2xl">
          <div className="liquid-glass-card flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30">
              <Icon paths={ICONS.alertTriangle} size={26} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t('apiKeys.loadErrorTitle') || 'Unable to Load API Keys'}
              </h2>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                {getErrorMessage(error)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playTick();
                void refetch();
              }}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Icon paths={ICONS.refresh} size={16} strokeWidth={2.2} />
              {t('common.retry') || 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = keys.filter((k) => k.isActive && !isKeyExpired(k.expiresAt)).length;
  const revokedCount = keys.length - activeCount;
  const totalCalls = stats?.totalUsage ?? keys.reduce((sum, k) => sum + k.usageCount, 0);

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* ====================================================================
         * 1. HERO HEADER
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-600 shadow-inner ring-1 ring-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400">
                <Icon paths={ICONS.key} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {activeCount} {t('apiKeys.activeKeys') || 'Active Tokens'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    {keys.length} Total
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('apiKeys.title') || 'API & External Integrations'}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('apiKeys.subtitle') ||
                    'Provision secure machine-to-machine access tokens, configure granular permissions, and monitor traffic telemetry.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setShowCreate(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <Icon paths={ICONS.plus} size={18} strokeWidth={2.4} />
                <span>{t('apiKeys.generate') || 'Generate New Key'}</span>
                <kbd className="hidden rounded bg-indigo-800/60 px-1.5 py-0.5 text-[10px] font-mono sm:inline-block">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {/* Total Keys Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ALL');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ALL' && 'ring-2 ring-indigo-500/40 bg-indigo-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('apiKeys.totalKeys') || 'Total Keys'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon paths={ICONS.key} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={keys.length} />
            </div>
          </button>

          {/* Active Keys Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ACTIVE');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ACTIVE' && 'ring-2 ring-emerald-500/50 bg-emerald-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('apiKeys.activeKeys') || 'Active Keys'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.shield} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              <CountUp value={activeCount} />
            </div>
          </button>

          {/* Revoked Keys Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('REVOKED');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'REVOKED' && 'ring-2 ring-rose-500/50 bg-rose-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Revoked / Expired
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Icon paths={ICONS.alertTriangle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-rose-500">
              <CountUp value={revokedCount} />
            </div>
          </button>

          {/* Total Usage Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('apiKeys.totalUsage') || 'Total Requests'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Icon paths={ICONS.activity} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={totalCalls} />
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 3. CONTROL BAR (Segmented Control + Search)
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Segmented Filter Control */}
          <div
            className="flex items-center rounded-2xl bg-neutral-200/50 p-1 dark:bg-white/[0.05]"
            role="tablist"
          >
            {(['ALL', 'ACTIVE', 'REVOKED'] as StatusFilter[]).map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    playTick();
                    setActiveFilter(filter);
                    setFocusedIndex(0);
                  }}
                  className={cn(
                    'relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeApiPill"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                      transition={SPRING_PHYSICS.snappy}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <span>
                      {filter === 'ALL'
                        ? t('common.all') || 'All'
                        : filter === 'ACTIVE'
                        ? t('apiKeys.active') || 'Active'
                        : t('apiKeys.revoked') || 'Revoked'}
                    </span>
                    <span className="rounded-full bg-neutral-400/15 px-1.5 py-0.2 text-[10px] tabular-nums">
                      {filter === 'ALL'
                        ? keys.length
                        : filter === 'ACTIVE'
                        ? activeCount
                        : revokedCount}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <Icon paths={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder={`${t('common.search') || 'Search keys or scopes'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. MAIN CONTENT (Desktop Table + Mobile Tactile Cards)
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {filteredKeys.length === 0 ? (
              <motion.div
                key="empty-keys"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/25">
                  <Icon paths={ICONS.key} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('apiKeys.emptyTitle') || 'No API Keys Found'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('apiKeys.emptyMessage') || 'Provision an API token to integrate with external systems.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    setShowCreate(true);
                  }}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <Icon paths={ICONS.plus} size={15} />
                  {t('apiKeys.generate') || 'Generate New Key'}
                </button>
              </motion.div>
            ) : (
              <div key="keys-content">
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/[0.06] text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:border-white/[0.06] dark:text-neutral-400">
                        <th className="py-3 px-5">{t('apiKeys.name') || 'Key Name'}</th>
                        <th className="py-3 px-5">{t('apiKeys.prefix') || 'Prefix'}</th>
                        <th className="py-3 px-5">{t('apiKeys.scopes') || 'Scopes'}</th>
                        <th className="py-3 px-5">{t('apiKeys.status') || 'Status'}</th>
                        <th className="py-3 px-5">{t('apiKeys.lastUsed') || 'Last Used'}</th>
                        <th className="py-3 px-5">{t('apiKeys.usage') || 'Requests'}</th>
                        <th className="py-3 px-5 text-right">{t('common.actions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {filteredKeys.map((key, idx) => {
                        const isFocused = focusedIndex === idx;
                        const status = getStatusTone(key.isActive, key.expiresAt);

                        return (
                          <tr
                            key={key.id}
                            onClick={() => handleInspectKey(key)}
                            className={cn(
                              'group cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                              isFocused && 'bg-indigo-500/[0.06] dark:bg-indigo-500/[0.1]'
                            )}
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                  <Icon paths={ICONS.key} size={18} />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                                    {key.name}
                                  </div>
                                  <div className="text-[11px] text-neutral-400">
                                    Rate: {key.rateLimit} req/min
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-5">
                              <code className="rounded-lg bg-neutral-200/60 px-2.5 py-1 font-mono text-xs font-bold text-neutral-800 dark:bg-white/[0.06] dark:text-neutral-200">
                                {key.keyPrefix}
                              </code>
                            </td>

                            <td className="py-4 px-5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {key.scopes.slice(0, 2).map((s) => (
                                  <span
                                    key={s}
                                    className="rounded-md bg-neutral-200/50 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-white/[0.05] dark:text-neutral-300"
                                  >
                                    {s}
                                  </span>
                                ))}
                                {key.scopes.length > 2 && (
                                  <span className="rounded-md bg-neutral-200/50 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500 dark:bg-white/[0.05]">
                                    +{key.scopes.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-5">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                  status.badgeStyle
                                )}
                              >
                                <span className={cn('h-1.5 w-1.5 rounded-full', status.dotStyle)} />
                                {status.label}
                              </span>
                            </td>

                            <td className="py-4 px-5 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatKeyDate(key.lastUsedAt)}
                            </td>

                            <td className="py-4 px-5 text-xs font-bold font-mono text-neutral-900 dark:text-white">
                              {key.usageCount.toLocaleString()}
                            </td>

                            <td className="py-4 px-5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {key.isActive && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playTick();
                                        rotateMutation.mutate(key.id);
                                      }}
                                      disabled={rotateMutation.isPending}
                                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                      title={t('apiKeys.rotate') || 'Rotate Key'}
                                    >
                                      <Icon paths={ICONS.refresh} size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playTick();
                                        setRevokeTarget(key);
                                      }}
                                      disabled={revokeMutation.isPending}
                                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                      title={t('apiKeys.revoke') || 'Revoke Key'}
                                    >
                                      <Icon paths={ICONS.trash} size={15} />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInspectKey(key);
                                  }}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
                                  title="Inspect key"
                                >
                                  <Icon paths={ICONS.eye} size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Tactile Squircle Cards */}
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] lg:hidden">
                  {filteredKeys.map((key) => {
                    const status = getStatusTone(key.isActive, key.expiresAt);

                    return (
                      <div
                        key={key.id}
                        onClick={() => handleInspectKey(key)}
                        className="flex min-h-[44px] flex-col gap-3 p-4 transition-colors active:bg-black/[0.03] dark:active:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                              <Icon paths={ICONS.key} size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                                {key.name}
                              </h3>
                              <code className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                                {key.keyPrefix}
                              </code>
                            </div>
                          </div>

                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                              status.badgeStyle
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', status.dotStyle)} />
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Usage: {key.usageCount.toLocaleString()} calls</span>
                          <span>Last: {formatKeyDate(key.lastUsedAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ====================================================================
       * 5. CREATE KEY MODAL (Glass Surface)
       * ================================================================== */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] grid place-items-center p-4 backdrop-blur-md bg-black/40"
            onClick={() => setShowCreate(false)}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={SPRING_PHYSICS.snappy}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="liquid-glass-card relative w-full max-w-lg overflow-hidden p-6 sm:p-8"
            >
              <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Icon paths={ICONS.plus} size={20} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {t('apiKeys.generateTitle') || 'Generate API Key'}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Configure permissions and rate limits for this client.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (!form.name || form.scopes.length === 0) return;
                  createMutation.mutate();
                }}
                className="mt-5 space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    {t('apiKeys.nameLabel') || 'Key Name'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={t('apiKeys.namePlaceholder') || 'e.g., Mobile App Client, LMS Sync Service'}
                    className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      {t('apiKeys.rateLimitLabel') || 'Rate Limit (req/min)'}
                    </label>
                    <input
                      type="number"
                      min={10}
                      value={form.rateLimit}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, rateLimit: Number(e.target.value) }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm tabular-nums text-neutral-900 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      {t('apiKeys.expiryLabel') || 'Expiry Date'}
                    </label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, expiresAt: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm text-neutral-900 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                    />
                  </div>
                </div>

                {/* Scope selector grouped by category */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    {t('apiKeys.scopesLabel') || 'Permissions & Scopes'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-3 rounded-2xl border border-black/[0.08] bg-white/40 p-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
                    {Object.entries(SCOPE_CATEGORIES).map(([cat, scopes]) => (
                      <div key={cat} className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          {cat}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {scopes.map((scope) => {
                            const isSelected = form.scopes.includes(scope);
                            return (
                              <button
                                key={scope}
                                type="button"
                                onClick={() => toggleScope(scope)}
                                className={cn(
                                  'min-h-[32px] rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95',
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-neutral-200/60 text-neutral-700 hover:bg-neutral-200 dark:bg-white/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.1]'
                                )}
                              >
                                {scope}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    disabled={createMutation.isPending}
                    className="min-h-[44px] rounded-xl border border-black/[0.08] bg-neutral-100/60 px-5 py-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200/60 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!form.name || form.scopes.length === 0 || createMutation.isPending}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 active:scale-95"
                  >
                    {createMutation.isPending ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Icon paths={ICONS.plus} size={15} strokeWidth={2.4} />
                        <span>{t('apiKeys.generate') || 'Generate'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
       * 6. REVEALED SECRET KEY VAULT MODAL
       * ================================================================== */}
      <AnimatePresence>
        {generatedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[210] grid place-items-center p-4 backdrop-blur-md bg-black/50"
            onClick={() => setGeneratedKey(null)}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={SPRING_PHYSICS.snappy}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="liquid-glass-card relative w-full max-w-lg overflow-hidden p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Icon paths={ICONS.key} size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {t('apiKeys.keyGenerated') || 'API Key Generated'}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Store this key in a secure secret manager immediately.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold">
                  {t('apiKeys.copyWarning') ||
                    'This key will never be shown again! Copy it now and store it securely.'}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-black/[0.1] bg-black/5 p-3 dark:border-white/[0.1] dark:bg-white/5">
                <code className="min-w-0 flex-1 font-mono text-xs font-bold text-neutral-900 dark:text-white break-all">
                  {generatedKey}
                </code>
                <button
                  type="button"
                  onClick={copyKey}
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
                >
                  {copied ? (
                    <Icon paths={ICONS.check} size={16} />
                  ) : (
                    <Icon paths={ICONS.copy} size={16} />
                  )}
                  <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setGeneratedKey(null)}
                  className="min-h-[44px] rounded-xl bg-indigo-600 px-6 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                  {t('common.done') || 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
       * 7. REVOCATION CONFIRM DIALOG
       * ================================================================== */}
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t('apiKeys.revokeTitle') || 'Revoke API Key'}
        description={t('apiKeys.revokeConfirm', { name: revokeTarget?.name ?? '' }) || `Are you sure you want to revoke the key "${revokeTarget?.name}"? Any systems using this token will instantly fail.`}
        confirmLabel={t('apiKeys.revoke') || 'Revoke Key'}
        tone="danger"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}

export default ApiKeysPage;
