/**
 * ============================================================================
 * AiCopilotHeader v4.0 — Liquid Glass Command Bar
 * ============================================================================
 * Fixes:
 *  - resolveTranslation helper — no raw-key leaks (5 sites)
 *  - shadow-xs → shadow-[0_1px_2px_rgba(0,0,0,0.04)] (Tailwind v3 safe)
 *  - Hardcoded zinc bg in mode switcher → token-driven
 *  - Mode switcher now visible on all breakpoints (icon-only on mobile)
 *  - Two duplicated buttons → data-driven map
 *  - orgName / assistantName from i18n
 *  - Chatni tozalash → i18n + aria-label
 *  - busy → visible "thinking" chip + avatar breathing ring
 *  - online → pulsing dot (offline → static)
 *  - !mb-0 removed from GlassPageHeader (no !important overrides)
 *  - invalid #0000000d → var(--border, rgba(0,0,0,0.08))
 *  - actions container: flex-wrap for mobile
 *  - context badge visible on all sizes
 *  - onChangeViewMode guarded (no dead clicks)
 *  - prefers-reduced-motion throughout
 * Design — Liquid Glass:
 *  - Identity card: 4-layer glass (gradient + dark tint + specular top/bottom
 *    bevels + corner glow), staggered fade-up entrance
 *  - Ambient tone-aware glow (pulses behind identity card)
 *  - Avatar: conic ring when busy (thinking), shimmer overlay always
 *  - Status pill: pulsing dot when online, static when offline
 *  - Segmented control: framer-motion layoutId slide indicator
 *  - Busy chip with shimmer
 *  - Full a11y: radiogroup, aria-checked, aria-label, ring-offset-2
 * ============================================================================
 */

import { Sparkles, Trash2, Pencil, Layout, Columns2, Brain } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { GlassButton, GlassPageHeader } from '@/components/ui';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

type ViewMode = 'full' | 'split' | 'drawer';

const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 } as const;
const SPRING_SMOOTH = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;

const VIEW_MODES: Array<{ id: ViewMode; icon: typeof Layout; key: string; fallback: string }> = [
  { id: 'full', icon: Layout, key: 'ai.viewMode.full', fallback: 'Studio' },
  { id: 'split', icon: Columns2, key: 'ai.viewMode.split', fallback: 'Split View' },
];

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
}

/* ============================================================================
 * PROPS
 * ========================================================================== */

export interface AiCopilotHeaderProps {
  online: boolean;
  busy: boolean;
  suggestionsActive?: boolean;
  viewMode?: ViewMode;
  onChangeViewMode?: (mode: ViewMode) => void;
  onNewChat?: () => void;
  onToggleSuggestions?: () => void;
  onClear?: () => void;
  contextBadge?: string;
  /** Override assistant display name (defaults to i18n → "M-EDU AI"). */
  assistantName?: string;
}

/* ============================================================================
 * SEGMENTED CONTROL (layoutId slide)
 * ========================================================================== */

interface SegmentedControlProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
  reduced?: boolean;
}

function SegmentedControl({ value, onChange, disabled, reduced }: SegmentedControlProps) {
  const { t } = useI18n();
  const uid = 'viewmode-indicator';

  return (
    <div
      role="radiogroup"
      aria-label={resolveTranslation(t, 'ai.viewMode.label', 'Ko\'rinish rejimi')}
      className={cn(
        'relative flex items-center gap-0.5 rounded-xl border border-white/50 bg-black/[0.03] p-0.5',
        'dark:border-white/[0.08] dark:bg-white/[0.05]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
      )}
    >
      {VIEW_MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = value === mode.id;
        const label = resolveTranslation(t, mode.key, mode.fallback);

        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={cn(
              'relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold',
              'transition-colors duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#007AFF]/40 focus-visible:ring-offset-1',
              'disabled:pointer-events-none disabled:opacity-50',
              isActive
                ? 'text-[#007AFF] dark:text-[#409CFF]'
                : 'text-[var(--text-muted,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-[var(--text-primary,#F5F5F7)]'
            )}
          >
            {/* Sliding pill indicator (Apple segmented control) */}
            {isActive && (
              <motion.span
                layoutId={reduced ? undefined : uid}
                aria-hidden="true"
                transition={SPRING_SNAPPY}
                className={cn(
                  'absolute inset-0 rounded-lg',
                  'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.9)]',
                  'dark:bg-[#3A3A3C] dark:shadow-[0_1px_3px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.08)]'
                )}
              />
            )}

            <Icon className="relative z-10 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * STATUS PILL
 * ========================================================================== */

function StatusPill({ online, reduced }: { online: boolean; reduced: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[10px] font-semibold uppercase tracking-[0.08em]',
        online
          ? 'border-[var(--success-border,rgba(52,199,89,0.25))] bg-[var(--success-soft,rgba(52,199,89,0.10))] text-[var(--success,#248A3D)] dark:text-[#30D158]'
          : 'border-[var(--warning-border,rgba(255,159,10,0.25))] bg-[var(--warning-soft,rgba(255,159,10,0.10))] text-[var(--warning,#B25000)] dark:text-[#FFB340]'
      )}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {online && !reduced && (
          <motion.span
            className="absolute inset-0 rounded-full bg-[var(--success,#34C759)]"
            animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <span
          className={cn(
            'relative h-1.5 w-1.5 rounded-full',
            online ? 'bg-[var(--success,#34C759)]' : 'bg-[var(--warning,#FF9500)]'
          )}
        />
      </span>
      {online ? 'AI yordamchi' : 'Oflayn'}
    </span>
  );
}

/* ============================================================================
 * MAIN
 * ========================================================================== */

export function AiCopilotHeader({
  online,
  busy,
  suggestionsActive,
  viewMode = 'full',
  onChangeViewMode,
  onNewChat,
  onToggleSuggestions,
  onClear,
  contextBadge,
  assistantName,
}: AiCopilotHeaderProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();

  const subtitle = resolveTranslation(
    t,
    'ai.subtitle',
    'Ta\'lim jarayonlarini tezroq va aqlliroq boshqaring'
  );
  const tagline = resolveTranslation(
    t,
    'ai.header.tagline',
    'Savol bering, hisobot oling yoki amal bajarishni so\'rang'
  );
  const newChatLabel = resolveTranslation(t, 'ai.newChat', 'Yangi suhbat');
  const suggestionsLabel = resolveTranslation(t, 'ai.suggestions', 'Takliflar');
  const clearLabel = resolveTranslation(t, 'ai.clear', 'Chatni tozalash');
  const displayName =
    assistantName ?? resolveTranslation(t, 'ai.assistantName', 'M-EDU AI');
  const thinkingLabel = resolveTranslation(t, 'ai.thinking', 'O\'ylayapti…');

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {onChangeViewMode && (
        <SegmentedControl
          value={viewMode}
          onChange={onChangeViewMode}
          disabled={busy}
          reduced={!!reduced}
        />
      )}

      {onNewChat && (
        <GlassButton
          variant="ghost"
          size="sm"
          icon={<Pencil className="h-3.5 w-3.5" />}
          onClick={onNewChat}
          disabled={busy}
        >
          {newChatLabel}
        </GlassButton>
      )}

      {onToggleSuggestions && (
        <GlassButton
          variant={suggestionsActive ? 'primary' : 'ghost'}
          size="sm"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={onToggleSuggestions}
        >
          {suggestionsLabel}
        </GlassButton>
      )}

      {onClear && (
        <GlassButton
          variant="ghost"
          size="sm"
          icon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
          onClick={onClear}
          disabled={busy}
          data-testid="ai-clear-header"
          aria-label={clearLabel}
        >
          {clearLabel}
        </GlassButton>
      )}
    </div>
  );

  return (
    <header
      className={cn(
        'relative z-10 flex shrink-0 flex-col gap-3 border-b p-4 sm:p-5',
        'border-[var(--border,rgba(0,0,0,0.08))] dark:border-white/[0.08]'
      )}
    >
      {/* ── Child 0: Page header with actions ───────────────────── */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
      >
        <GlassPageHeader title="M-EDU AI Copilot" subtitle={subtitle} actions={actions} />
      </motion.div>

      {/* ── Child 1: Assistant identity card (Liquid Glass) ──────── */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING_SMOOTH, delay: reduced ? 0 : 0.08 }}
        className="relative"
      >
        {/* Ambient tone-aware glow (pulses) */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-2 -z-10 rounded-3xl blur-2xl',
            !reduced && online && 'motion-safe:animate-[aiHeaderAmbient_5s_ease-in-out_infinite]'
          )}
          style={{
            opacity: online ? 0.55 : 0.2,
            background:
              'radial-gradient(ellipse at 20% 40%, rgba(0,122,255,0.28), transparent 60%), radial-gradient(ellipse at 80% 60%, rgba(175,82,222,0.22), transparent 60%)',
          }}
        />

        {/* Glass surface — 4 layers */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl',
            'border border-white/50 dark:border-white/[0.08]',
            'backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.14)]',
            'dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_8px_24px_-14px_rgba(0,0,0,0.50)]'
          )}
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)',
          }}
        >
          {/* Layer 2: Dark tint */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                'linear-gradient(135deg, rgba(28,28,30,0.65) 0%, rgba(28,28,30,0.45) 100%)',
            }}
          />

          {/* Layer 3: Specular top edge */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
          />

          {/* Layer 4: Specular bottom bevel */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"
          />

          {/* Corner lens flare */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-white/[0.14]"
          />

          {/* ─── Row ─────────────────────────────────────────── */}
          <div className="relative flex items-center gap-3 px-3.5 py-3">
            {/* Avatar with conic ring when busy */}
            <div className="relative h-10 w-10 shrink-0">
              {busy && !reduced && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[2px] rounded-[14px]"
                  style={{
                    background:
                      'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
                    filter: 'blur(0.5px)',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
              )}

              <div
                className={cn(
                  'relative flex h-full w-full items-center justify-center rounded-[14px] text-white',
                  'transition-transform duration-300',
                  busy && 'motion-safe:animate-[aiAvatarBreath_2.4s_ease-in-out_infinite]'
                )}
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,122,255,0.5)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[14px]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                  }}
                />
                <motion.span
                  className="relative flex items-center justify-center"
                  animate={
                    reduced || !busy
                      ? undefined
                      : { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }
                  }
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
                </motion.span>
              </div>
            </div>

            {/* Right column */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                  {displayName}
                </h2>

                <StatusPill online={online} reduced={!!reduced} />

                {busy && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgba(0,122,255,0.22)] bg-[rgba(0,122,255,0.10)] px-2 py-0.5 text-[10px] font-semibold text-[#007AFF] dark:border-[rgba(64,156,255,0.28)] dark:bg-[rgba(64,156,255,0.14)] dark:text-[#409CFF]"
                  >
                    <Brain className="h-2.5 w-2.5" aria-hidden="true" />
                    <span className="relative overflow-hidden">
                      {thinkingLabel}
                      {!reduced && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
                            mixBlendMode: 'overlay',
                          }}
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}
                    </span>
                  </span>
                )}

                {contextBadge && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,122,255,0.18)] bg-[rgba(0,122,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[#007AFF] dark:border-[rgba(64,156,255,0.24)] dark:bg-[rgba(64,156,255,0.12)] dark:text-[#409CFF]"
                    title={contextBadge}
                  >
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    <span className="max-w-[120px] truncate">{contextBadge}</span>
                  </span>
                )}
              </div>

              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
                {tagline}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes aiHeaderAmbient {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.60; transform: scale(1.06); }
        }
        @keyframes aiAvatarBreath {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
      `}</style>
    </header>
  );
}

export default AiCopilotHeader;