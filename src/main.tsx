import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { BrowserStorageService } from './storageService';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('ExpoSketch root element is missing');

const hardRestart = () => {
  void new BrowserStorageService()
    .clear()
    .catch(() => undefined)
    .finally(() => window.location.reload());
};

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary onRestart={hardRestart}>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
