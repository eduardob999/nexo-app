import { useState } from 'react';

/** Write a draft, or forget it when it is empty. Storage may be blocked, which is not an error here. */
export function storeDraft(key: string, v: string): void {
  const full = `nexo-draft-${key}`;
  try { if (v) window.localStorage.setItem(full, v); else window.localStorage.removeItem(full); } catch { /* storage blocked */ }
}

/** A text box that survives a reload, a re-render and a tab being discarded, until it is sent. Per device only. */
export function usePersisted(key: string): [string, (v: string) => void] {
  const full = `nexo-draft-${key}`;
  const [value, set] = useState(() => {
    try { return window.localStorage.getItem(full) ?? ''; } catch { return ''; }
  });
  const update = (v: string) => {
    set(v);
    storeDraft(key, v);
  };
  return [value, update];
}
