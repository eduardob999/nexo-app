import { useEffect, useRef, useState } from 'react';
import { subscribeFlash, type Tone } from './toast';

export function ToastHost() {
  const [msg, setMsg] = useState<{ text: string; tone: Tone } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => subscribeFlash((text, tone) => {
    setMsg({ text, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), tone === 'warn' ? 5000 : 2200);
  }), []);
  return msg ? <div className={`toast ${msg.tone}`} role="status" aria-live="polite">{msg.text}</div> : null;
}
