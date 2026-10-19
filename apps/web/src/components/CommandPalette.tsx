import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useOptionalAuthState } from '@/auth/AuthContext';
import { searchApi } from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  CreditCard,
  ClipboardCheck,
  FileSpreadsheet,
  UserPlus,
  Trophy,
  Smartphone,
  GraduationCap,
  Users,
  BookOpen,
  Search,
  Sparkles,
  CornerDownLeft,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category?: string;
  keywords?: string[];
  href?: string;
  icon: React.ReactNode;
  action?: () => void;
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function ActionBadge({
  icon: IconComponent,
  className,
  color,
}: {
  icon: LucideIcon;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-subtle bg-card/80 text-secondary transition-transform duration-150 ease-apple-spring group-hover:scale-[1.02]',
        color,
        className,
      )}
    >
      <IconComponent className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

function SimpleIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-subtle bg-card/80 text-secondary transition-transform duration-150 ease-apple-spring group-hover:scale-[1.02]">
      {children}
    </span>
  );
}

interface CommandItemWithRoles extends CommandItem {
  /** If set, only users with one of these roles will see this command */
  roles?: string[];
}

const ICON_NAV = <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12h18M3 6h18M3 18h18"/></svg>;

const QUICK_ACTIONS: CommandItemWithRoles[] = [
  {
    id: 'quick-payment',
    label: "Tezkor To'lov (Kassa)",
    description: "O'quvchidan zudlik bilan to'lov qabul qilish [Alt+P]",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['payment', 'tolov', 'pul', 'kassa', 'chek', 'payme', 'click', 'naqd'],
    icon: <ActionBadge icon={CreditCard} className="bg-emerald-500/15 border-emerald-500/25 text-emerald-500 dark:text-emerald-400" />,
    action: () => {
      window.dispatchEvent(new CustomEvent('open-quick-payment'));
      window.dispatchEvent(new CustomEvent('medu:open-quick-payment'));
    },
  },
  {
    id: 'quick-attendance',
    label: "Tezkor Davomat (Express)",
    description: "Bugungi guruh davomatini 1 daqiqada belgilash [Alt+A]",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['attendance', 'davomat', 'yoqlama', 'keldi', 'dars', 'kelmadi'],
    icon: <ActionBadge icon={ClipboardCheck} className="bg-indigo-500/15 border-indigo-500/25 text-indigo-500 dark:text-indigo-400" />,
    action: () => {
      window.dispatchEvent(new CustomEvent('open-quick-attendance'));
      window.dispatchEvent(new CustomEvent('medu:open-quick-attendance'));
    },
  },
  {
    id: 'quick-import',
    label: "Excel / CSV Bazasini Yuklash",
    description: "Markaz o'quvchilarini 2 soniyada tizimga o'tkazish",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['import', 'excel', 'csv', 'baza', 'upload', 'yuklash'],
    href: '/import-export',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={FileSpreadsheet} className="bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400" />,
  },
  {
    id: 'quick-new-student',
    label: "Yangi O'quvchi Qo'shish",
    description: "Yangi talaba anketasini ochish",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['new', 'student', 'oquvchi', 'talaba', 'qoshish'],
    href: '/students',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={UserPlus} className="bg-purple-500/15 border-purple-500/25 text-purple-500 dark:text-purple-400" />,
  },
  {
    id: 'quick-gamification',
    label: "M-Coins & Gamifikatsiya",
    description: "Reyting peshqadami va mukofotlar do'koni",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['gamification', 'coins', 'xp', 'tangalar', 'sovrin', 'leaderboard', 'podium'],
    href: '/gamification',
    icon: <ActionBadge icon={Trophy} className="bg-amber-500/15 border-amber-500/25 text-amber-500 dark:text-amber-400" />,
  },
  {
    id: 'quick-tg-app',
    label: "Telegram WebApp Hub",
    description: "Ota-ona (Face ID, invoys) & O'qituvchi (jadval, davomat)",
    category: "Tezkor Amallar (Spotlight Actions)",
    keywords: ['telegram', 'tg', 'bot', 'webapp', 'ota-ona', 'mobil', 'davomat'],
    href: '/tg-app',
    icon: <ActionBadge icon={Smartphone} className="bg-sky-500/15 border-sky-500/25 text-sky-500 dark:text-sky-400" />,
  },
];

const NAV_ITEMS: CommandItemWithRoles[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overview of your education center',
    category: 'Main',
    keywords: ['home', 'stats', 'overview'],
    href: '/',
    icon: (
      <ActionBadge icon={LayoutDashboard} className="bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400" />
    ),
  },
  {
    id: 'students',
    label: 'Students',
    description: 'Manage student records and profiles',
    category: 'Management',
    keywords: ['pupils', 'learners', 'enrollment'],
    href: '/students',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <ActionBadge icon={GraduationCap} className="bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400" />,
  },
  {
    id: 'teachers',
    label: 'Teachers',
    description: 'Manage teacher profiles and assignments',
    category: 'Management',
    keywords: ['staff', 'faculty', 'instructors'],
    href: '/teachers',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={Users} className="bg-purple-500/15 border-purple-500/25 text-purple-500 dark:text-purple-400" />,
  },
  {
    id: 'groups',
    label: 'Groups',
    description: 'Manage student groups and schedules',
    category: 'Management',
    keywords: ['classes', 'schedules'],
    href: '/groups',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <ActionBadge icon={Users} className="bg-cyan-500/15 border-cyan-500/25 text-cyan-500 dark:text-cyan-400" />,
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Track student attendance and reports',
    category: 'Management',
    keywords: ['present', 'absent', 'late', 'face', 'recognition'],
    href: '/attendance',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <ActionBadge icon={ClipboardCheck} className="bg-indigo-500/15 border-indigo-500/25 text-indigo-500 dark:text-indigo-400" />,
  },
  {
    id: 'courses',
    label: 'Courses',
    description: 'Course catalog and curriculum management',
    category: 'Management',
    keywords: ['subjects', 'curriculum', 'syllabus'],
    href: '/courses',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <ActionBadge icon={BookOpen} className="bg-amber-500/15 border-amber-500/25 text-amber-500 dark:text-amber-400" />,
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Track revenue, invoices and overdue payments',
    category: 'Finance',
    keywords: ['billing', 'fees', 'revenue', 'invoices'],
    href: '/payments',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={CreditCard} className="bg-emerald-500/15 border-emerald-500/25 text-emerald-500 dark:text-emerald-400" />,
  },
  {
    id: 'leads',
    label: 'Leads',
    description: 'Prospective student pipeline',
    category: 'Management',
    keywords: ['crm', 'prospects'],
    href: '/leads',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={Users} className="bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400" />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Reports, charts and performance metrics',
    category: 'Reports',
    keywords: ['reports', 'charts', 'metrics', 'statistics'],
    href: '/financial-analytics',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <SimpleIcon>{ICON_NAV}</SimpleIcon>,
  },
  {
    id: 'gamification',
    label: 'Gamification & M-Coins',
    description: 'Student XP, leaderboards, streaks and rewards store',
    category: 'Academic',
    keywords: ['coins', 'xp', 'points', 'leaderboard', 'store', 'rewards', 'gamification'],
    href: '/gamification',
    icon: <ActionBadge icon={Trophy} className="bg-amber-500/15 border-amber-500/25 text-amber-500 dark:text-amber-400" />,
  },
  {
    id: 'tg-app',
    label: 'Telegram WebApp Hub',
    description: 'Mobile parent & teacher Telegram portal',
    category: 'System',
    keywords: ['telegram', 'tg', 'bot', 'webapp', 'portal', 'parent', 'teacher'],
    href: '/tg-app',
    icon: <ActionBadge icon={Smartphone} className="bg-sky-500/15 border-sky-500/25 text-sky-500 dark:text-sky-400" />,
  },
  {
    id: 'certificates',
    label: 'Certificates',
    description: 'Generate and manage student certificates',
    category: 'Management',
    keywords: ['diploma', 'award', 'document'],
    href: '/certificates',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <SimpleIcon>{ICON_NAV}</SimpleIcon>,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'View and manage your notifications',
    category: 'System',
    keywords: ['alerts', 'messages', 'inbox'],
    href: '/notifications',
    icon: <SimpleIcon>{ICON_NAV}</SimpleIcon>,
  },
  {
    id: 'import-export',
    label: 'Import / Export',
    description: 'Import and export data in bulk',
    category: 'System',
    keywords: ['csv', 'excel', 'upload', 'download', 'data'],
    href: '/import-export',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <ActionBadge icon={FileSpreadsheet} className="bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400" />,
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    description: 'AI assistant for administrative tasks',
    category: 'AI',
    keywords: ['artificial intelligence', 'assistant', 'chat', 'help', 'gemini'],
    href: '/ai-copilot',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <ActionBadge icon={Sparkles} className="bg-purple-500/15 border-purple-500/25 text-purple-500 dark:text-purple-400" />,
  },
  {
    id: 'profile',
    label: 'My Profile',
    description: 'View and edit your profile',
    category: 'System',
    keywords: ['account', 'me', 'user'],
    href: '/settings',
    icon: <SimpleIcon>{ICON_NAV}</SimpleIcon>,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Organization, account and appearance',
    category: 'System',
    keywords: ['preferences', 'theme', 'configuration'],
    href: '/settings',
    icon: <ActionBadge icon={Settings} className="bg-zinc-500/15 border-zinc-500/25 text-zinc-500 dark:text-zinc-400" />,
  },
];

export function CommandPalette() {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const authState = useOptionalAuthState();
  const userRole = authState?.user?.role;
  const { playTick, playPop } = usePremiumSound();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  const [liveResults, setLiveResults] = useState<CommandItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(() => {
      searchApi.search(q, ['STUDENT', 'TEACHER', 'GROUP', 'COURSE'], 8)
        .then((res: any) => {
          if (cancelled) return;
          const mapped: CommandItem[] = (res.results || []).map((item: any) => {
            let cat = 'Qidiruv Natijalari';
            let iconComponent: LucideIcon = Search;
            let iconClass = 'bg-sky-500/15 border-sky-500/25 text-sky-400';
            const desc = item.subtitle || item.description || '';
            if (item.type === 'STUDENT') {
              cat = "O'quvchilar (Students)";
              iconComponent = GraduationCap;
              iconClass = 'bg-blue-500/15 border-blue-500/25 text-blue-500 dark:text-blue-400';
            } else if (item.type === 'TEACHER') {
              cat = "O'qituvchilar (Teachers)";
              iconComponent = Users;
              iconClass = 'bg-purple-500/15 border-purple-500/25 text-purple-500 dark:text-purple-400';
            } else if (item.type === 'GROUP') {
              cat = 'Guruhlar (Groups)';
              iconComponent = Users;
              iconClass = 'bg-cyan-500/15 border-cyan-500/25 text-cyan-500 dark:text-cyan-400';
            } else if (item.type === 'COURSE') {
              cat = 'Kurslar (Courses)';
              iconComponent = BookOpen;
              iconClass = 'bg-amber-500/15 border-amber-500/25 text-amber-500 dark:text-amber-400';
            }

            return {
              id: `search-${item.type}-${item.id}`,
              label: item.title,
              description: desc,
              category: cat,
              href: item.href,
              icon: <ActionBadge icon={iconComponent} className={iconClass} />,
            };
          });
          setLiveResults(mapped);
          setIsSearching(false);
        })
        .catch(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const roleFilteredActions = useMemo(() => {
    return QUICK_ACTIONS.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });
  }, [userRole]);

  const roleFilteredItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });
  }, [userRole]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return [...roleFilteredActions, ...roleFilteredItems];
    }

    const matchedNav = roleFilteredItems.filter((item) => {
      return [
        item.label,
        item.description,
        item.category,
        ...(item.keywords ?? []),
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(value));
    });

    const matchedActions = roleFilteredActions.filter((item) => {
      return [
        item.label,
        item.description,
        item.category,
        ...(item.keywords ?? []),
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(value));
    });

    return [...liveResults, ...matchedActions, ...matchedNav];
  }, [query, roleFilteredActions, roleFilteredItems, liveResults]);

  const openPalette = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    playTick();
    setOpen(true);
  }, [playTick]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);

    requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
    };

    const handleCustomOpen = () => {
      openPalette();
    };

    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('medu:open-command-palette', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('medu:open-command-palette', handleCustomOpen);
    };
  }, [open, openPalette, closePalette]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const execute = useCallback(
    (item: CommandItem) => {
      playPop();
      closePalette();
      if (item.action) {
        item.action();
      } else if (item.href) {
        navigate(item.href);
      }
    },
    [navigate, closePalette, playPop],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!filtered.length) return;
      playTick();
      setSelected((value) =>
        value >= filtered.length - 1 ? 0 : value + 1,
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!filtered.length) return;
      playTick();
      setSelected((value) =>
        value <= 0 ? filtered.length - 1 : value - 1,
      );
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (filtered[selected]) {
        execute(filtered[selected]);
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  };

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>(
    (result, item) => {
      const category = item.category || 'Other';
      result[category] ??= [];
      result[category].push(item);
      return result;
    },
    {},
  );

  let index = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 px-4 pt-[10vh] sm:pt-[14vh] backdrop-blur-sm animate-overlay-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePalette();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('a11y.commandPalette', 'Spotlight Command Palette')}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-subtle bg-card shadow-modal animate-modal-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 border-b border-black/[0.06] dark:border-white/[0.08] px-5 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-[#2563EB] dark:text-[#0A84FF]" />

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('a11y.searchPlaceholder', "Buyruq, o'quvchi, guruh yoki sahifani qidiring...")}
            aria-label={t('a11y.search', 'Qidiruv')}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              filtered[selected]
                ? `command-item-${filtered[selected].id}`
                : undefined
            }
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-tight outline-none placeholder:text-[#8E8E93] text-[#1D1D1F] dark:text-[#F5F5F7]"
          />

          {isSearching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent shrink-0" />
          )}

          <kbd className="hidden rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#8E8E93] sm:inline-flex">
            ESC
          </kbd>
        </div>

        <ul
          id={listId}
          role="listbox"
          className="max-h-[min(26rem,60vh)] overflow-y-auto py-2 scrollbar-thin"
        >
          {!filtered.length && (
            <li className="px-5 py-12 text-center text-sm font-medium text-[#8E8E93]">
              Hech qanday natija topilmadi: “{query}”
            </li>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <li key={category}>
              <div className="px-5 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#8E8E93]">
                {category}
              </div>

              {items.map((item) => {
                index += 1;

                const itemIndex = index;
                const active = itemIndex === selected;

                return (
                  <button
                    key={item.id}
                    id={`command-item-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => {
                      if (selected !== itemIndex) {
                        setSelected(itemIndex);
                        playTick();
                      }
                    }}
                    onClick={() => execute(item)}
                    className={[
                      'group mx-2.5 my-0.5 flex w-[calc(100%-1.25rem)] items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-all duration-150',
                      active
                        ? 'bg-[#2563EB]/10 dark:bg-[#0A84FF]/15 ring-1 ring-[#2563EB]/25 dark:ring-[#0A84FF]/30'
                        : 'hover:bg-black/[0.035] dark:hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <span className="shrink-0">
                      {item.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] font-semibold tracking-tight ${active ? 'text-[#2563EB] dark:text-[#0A84FF]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}>
                        {item.label}
                      </span>

                      {item.description && (
                        <span className="mt-0.5 block truncate text-[12px] font-normal text-[#8E8E93] dark:text-[#98989D]">
                          {item.description}
                        </span>
                      )}
                    </span>

                    {active && (
                      <span className="flex items-center gap-1 rounded-lg bg-[#2563EB]/15 dark:bg-[#0A84FF]/20 px-2 py-1 text-[11px] font-semibold text-[#2563EB] dark:text-[#0A84FF]">
                        <span>Ochish</span>
                        <CornerDownLeft className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-5 py-2.5 text-[11px] font-medium text-[#8E8E93]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-1 py-0.5 text-[10px]">↑↓</kbd>
              Navigatsiya
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-1 py-0.5 text-[10px]">↵</kbd>
              Tanlash
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-1 py-0.5 text-[10px]">ESC</kbd>
              Yopish
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Alt+P: To'lov
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Alt+A: Davomat
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommandPalette;
