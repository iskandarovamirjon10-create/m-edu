/**
 * CopilotCommandPalette — ⌘K command surface.
 * ============================================================================
 * A single keyboard-first entry point for every Copilot action: starting a
 * chat, running a capability, toggling the rails, switching theme or focus
 * mode. Fully accessible dialog with roving selection and type-ahead filter.
 * ============================================================================
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconChevronRight, IconCommand, IconSearch } from './copilotIcons';
import { CopilotKbd } from './CopilotControls';
import { cn } from '@/lib/design';

export interface CopilotCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
}

export interface CopilotCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CopilotCommand[];
  placeholder?: string;
}

export function CopilotCommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Buyruq yoki so‘rov qidiring…',
}: CopilotCommandPaletteProps) {
  const reduced = Boolean(useReducedMotion());
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const titleId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint ?? ''} ${command.group}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CopilotCommand[]>();
    for (const command of filtered) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const runAt = (index: number) => {
    const command = filtered[index];
    if (!command) return;
    onClose();
    command.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[170] flex items-start justify-center p-3 pt-[12vh] sm:pt-[16vh]">
          <motion.button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="cp-overlay !z-0"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
            className="cp-dialog relative z-10 flex max-h-[min(70vh,34rem)] w-full max-w-xl flex-col"
          >
            <div className="flex items-center gap-2.5 border-b border-[color:var(--cp-separator)] px-3.5 py-3">
              <IconSearch size={17} className="shrink-0 text-[color:var(--cp-text-tertiary)]" />
              <h2 id={titleId} className="sr-only">
                Copilot buyruqlari
              </h2>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    runAt(activeIndex);
                  } else if (event.key === 'Tab') {
                    onClose();
                  }
                }}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
                aria-autocomplete="list"
                placeholder={placeholder}
                className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium text-[color:var(--cp-text)] outline-none placeholder:text-[color:var(--cp-text-quaternary)]"
              />
              <CopilotKbd>esc</CopilotKbd>
            </div>

            <div ref={listRef} id={listId} role="listbox" aria-label="Buyruqlar" className="cp-scroll flex-1 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <div className="px-3 py-8 text-center text-[12px] text-[color:var(--cp-text-tertiary)]">
                  Hech narsa topilmadi
                </div>
              )}

              {grouped.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--cp-text-quaternary)]">
                    {group}
                  </div>
                  {items.map((command) => {
                    const index = filtered.indexOf(command);
                    const active = index === activeIndex;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        id={`${listId}-${command.id}`}
                        role="option"
                        aria-selected={active}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runAt(index)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left outline-none transition-colors duration-100',
                          active ? 'bg-[color:var(--cp-accent-soft)]' : 'hover:bg-[color:var(--cp-surface-sunken)]',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border',
                            active
                              ? 'border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent)] text-white'
                              : 'border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] text-[color:var(--cp-text-tertiary)]',
                          )}
                        >
                          {command.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-[12.5px] font-semibold',
                              active ? 'text-[color:var(--cp-accent)]' : 'text-[color:var(--cp-text)]',
                            )}
                          >
                            {command.label}
                          </span>
                          {command.hint && (
                            <span className="block truncate text-[10.5px] text-[color:var(--cp-text-tertiary)]">
                              {command.hint}
                            </span>
                          )}
                        </span>
                        {command.shortcut ? (
                          <CopilotKbd>{command.shortcut}</CopilotKbd>
                        ) : (
                          <IconChevronRight
                            size={13}
                            className={cn(
                              'shrink-0 transition-opacity',
                              active ? 'text-[color:var(--cp-accent)]' : 'text-[color:var(--cp-text-quaternary)] opacity-60',
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[color:var(--cp-separator)] bg-[color:var(--cp-surface-sunken)] px-3.5 py-2 text-[10px] font-medium text-[color:var(--cp-text-tertiary)]">
              <span className="inline-flex items-center gap-1.5">
                <IconCommand size={12} />
                M-EDU Copilot
              </span>
              <span className="hidden items-center gap-2 sm:flex">
                <CopilotKbd>↑↓</CopilotKbd> yurish
                <CopilotKbd>↵</CopilotKbd> ochish
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CopilotCommandPalette;
