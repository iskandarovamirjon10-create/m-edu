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

const NAV_ITEMS: CommandItem[] = [
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
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" />
        </svg>
      </Icon>
    ),
  },
  {
    id: 'teachers',
    label: 'Teachers',
    description: 'Manage teacher profiles and assignments',
    category: 'Management',
    keywords: ['staff', 'faculty', 'instructors'],
    href: '/teachers',
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 20a8 8 0 0 1 16 0" />
        </svg>
      </Icon>
    ),
  },
  {
    id: 'groups',
    label: 'Groups',
    description: 'Manage student groups and schedules',
    category: 'Management',
    keywords: ['classes', 'schedules'],
    href: '/groups',
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </Icon>
    ),
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Track revenue, invoices and overdue payments',
    category: 'Management',
    keywords: ['billing', 'fees', 'revenue'],
    href: '/payments',
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 6v12m-3-2.8.88.66c1.17.88 3.07.88 4.24 0 1.17-.88 1.17-2.3 0-3.18-.58-.44-1.35-.66-2.12-.66-.73 0-1.45-.22-2-.66-1.1-.88-1.1-2.3 0-3.18s2.9-.88 4 0l.42.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </Icon>
    ),
  },
  {
    id: 'leads',
    label: 'Leads',
    description: 'Prospective student pipeline',
    category: 'Management',
    keywords: ['crm', 'prospects'],
    href: '/leads',
    icon: (
      <Icon>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 6h18M5 10h14M7 14h10M9 18h6" />
        </svg>
      </Icon>
    ),
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

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return NAV_ITEMS;

    return NAV_ITEMS.filter((item) => {
      return [
        item.label,
        item.description,
        item.category,
        ...(item.keywords ?? []),
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(value));
    });
  }, [query]);

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
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/45 px-4 pt-[12vh] backdrop-blur-md animate-overlay-in"
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
          className="hidden items-center gap-4 border-t px-4 py-2.5 text-[11px] sm:flex"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommandPalette;
