import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initErrorReporting, reportClientError } from './lib/errorReporter';
import { getStoredLocale, loadLocale } from './i18n';

// 1. Telemetriyani har qanday boshqa amaldan oldin birinchi navbatda ishga tushiramiz
if (import.meta.env.PROD) {
  try {
    initErrorReporting();
  } catch (err) {
    console.error('Failed to bootstrap error telemetry:', err);
  }
}

// Ishga tushish unumdorligini belgilash
if (import.meta.env.DEV) {
  performance.mark('app-init-start');
}

// 2. Mobil qurilmalar (iOS Safari / Android) uchun Responsive Viewport balandligini hisoblash (dastlabki paint uchun)
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

// 3. Root elementni qidirish va Favqulodda Responsive Fallback (White Screen of Death oldini olish)
const rootElement = document.getElementById('root');

if (!rootElement) {
  const errorMessage = 'Tizimning asosiy konteyneri (#root) topilmadi.';
  reportClientError(new Error(errorMessage), 'window');

  // Foydalanuvchiga bo'sh oq ekran emas, chiroyli responsive xatolik oynasini ko'rsatamiz
  const emergencyContainer = document.createElement('div');
  emergencyContainer.setAttribute('role', 'alert');
  emergencyContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f172a;
    color: #f8fafc;
    text-align: center;
  `;
  emergencyContainer.innerHTML = `
    <div style="max-width: 440px; width: 100%; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; backdrop-filter: blur(20px);">
      <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">Yuklashda xatolik yuz berdi</h1>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 24px 0;">
        Ilova elementlarini yuklab bo'lmadi. Iltimos, sahifani qayta yuklang yoki internet aloqasini tekshiring.
      </p>
      <button onclick="window.location.reload()" style="
        width: 100%;
        padding: 12px 20px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      " onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
        Qayta yuklash
      </button>
    </div>
  `;
  document.body.appendChild(emergencyContainer);
  throw new Error(errorMessage);
}

// 4. React Root yaratish va dasturni ishga tushirish
const root = ReactDOM.createRoot(rootElement);

/** Fade out the static boot shell once React has painted its first frame. */
function dismissBootSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 320);
}

/**
 * The English dictionary is bundled; uz/ru are fetched on demand. Resolve the
 * persisted locale before the first paint so the shell never flashes English
 * for an Uzbek/Russian user.
 */
async function bootstrap(): Promise<void> {
  await loadLocale(getStoredLocale());
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  // Two frames: React 18 commits on a scheduled tick, so hide after paint.
  requestAnimationFrame(() => requestAnimationFrame(dismissBootSplash));
}

void bootstrap();

if (import.meta.env.DEV) {
  performance.mark('app-init-rendered');
  performance.measure('app-bootstrap-time', 'app-init-start', 'app-init-rendered');
}

// 5. PWA Service Worker (Avtomatik yangilanishni aniqlash bilan)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Yangi versiya chiqqanda aniqlash
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // Yangi yangilanish mavjudligi haqida hodisa tarqatamiz
                window.dispatchEvent(new CustomEvent('medu:pwa-update-available'));
              }
            });
          }
        });
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error('ServiceWorker registration failed:', error);
        }
        reportClientError(error, 'sw');
      });
  });
}

// 6. Core Web Vitals (Eng so'nggi INP metrikasi bilan)
if (import.meta.env.DEV) {
  import('web-vitals')
    .then((wv: any) => {
      const logMetric = (metric: { name: string; value: number; id: string }) => {
        console.debug(`[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms`);
      };

      if (typeof wv.onCLS === 'function') wv.onCLS(logMetric);
      if (typeof wv.onFCP === 'function') wv.onFCP(logMetric);
      if (typeof wv.onLCP === 'function') wv.onLCP(logMetric);
      if (typeof wv.onTTFB === 'function') wv.onTTFB(logMetric);
      if (typeof wv.onINP === 'function') wv.onINP(logMetric);
    })
    .catch(() => {
      // Dev rejimda web-vitals mavjud bo'lmasa xalaqit qilmaydi
    });
}
