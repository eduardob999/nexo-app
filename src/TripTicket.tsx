import type { Leg, Plan, PlanSide } from './types';
import { optionRows } from './tripOptions';

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

/** Train options for one direction: some earlier, the one planned, some later. Nothing when the card has none. */
function Options({ side, label }: { side: PlanSide | null | undefined; label: string }) {
  const rows = optionRows(side?.options);
  if (rows.length === 0) return null;
  return (
    <>
      <p className="tkh">{label}</p>
      <ul className="tkopts">
        {rows.map((r) => (
          <li key={`${r.leave}-${r.arrive}`} className={`tkopt ${r.kind}`}>
            <span className="tkot"><b>{r.leave}</b> → {r.arrive}</span>
            <span className="tkoi">{r.txt}{r.late ? <> <em>after the deadline</em></> : null}</span>
            {r.kind === 'pick' ? <span className="tkpick">planned</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function Cell({ label, time, sub }: { label: string; time?: string | undefined; sub?: string | undefined }) {
  return <div className="tkcell"><span className="tklbl">{label}</span><b>{time || '--:--'}</b><span className="tksub">{sub ?? ''}</span></div>;
}

/** The ticket from the old board: route, the three times, both legs, what to know. */
export function TripTicket({ plan }: { plan: Plan }) {
  const out = plan.out ?? {};
  const back = plan.back;
  return (
    <div className="ticket">
      <div className="tkroute"><span>{plan.from}</span><span aria-hidden="true">→</span><span>{plan.to}</span></div>
      {plan.why ? <p className="tkwhy">{plan.why}</p> : null}
      <div className="tktimes">
        <Cell label="Leave" time={out.leave} sub={out.from} />
        <Cell label="Arrive" time={out.arrive} sub={out.to} />
        {back?.leave ? <Cell label="Back" time={back.arrive ?? back.leave} sub={`leave ${back.leave}`} /> : <Cell label="Back" sub={back?.txt ?? 'not planned'} />}
      </div>
      <Options side={out} label="Trains there" />
      <Options side={back} label="Trains back" />
      {out.legs?.length ? <><p className="tkh">Way there</p><Legs side={out} /></> : null}
      {back?.legs?.length ? <><p className="tkh">Way back</p><Legs side={back} /></> : null}
      {plan.know?.length ? <><p className="tkh">Know</p><ul className="tkknow">{plan.know.map((k) => <li key={k}>{k}</li>)}</ul></> : null}
      {plan.maps && /^https:\/\//.test(plan.maps) ? <p className="tkmap"><a href={plan.maps} target="_blank" rel="noopener noreferrer">Open all stops in Google Maps</a></p> : null}
      {plan.est ? <p className="tkest">Estimate: {plan.est}</p> : null}
    </div>
  );
}
