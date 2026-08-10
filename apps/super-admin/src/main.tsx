import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@booking/design-tokens/globals.css';
import { App } from './App';
import './styles/super-admin-shell.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
