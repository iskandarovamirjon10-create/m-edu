/**
 * M-EDU - Apple Premium Design System (iOS 27 & macOS Sequoia Liquid Glass)
 * V4.0 — Calculated Token Bridge
 *
 * This configuration bridges Tailwind CSS directly to the mathematical
 * OKLCH tokens in design-tokens.css (V4) and globals.css (V4).
 *
 * Core Principles:
 *   1. Zero Hardcoded Color Drift: colors, shadows, blurs, and radii reference
 *      CSS variables. Changing a theme (light, dark, oled, sepia) or toggling
 *      --solid immediately propagates across all Tailwind utility classes.
 *   2. Backward Compatibility: preserves legacy steps (brand, surface-50..950,
 *      spacing, keyframes) so zero existing pages or components break.
 *   3. 120 Hz Motion: spring timing functions utilize physically calculated
 *      settle curves from V4 design tokens.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      colors: {
        // ── Canvas & Surfaces (100% Synced with V4 tokens) ───────────────
        page: 'var(--bg-page)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          sunken: 'var(--bg-sunken)',
          input: 'var(--bg-input)',
          card: 'var(--bg-card)',
          // Numeric steps mapped dynamically for backward compatibility
          50: 'var(--bg-surface)',
          100: 'color-mix(in srgb, var(--bg-surface) 96%, var(--text-primary))',
          200: 'color-mix(in srgb, var(--bg-surface) 90%, var(--text-primary))',
          300: 'color-mix(in srgb, var(--bg-surface) 82%, var(--text-primary))',
          400: 'color-mix(in srgb, var(--bg-surface) 74%, var(--text-primary))',
          500: 'var(--text-muted)',
          600: 'var(--text-tertiary)',
          700: 'var(--text-secondary)',
          800: 'var(--bg-elevated)',
          900: 'var(--bg-surface)',
          950: 'var(--bg-page)',
          // Direct tier steps
          1: 'var(--bg-page)',
          2: 'var(--bg-surface)',
          3: 'var(--bg-elevated)',
        },

        // ── Typography Semantic Tokens ────────────────────────────────────
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
          placeholder: 'var(--text-placeholder)',
          inverse: 'var(--text-inverse)',
        },

        // ── Hairline & Structural Borders ─────────────────────────────────
        border: {
          DEFAULT: 'var(--border-medium)',
          subtle: 'var(--border-subtle)',
          medium: 'var(--border-medium)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          glass: 'var(--glass-border)',
        },

        // ── Apple Core Spectrum (OKLCH Tokens) ────────────────────────────
        apple: {
          blue: 'var(--c-blue)',
          green: 'var(--c-green)',
          indigo: 'var(--c-indigo)',
          orange: 'var(--c-orange)',
          pink: 'var(--c-red)',
          purple: 'var(--c-purple)',
          red: 'var(--c-red)',
          teal: 'var(--c-teal)',
          yellow: 'var(--c-orange)',
          gray: 'rgb(var(--line-rgb))',
        },

        // ── Brand Spectrum (Rooted in Apple Blue / Primary) ───────────────
        brand: {
          50: 'color-mix(in srgb, var(--c-blue) 8%, var(--bg-page))',
          100: 'color-mix(in srgb, var(--c-blue) 16%, var(--bg-page))',
          200: 'color-mix(in srgb, var(--c-blue) 32%, var(--bg-page))',
          300: 'color-mix(in srgb, var(--c-blue) 52%, var(--bg-page))',
          400: 'color-mix(in srgb, var(--c-blue) 76%, var(--bg-page))',
          500: 'var(--primary)',
          600: 'var(--primary-hover)',
          700: 'var(--primary-active)',
          800: 'color-mix(in srgb, var(--primary) 75%, black)',
          900: 'color-mix(in srgb, var(--primary) 50%, black)',
          950: 'color-mix(in srgb, var(--primary) 30%, black)',
        },

        // ── Accent Spectrum (Rooted in Indigo / Purple) ───────────────────
        accent: {
          50: 'color-mix(in srgb, var(--c-indigo) 8%, var(--bg-page))',
          100: 'color-mix(in srgb, var(--c-indigo) 16%, var(--bg-page))',
          200: 'color-mix(in srgb, var(--c-indigo) 32%, var(--bg-page))',
          500: 'var(--c-indigo)',
          600: 'var(--c-indigo-hover)',
          700: 'color-mix(in srgb, var(--c-indigo) 75%, black)',
        },

        // ── Liquid Glass Optical Tiers ───────────────────────────────────
        glass: {
          light: 'var(--mat-bg-2)',
          lighter: 'var(--mat-bg-1)',
          dark: 'var(--mat-bg-4)',
          subtle: 'var(--mat-bg-2)',
          card: 'var(--mat-bg-3)',
          floating: 'var(--mat-bg-4)',
        },
      },

      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
        placeholder: 'var(--text-placeholder)',
        inverse: 'var(--text-inverse)',
      },

      backgroundColor: {
        page: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        sunken: 'var(--bg-sunken)',
        card: 'var(--bg-card)',
      },

      borderColor: {
        DEFAULT: 'var(--border-medium)',
        subtle: 'var(--border-subtle)',
        medium: 'var(--border-medium)',
        strong: 'var(--border-strong)',
        focus: 'var(--border-focus)',
        glass: 'var(--glass-border)',
      },

      fontFamily: {
        sans: ['var(--font-body)', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"SF Pro"', 'system-ui', 'Inter', 'sans-serif'],
        display: ['var(--font-heading)', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro"', 'system-ui', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', '"SF Mono"', 'ui-monospace', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        serif: ['"New York"', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },

      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        '4xl': 'calc(var(--radius-3xl) * 1.25)',
        '5xl': 'calc(var(--radius-3xl) * 1.5)',
        'pill': 'var(--radius-pill)',
      },

      boxShadow: {
        'xs': 'var(--shadow-1)',
        '2xs': 'var(--shadow-1)',
        'subtle': 'var(--shadow-1)',
        'card': 'var(--shadow-2)',
        'card-hover': 'var(--shadow-3)',
        'raised': 'var(--shadow-3)',
        'dropdown': 'var(--shadow-4)',
        'modal': 'var(--shadow-5)',
        'float': 'var(--shadow-6)',
        'royal': '0 4px 14px color-mix(in srgb, var(--c-blue) 24%, transparent)',
        'glass': 'var(--shadow-2)',
        'glass-lg': 'var(--shadow-4)',
        'glass-subtle': 'var(--inset-top-light), var(--shadow-2)',
        'glass-card': 'var(--inset-top-strong), var(--shadow-3)',
        'glass-floating': 'var(--inset-top-strong), var(--shadow-6)',
        'apple-card': 'var(--inset-top-light), var(--shadow-2)',
        'apple-float': 'var(--inset-top-strong), var(--shadow-5)',
        'glow-cyan': '0 0 20px color-mix(in srgb, var(--c-teal) 22%, transparent)',
        'glow-vivid': '0 2px 14px color-mix(in srgb, var(--c-blue) 28%, transparent)',
      },

      backdropBlur: {
        'glass-xs': 'var(--blur-1)',
        'glass-sm': 'var(--blur-1)',
        'glass': 'var(--blur-2)',
        'glass-lg': 'var(--blur-3)',
        'glass-xl': 'var(--blur-4)',
        'glass-2xl': 'var(--blur-5)',
      },

      transitionTimingFunction: {
        'apple-spring': 'var(--spring-snappy)',
        'apple-bounce': 'var(--spring-bouncy)',
        'apple-glide': 'var(--ease-glide)',
        'apple-snappy': 'var(--ease-apple-snappy)',
        'apple-out': 'var(--ease-standard)',
      },

      transitionDuration: {
        'instant': 'var(--dur-instant)',
        'fast': 'var(--dur-fast)',
        'normal': 'var(--dur-normal)',
        'slow': 'var(--dur-slow)',
      },

      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translate3d(0, 8px, 0)' }, '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'overlay-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'modal-in': { '0%': { opacity: '0', transform: 'scale(0.96) translate3d(0, 8px, 0)' }, '100%': { opacity: '1', transform: 'scale(1) translate3d(0, 0, 0)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'apple-spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'pulse-glow': { '0%, 100%': { boxShadow: '0 0 0 0 color-mix(in srgb, var(--c-blue) 18%, transparent)' }, '50%': { boxShadow: '0 0 0 6px color-mix(in srgb, var(--c-blue) 0%, transparent)' } },
        'orb-drift': { '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' }, '33%': { transform: 'translate3d(3%, 5%, 0) scale(1.04)' }, '66%': { transform: 'translate3d(-2%, -3%, 0) scale(0.97)' } },
        'bell-shake': { '0%, 100%': { transform: 'rotate(0deg)' }, '20%': { transform: 'rotate(8deg)' }, '40%': { transform: 'rotate(-6deg)' }, '60%': { transform: 'rotate(4deg)' }, '80%': { transform: 'rotate(-2deg)' } },
      },

      animation: {
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'overlay-in': 'overlay-in 0.18s ease-out forwards',
        'modal-in': 'modal-in 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'shimmer': 'shimmer 1.6s linear infinite',
        'apple-spin': 'apple-spin 0.9s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'orb-drift': 'orb-drift 40s ease-in-out infinite',
        'bell-shake': 'bell-shake 0.7s ease-in-out',
      },

      spacing: {
        '4.5': '1.125rem',
        '9.5': '2.375rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },

      scale: {
        '97': '0.97',
      },
    },
  },
  plugins: [],
};
