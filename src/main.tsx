import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PreviewApp } from './preview/PreviewApp';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('No #root element found in index.html.');

// Compile-time constant, so the harness and its fixtures vanish from a production build.
const previewing = import.meta.env.DEV && window.location.hash.startsWith('#/preview');

createRoot(container).render(<StrictMode>{previewing ? <PreviewApp /> : <App />}</StrictMode>);

registerServiceWorker();
