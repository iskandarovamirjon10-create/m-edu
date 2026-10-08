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

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{
        color: 'var(--text-secondary)',
        background: 'var(--bg-glass)',
      }}
    >
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
    label: "⚡ Tezkor To‘lov (3 soniya)",
    description: "O‘quvchidan zudlik bilan to‘lov qabul qilish [Alt+P]",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['payment', 'tolov', 'pul', 'kassa', 'chek', 'payme', 'click', 'naqd'],
    icon: <span className="text-base">💵</span>,
    action: () => {
      window.dispatchEvent(new CustomEvent('open-quick-payment'));
    },
  },
  {
    id: 'quick-attendance',
    label: "📋 Tezkor Davomat (Express)",
    description: "Bugungi guruh davomatini 1 daqiqada belgilash [Alt+A]",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['attendance', 'davomat', 'yoqlama', 'keldi', 'dars', 'kelmadi'],
    icon: <span className="text-base">📋</span>,
    action: () => {
      window.dispatchEvent(new CustomEvent('open-quick-attendance'));
    },
  },
  {
    id: 'quick-import',
    label: "📥 Excel / CSV Bazasini Yuklash",
    description: "Markaz o‘quvchilarini 2 soniyada tizimga o‘tkazish",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['import', 'excel', 'csv', 'baza', 'upload', 'yuklash'],
    href: '/import-export',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <span className="text-base">📊</span>,
  },
  {
    id: 'quick-new-student',
    label: "➕ Yangi O‘quvchi Qo‘shish",
    description: "Yangi talaba anketasini ochish",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['new', 'student', 'oquvchi', 'talaba', 'qoshish'],
    href: '/students',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <span className="text-base">👤</span>,
  },
  {
    id: 'quick-gamification',
    label: "🏆 M-Coins & Gamifikatsiya",
    description: "Reyting peshqadami va mukofotlar do‘koni",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['gamification', 'coins', 'xp', 'tangalar', 'sovrin', 'leaderboard', 'podium'],
    href: '/gamification',
    icon: <span className="text-base">🏆</span>,
  },
  {
    id: 'quick-tg-app',
    label: "📱 Telegram WebApp Hub",
    description: "Ota-ona (Face ID, invoys) & O‘qituvchi (jadval, davomat)",
    category: "Tezkor Amallar (Fast Actions)",
    keywords: ['telegram', 'tg', 'bot', 'webapp', 'ota-ona', 'mobil', 'davomat'],
    href: '/tg-app',
    icon: <span className="text-base">📱</span>,
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
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
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
    icon: <Icon>{ICON_NAV}</Icon>,
  },
  {
    id: 'teachers',
    label: 'Teachers',
    description: 'Manage teacher profiles and assignments',
    category: 'Management',
    keywords: ['staff', 'faculty', 'instructors'],
    href: '/teachers',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <Icon>{ICON_NAV}</Icon>,
  },
  {
    id: 'groups',
    label: 'Groups',
    description: 'Manage student groups and schedules',
    category: 'Management',
    keywords: ['classes', 'schedules'],
    href: '/groups',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <Icon>{ICON_NAV}</Icon>,
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Track student attendance and reports',
    category: 'Management',
    keywords: ['present', 'absent', 'late', 'face', 'recognition'],
    href: '/attendance',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg></Icon>,
  },
  {
    id: 'courses',
    label: 'Courses',
    description: 'Course catalog and curriculum management',
    category: 'Management',
    keywords: ['subjects', 'curriculum', 'syllabus'],
    href: '/courses',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg></Icon>,
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Track revenue, invoices and overdue payments',
    category: 'Finance',
    keywords: ['billing', 'fees', 'revenue', 'invoices'],
    href: '/payments',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6v12m-3-2.8.88.66c1.17.88 3.07.88 4.24 0 1.17-.88 1.17-2.3 0-3.18-.58-.44-1.35-.66-2.12-.66-.73 0-1.45-.22-2-.66-1.1-.88-1.1-2.3 0-3.18s2.9-.88 4 0l.42.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg></Icon>,
  },
  {
    id: 'leads',
    label: 'Leads',
    description: 'Prospective student pipeline',
    category: 'Management',
    keywords: ['crm', 'prospects'],
    href: '/leads',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18M5 10h14M7 14h10M9 18h6"/></svg></Icon>,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Reports, charts and performance metrics',
    category: 'Reports',
    keywords: ['reports', 'charts', 'metrics', 'statistics'],
    href: '/analytics',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3v18h18M7 16l4-4 4 4 5-5"/></svg></Icon>,
  },
  {
    id: 'gamification',
    label: 'Gamification & M-Coins',
    description: 'Student XP, leaderboards, streaks and rewards store',
    category: 'Academic',
    keywords: ['coins', 'xp', 'points', 'leaderboard', 'store', 'rewards', 'gamification'],
    href: '/gamification',
    icon: <Icon><span className="text-sm">🏆</span></Icon>,
  },
  {
    id: 'tg-app',
    label: 'Telegram WebApp Hub',
    description: 'Mobile parent & teacher Telegram portal',
    category: 'System',
    keywords: ['telegram', 'tg', 'bot', 'webapp', 'portal', 'parent', 'teacher'],
    href: '/tg-app',
    icon: <Icon><span className="text-sm">📱</span></Icon>,
  },
  {
    id: 'certificates',
    label: 'Certificates',
    description: 'Generate and manage student certificates',
    category: 'Management',
    keywords: ['diploma', 'award', 'document'],
    href: '/certificates',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></Icon>,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'View and manage your notifications',
    category: 'System',
    keywords: ['alerts', 'messages', 'inbox'],
    href: '/notifications',
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg></Icon>,
  },
  {
    id: 'import-export',
    label: 'Import / Export',
    description: 'Import and export data in bulk',
    category: 'System',
    keywords: ['csv', 'excel', 'upload', 'download', 'data'],
    href: '/import-export',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg></Icon>,
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    description: 'AI assistant for administrative tasks',
    category: 'AI',
    keywords: ['artificial intelligence', 'assistant', 'chat', 'help', 'gemini'],
    href: '/ai-copilot',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'],
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg></Icon>,
  },
  {
    id: 'profile',
    label: 'My Profile',
    description: 'View and edit your profile',
    category: 'System',
    keywords: ['account', 'me', 'user'],
    href: '/profile',
    icon: <Icon><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"/></svg></Icon>,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Organization, account and appearance',
    category: 'System',
    keywords: ['preferences', 'theme', 'configuration'],
    href: '/settings',
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03H6v-2.4h.9A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 12.73 5.2V5h2.4v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 11H21v2.4h-.04A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </Icon>
    ),
  },
];

export function CommandPalette() {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const authState = useOptionalAuthState();
  const userRole = authState?.user?.role;

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
            let icon = '🔍';
            const desc = item.subtitle || item.description || '';
            if (item.type === 'STUDENT') {
              cat = 'O‘quvchilar (Students)';
              icon = '🎓';
            } else if (item.type === 'TEACHER') {
              cat = 'O‘qituvchilar (Teachers)';
              icon = '👨‍🏫';
            } else if (item.type === 'GROUP') {
              cat = 'Guruhlar (Groups)';
              icon = '👥';
            } else if (item.type === 'COURSE') {
              cat = 'Kurslar (Courses)';
              icon = '📚';
            }

            return {
              id: `search-${item.type}-${item.id}`,
              label: item.title,
              description: desc,
              category: cat,
              href: item.href,
              icon: <span className="text-base">{icon}</span>,
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
    setOpen(true);
  }, []);

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

    document.addEventListener('keydown', handleShortcut);
    window.addEventListener('open-command-palette', handleCustomOpen);

    return () => {
      document.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, [open, openPalette, closePalette]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const execute = useCallback(
    (item: CommandItem) => {
      closePalette();

      if (item.href) {
        navigate(item.href);
      } else {
        item.action?.();
      }
    },
    [closePalette, navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!filtered.length) return;

      setSelected((value) =>
        value >= filtered.length - 1 ? 0 : value + 1,
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!filtered.length) return;

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
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/35 dark:bg-black/70 px-4 pt-[12vh] backdrop-blur-md animate-overlay-in"
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
        aria-label={t('a11y.commandPalette')}
        className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] border animate-modal-in"
        style={{
          borderColor: 'var(--border-glass)',
          background: 'var(--bg-card)',
          backdropFilter: 'blur(36px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(36px) saturate(1.7)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <svg
            className="h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('a11y.searchPlaceholder')}
            aria-label={t('a11y.search')}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              filtered[selected]
                ? `command-item-${filtered[selected].id}`
                : undefined
            }
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: 'var(--text-primary)' }}
          />

          {isSearching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shrink-0" />
          )}

          <kbd
            className="hidden rounded-lg border px-2 py-1 text-[10px] font-bold sm:inline-flex"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-glass)',
              color: 'var(--text-muted)',
            }}
          >
            ESC
          </kbd>
        </div>

        <ul
          id={listId}
          role="listbox"
          className="max-h-[min(26rem,60vh)] overflow-y-auto py-2"
        >
          {!filtered.length && (
            <li className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No results for “{query}”
            </li>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <li key={category}>
              <div
                className="px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em]"
                style={{ color: 'var(--text-muted)' }}
              >
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
                    onMouseEnter={() => setSelected(itemIndex)}
                    onClick={() => execute(item)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition duration-150"
                    style={{
                      color: active
                        ? 'var(--primary)'
                        : 'var(--text-primary)',
                      background: active
                        ? 'rgba(84,115,252,.09)'
                        : 'transparent',
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        color: active
                          ? 'var(--primary)'
                          : 'var(--text-secondary)',
                        background: active
                          ? 'rgba(84,115,252,.14)'
                          : 'var(--bg-glass)',
                      }}
                    >
                      {item.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {item.label}
                      </span>

                      {item.description && (
                        <span
                          className="mt-0.5 block truncate text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.description}
                        </span>
                      )}
                    </span>

                    {active && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-xs"
                        style={{
                          color: 'var(--primary)',
                          background: 'rgba(84,115,252,.12)',
                        }}
                      >
                        ↵
                      </span>
                    )}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>

        <div
          className="hidden items-center justify-between border-t px-4 py-2.5 text-[11px] sm:flex"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex items-center gap-3">
            <span>↑↓ Tanlash</span>
            <span>↵ Ochish</span>
            <span>ESC Yopish</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-emerald-400">
              Alt+P: To‘lov
            </span>
            <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-indigo-400">
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
