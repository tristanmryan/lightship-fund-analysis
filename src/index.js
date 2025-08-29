import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

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
