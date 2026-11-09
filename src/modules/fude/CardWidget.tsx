import { useEffect, useRef, useState } from 'react';
import { Autosaver, type SaveState } from './autosave';
import type { CardLike } from './api';
import { openForCard } from './api';
import type { FudeDoc } from './documents';
import { progress, type HomeworkSet } from './model';
import { lintText, profileById } from './profiles';
import { saveDocText, watchLinked } from './store';

/**
 * The module's small interactive piece for a host screen: on an assignment card, either the button that starts the
 * work, or the work itself (an exercise set's progress, or the document's text, editable right there).
 */
export function FudeCardWidget({ uid, card }: { uid: string; card: CardLike }) {
  const [found, setFound] = useState<{ sets: HomeworkSet[]; docs: FudeDoc[] }>({ sets: [], docs: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => watchLinked(uid, card.id, setFound), [uid, card.id]);
  const d = found.docs[0];
  const s = found.sets[0];
  if (d) return <DocInline uid={uid} doc={d} />;
  if (s) {
    const p = progress(s);
    return (
      <section className="panel fude-widget" aria-label="Fude">
        <b>Fude</b>
        <span className="mut">{p.answered} of {p.total} answered</span>
        <a className="tool-chip" href={`#/homework/${s.id}`}>Open the set</a>
      </section>
    );
  }
  return (
    <section className="panel fude-widget" aria-label="Fude">
      <b>Fude</b>
      <span className="mut">Write it with a reviewer, on your phone.</span>
      <button type="button" className="tool-chip" disabled={busy} onClick={() => { setBusy(true); void openForCard(uid, card).finally(() => setBusy(false)); }}>Work on it</button>
    </section>
  );
}

function DocInline({ uid, doc }: { uid: string; doc: FudeDoc }) {
  const profile = profileById(doc.profile);
  const [text, setText] = useState(doc.text);
  const [state, setState] = useState<SaveState>('idle');
  const saver = useRef<Autosaver | null>(null);
  if (saver.current === null) saver.current = new Autosaver(doc.text, (t) => { void saveDocText(uid, doc.id, t, new Date()); }, setState, 900);
  useEffect(() => () => saver.current?.dispose(), []);
  useEffect(() => { if (document.activeElement?.id !== `fw-${doc.id}`) { setText(doc.text); saver.current?.adopt(doc.text); } }, [doc.text, doc.id]);
  const lint = lintText(text, profile, doc.budget ?? profile.budget);
  const n = lint.budget?.unit === 'chars' ? lint.chars : lint.words;
  return (
    <section className="panel fude-widget col" aria-label="Fude">
      <div className="fude-widget-head"><b>Fude</b><a className="tool-chip" href={`#/homework/${doc.id}`}>Open</a></div>
      <textarea id={`fw-${doc.id}`} className="hw-answer" rows={5} placeholder="Write here" value={text}
        onChange={(e) => { setText(e.target.value); saver.current?.change(e.target.value, (e.nativeEvent as InputEvent).isComposing === true); }}
        onCompositionStart={() => saver.current?.compositionStart()}
        onCompositionEnd={(e) => saver.current?.compositionEnd(e.currentTarget.value)}
        onBlur={() => saver.current?.blur()} />
      <div className="fude-counts"><span className={lint.over ? 'bad' : lint.under ? 'warn' : ''}>{n} {lint.budget?.unit ?? 'words'}{lint.budget ? ` of ${lint.budget.min ?? 0}–${lint.budget.max ?? '∞'}` : ''}</span>
        <span className={`hw-save ${state}`} aria-live="polite">{state === 'dirty' ? 'Typing…' : state === 'saved' ? 'Saved' : ''}</span></div>
    </section>
  );
}
