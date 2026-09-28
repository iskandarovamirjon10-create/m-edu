/**
 * AiAvatar — shared identity mark for conversation participants.
 */
import { Sparkles, User } from 'lucide-react';

export function AiAvatar({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={[
        'hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl',
        'bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] sm:flex',
        className,
      ].join(' ')}
    >
      <Sparkles className="h-4 w-4" />
    </span>
  );
}

export function UserAvatar({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={[
        'hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl',
        'border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] sm:flex',
        className,
      ].join(' ')}
    >
      <User className="h-4 w-4" />
    </span>
  );
}

export default AiAvatar;
