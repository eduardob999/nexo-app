export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  compact: boolean;
  start: 'today' | 'upcoming';
}

const KEY = 'nexo-settings';
const DEFAULTS: Settings = { theme: 'auto', compact: false, start: 'today' };

/** Per-device display preferences only. Storage can be blocked or empty, so every access is guarded. */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto',
      compact: p.compact === true,
      start: p.start === 'upcoming' ? 'upcoming' : 'today',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: the setting simply does not persist.
  }
}

export function applySettings(s: Settings): void {
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.setAttribute('data-density', s.compact ? 'compact' : 'comfortable');
}
