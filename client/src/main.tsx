import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './styles.css';

const gsc = import.meta.env.VITE_GSC_TOKEN as string | undefined;
if (gsc) { const m = document.createElement('meta'); m.name = 'google-site-verification'; m.content = gsc; document.head.appendChild(m); }
createRoot(document.getElementById('root')!).render(<StrictMode><HelmetProvider><BrowserRouter><App /></BrowserRouter></HelmetProvider></StrictMode>);
