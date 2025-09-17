import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

// Sanitize console output to strip unknown replacement chars in dev
(() => {
  try {
    const orig = { ...console };
    const sanitize = (v) => (typeof v === 'string' ? v.replace(/\uFFFD/g, '') : v);
    ['log', 'info', 'warn', 'error'].forEach((k) => {
      const fn = orig[k] || (() => {});
      console[k] = (...args) => fn(...args.map(sanitize));
    });
  } catch {}
})();

// Visual refresh feature flag
const envOn = process.env.REACT_APP_ENABLE_VISUAL_REFRESH === 'true';
const storedOn = localStorage.getItem('visualRefresh') === 'on';

const toggleVisualRefresh = (on) => {
  if (on) {
    document.documentElement.classList.add('visual-refresh');
    
    // Inject Inter font if not already present
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  } else {
    document.documentElement.classList.remove('visual-refresh');
    
    // Remove Inter font link
    const link = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]');
    if (link) {
      link.remove();
    }
  }
  
  localStorage.setItem('visualRefresh', on ? 'on' : 'off');
};

// Initialize visual refresh state
toggleVisualRefresh(envOn || storedOn);

// Ensure modal close buttons have accessible labels when they appear
(() => {
  try {
    const setLabel = (btn) => {
      if (btn && !btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Close dialog');
      }
    };
    // Initial sweep
    document.querySelectorAll('.btn-close').forEach(setLabel);
    // Observe for dynamically added modals
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches && n.matches('.btn-close')) setLabel(n);
          n.querySelectorAll && n.querySelectorAll('.btn-close').forEach(setLabel);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch {}
})();

// Global keyboard shortcut for runtime toggle
window.addEventListener('keydown', (e) => {
  // Ctrl+Alt+V (or Cmd+Alt+V on macOS)
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.altKey && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    const on = !document.documentElement.classList.contains('visual-refresh');
    toggleVisualRefresh(on);
    console.info(`Visual refresh ${on ? 'ON' : 'OFF'} (persisted)`);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
