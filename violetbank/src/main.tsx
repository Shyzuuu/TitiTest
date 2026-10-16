import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément racine introuvable');

createRoot(root).render(
  <StrictMode>
    {import.meta.env.VITE_ROUTER === 'memory' ? (
      // Version hébergée en lien partagé : l'URL de la page ne peut pas porter les routes.
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    ) : (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
);
