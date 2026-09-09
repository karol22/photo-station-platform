import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@psp/ui/styles.css';
import { App } from './App';
import './store/session';

const container = document.getElementById('root');
if (!container) throw new Error('main.tsx: #root not found');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
