import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initErrorReporting, reportClientError } from './lib/errorReporter';

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure there is a <div id="root"></div> in your index.html.',
  );
}

// Create root with error boundary for better error handling
const root = ReactDOM.createRoot(rootElement);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Enable hot module replacement in development
if (import.meta.env.DEV) {
  import.meta.hot?.accept();
}

// Register service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      if (import.meta.env.DEV) {
        console.error('ServiceWorker registration failed:', error);
      }
      // Never dump SW internals to the production console — report instead
      // (no-op unless VITE_ERROR_REPORTING_URL is configured).
      reportClientError(error, 'sw');
    });
  });
}

// Log performance metrics in development
if (import.meta.env.DEV) {
  // Report web vitals
  const reportWebVitals = async (metric: {
    name: string;
    value: number;
    id: string;
  }) => {
    console.debug(`[Web Vitals] ${metric.name}: ${metric.value}`);
  };

  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB }) => {
    onCLS(reportWebVitals);
    onFCP(reportWebVitals);
    onLCP(reportWebVitals);
    onTTFB(reportWebVitals);
  });
}

// Production error telemetry: window + unhandledrejection listeners.
// Disabled in development and whenever VITE_ERROR_REPORTING_URL is unset,
// so local builds are never noisy and prod reports reach the API sink
// (POST /api/client-errors) as structured log lines.
if (import.meta.env.PROD) {
  initErrorReporting();
}

// Add performance marks
if (import.meta.env.DEV) {
  performance.mark('app-start');
}
