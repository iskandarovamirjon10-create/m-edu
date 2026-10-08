/**
 * AiCopilotHeader — Ultra Premium Edition v3
 * Features:
 *  - GlassPageHeader with title, actions, and clear chat button (data-testid="ai-clear-header")
 *  - Assistant identity card (child 1 of header, bg-[var(--bg-card)])
 *  - Online status pill ('AI yordamchi' / 'Oflayn')
 *  - Studio vs Split View mode switcher
 *  - Context badge indicator
 */

import { Sparkles, Trash2, Pencil, Layout, Columns2 } from 'lucide-react';
import { GlassButton, GlassPageHeader } from '@/components/ui';
import { useI18n } from '@/i18n/I18nProvider';

export interface AiCopilotHeaderProps {
  online: boolean;
  busy: boolean;
  suggestionsActive?: boolean;
  viewMode?: 'full' | 'split' | 'drawer';
  onChangeViewMode?: (mode: 'full' | 'split' | 'drawer') => void;
  onNewChat?: () => void;
  onToggleSuggestions?: () => void;
  onClear?: () => void;
  contextBadge?: string;
}

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
}: AiCopilotHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="relative z-10 shrink-0 flex flex-col gap-3 p-4 sm:p-5 border-b border-[var(--border,#0000000d)]">
      {/* ── Child 0: GlassPageHeader with Controls ── */}
      <GlassPageHeader
        title="M-EDU AI Copilot"
        subtitle={t('ai.subtitle') || 'Ta’lim jarayonlarini tezroq va aqlliroq boshqaring'}
        className="!mb-0"
        actions={
          <div className="flex items-center gap-2">
            {onChangeViewMode && (
              <div className="hidden md:flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.04] p-0.5">
                <button
                  type="button"
                  onClick={() => onChangeViewMode('full')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === 'full'
                      ? 'bg-white dark:bg-zinc-800 text-[#007AFF] shadow-xs'
                      : 'text-[var(--text-muted,#86868B)] hover:text-[var(--text-primary,#1D1D1F)]'
                  }`}
                >
                  <Layout className="h-3 w-3" />
                  <span>{t('ai.viewMode.full') || 'Studio'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeViewMode('split')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === 'split'
                      ? 'bg-white dark:bg-zinc-800 text-[#007AFF] shadow-xs'
                      : 'text-[var(--text-muted,#86868B)] hover:text-[var(--text-primary,#1D1D1F)]'
                  }`}
                >
                  <Columns2 className="h-3 w-3" />
                  <span>{t('ai.viewMode.split') || 'Split View'}</span>
                </button>
              </div>
            )}

            {onNewChat && (
              <GlassButton
                variant="ghost"
                size="sm"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={onNewChat}
                disabled={busy}
              >
                {t('ai.newChat') || 'Yangi suhbat'}
              </GlassButton>
            )}

            {onToggleSuggestions && (
              <GlassButton
                variant={suggestionsActive ? 'primary' : 'ghost'}
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={onToggleSuggestions}
              >
                {t('ai.suggestions') || 'Takliflar'}
              </GlassButton>
            )}

            {onClear && (
              <GlassButton
                variant="ghost"
                size="sm"
                icon={<Trash2 aria-hidden className="h-3.5 w-3.5" />}
                onClick={onClear}
                disabled={busy}
                data-testid="ai-clear-header"
              >
                Chatni tozalash
              </GlassButton>
            )}
          </div>
        }
      />

      {/* ── Child 1: Assistant Identity Card ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 shadow-[var(--shadow-xs)] backdrop-blur-xl">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
        >
          <Sparkles className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">M-EDU AI</h2>

            <span
              className={[
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5',
                'text-[10px] font-semibold uppercase tracking-wider',
                online
                  ? 'border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]'
                  : 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  online ? 'bg-[var(--success)]' : 'bg-[var(--warning)]',
                ].join(' ')}
              />
              {online ? 'AI yordamchi' : 'Oflayn'}
            </span>

            {contextBadge && (
              <span
                className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: 'rgba(0,122,255,0.08)',
                  border: '1px solid rgba(0,122,255,0.18)',
                  color: '#007AFF',
                }}
              >
                {contextBadge}
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
            {t('ai.header.tagline') || 'Savol bering, hisobot oling yoki amal bajarishni so‘rang'}
          </p>
        </div>
      </div>
    </header>
  );
}

export default AiCopilotHeader;