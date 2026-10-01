/**
 * Application Entry Point
 * Registers service worker and initializes the Web Components app.
 */

import './components/sso-app.js';

// Register Service Worker for PWA
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('SSO Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('SSO Service Worker registration failed:', err);
      });
  });
}
