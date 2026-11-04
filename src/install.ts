import { useEffect, useState } from 'react';

/** The browser's own install prompt, kept when it fires so a button of ours can show it later. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Call once at start-up: the event fires early and only once, so it has to be caught before React mounts. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export type InstallState = 'installed' | 'ready' | 'ios' | 'manual';

/**
 * What to offer. Android and desktop Chrome hand over a prompt we can show on a button. iPhone has no
 * such prompt at all, only Share then Add to Home Screen, so it gets instructions. Anything else gets a
 * pointer to the browser menu. An app already running installed offers nothing.
 */
export function installState(userAgent: string, standalone: boolean, hasPrompt: boolean): InstallState {
  if (standalone) return 'installed';
  if (hasPrompt) return 'ready';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'manual';
}

export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return {
    state: installState(navigator.userAgent, standalone, deferred !== null),
    install: async () => {
      if (!deferred) return;
      const ev = deferred;
      deferred = null;
      await ev.prompt();
      await ev.userChoice;
      listeners.forEach((l) => l());
    },
  };
}
