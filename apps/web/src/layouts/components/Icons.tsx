/**
 * M-EDU Layout Icons & Micro-Interactions — v11 "Titanium"
 * High precision vector paths, gradient strokes, and magnetic springs.
 */

import { useRef, useCallback, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { SPRING, ACCENTS, type AccentKey } from '../core/tokens';
import { useDeviceProfile, usePrefersReducedMotion } from '../core/singletons';

export const I: Record<string, string[]> = {
  dashboard: ['M4 4h6.5v6.5H4z','M13.5 4H20v6.5h-6.5z','M4 13.5h6.5V20H4z','M13.5 13.5H20V20h-6.5z'],
  ai: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z','M18.5 3.5v3','M20 5h-3','M5.5 18v2.5','M6.75 19.25h-2.5'],
  students: ['M22 9 12 4 2 9l10 5z','M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5','M22 9v6'],
  teachers: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M16 10l2 2 4-4'],
  groups: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M22 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  courses: ['M12 7v14','M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  attendance: ['M8 2v4','M16 2v4','M3 10h18','M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z','M9 15l2 2 4-4'],
  face: ['M9 3H5a2 2 0 0 0-2 2v4','M15 3h4a2 2 0 0 1 2 2v4','M21 15v4a2 2 0 0 1-2 2h-4','M9 21H5a2 2 0 0 1-2-2v-4','M9.5 10v.5','M14.5 10v.5','M9 15a4 4 0 0 0 6 0'],
  library: ['M4 4v16','M9 4v16','M14 4v16','M17.5 5.2 21 19.5','M2 20h20'],
  exams: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M9 15l2 2 4-4'],
  payments: ['M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z','M1 10h22','M6 15h2'],
  invoices: ['M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z','M9 7h6','M9 11h6','M9 15h4'],
  reports: ['M4 20V4','M4 20h17','M9 20v-7','M14 20V8','M19 20v-4'],
  homework: ['M13 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18 2l4 4-9 9-4 1 1-4z'],
  cert: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z','M8.2 13.9 7 22l5-3 5 3-1.2-8.1'],
  chat: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z'],
  executive: ['M21.2 15.9A10 10 0 1 1 8 2.8','M22 12A10 10 0 0 0 12 2v10z'],
  financial: ['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  payroll: ['M20 12V8H6a2 2 0 0 1 0-4h12v4','M4 6v12c0 1.1.9 2 2 2h14v-4','M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  leads: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z','M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M12 12h.01'],
  parentPortal: ['M3 11 12 3l9 8','M5 9.5V21h14V9.5','M9 21v-6h6v6'],
  hr: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z','M8 10h4','M8 14h4','M8 18h4','M16 10h.01','M16 14h.01','M16 18h.01'],
  automation: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  followUp: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z','M15 2h6v6','M21 2l-6 6'],
  branches: ['M3 21h18','M5 21V8l7-5 7 5v13','M9 21v-6h6v6','M10 12h.01','M14 12h.01'],
  inventory: ['M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z','M3.3 7 12 12l8.7-5','M12 22V12'],
  expenses: ['M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z','M9 12h6'],
  cameras: ['M23 7l-7 5 7 5V7z','M1 5h15v14H1z'],
  anomaly: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  governance: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z','M9 12l2 2 4-4'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M23 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  audit: ['M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.3-4.3'],
  menu: ['M3 6h18','M3 12h18','M3 18h18'],
  close: ['M18 6 6 18','M6 6l12 12'],
  calculator: ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z','M8 7h8','M8 11h.01','M12 11h.01','M16 11h.01','M8 15h.01','M12 15h.01','M16 15h.01'],
  collapse: ['M11 19l-7-7 7-7','M20 19l-7-7 7-7'],
  expand: ['M13 5l7 7-7 7','M4 5l7 7-7 7'],
  keyboard: ['M3 6h18v12H3z','M7 10h.01','M11 10h.01','M15 10h.01','M19 10h.01','M7 14h10'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2','M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  wifiOff: ['M1 1l22 22','M16.7 12.6A12 12 0 0 1 21 15','M5 12.5a12 12 0 0 1 5.2-2.9','M8.5 16a6 6 0 0 1 7 0','M12 20h.01'],
  check: ['M20 6 9 17l-5-5'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
};

const STROKE_BASE = 1.75;
const STROKE_ACTIVE = 2.1;

export function StaticIcon({ paths, className = '' }: { paths: string[]; className?: string }) {
  return (
    <svg
      className={`h-[1.25rem] w-[1.25rem] shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_BASE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function PremiumIcon({
  paths,
  isActive,
  accent = 'blue',
  id,
}: {
  paths: string[];
  isActive?: boolean;
  accent?: AccentKey;
  id: string;
}) {
  const c = ACCENTS[accent];
  const reduced = usePrefersReducedMotion();
  const gradId = `grad-${id}`;

  return (
    <svg
      className="h-[1.25rem] w-[1.25rem] shrink-0 transition-transform duration-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isActive ? STROKE_ACTIVE : STROKE_BASE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: isActive && !reduced ? 'scale(1.08)' : 'scale(1)',
        filter: isActive
          ? `drop-shadow(0 0 5px ${c.glow}) drop-shadow(0 1px 0 rgba(255,255,255,0.4))`
          : 'drop-shadow(0 1px 0 rgba(255,255,255,0.25))',
        transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
        color: isActive ? `url(#${gradId})` : undefined,
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function Magnetic({
  children,
  strength = 0.35,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING.magnetic);
  const sy = useSpring(y, SPRING.magnetic);
  const profile = useDeviceProfile();
  const isDisabled = disabled || profile.reduced || !profile.hoverCapable;

  const onMove = useCallback((e: React.MouseEvent) => {
    if (isDisabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }, [isDisabled, strength, x, y]);

  const onLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={isDisabled ? undefined : { x: sx, y: sy }}
      className={`inline-flex ${className}`}
    >
      {children}
    </motion.span>
  );
}
