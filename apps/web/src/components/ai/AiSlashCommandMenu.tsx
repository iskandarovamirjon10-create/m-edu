/**
 * AiSlashCommandMenu — Interactive Liquid Glass Slash Command Palette (v2).
 *
 * Responsibilities:
 *   - Shows floating command menu when user types `/` in composer.
 *   - Connects `/davomat`, `/qarz`, `/jadval`, `/talaba [ism]`, `/xulosa` to domain tools.
 *   - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Tab, Escape).
 *   - Mobile touch-friendly selection with accessibility (`role="listbox"`).
 */
import { useEffect, useRef } from 'react';
import { BarChart3, CreditCard, Calendar, Users, FileText } from 'lucide-react';
import { cn } from '@/lib/design';

export interface SlashCommand {
  id: string;
  command: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
  prompt: string;
  hasArg?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'attendance',
    command: '/davomat',
    title: 'Davomat Tahlili',
    description: 'Bugungi umumiy davomat koʻrsatkichlari va davomat kartasi',
    icon: BarChart3,
    prompt: 'Bugungi umumiy davomat tahlilini koʻrsat',
  },
  {
    id: 'debtors',
    command: '/qarz',
    title: 'Qarzdorliklar',
    description: 'Muddati oʻtgan toʻlovlar va qarzdor talabalar roʻyxati',
    icon: CreditCard,
    prompt: 'Muddati oʻtgan toʻlovlar va qarzdorlar roʻyxatini koʻrsat',
  },
  {
    id: 'schedule',
    command: '/jadval',
    title: 'Darslar Jadvali',
    description: 'Bugungi darslar vaqti, guruhlar va xonalar taqsimoti',
    icon: Calendar,
    prompt: 'Bugungi darslar jadvalini koʻrsat',
  },
  {
    id: 'student',
    command: '/talaba',
    title: 'Talabani Topish',
    description: 'Talaba dosyesi, guruhi va kontaktlarini topish',
    icon: Users,
    prompt: 'talaba haqida maʼlumot: ',
    hasArg: true,
  },
  {
    id: 'summary',
    command: '/xulosa',
    title: 'Muloqot Xulosasi',
    description: 'Ushbu suhbat boʻyicha rasmiy boshqaruv xulosasi',
    icon: FileText,
    prompt: 'Ushbu suhbat boʻyicha asosiy xulosa va ijro topshiriqlarini tayyorla',
  },
];

export interface AiSlashCommandMenuProps {
  query: string;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  className?: string;
  /** Enables `aria-activedescendant` wiring from the composer. */
  id?: string;
}

export function AiSlashCommandMenu({
  query,
  selectedIndex,
  onSelect,
  className,
  id,
}: AiSlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cleanQuery = query.toLowerCase().trim();

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().startsWith(cleanQuery) ||
      cmd.title.toLowerCase().includes(cleanQuery.replace('/', ''))
  );

  // Auto-scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="Slash buyruqlar"
      data-testid="ai-slash-menu"
      className={cn(
        'absolute bottom-full left-0 mb-2 w-full max-w-sm overflow-hidden rounded-2xl',
        'border border-black/[0.08] dark:border-white/10',
        'bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-3xl',
        'shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.8)]',
        'dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]',
        'divide-y divide-black/[0.04] dark:divide-white/[0.06]',
        'z-40 max-h-68 overflow-y-auto p-2 transition-all',
        className
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted,#86868B)]">
        <span>Tezkor Buyruqlar (Slash)</span>
        <span className="rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px]">Tab / ↵</span>
      </div>

      <div className="flex flex-col gap-1 pt-1">
        {filtered.map((item, idx) => {
          const isSelected = idx === Math.min(selectedIndex, filtered.length - 1);
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              id={id ? `${id}-option-${idx}` : undefined}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(item)}
              className={cn(
                'group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-all duration-150',
                isSelected
                  ? 'bg-gradient-to-r from-[#007AFF] via-[#0A84FF] to-[#3A82F6] text-white shadow-[0_4px_16px_rgba(0,122,255,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] scale-[1.01]'
                  : 'text-[var(--text-primary)] hover:bg-[#007AFF]/[0.06] hover:text-[#007AFF] active:scale-[0.98]'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105',
                  isSelected
                    ? 'bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                    : 'bg-black/[0.04] text-[#007AFF] dark:bg-white/[0.08] dark:text-[#007AFF]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold tracking-tight">{item.title}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-mono tracking-wide',
                      isSelected
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-muted)] group-hover:text-[#007AFF]'
                    )}
                  >
                    {item.command}
                  </span>
                </div>
                <span
                  className={cn(
                    'truncate text-[10.5px]',
                    isSelected ? 'text-white/85' : 'text-[var(--text-muted)]'
                  )}
                >
                  {item.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
