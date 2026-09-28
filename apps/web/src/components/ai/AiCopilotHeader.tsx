/**
 * AiCopilotHeader — page header, assistant identity card and conversation
 * actions. Availability is derived from the real connection state instead
 * of a hardcoded "Online" claim.
 */
import { Sparkles, Trash2 } from 'lucide-react';
import { GlassButton, GlassPageHeader } from '@/components/ui';

export interface AiCopilotHeaderProps {
  online: boolean;
  busy: boolean;
  onClear: () => void;
}

export function AiCopilotHeader({ online, busy, onClear }: AiCopilotHeaderProps) {
  return (
    <header className="relative z-10 shrink-0">
      <GlassPageHeader
        title="M-EDU AI Copilot"
        subtitle="Ta’lim jarayonlarini tezroq va aqlliroq boshqaring"
        className="!mb-3"
        actions={
          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Trash2 aria-hidden />}
            onClick={onClear}
            disabled={busy}
            data-testid="ai-clear-header"
          >
            Chatni tozalash
          </GlassButton>
        }
      />

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
          </div>

          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
            Savol bering, hisobot oling yoki amal bajarishni so‘rang
          </p>
        </div>
      </div>
    </header>
  );
}

export default AiCopilotHeader;
