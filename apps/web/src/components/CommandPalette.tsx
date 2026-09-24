/**
 * Command Palette — ⌘K / Ctrl+K quick navigation
 * Glass-styled spotlight search for the entire app.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface CommandItem {
 id: string;
 label: string;
 description?: string;
 icon: React.ReactNode;
 href?: string;
 action?: () => void;
 category?: string;
 keywords?: string[];
}

const NAV_ITEMS: CommandItem[] = [
 {
 id:'dashboard',
 label:'Dashboard',
 description:'Overview of your education center',
 category:'Main',
 keywords: ['home','stats','overview'],
 href:'/',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <rect x="3"y="3"width="7"height="7"rx="1"/>
 <rect x="14"y="3"width="7"height="7"rx="1"/>
 <rect x="3"y="14"width="7"height="7"rx="1"/>
 <rect x="14"y="14"width="7"height="7"rx="1"/>
 </svg>
 ),
},
 {
 id:'students',
 label:'Students',
 description:'Manage student records and profiles',
 category:'Management',
 keywords: ['pupils','enrollment','learners'],
 href:'/students',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z"/>
 </svg>
 ),
},
 {
 id:'teachers',
 label:'Teachers',
 description:'Manage teacher profiles and assignments',
 category:'Management',
 keywords: ['instructors','staff','faculty'],
 href:'/teachers',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
 </svg>
 ),
},
 {
 id:'payments',
 label:'Payments',
 description:'Track revenue, invoices and overdue',
 category:'Management',
 keywords: ['billing','fees','revenue','money'],
 href:'/payments',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
 </svg>
 ),
},
 {
 id:'groups',
 label:'Groups',
 description:'Manage student groups and schedules',
 category:'Management',
 keywords: ['classes','courses','schedules'],
 href:'/groups',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/>
 </svg>
 ),
},
 {
 id:'leads',
 label:'Leads',
 description:'Prospective student pipeline',
 category:'Management',
 keywords: ['prospects','inquiries','crm'],
 href:'/leads',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
 </svg>
 ),
},
 {
 id:'settings',
 label:'Settings',
 description:'Organization, account and appearance',
 category:'System',
 keywords: ['preferences','theme','config'],
 href:'/settings',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 0 .638-.682c.31-.866.7-1.696 1.139-2.472M12 9v3.75m-9.303 3.376c.866 1.357 2.318 2.108 3.843 2.108a9.06 9.06 0 0 0 3.843-2.108M12 9V6m0 3v3m0 0v.75m0 0H9m3 0h3"/>
 </svg>
 ),
},
 {
 id:'grades',
 label:'Grades',
 description:'Student gradebook and assessments',
 category:'Academic',
 keywords: ['marks','scores','exams'],
 href:'/grades',
 icon: (
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>
 </svg>
 ),
},
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
 Main: (
 <svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
 <polyline points="9 22 9 12 15 12 15 22"/>
 </svg>
 ),
 Management: (
 <svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
 <circle cx="12"cy="12"r="3"/>
 </svg>
 ),
 Academic: (
 <svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
 <path d="M6 12v5c3 3 9 3 12 0v-5"/>
 </svg>
 ),
 System: (
 <svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <circle cx="12"cy="12"r="3"/>
 <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
 </svg>
 ),
};

export function CommandPalette() {
  const { t} = useSafeI18n();
  const [open, setOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [selected, setSelected] = useState(0);
 const inputRef = useRef<HTMLInputElement>(null);
 const navigate = useNavigate();

 const filtered = query.trim()
 ? NAV_ITEMS.filter((item) => {
 const q = query.toLowerCase();
 return (
 item.label.toLowerCase().includes(q) ||
 item.description?.toLowerCase().includes(q) ||
 item.category?.toLowerCase().includes(q) ||
 item.keywords?.some((k) => k.includes(q))
 );
})
 : NAV_ITEMS;

 // Keyboard shortcut
 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key ==='k') {
 e.preventDefault();
 setOpen((v) => !v);
}
};
 document.addEventListener('keydown', onKey);
 return () => document.removeEventListener('keydown', onKey);
}, []);

 // Focus input when opened
 useEffect(() => {
 if (open) {
 setQuery('');
 setSelected(0);
 requestAnimationFrame(() => inputRef.current?.focus());
}
}, [open]);

 // Reset selection when filtered changes
 useEffect(() => {
 setSelected(0);
}, [query]);

 const execute = useCallback(
 (item: CommandItem) => {
 setOpen(false);
 setQuery('');
 if (item.href) navigate(item.href);
 else item.action?.();
},
 [navigate],
 );

 const onKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key ==='ArrowDown') {
 e.preventDefault();
 setSelected((s) => Math.min(s + 1, filtered.length - 1));
} else if (e.key ==='ArrowUp') {
 e.preventDefault();
 setSelected((s) => Math.max(s - 1, 0));
} else if (e.key ==='Enter') {
 e.preventDefault();
 if (filtered[selected]) execute(filtered[selected]);
} else if (e.key ==='Escape') {
 setOpen(false);
}
},
 [filtered, selected, execute],
 );

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

 // Group by category for display
 const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
 const cat = item.category ||'Other';
 if (!acc[cat]) acc[cat] = [];
 acc[cat].push(item);
 return acc;
}, {});

 let flatIndex = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4"
      style={{ background:'rgba(15,25,45,0.45)', backdropFilter:'blur(8px)', animation:'glass-dropdown-in 0.15s ease-out forwards'}}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t('a11y.commandPalette')}
    >
 <div
 className="w-full max-w-lg overflow-hidden"
 style={{
 background:'var(--bg-card)',
 backdropFilter:'blur(40px) saturate(1.8)',
 WebkitBackdropFilter:'blur(40px) saturate(1.8)',
 border:'1px solid var(--border-glass)',
 borderRadius:'var(--radius-xl)',
 boxShadow:'var(--shadow-lg)',
}}
 onClick={(e) => e.stopPropagation()}
 >
 {/* Reflection */}
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0"
 style={{
 background:'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, transparent 40%)',
 borderRadius:'inherit',
}}
 />

 <div className="relative z-10">
 {/* Search input */}
 <div
 className="flex items-center gap-3 px-4 py-3"
 style={{ borderBottom:'1px solid var(--border-subtle)'}}
 >
 <svg
 className="w-5 h-5 shrink-0"
 style={{ color:'var(--text-muted)'}}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.6"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <circle cx="11"cy="11"r="8"/>
 <path d="m21 21-4.35-4.35"/>
 </svg>
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={onKeyDown}
placeholder={t('a11y.searchPlaceholder')}
  className="flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-[var(--text-muted)]"
  style={{ color:'var(--text-primary)'}}
  aria-label={t('a11y.search')}
 aria-autocomplete="list"
 aria-controls="command-list"
 />
 <kbd
 className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
 style={{
 background:'var(--bg-glass)',
 border:'1px solid var(--border-subtle)',
 color:'var(--text-muted)',
}}
 >
 ESC
 </kbd>
 </div>

 {/* Results */}
 <ul
 id="command-list"
 className="max-h-80 overflow-y-auto py-2"
 style={{ scrollbarWidth:'thin', scrollbarColor:'var(--border-medium) transparent'}}
 role="listbox"
 >
 {filtered.length === 0 && (
 <li className="px-4 py-8 text-center">
 <p className="text-sm"style={{ color:'var(--text-muted)'}}>
 No results for "{query}"
 </p>
 </li>
 )}
 {Object.entries(grouped).map(([category, items]) => (
 <li key={category}>
 <div
 className="flex items-center gap-2 px-4 py-2"
 style={{ color:'var(--text-muted)'}}
 >
 {CATEGORY_ICONS[category]}
 <span className="text-[11px] font-semibold uppercase tracking-widest">
 {category}
 </span>
 </div>
 {items.map((item) => {
 flatIndex++;
 const isSelected = flatIndex === selected;
 return (
 <li key={item.id}>
 <button
 type="button"
 role="option"
 aria-selected={isSelected}
 onClick={() => execute(item)}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150"
 style={{
 background: isSelected ?'rgba(84,115,252,0.08)' :'transparent',
 color: isSelected ?'var(--m-vivid)' :'var(--text-primary)',
}}
 onMouseEnter={() => setSelected(flatIndex)}
 >
 <span
 className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
 style={{
 background: isSelected
 ?'rgba(84,115,252,0.14)'
 :'var(--bg-glass)',
 color: isSelected ?'var(--m-vivid)' :'var(--text-secondary)',
}}
 >
 {item.icon}
 </span>
 <div className="flex-1 min-w-0">
 <p className="text-[0.875rem] font-medium truncate">{item.label}</p>
 {item.description && (
 <p
 className="text-[0.75rem] truncate mt-0.5"
 style={{ color:'var(--text-muted)'}}
 >
 {item.description}
 </p>
 )}
 </div>
 {isSelected && (
 <span
 className="text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded"
 style={{
 background:'rgba(84,115,252,0.12)',
 color:'var(--m-vivid)',
}}
 >
 ↵
 </span>
 )}
 </button>
 </li>
 );
})}
 </li>
 ))}
 </ul>

 {/* Footer hint */}
 <div
 className="flex items-center gap-4 px-4 py-2.5"
 style={{
 borderTop:'1px solid var(--border-subtle)',
 color:'var(--text-muted)',
}}
 >
 {[
 ['↑↓','Navigate'],
 ['↵','Open'],
 ['ESC','Close'],
 ].map(([key, label]) => (
 <span key={key} className="flex items-center gap-1.5 text-[11px]">
 <kbd
 className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
 style={{
 background:'var(--bg-glass)',
 border:'1px solid var(--border-subtle)',
}}
 >
 {key}
 </kbd>
 <span>{label}</span>
 </span>
 ))}
 </div>
 </div>
      </div>
    </div>,
    document.body
  );
}

export default CommandPalette;
