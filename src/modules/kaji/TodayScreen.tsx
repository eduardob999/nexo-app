import { useEffect, useState } from 'react';
import { askRates, maturity, drifted, shouldAsk } from './adapt';
import { t } from './i18n';
import type { Lang, LogEvent, PlannedItem, TaskType } from './model';
import { AskButton } from './AskSheet';
import { HowLongSheet, KindSheet, LogSheet, RateSheet } from './Sheets';
import { customTask, eventFromTimer, isOpenTimer, startOpenTimer, type Kind } from './quicklog';
import { DismissSheet, RescheduleSheet } from './MoveSheets';
import { HomeStrip } from './HomeStrip';
import { clockText, elapsedMin, loadTimer, recentAnswers, saveTimer, type Running } from './timer';
import { nexoPick, swapItem } from './planner';
import { clockLabel } from './time';
import type { KajiActions, KajiData, Ratings } from './ui';
import { latestSwap, memberColor, recentDone, swapButtonState, taskName, todayFor } from './view';

type Flow = { step: 'minutes'; task: TaskType; item: PlannedItem | null; start?: number; est?: number } | { step: 'rate'; task: TaskType; item: PlannedItem | null; minutes: number; start?: number } | { step: 'log' } | { step: 'kind'; start: number; end: number } | { step: 'later'; task: TaskType; event: LogEvent } | { step: 'reschedule'; task: TaskType; item: PlannedItem } | { step: 'dismiss'; task: TaskType; item: PlannedItem } | null;

export function TodayScreen({ data, actions, lang, rand = Math.random, askPreview }: { data: KajiData; actions: KajiActions; lang: Lang; rand?: () => number; askPreview?: import('./asks').Ask[] }) {
  const [running, setRunning] = useState<Running | null>(() => loadTimer());
  const [tick, setTick] = useState(() => Date.now());
  const [flow, setFlow] = useState<Flow>(null);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const [sendingSwap, setSendingSwap] = useState<string | null>(null);
  const [swapErr, setSwapErr] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!running) return undefined;
    const i = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [running]);
  useEffect(() => {
    if (!undo) return undefined;
    const i = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(i);
  }, [undo]);

  const byId = new Map(data.tasks.map((x) => [x.id, x]));
  const mine = todayFor(data.plan, data.me, data.log, data.now);
  const others = data.members.filter((m) => m.uid !== data.me);
  const theirs = others.flatMap((m) => todayFor(data.plan, m.uid, data.log, data.now).map((i) => ({ i, m })));
  // a request still shown to me only while its chore is still planned for the person who asked (a re-plan can change the id, so it is matched by chore and time too)
  const openSwaps = data.swaps.filter((s) => s.state === 'open' && s.toUid === data.me && swapItem(data.plan, s)?.uid === s.fromUid);
  const nameOf = (uid: string) => data.members.find((m) => m.uid === uid)?.name ?? '';
  /** The other person who may do this chore: the one a swap can be asked of. */
  const swapTarget = (task: TaskType) => others.find((m) => !task.who?.length || task.who.includes(m.uid));
  const askSwap = async (item: PlannedItem, to: string) => {
    setSendingSwap(item.id); setSwapErr(false); setMenu(null);
    try { await actions.askSwap(item, to); setUndo({ id: '', label: `${taskName(byId.get(item.taskId), lang, item.taskId)} · ${t(lang, 'swapSent')} ${nameOf(to)}` }); } catch { setSwapErr(true); }
    setSendingSwap(null);
  };
  const nexoSlot = (item: PlannedItem) => nexoPick({ now: Math.max(Date.now(), data.now), horizonDays: 7, tasks: data.tasks, members: data.members, estimates: data.estimates, log: data.log, busy: data.busy, existing: data.plan, settings: data.settings, awayUntil: data.away, presence: data.presence }, item);

  const start = (item: PlannedItem) => { const r = { taskId: item.taskId, itemId: item.id, start: Date.now() }; saveTimer(r); setRunning(r); };
  const startOpen = () => { const r = startOpenTimer(Date.now()); saveTimer(r); setRunning(r); };
  const kindPicked = async (k: Kind, r: Running, end: number) => {
    setFlow(null);
    const ev = eventFromTimer(r, end, data.me, k);
    if (k.kind === 'custom') { stop(); await actions.logDone(ev.taskId, ev.minutes, {}, { planned: false, start: r.start, custom: ev.custom ?? k.name }); setUndo({ id: '', label: `${k.name} · ${ev.minutes} ${t(lang, 'minutes')}` }); return; }
    const task = k.kind === 'new' ? k.task : byId.get(k.taskId);
    if (!task) return;
    if (k.kind === 'new') await actions.saveTask(task);
    stop();
    maybeRate(task, null, ev.minutes, 1, r.start);
  };
  const stop = () => { saveTimer(null); setRunning(null); };

  const finish = (task: TaskType, item: PlannedItem | null, startedAt?: number) => {
    const est = data.estimates[task.id];
    const mat = est ? maturity(est, task, data.log, data.now) : 'new';
    const rates = askRates(mat, drifted(data.log, task.id), task, data.settings);
    const timed = startedAt !== undefined && running?.taskId === task.id;
    if (timed) { stop(); maybeRate(task, item, elapsedMin(startedAt as number, Date.now()), 1, startedAt); return; }       // he asked: finishing a timed chore always opens the form
    if (task.mode === 'measured' && shouldAsk(rates.timer, rand)) { setFlow({ step: 'minutes', task, item }); return; }
    const minutes = task.mode === 'fixed' ? task.priorMinutes : Math.round(est && est.n ? est.meanMin : task.priorMinutes);
    maybeRate(task, item, minutes, rates.rating);
  };
  // Logging without a timer always carries a duration: the estimate is offered first and one tap accepts it.
  const logWithoutTimer = (task: TaskType) => {
    const est = data.estimates[task.id];
    const guess = Math.round(est && est.n ? est.meanMin : task.priorMinutes);
    if (task.mode === 'measured') { setFlow({ step: 'minutes', task, item: null, est: guess }); return; }
    finish(task, null);
  };
  const maybeRate = (task: TaskType, item: PlannedItem | null, minutes: number, p: number, startedAt?: number) => {
    if (shouldAsk(p, rand)) setFlow({ step: 'rate', task, item, minutes, ...(startedAt !== undefined ? { start: startedAt } : {}) });
    else void commit(task, item, minutes, {}, startedAt);
  };
  const commit = async (task: TaskType, item: PlannedItem | null, minutes: number, r: Ratings, startedAt?: number) => {
    setFlow(null);
    await actions.logDone(task.id, minutes, r, { planned: item !== null, ...(startedAt !== undefined ? { start: startedAt } : {}) });
    setUndo({ id: '', label: taskName(task, lang) });
  };

  const pick = flow?.step === 'reschedule' ? nexoSlot(flow.item) : null;
  const runTask = running ? byId.get(running.taskId) : undefined;
  const open = isOpenTimer(running);
  return (
    <>
      {open && running ? (
        <div className="panel kaji-run" role="status">
          <div><small className="mut">{t(lang, 'running')}</small><b>{t(lang, 'quickRunning')}</b></div>
          <span className="kaji-clock">{clockText(tick - running.start)}</span>
          <button className="copy-main" onClick={() => setFlow({ step: 'kind', start: running.start, end: Date.now() })}>{t(lang, 'finish')}</button>
          <button className="chip-btn" onClick={stop}>{t(lang, 'discard')}</button>
        </div>
      ) : null}
      {running && runTask ? (
        <div className="panel kaji-run" role="status">
          <div><small className="mut">{t(lang, 'running')}</small><b>{runTask.icon} {taskName(runTask, lang)}</b></div>
          <span className="kaji-clock">{clockText(tick - running.start)}</span>
          <button className="copy-main" onClick={() => finish(runTask, mine.find((i) => i.id === running.itemId) ?? null, running.start)}>{t(lang, 'finish')}</button>
          <button className="chip-btn" onClick={stop}>{t(lang, 'stop')}</button>
        </div>
      ) : null}
      {openSwaps.map((s) => (
        <div className="panel kaji-swap" key={s.id}>
          <span>{nameOf(s.fromUid)} {t(lang, 'swapFromName')}: {byId.get(s.taskId)?.icon} {taskName(byId.get(s.taskId), lang, s.taskId)} {clockLabel(s.start)}</span>
          <span><button className="copy-main" onClick={() => void actions.answerSwap(s, true)}>{t(lang, 'accept')}</button> <button className="chip-btn" onClick={() => void actions.answerSwap(s, false)}>{t(lang, 'decline')}</button></span>
        </div>
      ))}
      {swapErr ? <p className="notice" role="alert">{t(lang, 'swapFailed')}</p> : null}
      <AskButton data={data} lang={lang} actions={actions} {...(askPreview ? { preview: askPreview } : {})} />
      <h2 className="group-title">{t(lang, 'yourChores')}</h2>
      {mine.length === 0 ? (
        <div className="panel kaji-empty"><b>{t(lang, 'nothingToday')}</b><p className="mut">{t(lang, 'nothingTodayHelp')}</p></div>
      ) : (
        <ul className="kaji-list panel">
          {mine.map((i) => {
            const task = byId.get(i.taskId);
            if (!task) return null;
            const on = running?.itemId === i.id;
            return (
              <li key={i.id} className="kaji-item">
                <span className="kaji-ic">{task.icon}</span>
                <span className="kaji-main"><b>{taskName(task, lang)}</b>
                  <small className="mut">{clockLabel(i.start)}–{clockLabel(i.end)} · {task.mode === 'fixed' ? t(lang, 'fixedWindow') : `${Math.round((i.end - i.start) / 60000)} ${t(lang, 'minutes')}`}</small></span>
                <span className="kaji-acts">
                  {on ? (
                    <button className="copy-main" onClick={() => finish(task, i, running?.start)}>{t(lang, 'finish')}</button>
                  ) : (
                    <button className="copy-main" disabled={running !== null} onClick={() => start(i)}>{t(lang, 'start')}</button>
                  )}
                  <button className="chip-btn small" onClick={() => setFlow({ step: 'reschedule', task, item: i })}>{t(lang, 'reschedule')}</button>
                  <button className="chip-btn small" onClick={() => setFlow({ step: 'dismiss', task, item: i })}>{t(lang, 'dismiss')}</button>
                  <button className="chip-btn kaji-more" aria-label={t(lang, 'more')} aria-expanded={menu === i.id} onClick={() => setMenu(menu === i.id ? null : i.id)}>⋯</button>
                  {menu === i.id ? (
                    <>
                      {on ? null : <button className="chip-btn" onClick={() => { setMenu(null); finish(task, i); }}>{t(lang, 'doneNoTimer')}</button>}
                      <button className="chip-btn" onClick={() => { setMenu(null); void actions.notToday(i); }}>{t(lang, 'notToday')}</button>
                      {(() => {
                        const to = swapTarget(task);
                        if (!to) return null;
                        const state = swapButtonState(latestSwap(data.swaps, data.me, i), sendingSwap === i.id);
                        return <button className="chip-btn" disabled={state !== 'idle'} onClick={() => void askSwap(i, to.uid)}>{state === 'sending' ? t(lang, 'swapSending') : state === 'open' ? `${t(lang, 'swapSent')} ${to.name}` : state === 'declined' ? `${to.name}: ${t(lang, 'swapDeclined')}` : t(lang, 'swap')}</button>;
                      })()}
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <h2 className="group-title">{t(lang, 'home')}</h2>
      <HomeStrip data={data} actions={actions} lang={lang} />
      {theirs.length ? (
        <>
          <h2 className="group-title">{t(lang, 'theirChores')}</h2>
          <ul className="kaji-list panel">
            {theirs.map(({ i, m }) => {
              const task = byId.get(i.taskId);
              return task ? (
                <li key={i.id} className="kaji-item kaji-dim">
                  <span className="kaji-ic">{task.icon}</span>
                  <span className="kaji-main"><b>{taskName(task, lang)}</b><small className="mut">{clockLabel(i.start)} · {m.name}</small></span>
                  <i className="kaji-dot" style={{ background: memberColor(data.members.findIndex((x) => x.uid === m.uid)) }} />
                </li>
              ) : null;
            })}
          </ul>
        </>
      ) : null}
      {recentDone(data.log, data.me, data.now).length ? (
        <>
          <h2 className="group-title">{t(lang, 'recentDone')}</h2>
          <ul className="kaji-list panel">
            {recentDone(data.log, data.me, data.now).map(({ event, rated }) => {
              const task = byId.get(event.taskId) ?? (event.custom ? customTask(event.custom) : undefined);
              return task ? (
                <li key={event.id} className="kaji-item">
                  <span className="kaji-ic">{task.icon}</span>
                  <span className="kaji-main"><b>{taskName(task, lang)}</b><small className="mut">{event.minutes} {t(lang, 'minutes')}{event.note ? ` · ${event.note.length > 40 ? event.note.slice(0, 40) + '…' : event.note}` : ''}</small></span>
                  <button className={rated ? 'chip-btn' : 'copy-main'} onClick={() => setFlow({ step: 'later', task, event })}>{rated ? t(lang, 'rated') : t(lang, 'rate')}</button>
                </li>
              ) : null;
            })}
          </ul>
        </>
      ) : null}
      {data.unplaced.length ? <p className="notice">{t(lang, 'unplaced')}: {data.unplaced.slice(0, 4).map((u) => byId.get(u.taskId)?.icon ?? u.taskId).join(' ')}</p> : null}
      {running ? null : <button className="kaji-fab" aria-label={t(lang, 'startTimer')} onClick={startOpen}>+</button>}
      {running ? null : <p className="kaji-nolog"><button className="chip-btn small" onClick={() => setFlow({ step: 'log' })}>{t(lang, 'logNoTimer')}</button></p>}
      {undo ? <div className="kaji-toast" role="status">{t(lang, 'saved')}: {undo.label}</div> : null}
      {flow?.step === 'log' ? <LogSheet lang={lang} tasks={data.tasks} onCancel={() => setFlow(null)} onPick={(task) => { setFlow(null); logWithoutTimer(task); }} /> : null}
      {flow?.step === 'kind' && running ? <KindSheet lang={lang} tasks={data.tasks} minutes={elapsedMin(flow.start, flow.end)} now={flow.end} onCancel={() => setFlow(null)} onPick={(k) => void kindPicked(k, running, flow.end)} /> : null}
      {flow?.step === 'minutes' ? (
        <HowLongSheet lang={lang} task={flow.task} choices={recentAnswers(data.log, flow.task.id, flow.est ?? flow.task.priorMinutes)} onCancel={() => setFlow(null)}
          onPick={(m) => { const est = data.estimates[flow.task.id]; const mat = est ? maturity(est, flow.task, data.log, data.now) : 'new'; maybeRate(flow.task, flow.item, m, askRates(mat, drifted(data.log, flow.task.id), flow.task, data.settings).rating); }} />
      ) : null}
      {flow?.step === 'later' ? (
        <RateSheet lang={lang} task={flow.task} later initial={{ ...(flow.event.effort ? { effort: flow.event.effort } : {}), ...(flow.event.dislike ? { dislike: flow.event.dislike } : {}), ...(flow.event.enjoyment ? { enjoyment: flow.event.enjoyment } : {}), ...(flow.event.note ? { note: flow.event.note } : {}) }}
          onSkip={() => setFlow(null)} onSave={(r) => { void actions.rate(flow.event.id, r); setFlow(null); }} />
      ) : null}
      {flow?.step === 'reschedule' ? (
        <RescheduleSheet lang={lang} task={flow.task} item={flow.item} now={Date.now() > data.now ? Date.now() : data.now} settings={data.settings} nexo={pick} nexoWho={pick && pick.uid !== flow.item.uid ? nameOf(pick.uid) : ''} onCancel={() => setFlow(null)}
          onPick={(start, reason, note, toUid) => { void actions.reschedule(flow.item, start, reason, note, toUid); setFlow(null); setUndo({ id: '', label: `${taskName(flow.task, lang)} · ${t(lang, 'movedTo')} ${clockLabel(start)}` }); }} />
      ) : null}
      {flow?.step === 'dismiss' ? (
        <DismissSheet lang={lang} task={flow.task} onCancel={() => setFlow(null)}
          onConfirm={(reason, note) => { void actions.dismiss(flow.item, reason, note); setFlow(null); setUndo({ id: '', label: `${taskName(flow.task, lang)} · ${t(lang, 'dismissed')}` }); }} />
      ) : null}
      {flow?.step === 'rate' ? (
        <RateSheet lang={lang} task={flow.task} onSkip={() => void commit(flow.task, flow.item, flow.minutes, {}, flow.start)} onSave={(r) => void commit(flow.task, flow.item, flow.minutes, r, flow.start)} />
      ) : null}
    </>
  );
}
