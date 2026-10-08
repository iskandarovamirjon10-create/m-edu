/**
 * M-EDU AuthLayout — iOS 27 "Liquid Glass" Edition
 *
 * Tamoyillar:
 *  · Immersive depth — 4 rangli aurora orbs, mouse parallax
 *  · Kinetic type — staggered char reveal
 *  · Liquid Glass card — 3 qatlam (fringe + specular + tint)
 *  · Breathing logo — conic aura pulse
 *  · Trust signals — security badges, gradient divider
 *  · Film grain — 4% shovqin qatlami (analog his)
 *  · Time-aware — vaqtga qarab ambient tint
 */

import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';

/* ══════════════════════════════════════════════════════════════════
 * 1. TOKENS
 * ══════════════════════════════════════════════════════════════════ */

const SPRING_SOFT = { type: 'spring', stiffness: 180, damping: 26, mass: 1 } as const;
const SPRING_HOVER = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 } as const;
void SPRING_HOVER;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/* Vaqtga qarab ambient palette */
interface AmbientTheme {
  primary: string;
  secondary: string;
  tertiary: string;
  glow: string;
  tint: string;
}

function getAmbientTheme(): AmbientTheme {
  const h = new Date().getHours();
  if (h < 5) {
    return {
      primary: '#5E5CE6',
      secondary: '#AF52DE',
      tertiary: '#0A84FF',
      glow: 'rgba(94,92,230,0.4)',
      tint: 'rgba(94,92,230,0.04)',
    };
  }
  if (h < 12) {
    return {
      primary: '#007AFF',
      secondary: '#32ADE6',
      tertiary: '#5856D6',
      glow: 'rgba(0,122,255,0.4)',
      tint: 'rgba(0,122,255,0.03)',
    };
  }
  if (h < 17) {
    return {
      primary: '#FF9500',
      secondary: '#FF2D55',
      tertiary: '#AF52DE',
      glow: 'rgba(255,149,0,0.35)',
      tint: 'rgba(255,149,0,0.03)',
    };
  }
  if (h < 22) {
    return {
      primary: '#AF52DE',
      secondary: '#FF2D55',
      tertiary: '#5856D6',
      glow: 'rgba(175,82,222,0.4)',
      tint: 'rgba(175,82,222,0.04)',
    };
  }
  return {
    primary: '#5E5CE6',
    secondary: '#0A84FF',
    tertiary: '#AF52DE',
    glow: 'rgba(94,92,230,0.4)',
    tint: 'rgba(94,92,230,0.04)',
  };
}

/* ══════════════════════════════════════════════════════════════════
 * 2. AURORA ORBS — immersive background
 * ══════════════════════════════════════════════════════════════════ */

function AuroraOrbs() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Spring-smoothed parallax
  const px = useSpring(mx, { stiffness: 40, damping: 20, mass: 1 });
  const py = useSpring(my, { stiffness: 40, damping: 20, mass: 1 });

  // Different layers move at different rates (parallax)
  const orb1X = useTransform(px, (v) => v * -30);
  const orb1Y = useTransform(py, (v) => v * -30);
  const orb2X = useTransform(px, (v) => v * 22);
  const orb2Y = useTransform(py, (v) => v * 22);
  const orb3X = useTransform(px, (v) => v * -16);
  const orb3Y = useTransform(py, (v) => v * -16);
  const orb4X = useTransform(px, (v) => v * 14);
  const orb4Y = useTransform(py, (v) => v * 14);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mx.set(x);
      my.set(y);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mx, my]);

  const theme = useMemo(() => getAmbientTheme(), []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Orb 1 — primary, top-left */}
      <motion.div
        style={{
          x: orb1X,
          y: orb1Y,
          background: `radial-gradient(circle, ${theme.primary} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-[10%] -top-[15%] h-[42rem] w-[42rem] rounded-full blur-[120px]"
      />

      {/* Orb 2 — secondary, bottom-right */}
      <motion.div
        style={{
          x: orb2X,
          y: orb2Y,
          background: `radial-gradient(circle, ${theme.secondary} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1.1, 0.95, 1.1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-[20%] -right-[10%] h-[46rem] w-[46rem] rounded-full blur-[140px]"
      />

      {/* Orb 3 — tertiary, center-right */}
      <motion.div
        style={{
          x: orb3X,
          y: orb3Y,
          background: `radial-gradient(circle, ${theme.tertiary} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [0.95, 1.1, 0.95],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute right-[15%] top-[10%] h-[32rem] w-[32rem] rounded-full blur-[100px]"
      />

      {/* Orb 4 — accent, bottom-left */}
      <motion.div
        style={{
          x: orb4X,
          y: orb4Y,
          background: `radial-gradient(circle, ${theme.primary} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        className="absolute -bottom-[10%] left-[5%] h-[36rem] w-[36rem] rounded-full blur-[130px]"
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. GRAIN OVERLAY — filmic texture
 * ══════════════════════════════════════════════════════════════════ */

function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4. LIQUID GLASS CARD — 3 qatlamli shisha
 * ══════════════════════════════════════════════════════════════════ */

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
  tint?: string;
}

function LiquidGlassCard({ children, className = '', tint = 'transparent' }: LiquidGlassCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 50, y: 50, active: false });
  const [hovered, setHovered] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      active: true,
    });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPos((p) => ({ ...p, active: false })); }}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: 0.15 }}
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: '2rem',
        WebkitBackdropFilter: 'blur(56px) saturate(220%)',
        backdropFilter: 'blur(56px) saturate(220%)',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.55) 100%)',
        boxShadow: hovered
          ? '0 40px 80px -20px rgba(0,0,0,0.18), 0 12px 28px -8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)'
          : '0 30px 60px -20px rgba(0,0,0,0.14), 0 8px 20px -6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      {/* Layer 1 — Chromatic fringe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          borderRadius: '2rem',
          background:
            'linear-gradient(120deg, rgba(255,0,80,0.05) 0%, transparent 15%, transparent 85%, rgba(0,120,255,0.05) 100%)',
        }}
      />

      {/* Layer 2 — Specular edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: '2rem',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.95),' +
            'inset 0 -1px 0 rgba(255,255,255,0.3),' +
            'inset 1px 0 0 rgba(255,255,255,0.5),' +
            'inset -1px 0 0 rgba(255,255,255,0.5),' +
            'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      />

      {/* Layer 3 — Tint wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-colors duration-700"
        style={{ borderRadius: '2rem', background: tint }}
      />

      {/* Layer 4 — Cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          borderRadius: '2rem',
          opacity: pos.active ? 1 : 0,
          background: `radial-gradient(600px circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.5), transparent 42%)`,
          mixBlendMode: 'overlay',
        }}
      />

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. BREATHING LOGO — conic aura
 * ══════════════════════════════════════════════════════════════════ */

function BreathingLogo({ theme }: { theme: AmbientTheme }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: 0.05 }}
      className="relative mx-auto flex h-20 w-20 items-center justify-center"
    >
      {/* Outer breathing rings (2 staggered) */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${theme.primary}40`,
        }}
        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
        aria-hidden
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${theme.primary}40`,
        }}
        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 1.5 }}
        aria-hidden
      />

      {/* Rotating conic gradient halo */}
      <motion.span
        className="absolute -inset-2 rounded-full opacity-40 blur-md"
        style={{
          background: `conic-gradient(from 0deg, ${theme.primary}, ${theme.secondary}, ${theme.tertiary}, ${theme.primary})`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />

      {/* Logo itself */}
      <div className="relative z-10">
        <MeduLogo size="xl" className="drop-shadow-sm" />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. KINETIC TITLE — staggered char reveal
 * ══════════════════════════════════════════════════════════════════ */

function KineticTitle({ text, delay = 0 }: { text: string; delay?: number }) {
  const chars = useMemo(() => text.split(''), [text]);

  return (
    <h1
      className="mt-5 text-center text-[26px] font-semibold leading-tight tracking-[-0.03em]"
      style={{ color: 'var(--text-primary)' }}
      aria-label={text}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-block">
        {chars.map((c, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.022,
              ease: EASE_OUT_EXPO,
            }}
            className="inline-block"
            style={{ whiteSpace: c === ' ' ? 'pre' : undefined }}
          >
            {c}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. TRUST BADGES — security signals
 * ══════════════════════════════════════════════════════════════════ */

function TrustBadges() {
  const badges = [
    { label: '256-bit SSL', icon: '🔒' },
    { label: 'Face ID', icon: '👤' },
    { label: 'GDPR', icon: '🛡️' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5, ease: EASE_OUT_EXPO }}
      className="mt-6 flex items-center justify-center gap-2"
    >
      {badges.map((b, i) => (
        <div key={b.label} className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold tracking-tight"
            style={{
              borderColor: 'rgba(0,0,0,0.06)',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="text-[11px]" aria-hidden>{b.icon}</span>
            {b.label}
          </span>
          {i < badges.length - 1 && (
            <span className="h-1 w-1 rounded-full bg-black/10" aria-hidden />
          )}
        </div>
      ))}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. AUTH LAYOUT — asosiy komponent
 * ══════════════════════════════════════════════════════════════════ */

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const theme = useMemo(() => getAmbientTheme(), []);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: 'var(--bg-page)' }}
    >
      {/* ── Layer 1: Aurora orbs (background) ── */}
      <AuroraOrbs />

      {/* ── Layer 2: Subtle radial vignette ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.04) 100%)',
        }}
      />

      {/* ── Layer 3: Film grain ── */}
      <GrainOverlay />

      {/* ── Foreground content ── */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo + title */}
        <div className="mb-7 text-center">
          <BreathingLogo theme={theme} />

          <KineticTitle text={title} delay={0.15} />

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: EASE_OUT_EXPO }}
              className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </motion.p>
          )}

          {/* Gradient divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.55, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="mx-auto mt-5 h-px w-24 origin-center"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.primary}40, transparent)`,
            }}
            aria-hidden
          />
        </div>

        {/* Glass card with form */}
        <LiquidGlassCard tint={theme.tint} className="p-8 sm:p-10">
          {children}
        </LiquidGlassCard>

        {/* Trust badges */}
        <TrustBadges />

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: EASE_OUT_EXPO }}
          className="mt-5 text-center text-[11px] font-medium tracking-tight"
          style={{ color: 'var(--text-muted)' }}
        >
          © {new Date().getFullYear()} M-EDU · Education Management Platform
          <br />
          <span className="opacity-70">Secure face-recognition attendance</span>
        </motion.p>
      </div>
    </div>
  );
}