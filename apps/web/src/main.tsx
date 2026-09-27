import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root not found');
}

if (!PUBLISHABLE_KEY) {
  root.innerHTML =
    '<p style="font-family: system-ui; padding: 2rem">Missing VITE_CLERK_PUBLISHABLE_KEY in apps/web/.env</p>';
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </React.StrictMode>,
  );
}
