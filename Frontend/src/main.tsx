import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ACCESS_TOKEN_KEY, USE_MOCK } from '@/lib/api';

/**
 * In mock mode there is no backend to authenticate against, so a placeholder
 * token is seeded to keep the protected routes reachable. Guarded on USE_MOCK
 * — previously this ran unconditionally, which meant a real backend received
 * a bogus "mock-token" Authorization header on every request.
 */
if (USE_MOCK && !localStorage.getItem(ACCESS_TOKEN_KEY)) {
  localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-token');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
