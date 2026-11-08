import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initErrorReporting, reportClientError } from './lib/errorReporter';
import { getStoredLocale, loadLocale } from './i18n';

// ── 1. Telemetriya va diagnostikani yuklash ─────────────────────────────────
if (import.meta.env.PROD) {
  try {
    initErrorReporting();
  } catch (err) {
    console.error('Failed to bootstrap error telemetry:', err);
  }
}

if (import.meta.env.DEV) {
  performance.mark('app-init-start');
}

// ── 2. Mobil Viewport va Dynamic Address Bar balandligini kalibrlash ────────
function setupResponsiveViewport(): void {
  if (typeof window === 'undefined') return;
  const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
  const vw = (window.visualViewport?.width ?? window.innerWidth) * 0.01;
  const vvHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  document.documentElement.style.setProperty('--app-vw', `${vw}px`);
  document.documentElement.style.setProperty('--visual-viewport-height', `${vvHeight}px`);
}
setupResponsiveViewport();

// ── 3. Favqulodda Liquid Glass Fallback (XSS va CSP xavfsiz) ─────────────────
function renderEmergencyFatalFallback(message: string): void {
  if (import.meta.env.DEV) {
    console.error('[Fatal Bootstrap]', message);
  }
  const container = document.createElement('div');
  container.setAttribute('role', 'alert');
  container.className =
    'fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 text-center select-none bg-[#090D16] text-[#F8FAFC]';

  const card = document.createElement('div');
  card.className =
    'relative isolate max-w-md w-full rounded-[2.25rem] border border-white/20 bg-white/[0.05] p-8 backdrop-blur-3xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.2)]';

  const iconTile = document.createElement('div');
  iconTile.className =
    'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-2xl shadow-[0_0_24px_rgba(244,63,94,0.3)]';
  iconTile.textContent = '⚠️';

  const heading = document.createElement('h1');
  heading.className = 'text-lg font-extrabold tracking-tight text-white mb-2';
  heading.textContent = 'Yuklashda xatolik yuz berdi';

  const desc = document.createElement('p');
  desc.className = 'text-xs leading-relaxed text-slate-400 mb-6';
  desc.textContent =
    'Ilova muhitini ishga tushirib bo‘lmadi. Internet aloqasini tekshiring yoki sahifani qayta yuklang.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] text-white font-bold text-xs tracking-tight shadow-[0_12px_24px_-6px_rgba(0,122,255,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform active:scale-95';
  btn.textContent = 'Qayta yuklash';
  btn.addEventListener('click', () => {
    window.location.reload();
  });

  card.append(iconTile, heading, desc, btn);
  container.appendChild(card);
  document.body.appendChild(container);
}

// ── 4. React Root va Bootstrap jarayoni ─────────────────────────────────────
const rootElement = document.getElementById('root');

if (!rootElement) {
  const errMsg = 'Tizimning asosiy konteyneri (#root) DOM da topilmadi.';
  reportClientError(new Error(errMsg), 'window');
  renderEmergencyFatalFallback(errMsg);
  throw new Error(errMsg);
}

const root = ReactDOM.createRoot(rootElement);

function dismissBootSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 320);
}

async function bootstrap(): Promise<void> {
  // Tarmoq uzilgan bo'lsa ham dastur to'xtab qolmasligi uchun try/catch bilan o'ralgan
  try {
    await loadLocale(getStoredLocale());
  } catch (err) {
    console.warn('[i18n] Failed to fetch locale bundle, falling back to embedded defaults:', err);
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(dismissBootSplash);
    if (import.meta.env.DEV) {
      performance.mark('app-init-rendered');
      performance.measure('app-bootstrap-time', 'app-init-start', 'app-init-rendered');
    }
  });
}

void bootstrap();

// ── 5. PWA Service Worker (UpdateFound + Waiting holatlarini to'liq ushlash) ──
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Agar yangi versiya allaqachon yuklanib kutayotgan bo'lsa
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('medu:pwa-update-available'));
          return;
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(new CustomEvent('medu:pwa-update-available'));
            }
          });
        });
      })
      .catch((error) => {
        reportClientError(error, 'sw');
      });
  });
}

// ── 6. Core Web Vitals (INP va zamonaviy metrikalar) ────────────────────────
if (import.meta.env.DEV) {
  import('web-vitals')
    .then((wv: Record<string, unknown>) => {
      const logMetric = (metric: { name: string; value: number }) => {
        console.debug(`[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms`);
      };

      if (typeof wv.onCLS === 'function') (wv.onCLS as (cb: typeof logMetric) => void)(logMetric);
      if (typeof wv.onFCP === 'function') (wv.onFCP as (cb: typeof logMetric) => void)(logMetric);
      if (typeof wv.onLCP === 'function') (wv.onLCP as (cb: typeof logMetric) => void)(logMetric);
      if (typeof wv.onTTFB === 'function') (wv.onTTFB as (cb: typeof logMetric) => void)(logMetric);
      if (typeof wv.onINP === 'function') (wv.onINP as (cb: typeof logMetric) => void)(logMetric);
    })
    .catch(() => {});
}