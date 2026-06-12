import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, loadTheme } from './theme';
import './styles.css';

// Applied before render to avoid a flash of the wrong theme; CSP forbids an
// inline bootstrap script, so this runs as early as possible in the bundle.
applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
