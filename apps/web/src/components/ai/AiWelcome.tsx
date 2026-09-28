/**
 * AiWelcome / AiQuickPrompt — premium empty state with quick prompts.
 *
 * Prompts map to capabilities the M-EDU AI backend actually exposes
 * (attendance, schedule, students, finance, reports and the confirmed
 * Telegram message action) — no decorative or unsupported shortcuts.
 */
import type { ReactNode } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

export interface AiQuickPromptData {
  id: string;
  title: string;
  hint: string;
  text: string;
  icon: ReactNode;
}

export const AI_QUICK_PROMPTS: AiQuickPromptData[] = [
  {
    id: 'attendance',
    title: 'Davomat',
    hint: 'Bugungi davomatni ko‘rsatish',
    text: 'Bugungi davomatni ko‘rsat',
    icon: <ClipboardCheck aria-hidden className="h-5 w-5" />,
  },
  {
    id: 'schedule',
    title: 'Darslar',
    hint: 'Bugungi darslar jadvali',
    text: 'Bugungi darslar jadvalini ko‘rsat',
    icon: <CalendarDays aria-hidden className="h-5 w-5" />,
  },
  {
    id: 'students',
    title: 'O‘quvchilar',
    hint: 'O‘quvchilarni qidirish',
    text: 'O‘quvchilarni ismi bo‘yicha qidirib ber',
    icon: <Users aria-hidden className="h-5 w-5" />,
  },
  {
    id: 'finance',
    title: 'To‘lovlar',
    hint: 'Qarzdorlar ro‘yxati',
    text: 'Qarzdorlar ro‘yxatini ko‘rsat',
    icon: <Wallet aria-hidden className="h-5 w-5" />,
  },
  {
    id: 'report',
    title: 'Hisobot',
    hint: 'Qisqa kunlik hisobot',
    text: 'Bugungi darslar bo‘yicha qisqa hisobot tayyorla',
    icon: <FileText aria-hidden className="h-5 w-5" />,
  },
  {
    id: 'announcement',
    title: 'Xabarlar',
    hint: 'Telegram xabarini tayyorlash',
    text: 'Ota-onalarga Telegram xabarini tayyorlashni so‘rang',
    icon: <Megaphone aria-hidden className="h-5 w-5" />,
  },
];

export interface AiQuickPromptProps {
  prompt: AiQuickPromptData;
  disabled?: boolean;
  onSelect: (text: string) => void;
}

export function AiQuickPrompt({ prompt, disabled = false, onSelect }: AiQuickPromptProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt.text)}
      className={[
        'group flex w-full flex-col gap-2 rounded-2xl border border-[var(--border)]',
        'bg-[var(--bg-card)] p-4 text-left',
        'transition-[transform,border-color,box-shadow,background-color] duration-[var(--duration-fast)]',
        'hover:-translate-y-0.5 hover:border-[var(--border-focus)] hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-md)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
      ].join(' ')}
      aria-label={`${prompt.title} — ${prompt.hint}`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-white">
        {prompt.icon}
      </span>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{prompt.title}</span>
      <span className="text-xs leading-5 text-[var(--text-secondary)]">{prompt.hint}</span>
    </button>
  );
}

export interface AiWelcomeProps {
  disabled?: boolean;
  onSelect: (text: string) => void;
}

export function AiWelcome({ disabled = false, onSelect }: AiWelcomeProps) {
  return (
    <div className="flex min-h-full items-center justify-center py-6">
      <div className="mx-auto w-full max-w-2xl text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-[var(--shadow-lg)]"
        >
          <Sparkles className="h-7 w-7" />
        </span>

        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Bugun sizga qanday yordam beray?
        </h2>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
          M-EDU tizimidagi ma’lumotlarni tahlil qiling, hisobotlar tayyorlang yoki kundalik
          vazifalarni AI yordamida tezlashtiring.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AI_QUICK_PROMPTS.map((prompt) => (
            <AiQuickPrompt key={prompt.id} prompt={prompt} disabled={disabled} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default AiWelcome;
