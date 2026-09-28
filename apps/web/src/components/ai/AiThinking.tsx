/**
 * AiThinking — subtle, accessible "AI is working" indicator.
 *
 * Animation is decorative only and is neutralized by the global
 * `prefers-reduced-motion` rule (and the `motion-reduce:` variant).
 */

export interface AiThinkingProps {
  label?: string;
}

export function AiThinking({ label = 'Javob tayyorlanmoqda...' }: AiThinkingProps) {
  return (
    <div className="flex items-end gap-3" role="status" aria-live="polite" aria-busy="true">
      <span
        aria-hidden
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] sm:flex"
      >
        <span className="h-2 w-2 rounded-full bg-white/90" />
      </span>

      <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-xs)]">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
          M-EDU AI
        </span>

        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="flex items-center gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] motion-reduce:animate-none animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] motion-reduce:animate-none animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] motion-reduce:animate-none animate-bounce" />
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default AiThinking;
