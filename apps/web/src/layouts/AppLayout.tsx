/**
 * M-EDU AppLayout — Glass Shell
 * Premium, light-first, futuristic. Sidebar uses glass surface with
 * brand accent on active items. Mobile sheet uses the same glass.
 */
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { CommandPalette } from '@/components/CommandPalette';
import { AIAssistant } from '@/components/AIAssistant';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { initials, fullName } from '@/lib/format';
import { useTheme } from '../hooks/useTheme';

interface NavItem {
  to: string;
  /** Dictionary key under `nav.*`; preferred over `label`. */
  labelKey: string;
  /** English fallback only — prefer `labelKey`. */
  label: string;
  icon: ReactNode;
  end?: boolean;
}

// Minimalist, line-style icons (24x24, stroke 1.6)
const Icon = ({ d }: { d: string }) => (
  <svg
    className="h-[1.125rem] w-[1.125rem] shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const I = {
  dashboard: 'M3 13.5 12 5.25 21 13.5M4.5 11.25V21h15v-9.75',
  students:  'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  teachers:  'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.595 60.595 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5',
  groups:    'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
  courses:   'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  attendance:'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  face:      'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  payments:  'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  library:   'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  exams:     'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z',
  homework:  'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  hr:        'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z',
  cert:      'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35',
  inventory: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  expenses:  'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  leads:     'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15',
  cameras:   'M6.115 5.19l.319 1.913A6.75 6.75 0 0 0 8.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 0 0 2.288-4.042 1.087 1.087 0 0 0-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 0 1-.98-.314l-.295-.295a1.125 1.125 0 0 1 0-1.591l.13-.132a1.125 1.125 0 0 1 1.445-.261l.156.09c.446.256.976.234 1.375-.058L15.5 8.25',
  users:     'M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  audit:     'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  settings:  'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87',
  logout:    'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  search:    'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  menu:      'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  close:     'M6 18 18 6M6 6l12 12',
  bell:      'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  invoices:  'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  reports:   'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  chat:      'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z',
  parentPortal: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
  executive:  'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605',
  automation: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1-.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.723 7.723 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.49l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
  payroll:    'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15',
  financial:  'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15',
  branches:   'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z',
  governance: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  anomaly:    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  followUp:   'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
};

const PRIMARY_NAV: NavItem[] = [
  { to: '/',           labelKey: 'nav.dashboard',        label: 'Dashboard',        icon: <Icon d={I.dashboard}/>,  end: true },
  { to: '/students',   labelKey: 'nav.students',         label: 'Students',         icon: <Icon d={I.students}/> },
  { to: '/teachers',   labelKey: 'nav.teachers',         label: 'Teachers',         icon: <Icon d={I.teachers}/> },
  { to: '/groups',     labelKey: 'nav.groups',           label: 'Groups',           icon: <Icon d={I.groups}/> },
  { to: '/courses',    labelKey: 'nav.courses',          label: 'Courses',          icon: <Icon d={I.courses}/> },
  { to: '/attendance', labelKey: 'nav.attendance',       label: 'Attendance',       icon: <Icon d={I.attendance}/> },
  { to: '/face',       labelKey: 'nav.faceRecognition',  label: 'Face Recognition', icon: <Icon d={I.face}/> },
  { to: '/library',    labelKey: 'nav.library',          label: 'Library',          icon: <Icon d={I.library}/> },
  { to: '/exams',      labelKey: 'nav.exams',            label: 'Exams',            icon: <Icon d={I.exams}/> },
  { to: '/payments',   labelKey: 'nav.payments',         label: 'Payments',         icon: <Icon d={I.payments}/> },
  { to: '/invoices',   labelKey: 'nav.invoices',         label: 'Invoices',         icon: <Icon d={I.invoices}/> },
  { to: '/reports',    labelKey: 'nav.reports',          label: 'Reports',          icon: <Icon d={I.reports}/> },
  { to: '/homework',   labelKey: 'nav.homework',         label: 'Homework',         icon: <Icon d={I.homework}/> },
  { to: '/certificates', labelKey: 'nav.certificates',   label: 'Certificates',     icon: <Icon d={I.cert}/> },
  { to: '/chat',         labelKey: 'nav.chat',           label: 'Chat',             icon: <Icon d={I.chat}/> },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/executive-dashboard', labelKey: 'nav.executiveDashboard', label: 'Executive Dashboard', icon: <Icon d={I.executive}/> },
  { to: '/financial-analytics', labelKey: 'nav.financialAnalytics', label: 'Financial Analytics', icon: <Icon d={I.financial}/> },
  { to: '/payroll-analytics',   labelKey: 'nav.payrollAnalytics',   label: 'Payroll Analytics',   icon: <Icon d={I.payroll}/> },
  { to: '/crm-analytics',       labelKey: 'nav.crmAnalytics',       label: 'CRM Analytics',       icon: <Icon d={I.leads}/> },
  { to: '/parent-portal',       labelKey: 'nav.parentPortal',       label: 'Parent Portal',       icon: <Icon d={I.parentPortal}/> },
  { to: '/hr',                  labelKey: 'nav.hrPayroll',          label: 'HR & Payroll',        icon: <Icon d={I.hr}/> },
  { to: '/payroll',             labelKey: 'nav.payrollRuns',        label: 'Payroll Runs',        icon: <Icon d={I.payroll}/> },
  { to: '/automation',          labelKey: 'nav.automation',         label: 'Automation',          icon: <Icon d={I.automation}/> },
  { to: '/follow-up-automation',labelKey: 'nav.followUpRules',      label: 'Follow-Up Rules',     icon: <Icon d={I.followUp}/> },
  { to: '/branches',            labelKey: 'nav.branches',           label: 'Branches',            icon: <Icon d={I.branches}/> },
  { to: '/inventory',           labelKey: 'nav.inventory',          label: 'Inventory',           icon: <Icon d={I.inventory}/> },
  { to: '/expenses',            labelKey: 'nav.expenses',           label: 'Expenses',            icon: <Icon d={I.expenses}/> },
  { to: '/leads',               labelKey: 'nav.leads',              label: 'Leads',               icon: <Icon d={I.leads}/> },
  { to: '/cameras',             labelKey: 'nav.cameras',            label: 'Cameras',             icon: <Icon d={I.cameras}/> },
  { to: '/anomaly-detection',   labelKey: 'nav.anomalyDetection',   label: 'Anomaly Detection',   icon: <Icon d={I.anomaly}/> },
  { to: '/data-governance',     labelKey: 'nav.dataGovernance',     label: 'Data Governance',     icon: <Icon d={I.governance}/> },
  { to: '/users',               labelKey: 'nav.users',              label: 'Users',               icon: <Icon d={I.users}/> },
  { to: '/audit',               labelKey: 'nav.audit',              label: 'Audit Log',           icon: <Icon d={I.audit}/> },
  { to: '/settings',            labelKey: 'nav.settings',           label: 'Settings',            icon: <Icon d={I.settings}/> },
];

const HIDDEN_FOR_STUDENT = new Set([
  '/teachers', '/users', '/expenses', '/cameras', '/audit',
  '/settings', '/homework', '/leads', '/hr', '/inventory',
  '/invoices', '/reports', '/executive-dashboard', '/financial-analytics',
  '/payroll-analytics', '/crm-analytics', '/parent-portal', '/payroll',
  '/automation', '/follow-up-automation', '/branches', '/anomaly-detection',
  '/data-governance',
]);

function Brand({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 no-underline group">
      <span
        className={[
          'flex items-center justify-center rounded-xl font-bold text-white',
          'bg-gradient-to-br from-brand-500 via-brand-700 to-brand-800',
          'shadow-[0_4px_14px_rgba(84,115,252,0.30)]',
          'transition-transform duration-300 group-hover:scale-105',
          size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-base',
        ].join(' ')}
      >
        M
      </span>
      <span
        className={[
          'font-bold tracking-tight text-[var(--text-primary)]',
          size === 'sm' ? 'text-base' : 'text-lg',
        ].join(' ')}
      >
        M-EDU
      </span>
    </Link>
  );
}

function NavItems({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const { t } = useI18n();
  const renderItem = (item: NavItem) => {
    if (role === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)) return null;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'group relative flex items-center gap-3',
            'px-3 py-2.5 rounded-xl',
            'text-[0.9375rem] font-medium',
            'transition-all duration-200 ease-out',
            isActive
              ? 'bg-gradient-to-r from-brand-700/12 to-brand-700/4 text-brand-700 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] hover:translate-x-0.5',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-brand-700"
              />
            )}
            <span
              className={[
                'flex-shrink-0 transition-transform duration-200',
                isActive ? 'text-brand-700 scale-110' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {item.icon}
            </span>
            <span className="flex-1">{t(item.labelKey) || item.label}</span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={t('a11y.mainNav')}>
      <div className="space-y-0.5">{PRIMARY_NAV.map(renderItem)}</div>
      {SECONDARY_NAV.some((item) => !(role === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to))) && (
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {t('nav.administration')}
          </p>
          <div className="space-y-0.5">{SECONDARY_NAV.map(renderItem)}</div>
        </div>
      )}
    </nav>
  );
}

function ThemeToggle() {
  const { setTheme, isDark } = useTheme();
  const { t } = useI18n();

  const themeLabel = isDark ? t('a11y.switchToLight') : t('a11y.switchToDark');

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={themeLabel}
      className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] transition-colors"
      title={themeLabel}
    >
      {isDark ? (
        <svg className="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg className="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  // Global search: Enter navigates to /search?q=…, Escape clears the field.
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = search.trim();
        if (!q) {
          searchRef.current?.focus();
          return;
        }
        navigate(`/search?q=${encodeURIComponent(q)}`);
        setSearch('');
        searchRef.current?.blur();
      } else if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    },
    [search, navigate],
  );

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const userRole = user?.role || '';
  const userFullName = user ? fullName(user.firstName, user.lastName) : '';
  const userInitials = user ? initials(user.firstName, user.lastName) : '?';
  const organizationName = user?.organization?.name || 'Education Center';

  return (
    <div className="relative flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Floating background orbs */}
      <div className="orb-container" aria-hidden>
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar — glass surface */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col lg:flex">
        <div className="flex h-full flex-col m-3 rounded-3xl border border-[var(--border-glass)] bg-[var(--bg-glass)] backdrop-blur-3xl backdrop-saturate-[1.7] shadow-[var(--shadow-lg)] overflow-hidden">
          {/* Brand */}
          <div className="flex h-16 items-center px-5 border-b border-[var(--border-subtle)]">
            <Brand />
          </div>

          {/* Org info */}
          <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)] truncate">
              {organizationName}
            </p>
            <p className="text-[0.75rem] text-[var(--text-muted)] capitalize">
              {userRole.replace('_', ' ').toLowerCase()}
            </p>
          </div>

          <NavItems role={userRole} />

          {/* Logout */}
          <div className="p-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] transition-all duration-200"
            >
              <Icon d={I.logout}/>
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between lg:hidden">
        <div className="flex h-full w-full items-center justify-between px-4 m-2 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] backdrop-blur-2xl shadow-[var(--shadow-md)]">
          <Brand size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationsMenu />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <Icon d={I.close}/> : <Icon d={I.menu}/>}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-[rgba(15,25,45,0.45)] backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            ref={mobileMenuRef}
            className="absolute left-0 top-0 h-full w-[280px] m-3 rounded-3xl border border-[var(--border-glass)] bg-[var(--bg-card)] backdrop-blur-3xl shadow-[var(--shadow-lg)] overflow-hidden flex flex-col"
          >
            <div className="flex h-16 items-center justify-between px-5 border-b border-[var(--border-subtle)]">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)]"
                aria-label={t('a11y.closeMenu')}
              >
                <Icon d={I.close}/>
              </button>
            </div>
            <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
              <p className="text-[0.9375rem] font-semibold text-[var(--text-primary)] truncate">{organizationName}</p>
              <p className="text-[0.75rem] text-[var(--text-muted)] capitalize">{userRole.replace('_', ' ').toLowerCase()}</p>
            </div>
            <NavItems role={userRole} onNavigate={() => setMobileMenuOpen(false)} />
            <div className="p-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)]"
              >
                <Icon d={I.logout}/>
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col lg:pl-[280px]">
        {/* Top bar (desktop) */}
        <header className="sticky top-0 z-20 hidden lg:flex h-16 items-center gap-3 px-4 m-3 mb-0 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] backdrop-blur-2xl backdrop-saturate-[1.6] shadow-[var(--shadow-md)]">
          <div className="relative flex-1 max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Icon d={I.search}/>
            </span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              type="search"
              placeholder={t('nav.searchPlaceholder')}
              className="w-full pl-10 pr-16 py-2 rounded-xl bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.15)] transition-all"
              aria-label={t('nav.searchPlaceholder')}
            />
            {/* Command palette shortcut hint */}
            <button
              type="button"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--m-vivid)] transition-colors pointer-events-none"
              style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}
              tabIndex={-1}
              aria-hidden="true"
            >
              ⌘K
            </button>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsMenu />
            <div className="h-6 w-px bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(84,115,252,0.25)] ring-2 ring-white/40"
                title={user?.email}
              >
                {userInitials}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-sm font-semibold text-[var(--text-primary)] leading-none">
                  {userFullName}
                </span>
                <span className="text-[0.75rem] text-[var(--text-muted)] capitalize leading-none mt-0.5">
                  {userRole.replace('_', ' ').toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-6 pt-20 pb-8 outline-none lg:px-7 lg:pt-7"
        >
          <Outlet />
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <AIAssistant />
    </div>
  );
}

export default AppLayout;
