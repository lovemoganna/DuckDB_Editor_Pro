import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/jetbrains-mono/index.css';
import App from './App';
import './index.css';

// Polyfill process for browser runtime environments (react-draggable, react-grid-layout)
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
