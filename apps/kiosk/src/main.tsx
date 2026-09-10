import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@psp/ui/styles.css';
import './styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  root.className = 'psp-kiosk';
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
