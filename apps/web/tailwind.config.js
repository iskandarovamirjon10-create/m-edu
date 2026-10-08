/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // App-shell layout tiers: phone < 768 (md), tablet 768–1279, desktop >= 1280 (xl).
      // `xs` (480px) targets large phones where a two-column card grid fits.
      screens: {
        xs: '480px',
      },
      colors: {
        brand: {
          50: '#EAFBFF',
          100: '#D2F4F8',
          200: '#A4E9F1',
          300: '#94EAEF', // Cyan — primary hero
          400: '#8CDCF1', // Sky
          500: '#7EC2F3', // Azure
          600: '#618CF9', // Indigo
          700: '#5474FC', // Vivid — primary actions
          800: '#4C65FD', // Deep
          900: '#3950E0',
        },
        glass: {
          light:    'rgba(255,255,255,0.55)',
          lighter:  'rgba(255,255,255,0.78)',
          dark:     'rgba(20,30,45,0.45)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '32px',
        '5xl': '40px',
      },
      boxShadow: {
        'glass':       '0 12px 32px rgba(20,30,45,0.08)',
        'glass-lg':    '0 24px 56px rgba(20,30,45,0.10)',
        'glow-cyan':   '0 0 40px rgba(148,234,239,0.30)',
        'glow-vivid':  '0 8px 24px rgba(84,115,252,0.30)',
      },
      backdropBlur: {
        'glass': '24px',
        'glass-lg': '32px',
      },
      keyframes: {
        'fade-in':     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up':    { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':    { '0%': { opacity: '0', transform: 'scale(0.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'pulse-glow':  { '0%, 100%': { boxShadow: '0 0 0 0 rgba(148,234,239,0.3)' }, '50%': { boxShadow: '0 0 0 8px rgba(148,234,239,0)' } },
        'orb-drift':   { '0%, 100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(4%,6%) scale(1.06)' }, '66%': { transform: 'translate(-3%,-4%) scale(0.96)' } },
      },
      animation: {
        'fade-in':     'fade-in 0.3s ease forwards',
        'slide-up':    'slide-up 0.35s cubic-bezier(.25,.46,.45,.94) forwards',
        'scale-in':    'scale-in 0.25s cubic-bezier(.25,.46,.45,.94) forwards',
        'pulse-glow':  'pulse-glow 2s ease-in-out infinite',
        'orb-drift':   'orb-drift 40s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
