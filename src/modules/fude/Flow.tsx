/** The screens of the assignment flow (flow.ts). Each step is one card; the editor and the checks of step 6 and 7-8 stay in Screen.tsx. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FudeDoc } from './documents';
import { decodeText, chosenContext, compileContext, DEFAULT_SOURCES, draftPrompt, factSheet, firstOpenStep, LAST_STEP, meBlock, researchPrompt, SOURCE_LABEL, STEPS, stepDone, type ContextItem, type ContextSources } from './flow';

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
    </section>
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
  const anySource = Object.values(sources).some(Boolean);
  return (
    <div className="fude-tools">
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
                  <span><b>{i.title}</b><small>{SOURCE_LABEL[i.source]}{i.from ? ` · ${i.from}` : ''}{i.date ? ` · ${i.date}` : ''}{i.why ? ` · ${i.why}` : ''}</small></span>
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
});

/** Step 3 and 5: the two prompts. They are rebuilt from the saved fields every time, so they never go stale. */
export function PromptStep({ doc, api, kind }: { doc: FudeDoc; api: FlowApi; kind: 'research' | 'draft' }) {
  const blocked = !api.me.trim() ? 'Your standing description (ME.md) has not arrived from the helper yet, so the prompt would be missing it. Check that the Fude helper is running.'
    : !(doc.requirements ?? '').trim() ? 'Step 1 is empty. The prompt needs the assignment text.' : '';
  const text = blocked ? '' : kind === 'research' ? researchPrompt(promptInput(doc, api.me)) : draftPrompt(promptInput(doc, api.me));
  const ctx = chosenContext(doc.flow).length;
  return (
    <div className="fude-tools">
      <CopyBox label={kind === 'research' ? 'Research prompt' : 'Draft prompt'} text={text} blocked={blocked}
        note={kind === 'research'
          ? `Uses the request, ${ctx ? `${ctx} context item${ctx === 1 ? '' : 's'}` : 'no context items'} and your standing description. Paste it into Perplexity (Pro Search, Academic).`
          : `Uses the request, your context and the research answer${doc.flow?.research?.trim() ? '' : ' (none pasted yet)'}. Paste it into GPT or any model, or skip this and write the draft yourself in the next step.`} />
    </div>
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
  const items = doc.assignmentCheck?.status === 'ready' && doc.assignmentCheck.text === text ? doc.assignmentCheck.items ?? [] : null;
  const unmet = items ? items.filter((i) => i.status !== 'met').length : null;
  const ja = !flow.skipTranslation ? (doc.translationDraft ?? '').trim() : '';
  const checks: [string, boolean][] = [
    ['Text written', !!text.trim()],
    ['Checked against the assignment', !!items],
    ['Every requirement met', items ? unmet === 0 : false],
    ...(!flow.skipTranslation ? [['Japanese pasted', !!ja] as [string, boolean], ['Japanese compared with the English', doc.translationCheck?.status === 'ready' && doc.translationCheck.japanese === ja] as [string, boolean]] : []),
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
      {unmet ? <p className="fude-tool-warn">{unmet} requirement{unmet === 1 ? ' is' : 's are'} not fully met. Go back to step 6 to see which.</p> : null}
      {done ? (
        <>
          <p className="fude-tool-warn">Submitted {new Date(flow.submittedAt as string).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. The final version is kept for future similar works.</p>
          <div className="fude-tool-actions"><button type="button" className="tool-chip" onClick={() => api.reopen(doc)}>Undo: not submitted</button></div>
        </>
      ) : (
        <div className="fude-tool-actions">
          <button type="button" className="flow-primary" disabled={busy || !text.trim()} onClick={() => { void go(); }}>{busy ? 'Saving…' : doc.cardId && api.canCloseCard ? 'Mark submitted and close the card' : 'Mark submitted'}</button>
        </div>
      )}
      {err ? <p className="fude-tool-warn" role="alert">{err}</p> : null}
      <details><summary>Final text ({text.trim().split(/\s+/).filter(Boolean).length} words)</summary><pre className="flow-pre">{text}</pre></details>
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
