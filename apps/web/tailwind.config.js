/**
 * M-EDU - Apple Premium Design System (iOS 27 & macOS Sequoia Liquid Glass)
 *
 * One restrained system:
 *  - Apple system colors (blue #007AFF, green #34C759, orange #FF9500, red #FF3B30)
 *  - Hairline borders, multi-stop ambient shadows, no candy/neon glows
 *  - SF Pro typography with tight optical tracking
 *  - Apple spring easing (cubic-bezier(0.32, 0.72, 0, 1))
 *  - Unified 3-Tier Liquid Glass optics (subtle, card, floating)
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
        brand: {
          50: '#EAF3FF',
          100: '#D6E8FF',
          200: '#ADCCFF',
          300: '#7FB3FF',
          400: '#4A9AFF',
          500: '#007AFF',
          600: '#0066D6',
          700: '#0052B3',
          800: '#003D80',
          900: '#002B5C',
          950: '#001C3D',
        },
        accent: {
          50: '#EFEEFF',
          100: '#E0DFFE',
          200: '#C3C0FD',
          500: '#5856D6',
          600: '#4744C4',
          700: '#3633A8',
        },
        apple: {
          blue: '#007AFF',
          green: '#34C759',
          indigo: '#5856D6',
          orange: '#FF9500',
          pink: '#FF2D55',
          purple: '#AF52DE',
          red: '#FF3B30',
          teal: '#5AC8FA',
          yellow: '#FFCC00',
          gray: '#8E8E93',
        },
        surface: {
          50: '#FFFFFF',
          100: '#F5F5F7',
          200: '#E8E8ED',
          300: '#D2D2D7',
          400: '#C7C7CC',
          500: '#8E8E93',
          600: '#636366',
          700: '#48484A',
          800: '#2C2C2E',
          900: '#1C1C1E',
          950: '#000000',
        },
        glass: {
          light: 'rgba(255,255,255,0.78)',
          lighter: 'rgba(255,255,255,0.88)',
          dark: 'rgba(22,27,38,0.74)',
          subtle: 'rgba(255,255,255,0.70)',
          card: 'rgba(255,255,255,0.80)',
          floating: 'rgba(255,255,255,0.88)',
        },
      },
      fontFamily: {
        sans: ['-apple-system','BlinkMacSystemFont','"SF Pro Display"','"SF Pro Text"','"SF Pro"','system-ui','Inter','sans-serif'],
        display: ['-apple-system','BlinkMacSystemFont','"SF Pro Display"','"SF Pro"','system-ui','Inter','sans-serif'],
        mono: ['"SF Mono"','ui-monospace','"JetBrains Mono"','Menlo','Monaco','Consolas','monospace'],
        serif: ['"New York"','ui-serif','Georgia','Cambria','serif'],
      },
      borderRadius: {
        '3xl': '20px',
        '4xl': '24px',
        '5xl': '28px',
      },
      boxShadow: {
        'xs': '0 1px 1px rgba(0,0,0,0.04)',
        '2xs': '0 0.5px 1px rgba(0,0,0,0.05)',
        'subtle': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'raised': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'dropdown': '0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        'modal': '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        'float': '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)',
        'royal': '0 4px 14px rgba(0,122,255,0.24)',
        'glass': '0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'glass-lg': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'glass-subtle': 'inset 0 1px 0 0 rgba(255,255,255,0.8), 0 2px 8px -2px rgba(0,0,0,0.04)',
        'glass-card': 'inset 0 1px 0 0 rgba(255,255,255,0.85), inset 1px 0 0 0 rgba(255,255,255,0.35), 0 8px 24px -4px rgba(0,0,0,0.05)',
        'glass-floating': 'inset 0 1px 0 0 rgba(255,255,255,0.9), 0 24px 64px -8px rgba(0,0,0,0.10)',
        'apple-card': '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.06)',
        'apple-float': '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
        'glow-cyan': '0 0 20px rgba(90,200,250,0.16)',
        'glow-vivid': '0 2px 12px rgba(0,122,255,0.18)',
      },
      backdropBlur: {
        'glass-xs': '8px',
        'glass-sm': '12px',
        'glass': '20px',
        'glass-lg': '28px',
        'glass-xl': '36px',
        'glass-2xl': '48px',
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'apple-glide': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'apple-snappy': 'cubic-bezier(0.2, 0.9, 0.2, 1)',
        'apple-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'overlay-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'modal-in': { '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'apple-spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'pulse-glow': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,122,255,0.18)' }, '50%': { boxShadow: '0 0 0 6px rgba(0,122,255,0)' } },
        'orb-drift': { '0%, 100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(3%,5%) scale(1.04)' }, '66%': { transform: 'translate(-2%,-3%) scale(0.97)' } },
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
