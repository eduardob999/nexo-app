import { useEffect, useState } from 'react';
import { askRates, maturity, drifted, shouldAsk } from './adapt';
import { t } from './i18n';
import type { Lang, PlannedItem, TaskType } from './model';
import { HowLongSheet, LogSheet, RateSheet } from './Sheets';
import { clockText, elapsedMin, loadTimer, recentAnswers, saveTimer, type Running } from './timer';
import { clockLabel } from './time';
import type { KajiActions, KajiData, Ratings } from './ui';
import { memberColor, taskName, todayFor } from './view';

type Flow = { step: 'minutes'; task: TaskType; item: PlannedItem | null; start?: number } | { step: 'rate'; task: TaskType; item: PlannedItem | null; minutes: number; start?: number } | { step: 'log' } | null;

export function TodayScreen({ data, actions, lang, rand = Math.random }: { data: KajiData; actions: KajiActions; lang: Lang; rand?: () => number }) {
  const [running, setRunning] = useState<Running | null>(() => loadTimer());
  const [tick, setTick] = useState(() => Date.now());
  const [flow, setFlow] = useState<Flow>(null);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const [askedSwap, setAskedSwap] = useState<string | null>(null);
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
  const openSwaps = data.swaps.filter((s) => s.state === 'open' && s.toUid === data.me);

  const start = (item: PlannedItem) => { const r = { taskId: item.taskId, itemId: item.id, start: Date.now() }; saveTimer(r); setRunning(r); };
  const stop = () => { saveTimer(null); setRunning(null); };

  const finish = (task: TaskType, item: PlannedItem | null, startedAt?: number) => {
    const est = data.estimates[task.id];
    const mat = est ? maturity(est, task, data.log, data.now) : 'new';
    const rates = askRates(mat, drifted(data.log, task.id), task, data.settings);
    const timed = startedAt !== undefined && running?.taskId === task.id;
    if (timed) { stop(); maybeRate(task, item, elapsedMin(startedAt as number, Date.now()), rates.rating, startedAt); return; }
    if (task.mode === 'measured' && shouldAsk(rates.timer, rand)) { setFlow({ step: 'minutes', task, item }); return; }
    const minutes = task.mode === 'fixed' ? task.priorMinutes : Math.round(est && est.n ? est.meanMin : task.priorMinutes);
    maybeRate(task, item, minutes, rates.rating);
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

  const runTask = running ? byId.get(running.taskId) : undefined;
  return (
    <>
      {running && runTask ? (
        <div className="panel kaji-run" role="status">
          <div><small className="mut">{t(lang, 'running')}</small><b>{runTask.icon} {taskName(runTask, lang)}</b></div>
          <span className="kaji-clock">{clockText(tick - running.start)}</span>
          <button className="copy-main" onClick={() => finish(runTask, mine.find((i) => i.id === running.itemId) ?? null, running.start)}>{t(lang, 'done')}</button>
          <button className="chip-btn" onClick={stop}>{t(lang, 'stop')}</button>
        </div>
      ) : null}
      {openSwaps.map((s) => (
        <div className="panel kaji-swap" key={s.id}>
          <span>{t(lang, 'swapOpen')}: {byId.get(s.taskId)?.icon} {taskName(byId.get(s.taskId), lang, s.taskId)} {clockLabel(s.start)}</span>
          <span><button className="copy-main" onClick={() => void actions.answerSwap(s, true)}>{t(lang, 'accept')}</button> <button className="chip-btn" onClick={() => void actions.answerSwap(s, false)}>{t(lang, 'decline')}</button></span>
        </div>
      ))}
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
                  <small className="mut">{clockLabel(i.start)} to {clockLabel(i.end)} · {task.mode === 'fixed' ? t(lang, 'fixedWindow') : `${Math.round((i.end - i.start) / 60000)} ${t(lang, 'minutes')}`}</small></span>
                <span className="kaji-acts">
                  {task.mode === 'measured' && !on ? <button className="chip-btn" onClick={() => start(i)}>{t(lang, 'start')}</button> : null}
                  <button className="copy-main" onClick={() => finish(task, i, on ? running?.start : undefined)}>{t(lang, 'done')}</button>
                  <button className="chip-btn kaji-more" aria-label={t(lang, 'more')} aria-expanded={menu === i.id} onClick={() => setMenu(menu === i.id ? null : i.id)}>⋯</button>
                  {menu === i.id ? (
                    <>
                      <button className="chip-btn" onClick={() => { setMenu(null); void actions.notToday(i); }}>{t(lang, 'notToday')}</button>
                      {others.length ? <button className="chip-btn" disabled={askedSwap === i.id} onClick={() => { setAskedSwap(i.id); setMenu(null); void actions.askSwap(i, (others[0] as { uid: string }).uid); }}>{askedSwap === i.id ? t(lang, 'swapSent') : t(lang, 'swap')}</button> : null}
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
      {data.unplaced.length ? <p className="notice">{t(lang, 'unplaced')}: {data.unplaced.slice(0, 4).map((u) => byId.get(u.taskId)?.icon ?? u.taskId).join(' ')}</p> : null}
      <button className="kaji-fab" aria-label={t(lang, 'logAChore')} onClick={() => setFlow({ step: 'log' })}>+</button>
      {undo ? <div className="kaji-toast" role="status">{t(lang, 'saved')}: {undo.label}</div> : null}
      {flow?.step === 'log' ? <LogSheet lang={lang} tasks={data.tasks} onCancel={() => setFlow(null)} onPick={(task) => { setFlow(null); finish(task, null); }} /> : null}
      {flow?.step === 'minutes' ? (
        <HowLongSheet lang={lang} task={flow.task} choices={recentAnswers(data.log, flow.task.id, flow.task.priorMinutes)} onCancel={() => setFlow(null)}
          onPick={(m) => { const est = data.estimates[flow.task.id]; const mat = est ? maturity(est, flow.task, data.log, data.now) : 'new'; maybeRate(flow.task, flow.item, m, askRates(mat, drifted(data.log, flow.task.id), flow.task, data.settings).rating); }} />
      ) : null}
      {flow?.step === 'rate' ? (
        <RateSheet lang={lang} task={flow.task} onSkip={() => void commit(flow.task, flow.item, flow.minutes, {}, flow.start)} onSave={(r) => void commit(flow.task, flow.item, flow.minutes, r, flow.start)} />
      ) : null}
    </>
  );
}
