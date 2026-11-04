import { buildStrip, type Free, type TodayInfo } from './strip';

function Banner({ x }: { x: Free }) {
  const conf = x.lab === 'confirm';
  return (
    <p className={`holiday ${conf ? 'conf' : ''}`}>
      {conf ? <>University break: <b>{x.name}</b>. No classes. Lab: confirm.</> : <>Holiday today: <b>{x.name}</b>. No lab.</>}
      {x.end && x.end !== x.start ? ` Until ${x.end.slice(5)}.` : ''}
    </p>
  );
}

/** Weather, trains, free days, birthdays and events, in one fold that is open by default. */
export function TodayStrip({ info, now }: { info: TodayInfo | null | undefined; now: Date }) {
  const s = buildStrip(info, now);
  if (!s) return null;
  const hasRows = s.weather || s.trains || s.days.length || s.events.length;
  return (
    <>
      {s.banner ? <Banner x={s.banner} /> : null}
      {hasRows ? (
        <details className="strip-info" open>
          <summary>
            <span className="strip-head">{s.head.length ? s.head.join(' · ') : 'Today'}</span>
            {s.updated ? <span className={`strip-up ${s.updated.stale ? 'stale' : ''}`}>{s.updated.stale ? 'stale, ' : ''}updated {s.updated.label}</span> : null}
          </summary>
          {s.weather ? (
            <p className="strip-row">
              {s.weather.now ? <span><b>{s.weather.now}</b>{s.weather.place ? <span className="mut"> {s.weather.place}</span> : null}</span> : null}
              {s.weather.today ? <span><span className="lab">Today</span> {s.weather.today}</span> : null}
              {s.weather.tomorrow ? <span><span className="lab">Tomorrow</span> {s.weather.tomorrow}</span> : null}
              {s.weather.sunset ? <span className="mut">sunset {s.weather.sunset}</span> : null}
            </p>
          ) : null}
          {s.trains ? (
            s.trains.normal ? <p className="strip-row mut">Trains normal</p> : (
              <p className="strip-row">{s.trains.bad.map((b) => <span key={b.line} className="bad"><b>{b.line}</b> {b.status}</span>)}</p>
            )
          ) : null}
          {s.days.length ? (
            <p className="strip-row">
              {s.days.map((d) => (
                <span key={d.text} className={d.now ? 'now' : ''}>{d.text}{d.when ? <span className="mut"> {d.when}</span> : null}</span>
              ))}
            </p>
          ) : null}
          {s.events.length ? (
            <ul className="strip-events">
              {s.events.map((e) => (
                <li key={e.title + e.when}>
                  {e.when ? <span className="mut">{e.when} </span> : null}
                  {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a> : e.title}
                  {e.place ? <span className="mut"> · {e.place}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
