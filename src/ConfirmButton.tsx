import { useEffect, useState } from 'react';

/** How long the second tap stays valid. */
export const CONFIRM_MS = 4000;

/**
 * A button that asks once. The first tap changes its words to "Tap again"; a second tap inside four
 * seconds does the thing, and after that it goes back to asking. Used wherever a tap would remove something.
 */
export function ConfirmButton({ label, armedLabel = 'Tap again', onConfirm, className = 'chip-btn small', ariaLabel }: {
  label: string; armedLabel?: string; onConfirm: () => void; className?: string; ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? ' danger' : ''}`} aria-label={armed ? `${armedLabel}: ${ariaLabel ?? label}` : (ariaLabel ?? label)}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? armedLabel : label}
    </button>
  );
}
