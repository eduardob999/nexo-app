/** The screens of the assignment flow (flow.ts). Each step is one card; the editor and the checks of step 6 and 7-8 stay in Screen.tsx. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FudeDoc } from './documents';
import { decodeText, chosenContext, compileContext, DEFAULT_SOURCES, draftPrompt, factSheet, firstOpenStep, headerFor, jaBudgetOf, LAST_STEP, meBlock, missingOwnInput, ownInputNeeds, ownInputTitle, researchPrompt, SOURCE_LABEL, STEPS, stepDone, styleFor, submitLang, type ContextItem, type ContextSources } from './flow';
import { diffWords, changedWords } from './diff';
import { CLAIM_LABEL, STATUS_LABEL, tally, unresolvedClaims } from './assignment';
import { driftWarnings, EDIT_LABEL, listItems } from './edits';
import { editorCounterNote, englishWordTarget, enWords, jaChars, lengthVerdict } from './lengths';
import { NATURALIZE_HEAD, naturalizePrompt } from './naturalize';

export interface FlowApi {
  /** ME.md as mirrored by the helper; empty until it arrives. */
  me: string;
  save: (doc: FudeDoc, patch: Record<string, unknown>) => void;
  facts: (doc: FudeDoc, facts: string) => void;
  requirements: (doc: FudeDoc, text: string) => void;
  askContext: (doc: FudeDoc, sources: ContextSources, hint: string) => void;
  clearContext: (doc: FudeDoc) => void;
  submit: (doc: FudeDoc, final: { english: string; japanese?: string }) => Promise<void>;
  reopen: (doc: FudeDoc) => void;
  /** Replace the text, keeping the old one as the version the Changes panel compares against. */
  replaceText: (doc: FudeDoc, text: string) => void;
  askEdits: (doc: FudeDoc, text: string, instructions: string) => void;
  clearEdits: (doc: FudeDoc) => void;
  askCompare: (doc: FudeDoc, req: { english: string; a: string; b: string; labelA?: string; labelB?: string; budget?: { min?: number; max?: number } }) => void;
  clearCompare: (doc: FudeDoc) => void;
  /** The requirement check on the Japanese that will be submitted, and the claims-against-sources check on the English. */
  askAssignmentCheckJa: (doc: FudeDoc, japanese: string) => void;
  clearAssignmentCheckJa: (doc: FudeDoc) => void;
  askSourcesCheck: (doc: FudeDoc, text: string) => void;
  clearSourcesCheck: (doc: FudeDoc) => void;
  canCloseCard: boolean;
}

const dueText = (due?: string) => (due ? new Date(due).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined);

export function StepBar({ doc, step, onGo }: { doc: FudeDoc; step: number; onGo: (n: number) => void }) {
  return (
    <nav className="flow-bar" aria-label="Steps">
      {STEPS.map((s) => {
        const done = stepDone(doc, s.n);
        return (
          <button key={s.n} type="button" className={`flow-dot${s.n === step ? ' now' : ''}${done ? ' done' : ''}`} aria-current={s.n === step ? 'step' : undefined} aria-label={`Step ${s.n}: ${s.label}${done ? ', done' : ''}`} onClick={() => onGo(s.n)}>
            <span>{done && s.n !== step ? '✓' : s.n}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function StepHead({ step }: { step: number }) {
  const s = STEPS[step - 1];
  return (
    <header className="flow-head">
      <p className="kicker">Step {step} of {LAST_STEP}</p>
      <h2>{s?.label}</h2>
      <p className="mut">{s?.hint}</p>
    </header>
  );
}

export function StepNav({ doc, step, onGo, nextLabel }: { doc: FudeDoc; step: number; onGo: (n: number) => void; nextLabel?: string }) {
  const here = stepDone(doc, step);
  return (
    <div className="flow-nav">
      {step > 1 ? <button type="button" className="tool-chip" onClick={() => onGo(step - 1)}>Back</button> : <span />}
      {step < LAST_STEP ? <button type="button" className={`flow-next${here ? ' ready' : ''}`} onClick={() => onGo(step + 1)}>{nextLabel ?? (here ? 'Next step' : 'Skip to next')}</button> : null}
    </div>
  );
}

function CopyBox({ label, text, blocked, note }: { label: string; text: string; blocked?: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [text]);
  return (
    <section className="panel fude-tool" aria-label={label}>
      {note ? <p className="mut">{note}</p> : null}
      {blocked ? <p className="fude-tool-warn" role="alert">{blocked}</p> : null}
      <textarea className="hw-answer fude-tool-box" readOnly rows={10} value={blocked ? '' : text} onFocus={(e) => e.currentTarget.select()} />
      <div className="fude-tool-actions">
        <span className="fude-tool-count">{text.length.toLocaleString('en-GB')} characters</span>
        <button type="button" className="tool-chip" disabled={!!blocked || !text} onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false)); }}>{copied ? 'Copied' : 'Copy prompt'}</button>
      </div>
    </section>
  );
}

/** Step 1. The request, as given. Nexo fills it when it opens the card; he can edit or paste his own. */
export function RequestStep({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const [req, setReq] = useState(doc.requirements ?? '');
  useEffect(() => { if (document.activeElement?.id !== 'flow-request') setReq(doc.requirements ?? ''); }, [doc.requirements]);
  const due = dueText(doc.due);
  return (
    <section className="panel fude-tool" aria-label="Assignment request">
      {due ? <header className="fude-tool-head"><h3>Due {due}</h3></header> : null}
      <textarea id="flow-request" className="hw-answer fude-tool-box" rows={12} value={req} autoCorrect="off"
        placeholder="Paste the assignment exactly as given: every part, length, language, what to relate it to, how to submit. Then add a numbered list of requirements."
        onChange={(e) => setReq(e.target.value)} onBlur={() => { if (req !== (doc.requirements ?? '')) api.requirements(doc, req); }} />
      {!req.trim() ? <p className="fude-tool-warn">Nothing here yet. Nexo fills this when it opens the card; paste the instructions if it has not.</p> : <p className="mut">Saved when you leave the box. Every later prompt and check uses this text.</p>}
      <LanguageBox doc={doc} api={api} />
    </section>
  );
}

/** What language the lecture was in decides what language the report is submitted in (the course rule: an English lecture gets an English report). */
export function LanguageBox({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const lang = doc.flow?.lectureLanguage;
  const jb = jaBudgetOf(doc);
  const set = (l: 'ja' | 'en') => api.save(doc, { lectureLanguage: l, skipTranslation: l === 'en' });
  return (
    <div className="flow-lang">
      <p className="mut">The lecture was given in</p>
      <div className="fude-tool-actions" role="group" aria-label="Lecture language">
        <button type="button" className={`tool-chip${lang === 'ja' ? ' on' : ''}`} aria-pressed={lang === 'ja'} onClick={() => set('ja')}>Japanese</button>
        <button type="button" className={`tool-chip${lang === 'en' ? ' on' : ''}`} aria-pressed={lang === 'en'} onClick={() => set('en')}>English</button>
      </div>
      <p className="mut">{lang === 'ja' ? `So the report is submitted in Japanese. You write the English first and translate it${jb ? `; the course asks for ${jb.min ?? 0}–${jb.max ?? ''} Japanese characters, which is ${(() => { const t = englishWordTarget(jb); return t ? `about ${t.min ?? ''}–${t.max ?? ''} English words` : ''; })()}` : ''}.`
        : lang === 'en' ? 'So the report is submitted in English and the translation steps are skipped.' : 'Not set yet. The draft prompt and the translation steps depend on it.'}</p>
    </div>
  );
}

const SOURCE_NOTE: Record<keyof ContextSources, string> = {
  gmail: 'Search your Gmail, including mail you sent yourself',
  drive: 'Search Drive for notes, transcripts and slides',
  mailspring: 'Read Mailspring (read only; the senders list applies)',
  past: 'Earlier submitted works, for style and structure',
};

/** Step 2. Choose sources, let the helper look, tick what to keep; or paste. */
export function ContextStep({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const flow = doc.flow ?? {};
  const [sources, setSources] = useState<ContextSources>({ ...DEFAULT_SOURCES, ...(flow.sources ?? {}) });
  const [hint, setHint] = useState(flow.hint ?? '');
  const [paste, setPaste] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const req = doc.contextRequest;
  const busy = req?.status === 'requested' || req?.status === 'working';
  const items = flow.contextItems ?? [];
  const merged = useRef('');
  // Newly found items join the list once, off by default unless the helper marked them on.
  useEffect(() => {
    if (req?.status !== 'ready' || !req.items) return;
    const key = `${req.at ?? ''}:${req.items.length}`;
    if (merged.current === key) return;
    merged.current = key;
    const have = new Set(items.map((i) => i.id));
    const fresh = req.items.filter((i) => !have.has(i.id));
    if (fresh.length) api.save(doc, { contextItems: [...items, ...fresh] });
    api.clearContext(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.status, req?.at]);
  const setItems = (next: ContextItem[]) => api.save(doc, { contextItems: next });
  const toggle = (id: string) => setItems(items.map((i) => (i.id === id ? { ...i, on: !i.on } : i)));
  const addPaste = () => {
    if (!paste.trim()) return;
    const id = `p${Date.now().toString(36)}`;
    setItems([...items, { id, source: 'paste', title: pasteTitle.trim() || 'Pasted note', text: paste.trim(), on: true }]);
    setPaste(''); setPasteTitle('');
  };
  const addFile = async (f: File | undefined) => {
    if (!f) return;
    const text = decodeText(await f.arrayBuffer()).trim();
    if (text) setItems([...items, { id: `f${Date.now().toString(36)}`, source: 'file', title: f.name, text: text.slice(0, 60000), on: true }]);
  };
  const on = chosenContext(flow);
  const needs = ownInputNeeds(doc.requirements);
  const missing = missingOwnInput(doc);
  const saveOwn = (need: string, text: string) => {
    const title = ownInputTitle(need);
    const rest = items.filter((i) => i.title !== title);
    setItems(text.trim() ? [...rest, { id: `own${need.length}${need.charCodeAt(0)}`, source: 'paste', title, text: text.trim(), on: true }] : rest);
  };
  const anySource = Object.values(sources).some(Boolean);
  return (
    <div className="fude-tools">
      {needs.length ? (
        <section className="panel fude-tool" aria-label="Needs you before drafting">
          <header className="fude-tool-head"><h3>Needs you before drafting</h3><p>{missing.length ? `${missing.length} of ${needs.length} still empty. These parts need something only you have; the draft will not invent them.` : 'All filled. They go into the draft prompt as your own words.'}</p></header>
          {needs.map((n) => {
            const have = items.find((i) => i.title === ownInputTitle(n));
            return (
              <label key={n} className="flow-own">
                <b>{n}</b>
                <textarea className="hw-answer" rows={3} autoCorrect="off" defaultValue={have?.text ?? ''} placeholder="Your own words: what you thought, what you felt, how it relates to your work."
                  onBlur={(e) => { if (e.target.value.trim() !== (have?.text ?? '')) saveOwn(n, e.target.value); }} />
              </label>
            );
          })}
        </section>
      ) : null}
      <section className="panel fude-tool" aria-label="Find context">
        <header className="fude-tool-head"><h3>Look for context</h3><p>Pick where to look. Nexo reads only; nothing is changed or sent.</p></header>
        <div className="flow-sources">
          {(Object.keys(SOURCE_NOTE) as (keyof ContextSources)[]).map((k) => (
            <label key={k} className="flow-check">
              <input type="checkbox" checked={sources[k]} onChange={() => setSources({ ...sources, [k]: !sources[k] })} />
              <span><b>{SOURCE_LABEL[k]}</b><small>{SOURCE_NOTE[k]}</small></span>
            </label>
          ))}
        </div>
        <input className="reply-input" aria-label="What to look for" placeholder="Anything that helps it find the right mail (optional)" value={hint} onChange={(e) => setHint(e.target.value)} />
        <div className="fude-tool-actions">
          {busy ? <span className="mut" role="status">Looking through your sources, about a minute…</span>
            : <button type="button" className="flow-primary" disabled={!anySource} onClick={() => api.askContext(doc, sources, hint)}>Check for context</button>}
        </div>
        {req?.status === 'error' ? <p className="fude-tool-warn" role="alert">{req.message ?? 'The search failed. Try again.'}</p> : null}
        {req?.status === 'ready' && !(req.items ?? []).length ? <p className="mut">Nothing relevant found in those sources.</p> : null}
      </section>
      {items.length ? (
        <section className="panel fude-tool" aria-label="Context found">
          <header className="fude-tool-head"><h3>{on.length} of {items.length} kept</h3><p>Tick what the report may rely on.</p></header>
          <ul className="flow-items">
            {items.map((i) => (
              <li key={i.id}>
                <label className="flow-check">
                  <input type="checkbox" checked={i.on} onChange={() => toggle(i.id)} />
                  <span><b>{i.unread ? 'Not read: ' : ''}{i.title}</b><small>{SOURCE_LABEL[i.source]}{i.from ? ` · ${i.from}` : ''}{i.date ? ` · ${i.date}` : ''}{i.why ? ` · ${i.why}` : ''}</small></span>
                </label>
                <details><summary>{i.text.length.toLocaleString('en-GB')} characters</summary><pre className="flow-pre">{i.text}</pre></details>
                {i.source === 'paste' || i.source === 'file' ? <button type="button" className="tool-chip" onClick={() => setItems(items.filter((x) => x.id !== i.id))}>Remove</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="panel fude-tool" aria-label="Add context yourself">
        <header className="fude-tool-head"><h3>Add your own</h3><p>Paste notes or a transcript, or pick a text file.</p></header>
        <input className="reply-input" aria-label="Title" placeholder="Title (for example: class transcript)" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
        <textarea className="hw-answer" rows={5} autoCorrect="off" placeholder="Paste here" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="fude-tool-actions">
          <button type="button" className="tool-chip" disabled={!paste.trim()} onClick={addPaste}>Add pasted text</button>
          <label className="tool-chip flow-file">Add a file (transcript, notes)<input type="file" accept=".txt,.md,.csv,.json,.tex,text/*" onChange={(e) => { void addFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {!items.length ? <button type="button" className={`tool-chip${flow.contextSkipped ? ' on' : ''}`} onClick={() => api.save(doc, { contextSkipped: !flow.contextSkipped })}>{flow.contextSkipped ? 'No context needed ✓' : 'No context needed'}</button> : null}
        </div>
      </section>
    </div>
  );
}

const promptInput = (doc: FudeDoc, me: string) => ({
  title: doc.title, request: doc.requirements ?? '', context: compileContext(doc.flow), research: doc.flow?.research ?? '',
  me: meBlock(me), due: dueText(doc.due), budget: doc.budget,
  style: doc.flow?.style, opinion: doc.flow?.opinion, submitLang: submitLang(doc.flow), jaBudget: jaBudgetOf(doc), ownNeeds: ownInputNeeds(doc.requirements),
});

/** Step 3 and 5: the two prompts. They are rebuilt from the saved fields every time, so they never go stale. */
export function PromptStep({ doc, api, kind }: { doc: FudeDoc; api: FlowApi; kind: 'research' | 'draft' }) {
  const blocked = !api.me.trim() ? 'Your standing description (ME.md) has not arrived from the helper yet, so the prompt would be missing it. Check that the Fude helper is running.'
    : !(doc.requirements ?? '').trim() ? 'Step 1 is empty. The prompt needs the assignment text.' : '';
  const text = blocked ? '' : kind === 'research' ? researchPrompt(promptInput(doc, api.me)) : draftPrompt(promptInput(doc, api.me));
  const ctx = chosenContext(doc.flow).length;
  return (
    <div className="fude-tools">
      {kind === 'draft' ? <DraftSettings doc={doc} api={api} /> : null}
      <CopyBox label={kind === 'research' ? 'Research prompt' : 'Draft prompt'} text={text} blocked={blocked}
        note={kind === 'research'
          ? `Uses the request, ${ctx ? `${ctx} context item${ctx === 1 ? '' : 's'}` : 'no context items'} and your standing description. Paste it into Perplexity (Pro Search, Academic).`
          : `Uses the request, your context and the research answer${doc.flow?.research?.trim() ? '' : ' (none pasted yet)'}. Paste it into GPT or any model, or skip this and write the draft yourself in the next step.`} />
    </div>
  );
}

/** Step 5: the style rules and his own opinion notes, both saved on the document and both placed in the draft prompt. */
function DraftSettings({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const [style, setStyle] = useState(styleFor(doc.flow?.style, doc.requirements ?? ''));
  const [opinion, setOpinion] = useState(doc.flow?.opinion ?? '');
  useEffect(() => { if (document.activeElement?.id !== 'flow-style') setStyle(styleFor(doc.flow?.style, doc.requirements ?? '')); }, [doc.flow?.style, doc.requirements]);
  useEffect(() => { if (document.activeElement?.id !== 'flow-opinion') setOpinion(doc.flow?.opinion ?? ''); }, [doc.flow?.opinion]);
  const custom = !!doc.flow?.style?.trim();
  return (
    <section className="panel fude-tool" aria-label="Draft settings">
      <details open={!custom}>
        <summary>Style rules{custom ? ' (yours)' : ' (the default for this kind of assignment)'}</summary>
        <textarea id="flow-style" className="hw-answer" rows={9} autoCorrect="off" value={style} onChange={(e) => setStyle(e.target.value)}
          onBlur={() => { if (style.trim() !== styleFor(doc.flow?.style, doc.requirements ?? '')) api.save(doc, { style: style.trim() }); }} />
        {custom ? <div className="fude-tool-actions"><button type="button" className="tool-chip" onClick={() => api.save(doc, { style: undefined })}>Back to the default</button></div> : null}
        <p className="mut">One rule per line. They go into the draft prompt.</p>
      </details>
      <label className="flow-field"><b>My opinion notes</b>
        <small>Your own views for the part that asks for your opinion. The draft may use them and may not add views of its own.</small>
        <textarea id="flow-opinion" className="hw-answer" rows={5} autoCorrect="off" value={opinion} placeholder="What struck you, what you would question, how it connects to your research"
          onChange={(e) => setOpinion(e.target.value)} onBlur={() => { if (opinion !== (doc.flow?.opinion ?? '')) api.save(doc, { opinion }); }} />
      </label>
    </section>
  );
}

/** Step 4. The Perplexity answer. Saved, and joined with the context into the fact sheet the reviewer checks claims against. */
export function AnswerStep({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const [txt, setTxt] = useState(doc.flow?.research ?? '');
  useEffect(() => { if (document.activeElement?.id !== 'flow-research') setTxt(doc.flow?.research ?? ''); }, [doc.flow?.research]);
  const save = () => {
    if (txt === (doc.flow?.research ?? '')) return;
    api.save(doc, { research: txt });
    api.facts(doc, factSheet({ ...(doc.flow ?? {}), research: txt }));
  };
  return (
    <section className="panel fude-tool" aria-label="Research answer">
      <textarea id="flow-research" className="hw-answer fude-tool-box" rows={14} autoCorrect="off" value={txt}
        placeholder="Paste Perplexity's whole answer, sources included." onChange={(e) => setTxt(e.target.value)} onBlur={save} />
      <div className="fude-tool-actions">
        <span className="fude-tool-count">{txt.length.toLocaleString('en-GB')} characters</span>
        <button type="button" className="tool-chip" disabled={txt === (doc.flow?.research ?? '')} onClick={save}>Save</button>
      </div>
      <p className="mut">Saved with your context as the fact sheet the writing check compares every sentence against.</p>
    </section>
  );
}

/** Step 9. The last look, and the one button that closes the card and keeps the final version. */
export function SubmitStep({ doc, api, text }: { doc: FudeDoc; api: FlowApi; text: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const flow = doc.flow ?? {};
  const ja = !flow.skipTranslation ? (doc.translationDraft ?? '').trim() : '';
  // A report submitted in Japanese is judged on the Japanese; the English draft cannot meet a Japanese length or language requirement.
  const checked = ja ? doc.assignmentCheckJa : doc.assignmentCheck;
  const items = checked?.status === 'ready' && checked.text === (ja || text) ? checked.items ?? [] : null;
  const unmet = items ? items.filter((i) => i.status !== 'met').length : null;
  const sc = doc.sourcesCheck?.status === 'ready' && doc.sourcesCheck.text === text ? doc.sourcesCheck.items ?? [] : null;
  const unresolved = sc ? unresolvedClaims(sc) : null;
  const jb = jaBudgetOf(doc);
  const jv = ja && jb ? lengthVerdict(ja, jb) : null;
  const overLimit = jv?.status === 'over';
  const checks: [string, boolean][] = [
    ['Text written', !!text.trim()],
    ['Checked against the assignment' + (ja ? ' (the Japanese)' : ''), !!items],
    ['Every requirement met', items ? unmet === 0 : false],
    [unresolved === null ? 'Claims checked against sources' : unresolved === 0 ? 'Claims checked against sources' : `Claims checked against sources: ${unresolved} not fully supported`, unresolved === 0],
    ['Checked the university\'s generative-AI rules for this course (disclosure, limits)', !!flow.aiRulesChecked],
    ...(!flow.skipTranslation ? [['Japanese pasted', !!ja] as [string, boolean], ['Japanese compared with the English', doc.translationCheck?.status === 'ready' && doc.translationCheck.japanese === ja] as [string, boolean], ...(jv ? [[`Japanese length ${jv.message}`, jv.status === 'ok'] as [string, boolean]] : [])] : []),
  ];
  const done = !!flow.submittedAt;
  const go = async () => {
    setBusy(true); setErr('');
    try { await api.submit(doc, { english: text.trim(), ...(ja ? { japanese: ja } : {}) }); } catch { setErr('Could not save. Check the connection and try again.'); }
    setBusy(false);
  };
  return (
    <section className="panel fude-tool" aria-label="Submit">
      <ul className="flow-checks">
        {checks.map(([label, ok]) => <li key={label} className={ok ? 'ok' : 'no'}><span aria-hidden="true">{ok ? '✓' : '○'}</span>{label}</li>)}
      </ul>
      {!flow.aiRulesChecked && !done ? <div className="fude-tool-actions"><button type="button" className="tool-chip" onClick={() => api.save(doc, { aiRulesChecked: true })}>I checked the generative-AI rules</button></div> : null}
      {unmet ? <p className="fude-tool-warn">{unmet} requirement{unmet === 1 ? ' is' : 's are'} not fully met. Go back to step {ja ? 9 : 6} to see which.</p> : null}
      {overLimit && !done ? <p className="fude-tool-warn" role="alert">Cannot mark submitted: the Japanese is over the limit. {jv?.message}</p> : null}
      {done ? (
        <>
          <p className="fude-tool-warn">Submitted {new Date(flow.submittedAt as string).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. The final version is kept for future similar works.</p>
          <div className="fude-tool-actions"><button type="button" className="tool-chip" onClick={() => api.reopen(doc)}>Undo: not submitted</button></div>
        </>
      ) : (
        <div className="fude-tool-actions">
          <button type="button" className="flow-primary" disabled={busy || !text.trim() || overLimit} onClick={() => { void go(); }}>{busy ? 'Saving…' : doc.cardId && api.canCloseCard ? 'Mark submitted and close the card' : 'Mark submitted'}</button>
        </div>
      )}
      {err ? <p className="fude-tool-warn" role="alert">{err}</p> : null}
      <details><summary>Final text ({text.trim().split(/\s+/).filter(Boolean).length} words)</summary><pre className="flow-pre">{text}</pre></details>
      {ja ? <><details><summary>Japanese ({jaChars(ja).toLocaleString('en-GB')} characters)</summary><pre className="flow-pre" lang="ja">{ja}</pre></details><p className="mut">{editorCounterNote}</p></> : null}
    </section>
  );
}

/** Step 7. The naturalizing pass: copy the prompt, paste what came back, see what changed, and take it or leave it. */
export function NaturalizeStep({ doc, api, text }: { doc: FudeDoc; api: FlowApi; text: string }) {
  const safe = doc.flow?.naturalizeSafe !== false;
  const prompt = naturalizePrompt(text, safe);
  const [back, setBack] = useState(doc.flow?.naturalized ?? '');
  useEffect(() => { if (document.activeElement?.id !== 'flow-naturalized') setBack(doc.flow?.naturalized ?? ''); }, [doc.flow?.naturalized]);
  const hunks = useMemo(() => (back.trim() ? diffWords(text, back.trim()) : []), [text, back]);
  const warns = back.trim() ? driftWarnings(text, back.trim()) : [];
  const done = !!doc.flow?.naturalizeDone;
  return (
    <div className="fude-tools">
      <CopyBox label="Naturalize prompt" text={prompt} blocked={text.trim() ? '' : 'The text is empty. Write or paste the draft in step 6 first.'}
        note={`The instruction is the one you use: "${NATURALIZE_HEAD}". Paste it into ChatGPT, then paste its answer below.`} />
      <label className="flow-check"><input type="checkbox" checked={safe} onChange={() => api.save(doc, { naturalizeSafe: !safe })} />
        <span><b>Add the safeguards</b><small>Keeps facts, numbers, headings, paragraphs, long sentences and term explanations from being changed.</small></span></label>
      <section className="panel fude-tool" aria-label="What came back">
        <textarea id="flow-naturalized" className="hw-answer fude-tool-box" rows={10} autoCorrect="off" value={back} placeholder="Paste the naturalized version here"
          onChange={(e) => setBack(e.target.value)} onBlur={() => { if (back !== (doc.flow?.naturalized ?? '')) api.save(doc, { naturalized: back }); }} />
        {back.trim() ? (<>
          <p className="mut">{hunks.length ? `${hunks.length} changes, about ${changedWords(hunks)} words. ${enWords(text)} words before, ${enWords(back)} now.` : 'Identical to your text.'}</p>
          {warns.length ? <ul className="flow-warns" role="alert">{warns.map((w) => <li key={w} className="fude-tool-warn">{w}</li>)}</ul> : hunks.length ? <p className="mut">No numbers, headings or paragraphs were changed.</p> : null}
          {hunks.length ? <details><summary>See the changes</summary><ul className="fude-hunks">{hunks.slice(0, 40).map((h) => <li key={h.id}>{h.removed ? <del className="fude-del">{h.removed.trim()}</del> : null}{h.added ? <ins className="fude-ins">{h.added.trim()}</ins> : null}</li>)}</ul></details> : null}
        </>) : null}
        <div className="fude-tool-actions">
          <button type="button" className="flow-primary" disabled={!back.trim() || !hunks.length} onClick={() => { api.replaceText(doc, back.trim()); api.save(doc, { naturalized: undefined, naturalizeDone: true }); }}>Use this version</button>
          <button type="button" className="tool-chip" onClick={() => api.save(doc, { naturalizeDone: !done })}>{done ? 'Done ✓ (tap to undo)' : 'Keep my text and continue'}</button>
        </div>
        <p className="mut">Using it keeps your earlier version in the Changes panel of step 6, where any change can be reverted.</p>
      </section>
    </div>
  );
}

/** Step 6: a pasted list of modifications applied to the text as a proposal. */
export function EditsBox({ doc, api, text }: { doc: FudeDoc; api: FlowApi; text: string }) {
  const [list, setList] = useState('');
  const req = doc.editRequest;
  const busy = req?.status === 'requested' || req?.status === 'working';
  const items = listItems(list);
  const ready = req?.status === 'ready' && req.text === text && typeof req.result === 'string';
  const result = ready ? (req?.result as string) : '';
  const hunks = useMemo(() => (ready ? diffWords(text, result) : []), [ready, text, result]);
  const warns = ready ? driftWarnings(text, result) : [];
  return (
    <section className="panel fude-tool" aria-label="Apply a list of changes">
      <header className="fude-tool-head"><h3>Apply a list of changes</h3><p>Paste your modifications, one per line. Nothing changes until you accept the result.</p></header>
      <textarea className="hw-answer" rows={7} autoCorrect="off" value={list} placeholder={'1. Call the teacher "the lecturer" instead of "he"\n2. Make this sentence easier to follow: ...\n3. Say "emphasized that" instead of "warned"'}
        onChange={(e) => setList(e.target.value)} />
      <div className="fude-tool-actions">
        <span className="fude-tool-count">{items.length} change{items.length === 1 ? '' : 's'}</span>
        {busy ? <span className="mut" role="status">Applying the changes…</span>
          : <button type="button" className="tool-chip" disabled={!items.length || !text.trim()} onClick={() => api.askEdits(doc, text, list.trim())}>Apply these changes</button>}
      </div>
      {req?.status === 'error' ? <p className="fude-tool-warn" role="alert">{req.message ?? 'That could not run. Try again.'}</p> : null}
      {req?.status === 'stale' || (req?.status === 'ready' && !ready) ? <p className="fude-tool-warn">The text changed while it was working. Apply the list again.</p> : null}
      {ready ? (<>
        <ul className="flow-edit-items" aria-label="What happened to each change">
          {(req?.items ?? []).map((i) => <li key={i.n} className={`edit-${i.status}`}><b>{EDIT_LABEL[i.status]}</b> {i.instruction}{i.note ? <small> {i.note}</small> : null}</li>)}
        </ul>
        <p className="mut">{hunks.length ? `${hunks.length} places changed, about ${changedWords(hunks)} words.` : 'The text is unchanged.'}</p>
        {warns.length ? <ul className="flow-warns" role="alert">{warns.map((w) => <li key={w} className="fude-tool-warn">{w}</li>)}</ul> : null}
        {hunks.length ? <details open><summary>See the changes</summary><ul className="fude-hunks">{hunks.slice(0, 40).map((h) => <li key={h.id}>{h.removed ? <del className="fude-del">{h.removed.trim()}</del> : null}{h.added ? <ins className="fude-ins">{h.added.trim()}</ins> : null}</li>)}</ul></details> : null}
        <div className="fude-tool-actions">
          <button type="button" className="flow-primary" disabled={!hunks.length} onClick={() => { api.replaceText(doc, result); api.clearEdits(doc); setList(''); }}>Use the revised text</button>
          <button type="button" className="tool-chip" onClick={() => api.clearEdits(doc)}>Discard</button>
        </div>
      </>) : null}
    </section>
  );
}

/** Step 8: the header lines the Japanese submission starts with, saved on the document and placed in the translation prompt. */
export function HeaderBox({ doc, api }: { doc: FudeDoc; api: FlowApi }) {
  const [h, setH] = useState(headerFor(doc.flow));
  useEffect(() => { if (document.activeElement?.id !== 'flow-header') setH(headerFor(doc.flow)); }, [doc.flow?.header]);
  const open = h.includes('〇〇') || h.includes('YYYY');
  return (
    <section className="panel fude-tool" aria-label="Header of the Japanese report">
      <header className="fude-tool-head"><h3>Header of the Japanese report</h3><p>Date and teacher, lecture title, your name and affiliation. Empty means no header.</p></header>
      <textarea id="flow-header" className="hw-answer" rows={5} lang="ja" autoCorrect="off" value={h} onChange={(e) => setH(e.target.value)} onBlur={() => { if (h !== headerFor(doc.flow)) api.save(doc, { header: h }); }} />
      {open ? <p className="fude-tool-warn">Fill in the parts marked 〇〇 and the date before you copy the prompt.</p> : null}
    </section>
  );
}

/** Step 9: two Japanese translations compared with the English. The merged text is a proposal he can take whole. */
export function CompareBox({ doc, api, text, ja, onUseMerged }: { doc: FudeDoc; api: FlowApi; text: string; ja: string; onUseMerged: (merged: string) => void }) {
  const [b, setB] = useState('');
  const req = doc.compareRequest;
  const busy = req?.status === 'requested' || req?.status === 'working';
  const budget = jaBudgetOf(doc);
  const ready = req?.status === 'ready' && req.english === text && req.a === ja && !!req.result;
  const r = req?.result;
  return (
    <section className="panel fude-tool" aria-label="Compare two translations">
      <header className="fude-tool-head"><h3>Compare with a second translation</h3><p>Your Japanese above is version A. Paste another one as B; both are checked against the English, sentence by sentence.</p></header>
      <textarea className="hw-answer" lang="ja" rows={6} autoCorrect="off" value={b} placeholder="ここに別の日本語訳（B）を貼り付け" onChange={(e) => setB(e.target.value)} />
      <div className="fude-tool-actions">
        <span className="fude-tool-count">B: {jaChars(b).toLocaleString('en-GB')} characters</span>
        {busy ? <span className="mut" role="status">Comparing the two…</span>
          : <button type="button" className="tool-chip" disabled={!b.trim() || !ja.trim() || !text.trim()} onClick={() => api.askCompare(doc, { english: text, a: ja, b: b.trim(), ...(budget ? { budget } : {}) })}>Compare A and B</button>}
      </div>
      {req?.status === 'error' ? <p className="fude-tool-warn" role="alert">{req.message ?? 'That could not run. Try again.'}</p> : null}
      {req?.status === 'stale' || (req?.status === 'ready' && !ready) ? <p className="fude-tool-warn">The English or version A changed. Compare again.</p> : null}
      {ready && r ? (<>
        <p>{r.summary}</p>
        <p className="mut">A {lengthVerdict(req?.a ?? '', budget).message} · B {lengthVerdict(req?.b ?? '', budget).message} · Merged {lengthVerdict(r.merged, budget).message}</p>
        <ul className="fude-notes" aria-label="Differences">
          {r.items.map((i) => (
            <li key={i.n}>
              <p><b>{i.kind}</b> · better: <b>{i.pick === 'a' ? 'A' : i.pick === 'b' ? 'B' : i.pick}</b></p>
              <p className="mut">English: “{i.english}”</p>
              <p lang="ja">A: {i.a}</p><p lang="ja">B: {i.b}</p>
              <p>{i.note}</p>
              {i.fix ? <p className="fude-fix" lang="ja">→ {i.fix}</p> : null}
            </li>
          ))}
        </ul>
        <details><summary>The merged version</summary><pre className="flow-pre" lang="ja">{r.merged}</pre></details>
        <div className="fude-tool-actions">
          <button type="button" className="tool-chip" onClick={() => onUseMerged(r.merged)}>Use the merged version as my Japanese</button>
          <button type="button" className="tool-chip" onClick={() => api.clearCompare(doc)}>Close</button>
        </div>
      </>) : null}
    </section>
  );
}

export function SkipTranslation({ doc, api, children }: { doc: FudeDoc; api: FlowApi; children: ReactNode }) {
  const skip = !!doc.flow?.skipTranslation;
  return (
    <div className="fude-tools">
      <div className="fude-tool-actions">
        <button type="button" className={`tool-chip${skip ? ' on' : ''}`} onClick={() => api.save(doc, { skipTranslation: !skip })}>{skip ? 'English only ✓ (tap to undo)' : 'This one is English only: skip translation'}</button>
      </div>
      {skip ? null : children}
    </div>
  );
}

export { firstOpenStep };

/** Step 9: the requirements judged on the Japanese that will be submitted, which is where length and language can actually be met. */
export function JaRequirementBox({ doc, api, ja }: { doc: FudeDoc; api: FlowApi; ja: string }) {
  const chk = doc.assignmentCheckJa;
  const busy = chk?.status === 'requested' || chk?.status === 'working';
  const items = chk?.status === 'ready' ? chk.items ?? [] : [];
  const t = tally(items);
  const outdated = chk?.status === 'ready' && chk.text !== ja.trim();
  return (
    <section className="panel fude-tool" aria-label="Requirements on the Japanese">
      <header className="fude-tool-head"><h3>{chk?.status === 'ready' ? `The Japanese against the assignment: ${t.met} of ${t.total} done` : 'Check the Japanese against the assignment'}</h3><p>Length and language are judged here, on the text that is submitted.</p></header>
      <div className="fude-tool-actions">
        {busy ? <span className="mut" role="status">Checking the Japanese against the assignment…</span>
          : <button type="button" className="tool-chip" disabled={!ja.trim() || !doc.requirements} onClick={() => api.askAssignmentCheckJa(doc, ja.trim())}>Check the Japanese</button>}
        {chk ? <button type="button" className="tool-chip" onClick={() => api.clearAssignmentCheckJa(doc)}>Close results</button> : null}
      </div>
      {chk?.status === 'error' ? <p className="fude-tool-warn" role="alert">{chk.message}</p> : null}
      {outdated ? <p className="fude-tool-warn">The Japanese changed after this check. Check again before you submit.</p> : null}
      {items.length ? (
        <ul className="fude-notes" aria-label="Requirements">
          {items.map((i, n) => (
            <li key={n} className={`sev-${i.status === 'met' ? 'info' : i.status === 'partial' ? 'warn' : 'error'}`}>
              <p><b>{STATUS_LABEL[i.status]}</b> {i.req}</p>
              {i.evidence ? <p className="mut">“{i.evidence}”</p> : null}
              {i.gap ? <p>{i.gap}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Step 6: every factual claim of the English against the fact sheet, with the quote that backs it. A claim with no quote is not supported. */
export function SourcesBox({ doc, api, text }: { doc: FudeDoc; api: FlowApi; text: string }) {
  const chk = doc.sourcesCheck;
  const busy = chk?.status === 'requested' || chk?.status === 'working';
  const items = chk?.status === 'ready' ? chk.items ?? [] : [];
  const outdated = chk?.status === 'ready' && chk.text !== text;
  return (
    <details className="panel hw-context" open={!!chk || undefined}>
      <summary>{chk?.status === 'ready' ? `Claims against sources: ${items.length - unresolvedClaims(items)} of ${items.length} supported` : 'Sources: check every claim against the fact sheet'}</summary>
      <div className="fude-tool-actions">
        {busy ? <span className="mut" role="status">Checking every claim against your sources…</span>
          : <button type="button" className="tool-chip" disabled={!text.trim() || !factSheet(doc.flow).trim() && !(doc.facts ?? '').trim()} onClick={() => api.askSourcesCheck(doc, text)}>Check claims against sources</button>}
        {chk ? <button type="button" className="tool-chip" onClick={() => api.clearSourcesCheck(doc)}>Close results</button> : null}
      </div>
      {chk?.status === 'error' ? <p className="fude-tool-warn" role="alert">{chk.message}</p> : null}
      {outdated ? <p className="fude-tool-warn">You changed the text after this check. Check again before you submit.</p> : null}
      {items.length ? (
        <ul className="fude-notes" aria-label="Claims">
          {items.map((i, n) => (
            <li key={n} className={`sev-${i.status === 'supported' ? 'info' : i.status === 'weak' ? 'warn' : 'error'}`}>
              <p><b>{CLAIM_LABEL[i.status]}</b> {i.claim}</p>
              {i.quote ? <p className="mut" lang="ja">“{i.quote}”</p> : null}
              {i.note ? <p>{i.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
