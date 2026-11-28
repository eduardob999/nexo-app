import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PreviewApp } from './preview/PreviewApp';
import { captureInstallPrompt } from './install';
import { ensureBaseline } from './seen';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('No #root element found in index.html.');

// Compile-time constant, so the harness and its fixtures vanish from a production build.
const previewing = import.meta.env.DEV && window.location.hash.startsWith('#/preview');

/** A screen that throws used to leave a blank page with no clue why. Show the message instead. */
class Guard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate() { /* a new hash means a new screen, so try again */ }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen center">
        <p className="notice">This screen failed: {this.state.error.message}</p>
        <button type="button" className="chip-btn" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Reload</button>
      </main>
    );
  }
}

createRoot(container).render(<StrictMode><Guard>{previewing ? <PreviewApp /> : <App />}</Guard></StrictMode>);

ensureBaseline();
captureInstallPrompt();
registerServiceWorker();
