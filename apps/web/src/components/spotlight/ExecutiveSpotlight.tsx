/**
 * M-EDU V2 — Executive Spotlight Command Palette (`ExecutiveSpotlight.tsx`)
 * Universal omni-launcher, keyboard-driven navigation, and instant workflow activator.
 * Engineered with 120Hz spring physics, Apple VisionOS glass surfaces, and WCAG 2.2 AA accessibility.
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';

export interface SpotlightItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'quickAction' | 'navigation' | 'management' | 'system';
  icon: string;
  badge?: string;
  keywords?: string[];
  onSelect: () => void;
}

interface ExecutiveSpotlightProps {
  isOpen?: boolean;
  onClose?: () => void;
  customActions?: SpotlightItem[];
}

const CATEGORY_LABELS = {
  quickAction: 'Tezkor Amallar',
  navigation: 'Asosiy Sahifalar',
  management: 'Boshqaruv & CRM',
  system: 'Tizim & Uskunalar',
} as const;

export const ExecutiveSpotlight = memo(function ExecutiveSpotlight({
  isOpen,
  onClose,
  customActions = [],
}: ExecutiveSpotlightProps) {
  const navigate = useNavigate();
  const { playTick, playSuccess, playError } = usePremiumSound();

  const [internalOpen, setInternalOpen] = useState(false);
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : internalOpen;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else setInternalOpen(false);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setInternalOpen((v) => !v);
      }
    };
    const onCustom = () => setInternalOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-executive-spotlight', onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-executive-spotlight', onCustom);
    };
  }, []);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isCurrentlyOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isCurrentlyOpen]);

  // Built-in universal catalog
  const defaultItems = useMemo<SpotlightItem[]>(() => [
    // Quick Actions
    {
      id: 'act-new-student',
      title: "Yangi o'quvchi qo'shish",
      subtitle: "Yangi talabani tizimga kiritish va guruhga biriktirish",
      category: 'quickAction',
      icon: '👤+',
      badge: 'N',
      keywords: ['student', 'oquvchi', 'talaba', 'qoshish', 'create'],
      onSelect: () => navigate('/students/new'),
    },
    {
      id: 'act-new-payment',
      title: "To'lov qabul qilish",
      subtitle: "Kassa yoki onlayn to'lovni qayd qilish",
      category: 'quickAction',
      icon: '💳',
      badge: 'P',
      keywords: ['tolov', 'pul', 'kassa', 'payment', 'pay'],
      onSelect: () => navigate('/payments?action=new'),
    },
    {
      id: 'act-ai-copilot',
      title: "AI Copilot bilan muloqot",
      subtitle: "Tizim ma'lumotlari tahlili va buyruqlar bajarish",
      category: 'quickAction',
      icon: '✨',
      badge: '⌘J',
      keywords: ['ai', 'copilot', 'suniy intellekt', 'yordamchi', 'assistant'],
      onSelect: () => navigate('/ai-copilot'),
    },
    {
      id: 'act-face-kiosk',
      title: "Jonli Face ID Kioskini ochish",
      subtitle: "Biometrik turniket va davomat kiosk ekrani",
      category: 'quickAction',
      icon: '📷',
      badge: 'K',
      keywords: ['face', 'kiosk', 'davomat', 'turniket', 'kamera'],
      onSelect: () => navigate('/face-recognition'),
    },
    {
      id: 'act-cashier-z',
      title: "Kassa Z-Hisoboti (Smena yopish)",
      subtitle: "Kunlik kassa qoldig'i va to'lovlar balansi",
      category: 'quickAction',
      icon: '🧾',
      badge: 'Z',
      keywords: ['z-report', 'smena', 'kassa', 'hisobot', 'balance'],
      onSelect: () => navigate('/payments?tab=analytics&openZ=true'),
    },

    // Navigation
    {
      id: 'nav-dashboard',
      title: "Boshqaruv Paneli (Dashboard)",
      subtitle: "Asosiy telemetriya, KPI va operatsion radar",
      category: 'navigation',
      icon: '📊',
      keywords: ['boshqaruv', 'dashboard', 'asosiy', 'kpi'],
      onSelect: () => navigate('/dashboard'),
    },
    {
      id: 'nav-students',
      title: "O'quvchilar ro'yxati",
      subtitle: "Barcha talabalar, ularning holati va profillari",
      category: 'navigation',
      icon: '🎓',
      keywords: ['oquvchilar', 'students', 'talabalar', 'shogirdlar'],
      onSelect: () => navigate('/students'),
    },
    {
      id: 'nav-teachers',
      title: "O'qituvchilar va Mentorlar",
      subtitle: "Pedagoglar shtati, yuklamalar va dars soatlari",
      category: 'navigation',
      icon: '👨‍🏫',
      keywords: ['ustoz', 'oqituvchi', 'teachers', 'mentorlar'],
      onSelect: () => navigate('/teachers'),
    },
    {
      id: 'nav-groups',
      title: "Guruhlar va Kurslar",
      subtitle: "Faol guruhlar, sinfxonalar va mashg'ulotlar",
      category: 'navigation',
      icon: '👥',
      keywords: ['guruhlar', 'groups', 'kurslar', 'sinflar'],
      onSelect: () => navigate('/groups'),
    },
    {
      id: 'nav-schedule',
      title: "Dars Jadvali & Xonalar",
      subtitle: "Haftalik dars taqvimi va auditoriyalar bandligi",
      category: 'navigation',
      icon: '📅',
      keywords: ['jadval', 'schedule', 'darslar', 'vaqt'],
      onSelect: () => navigate('/schedule'),
    },
    {
      id: 'nav-attendance',
      title: "Davomat Jurnali",
      subtitle: "Bugungi va oylik elektron davomat varaqasi",
      category: 'navigation',
      icon: '📋',
      keywords: ['davomat', 'attendance', 'keldi-ketdi', 'jurnal'],
      onSelect: () => navigate('/attendance'),
    },
    {
      id: 'nav-payments',
      title: "Moliya & To'lovlar Markazi",
      subtitle: "Tushumlar, qarzdorliklar va kassa operatsiyalari",
      category: 'management',
      icon: '💰',
      keywords: ['moliya', 'payments', 'kassa', 'finance', 'daromad'],
      onSelect: () => navigate('/payments'),
    },
    {
      id: 'nav-leads',
      title: "CRM & Lidlar Voronkasi",
      subtitle: "Yangi murojaatlar va talabaga aylantirish bosqichlari",
      category: 'management',
      icon: '🎯',
      keywords: ['crm', 'leads', 'lidlar', 'voronka', 'marketing'],
      onSelect: () => navigate('/leads'),
    },
    {
      id: 'nav-telegram',
      title: "Telegram Bot & Bildirishnomalar",
      subtitle: "Ota-onalar boti, WebApp va avtomatik SMS xabarlar",
      category: 'management',
      icon: '✈️',
      keywords: ['telegram', 'bot', 'sms', 'xabarlar', 'ota-ona'],
      onSelect: () => navigate('/telegram'),
    },
    {
      id: 'nav-cameras',
      title: "Kameralar va RTSP Oqimlari",
      subtitle: "IP kameralar tarmog'i va jonli video kuzatuv",
      category: 'system',
      icon: '📹',
      keywords: ['kameralar', 'cameras', 'rtsp', 'video', 'kuzatuv'],
      onSelect: () => navigate('/cameras'),
    },
    {
      id: 'nav-settings',
      title: "Tizim Sozlamalari & Xavfsizlik",
      subtitle: "Filial parametrlari, API kalitlari va xavfsizlik",
      category: 'system',
      icon: '⚙️',
      keywords: ['sozlamalar', 'settings', 'xavfsizlik', 'config'],
      onSelect: () => navigate('/settings'),
    },
  ], [navigate]);

  const allItems = useMemo(
    () => [...defaultItems, ...customActions],
    [defaultItems, customActions],
  );

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    return allItems.filter((item) => {
      const inTitle = item.title.toLowerCase().includes(q);
      const inSubtitle = item.subtitle?.toLowerCase().includes(q) ?? false;
      const inKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
      return inTitle || inSubtitle || inKeywords;
    });
  }, [allItems, query]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          playSuccess();
          handleClose();
          selected.onSelect();
        } else {
          playError();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [filteredItems, selectedIndex, playTick, playSuccess, playError, handleClose],
  );

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isCurrentlyOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xl"
          onClick={handleClose}
        >
          <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className={cn(
            'w-full max-w-2xl overflow-hidden rounded-3xl border border-white/40 bg-white/80 p-0 shadow-2xl backdrop-blur-3xl',
            'dark:border-white/15 dark:bg-[#18181b]/90 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]',
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Universal Spotlight Command Palette"
        >
          {/* Search Header */}
          <div className="relative flex items-center border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <span className="text-xl text-[var(--text-secondary,#86868b)] mr-3 select-none">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Qidiruv yoki buyruq kiriting... (masalan: o'quvchi, to'lov, kassa, jadval)"
              className="w-full bg-transparent text-base sm:text-lg font-medium text-[var(--text-primary,#1d1d1f)] dark:text-white placeholder:text-[var(--text-tertiary,#a1a1a6)] outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="ml-2 rounded-full p-1 text-xs text-[var(--text-tertiary)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-black/10 dark:border-white/15 px-2 py-0.5 text-[11px] font-mono text-[var(--text-tertiary)]">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto p-2 no-scrollbar divide-y divide-black/[0.03] dark:divide-white/[0.04]"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center">
                <span className="text-3xl mb-2 block">🧐</span>
                <p className="text-sm font-semibold text-[var(--text-primary)] dark:text-white">
                  Hech narsa topilmadi
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Boshqa kalit so'z bilan izlab ko'ring
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playSuccess();
                      handleClose();
                      item.onSelect();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-150',
                      isSelected
                        ? 'bg-brand-500/15 text-brand-600 dark:bg-brand-400/20 dark:text-brand-300 shadow-sm'
                        : 'text-[var(--text-primary,#1d1d1f)] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-lg">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tracking-tight truncate">
                            {item.title}
                          </span>
                          <span className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-[var(--text-secondary,#86868b)] truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.badge && (
                        <kbd className="hidden sm:inline-flex items-center rounded-md border border-black/10 dark:border-white/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                          {item.badge}
                        </kbd>
                      )}
                      <span
                        className={cn(
                          'text-xs font-semibold opacity-0 transition-opacity',
                          isSelected && 'opacity-100',
                        )}
                      >
                        ↵
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Hints */}
          <div className="flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] px-5 py-2.5 text-[11px] text-[var(--text-secondary,#86868b)] bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">↑</kbd>{' '}
                <kbd className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">↓</kbd> harakatlanish
              </span>
              <span>
                <kbd className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">↵</kbd> tanlash
              </span>
            </div>
            <span className="hidden sm:inline font-mono">
              M-EDU V2 OmniCommand
            </span>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>,
  document.body
);
});
