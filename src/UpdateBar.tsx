import { useEffect, useState } from 'react';
import { onServiceWorkerUpdate } from './pwa/registerServiceWorker';

/**
 * Tells him a new version is ready, and applies it for him when the app has only just opened and he is not
 * typing. The worker deliberately never takes over by itself (it would swap the code under a half-written
 * reply), so without this bar an installed app can run an old version for days.
 */
export function UpdateBar() {
  const [apply, setApply] = useState<(() => void) | null>(null);
  useEffect(() => onServiceWorkerUpdate((fn) => {
    const typing = document.activeElement?.matches('input, textarea') ?? false;
    if (performance.now() < 15_000 && !typing) fn();      // just launched, nothing to lose
    else setApply(() => fn);
  }), []);
  if (!apply) return null;
  return (
    <div className="update-bar" role="status">
      <span>A new version is ready.</span>
      <button className="chip-btn small" onClick={apply}>Update</button>
    </div>
  );
}
