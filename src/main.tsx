import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { clearServiceWorkerAndCaches, triggerChunkRecoveryReload } from './utils/chunkRecovery.ts';
import './index.css';

declare global {
  interface Window {
    __APP_MOUNTED__?: boolean;
    __CLEAR_BOOT_TIMER__?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.__CLEAR_BOOT_TIMER__?.();
  window.__APP_MOUNTED__ = true;

  // Recover automatically if a client holds an outdated HTML shell referencing a retired chunk hash
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerChunkRecoveryReload();
  });

  if (import.meta.env.DEV) {
    void clearServiceWorkerAndCaches();
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
