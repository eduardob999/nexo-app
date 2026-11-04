import { useEffect, useState } from 'react';
import type { NexoStatus } from './types';

interface Props {
  status: NexoStatus | null | undefined;
  /** When he last pressed Call Nexo on this device, or 0. Bridges the seconds before the status document catches up. */
  calledAt: number;
  titles: Map<string, string>;
  now?: number;
}

const MAX_LISTED = 6;

function minutes(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

function clock(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
}

/**
 * Progress for a call. The app cannot see inside a tick, so it reports what can be known from outside:
 * that the loop has been called, that a tick is running and for how long, and which of the cards that
 * were waiting when it began have been answered since. The bar fills with those answers.
 */
export function NexoPanel({ status, calledAt, titles, now: fixedNow }: Props) {
  const [tick, setTick] = useState(() => Date.now());
  const active = status?.phase === 'working' || status?.phase === 'queued' || calledAt > 0;
  useEffect(() => {
    if (!active || fixedNow !== undefined) return undefined;
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active, fixedNow]);
  const now = fixedNow ?? tick;

  if (!status || status.phase === 'idle') {
    const sinceCall = calledAt > 0 ? now - calledAt : Number.POSITIVE_INFINITY;
    if (sinceCall < 30_000) {
      return (
        <section className="nexo-panel" aria-live="polite">
          <p className="np-head">Calling Nexo…</p>
          <div className="np-bar indeterminate" role="progressbar" aria-label="Calling Nexo" />
        </section>
      );
    }
    if (calledAt > 0 && sinceCall < 120_000) {
      return (
        <section className="nexo-panel warn" aria-live="polite">
          <p className="np-head">The call has not reached the loop</p>
          <p className="np-sub">Sync may be behind. Your press is saved and will be picked up when it catches up.</p>
        </section>
      );
    }
    const ended = status?.lastEndedAt ? Date.parse(status.lastEndedAt) : NaN;
    if (!Number.isNaN(ended) && status?.lastOutcome === 'failed' && now - ended < 60 * 60_000) {
      return (
        <section className="nexo-panel warn">
          <p className="np-head">The last run failed at {clock(status.lastEndedAt)}</p>
          <p className="np-sub">Nexo did not finish. Cards waiting on it are still waiting.</p>
        </section>
      );
    }
    if (!Number.isNaN(ended) && status?.lastOutcome === 'ok' && now - ended < 10 * 60_000) {
      return <section className="nexo-panel done"><p className="np-head">Nexo finished at {clock(status.lastEndedAt)}</p></section>;
    }
    return null;
  }

  const queued = status.phase === 'queued';
  const startedMs = Date.parse((queued ? status.queuedAt : status.startedAt) ?? '');
  const elapsed = Number.isNaN(startedMs) ? 0 : now - startedMs;
  const slow = !queued && elapsed > 10 * 60_000;
  const shown = status.cards.slice(0, MAX_LISTED);
  const pct = status.total > 0 ? Math.round((status.answered / status.total) * 100) : 0;
  return (
    <section className={`nexo-panel ${slow ? 'warn' : ''}`} aria-live="polite">
      <p className="np-head">
        {queued ? 'Nexo has been called' : 'Nexo is working'}
        <span className="np-time">{queued ? `waiting ${minutes(elapsed)}` : minutes(elapsed)}</span>
      </p>
      <div
        className={`np-bar ${!queued && status.total === 0 ? 'indeterminate' : ''}`}
        role="progressbar" aria-label="Nexo progress" aria-valuemin={0} aria-valuemax={status.total || 100} aria-valuenow={status.answered}
      >
        <i style={{ width: `${queued ? 0 : pct}%` }} />
      </div>
      <p className="np-sub">
        {queued
          ? `Waiting for the loop to start. ${status.total} ${status.total === 1 ? 'card' : 'cards'} to revise.`
          : status.total > 0
            ? `${status.answered} of ${status.total} ${status.total === 1 ? 'card' : 'cards'} answered`
            : 'No card was waiting, so this is a routine check.'}
      </p>
      {slow ? <p className="np-sub">This run is taking longer than usual{status.answered === 0 ? ' and has answered nothing yet' : ''}.</p> : null}
      {shown.length > 0 ? (
        <ul className="np-list">
          {shown.map((c) => (
            <li key={c.id} className={c.answered ? 'done' : ''}>
              <span className="np-mark" aria-hidden="true">{c.answered ? '✓' : '○'}</span>
              <span>{titles.get(c.id) ?? c.title}</span>
            </li>
          ))}
          {status.cards.length > MAX_LISTED ? <li className="more">and {status.cards.length - MAX_LISTED} more</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
