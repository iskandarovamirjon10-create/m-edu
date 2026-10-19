/**
 * ============================================================================
 * M-EDU Dynamic Wallpaper & Shader Substrate — macOS Sequoia Edition
 * ============================================================================
 *
 * Provides Apple macOS Sequoia-grade dynamic ambient light substrates:
 *  - 4 Curated Palettes with full Light & Dark mode support:
 *     1. Sequoia Dawn (Warm amber, rose, deep obsidian indigo)
 *     2. Sonoma Sky (Pacific azure, clean turquoise, vapor blue)
 *     3. Ventura Gold (Warm California golden hour radiance)
 *     4. Obsidian Studio (Pure deep OLED graphite with subtle specular mesh)
 *  - Synchronized with active theme (`isDark` from `useTheme`)
 *  - Mouse parallax motion & gentle ambient pulsation
 *  - Persistent across reloads (localStorage: 'm-edu.wallpaper-theme')
 *  - Full GPU acceleration via CSS radial mesh & transform3d
 * ============================================================================
 */

import { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';

export type WallpaperTheme = 'sequoia' | 'sonoma' | 'ventura' | 'obsidian';

interface WallpaperPalette {
  name: string;
  light: {
    bg: string;
    blob1: string;
    blob2: string;
    blob3: string;
  };
  dark: {
    bg: string;
    blob1: string;
    blob2: string;
    blob3: string;
  };
}

const THEMES: Record<WallpaperTheme, WallpaperPalette> = {
  sequoia: {
    name: 'macOS Sequoia Dawn',
    light: {
      bg: 'from-amber-100/30 via-orange-50/20 to-sky-100/20',
      blob1: 'radial-gradient(circle, rgba(245, 158, 11, 0.09) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(225, 29, 72, 0.07) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(99, 102, 241, 0.07) 0%, transparent 70%)',
    },
    dark: {
      bg: 'from-amber-950/25 via-slate-900/50 to-slate-950/80',
      blob1: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(225, 29, 72, 0.16) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
    },
  },
  sonoma: {
    name: 'macOS Sonoma Sky',
    light: {
      bg: 'from-sky-100/30 via-blue-50/20 to-indigo-50/25',
      blob1: 'radial-gradient(circle, rgba(14, 165, 233, 0.09) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
    },
    dark: {
      bg: 'from-sky-950/25 via-blue-900/40 to-slate-950/80',
      blob1: 'radial-gradient(circle, rgba(14, 165, 233, 0.20) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, transparent 70%)',
    },
  },
  ventura: {
    name: 'macOS Ventura Gold',
    light: {
      bg: 'from-orange-100/30 via-amber-50/20 to-yellow-50/20',
      blob1: 'radial-gradient(circle, rgba(251, 146, 60, 0.09) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(234, 88, 12, 0.07) 0%, transparent 70%)',
    },
    dark: {
      bg: 'from-orange-950/25 via-amber-950/40 to-slate-950/80',
      blob1: 'radial-gradient(circle, rgba(251, 146, 60, 0.19) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(245, 158, 11, 0.17) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(234, 88, 12, 0.15) 0%, transparent 70%)',
    },
  },
  obsidian: {
    name: 'Obsidian Studio OLED',
    light: {
      bg: 'from-slate-100/40 via-zinc-50/30 to-white/60',
      blob1: 'radial-gradient(circle, rgba(0, 0, 0, 0.03) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(168, 85, 247, 0.04) 0%, transparent 70%)',
    },
    dark: {
      bg: 'from-zinc-950/60 via-black to-black',
      blob1: 'radial-gradient(circle, rgba(255, 255, 255, 0.04) 0%, transparent 70%)',
      blob2: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
      blob3: 'radial-gradient(circle, rgba(168, 85, 247, 0.06) 0%, transparent 70%)',
    },
  },
};

export function setWallpaperTheme(theme: WallpaperTheme): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('m-edu.wallpaper-theme', theme);
    window.dispatchEvent(new CustomEvent('m-edu-wallpaper-changed', { detail: theme }));
  }
}

export const DynamicWallpaper = memo(function DynamicWallpaper() {
  const { isDark } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<WallpaperTheme>(() => {
    if (typeof window === 'undefined') return 'sequoia';
    return (localStorage.getItem('m-edu.wallpaper-theme') as WallpaperTheme) || 'sequoia';
  });

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const theme = (e as CustomEvent<WallpaperTheme>).detail;
      if (theme && THEMES[theme]) {
        setCurrentTheme(theme);
      }
    };

    window.addEventListener('m-edu-wallpaper-changed', handleThemeChange);
    return () => window.removeEventListener('m-edu-wallpaper-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    let frameId: number;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 40;
        const y = (e.clientY / window.innerHeight - 0.5) * 40;
        setMousePos({ x, y });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, []);

  const activeThemeGroup = THEMES[currentTheme] || THEMES.sequoia;
  const active = isDark ? activeThemeGroup.dark : activeThemeGroup.light;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Background ambient gradient */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${active.bg} opacity-40 transition-colors duration-1000`} />

      {/* Floating Ambient Light Mesh Blobs with Parallax */}
      <motion.div
        animate={{
          x: mousePos.x * 0.8,
          y: mousePos.y * 0.8,
        }}
        transition={{ type: 'spring', stiffness: 40, damping: 20 }}
        style={{
          background: active.blob1,
        }}
        className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full blur-[100px] transition-all duration-1000"
      />

      <motion.div
        animate={{
          x: -mousePos.x * 0.6,
          y: -mousePos.y * 0.6,
        }}
        transition={{ type: 'spring', stiffness: 40, damping: 20 }}
        style={{
          background: active.blob2,
        }}
        className="absolute top-1/4 -right-24 h-[650px] w-[650px] rounded-full blur-[120px] transition-all duration-1000"
      />

      <motion.div
        animate={{
          x: mousePos.x * 0.4,
          y: mousePos.y * 0.4,
        }}
        transition={{ type: 'spring', stiffness: 40, damping: 20 }}
        style={{
          background: active.blob3,
        }}
        className="absolute -bottom-36 left-1/3 h-[600px] w-[600px] rounded-full blur-[110px] transition-all duration-1000"
      />
    </div>
  );
});
