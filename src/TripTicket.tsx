import { useEffect, useState } from 'react';
import type { Leg, Plan, PlanSide } from './types';
import { effective, optionRows, stepLines } from './tripOptions';

type Side = 'out' | 'back';

function Legs({ side }: { side: PlanSide | null | undefined }) {
  const legs: Leg[] = side?.legs ?? [];
  if (legs.length === 0) return null;
  return (
    <ol className="tkline">
      {legs.map((l, i) => (
        <li key={i}><span className="tkt">{l.t ?? ''}</span><span className="tkdot" aria-hidden="true" /><span>{l.txt}{l.dur ? <i> {l.dur}</i> : null}</span></li>
      ))}
    </ol>
  );
}

function Cell({ label, time, sub }: { label: string; time?: string | undefined; sub?: string | undefined }) {
  return <div className="tkcell"><span className="tklbl">{label}</span><b>{time || '--:--'}</b><span className="tksub">{sub ?? ''}</span></div>;
}

const platformText = (p: string | null | undefined): string => (p ? (/^\d+$/.test(p) ? `platform ${p}` : p) : '');

/**
 * One direction with whole journeys: the chosen one as a labelled timeline, the others as rows to tap.
 * Every time on the timeline comes from the chosen journey, so tapping another one rearranges all of it.
 */
function Journey({ side, label, selected, onPick }: { side: PlanSide | null | undefined; label: string; selected: string | undefined; onPick: (id: string | null) => void }) {
  const rows = optionRows(side?.options, selected);
  const h = effective(side, selected);
  if (rows.length === 0 || !h) return null;
  const planned = rows.find((r) => r.kind === 'pick');
  const lines = stepLines(h);
  const changed = planned !== undefined && !planned.selected;
  return (
    <section className="tkjourney" aria-label={label}>
      <div className="tkjh"><p className="tkh">{lines.length ? label : `Trains ${label.toLowerCase().replace('way ', '')}`}</p>{changed ? <button type="button" className="tkreset" onClick={() => onPick(null)}>Planned</button> : null}</div>
      {lines.length ? (
        <ol className="tksteps">
          {lines.map((l, i) => (
            <li key={i} className={`tkstep ${l.kind}`}>
              <span className="tkst">{l.time}</span>
              <span className="tksl">{l.label}</span>
              <span className="tkstx">{l.text}{l.sub ? <small>{l.sub}</small> : null}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {lines.length ? <p className="tkpickh">Other trains</p> : null}
      <ul className="tkopts">
        {rows.map((r) => (
          <li key={r.oid}>
            <button type="button" className={`tkopt ${r.kind}${r.selected ? ' sel' : ''}`} aria-pressed={r.selected} onClick={() => onPick(r.oid)}>
              <span className="tkot"><span className="tkos">Start</span> <b>{r.startAt}</b> <span aria-hidden="true">→</span> <span className="tkos">arrive</span> {r.arrive}</span>
              {r.kind === 'pick' ? <span className="tkpick">planned</span> : null}
              <span className="tkoi">{r.txt}{r.late ? <> <em>after the deadline</em></> : null}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Three named times for one direction: when to start moving, when to board the first train, when he arrives. */
function Headline({ side, selected, prefix }: { side: PlanSide | null | undefined; selected: string | undefined; prefix: string }) {
  const h = effective(side, selected);
  if (!h || h.steps.length === 0) return null;
  const train = h.steps.find((s) => s.kind === 'train');
  const last = [...h.steps].reverse().find((s) => s.kind === 'train');
  const p = prefix ? `${prefix} ` : '';
  return (
    <div className="tktimes">
      <Cell label={prefix ? `${p}start` : h.startLabel} time={h.start} sub={h.steps[0]?.from} />
      <Cell label={`${p}board`} time={h.board} sub={train ? [train.line, platformText(train.platform)].filter(Boolean).join(' · ') : undefined} />
      <Cell label={`${p}arrive`} time={h.arrive} sub={last?.to ?? side?.to} />
    </div>
  );
}

/**
 * The ticket: route, the times, every train of the journey, what to know. `onSelect` stores the chosen journey on the card;
 * without it the choice still works on screen, so a preview behaves the same.
 */
export function TripTicket({ plan, onSelect }: { plan: Plan; onSelect?: (side: Side, id: string | null) => void }) {
  const out = plan.out ?? {};
  const back = plan.back;
  const [local, setLocal] = useState<{ out?: string | null | undefined; back?: string | null | undefined }>({});
  // A change that arrives from the card replaces what was tapped here.
  useEffect(() => { setLocal((l) => ({ ...l, out: undefined })); }, [out.selected]);
  useEffect(() => { setLocal((l) => ({ ...l, back: undefined })); }, [back?.selected]);
  const sel = (side: Side): string | undefined => {
    const l = local[side];
    if (l === null) return '';
    return l ?? (side === 'out' ? out.selected : back?.selected);
  };
  const pick = (side: Side) => (id: string | null) => { setLocal((l) => ({ ...l, [side]: id })); onSelect?.(side, id); };
  const outSteps = effective(out, sel('out'))?.steps.length;
  const backSteps = effective(back, sel('back'))?.steps.length;
  return (
    <div className="ticket">
      <div className="tkroute"><span>{plan.from}</span><span aria-hidden="true">→</span><span>{plan.to}</span></div>
      {plan.why ? <p className="tkwhy">{plan.why}</p> : null}
      {outSteps ? <Headline side={out} selected={sel('out')} prefix="" /> : (
        <div className="tktimes">
          <Cell label="Leave" time={out.leave} sub={out.from} />
          <Cell label="Arrive" time={out.arrive} sub={out.to} />
          {back?.leave ? <Cell label="Back" time={back.arrive ?? back.leave} sub={`leave ${back.leave}`} /> : <Cell label="Back" sub={back?.txt ?? 'not planned'} />}
        </div>
      )}
      <Journey side={out} label="Way there" selected={sel('out')} onPick={pick('out')} />
      {backSteps ? <Headline side={back} selected={sel('back')} prefix="Back" /> : null}
      <Journey side={back} label="Way back" selected={sel('back')} onPick={pick('back')} />
      {!outSteps && out.legs?.length ? <><p className="tkh">Way there</p><Legs side={out} /></> : null}
      {!backSteps && back?.legs?.length ? <><p className="tkh">Way back</p><Legs side={back} /></> : null}
      {plan.know?.length ? <><p className="tkh">Know</p><ul className="tkknow">{plan.know.map((k) => <li key={k}>{k}</li>)}</ul></> : null}
      {plan.maps && /^https:\/\//.test(plan.maps) ? <p className="tkmap"><a href={plan.maps} target="_blank" rel="noopener noreferrer">Open all stops in Google Maps</a></p> : null}
      {plan.est ? <p className="tkest">Estimate: {plan.est}</p> : null}
    </div>
  );
}
