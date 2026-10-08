import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

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
      // Do not surface SW internals in the production browser console.
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

// Add global error handlers for better error tracking
if (import.meta.env.PROD) {
  window.addEventListener('error', (event) => {
    // Production telemetry should go through a real error-reporting service
    // (Sentry/LogRocket/DataDog). Logging to the end-user console leaks
    // internals and PII — see product-readiness audit F-WEB-1.
    void event;
  });

  window.addEventListener('unhandledrejection', (event) => {
    void event;
  });
}

// Add performance marks
if (import.meta.env.DEV) {
  performance.mark('app-start');
}
