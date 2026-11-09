import { ConfirmButton } from './ConfirmButton';
import { useState } from 'react';
import { useEffect } from 'react';
import { driveReady, connectDrive } from './drive';
import { attachableFiles, attachmentLabel, isImage, mentionsAttachment } from './draftfiles';
import type { Card, CardFile, Draft, DraftAttachment, NexoStatus } from './types';

interface Props {
  drafts: Draft[];
  /** Open this draft's text in Fude for a proofreading pass. */
  onFude?: ((draft: Draft) => void) | undefined;
  onCopied: (id: string) => void;
  onSent: (id: string) => void;
  onDiscard: (id: string) => void;
  onSend: (draft: Draft) => void;
  onEdit: (draft: Draft, text: string) => void;
  onRevise: (draft: Draft, instruction: string) => void;
  onAnswer: (draft: Draft, detail: string) => void;
  onMailCheck?: () => void;
  /** Open cards, for the linked card's file list. */
  cards?: Card[] | undefined;
  /** Live files of a card (thumbs live there). */
  watchPics?: ((cardId: string, on: (f: CardFile[]) => void) => () => void) | undefined;
  onAttachExisting?: ((draft: Draft, file: CardFile) => void) | undefined;
  onDetach?: ((draft: Draft, fileId: string) => void) | undefined;
  /** Uploads to Drive, puts the files on the linked card and attaches them to the draft. */
  onUpload?: ((draft: Draft, files: File[]) => Promise<void>) | undefined;
  nexo?: NexoStatus | null | undefined;
}

/** Clipboard first; the textarea fallback covers browsers that refuse the async API on a plain page. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function CopyChip({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="chip-btn small" onClick={() => { void copyText(text).then((ok) => setDone(ok)); }}>
      {done ? 'Copied' : label}
    </button>
  );
}

const SEND_VALID_MS = 6 * 3600_000;

function hhmm(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
}

function dayHm(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const today = d.toDateString() === new Date().toDateString();
  return today ? hhmm(iso) : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${hhmm(iso)}`;
}

function SentLine({ draft }: { onFude?: ((draft: Draft) => void) | undefined; draft: Draft }) {
  const to = (draft.to ?? []).join(', ');
  const names = (draft.attachments ?? []).map((f) => f.name).join(', ');
  return (
    <li className="draft sent-line">
      <span className="who">SENT · {dayHm(draft.sentAt)}{draft.sentVia === 'elsewhere' ? ' · by you, elsewhere' : ''}</span>
      <span>{draft.subject ?? draft.topic ?? draft.id}{to ? ` to ${to}` : ''}</span>
      {names ? <span className="mut">Attached: {names}</span> : null}
    </li>
  );
}

function Attachments({ draft, card, watchPics, onAttachExisting, onDetach, onUpload }: { draft: Draft; card?: Card | undefined } & Pick<Props, 'watchPics' | 'onAttachExisting' | 'onDetach' | 'onUpload'>) {
  const [pane, setPane] = useState(false);
  const [busy, setBusy] = useState('');
  const [drive, setDrive] = useState(driveReady());
  const [pics, setPics] = useState<CardFile[]>([]);
  const list = draft.attachments ?? [];
  const live = Boolean(draft.linkedNote) && (list.length > 0 || pane);
  useEffect(() => {
    if (!live || !watchPics || !draft.linkedNote) return undefined;
    return watchPics(draft.linkedNote, setPics);
  }, [live, watchPics, draft.linkedNote]);
  const thumbOf = (f: DraftAttachment) => pics.find((p) => p.id === f.id)?.thumb;
  const options = attachableFiles(card?.files, list);
  const pick = (fl: FileList | null) => {
    const files = Array.from(fl ?? []);
    if (files.length === 0 || !onUpload) return;
    setBusy(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}`);
    onUpload(draft, files).then(() => { setBusy(''); setPane(false); }, (e: unknown) => { setBusy(e instanceof Error ? e.message : 'Upload failed'); setDrive(driveReady()); });
  };
  const canAttach = Boolean(draft.linkedNote && onUpload);
  return (
    <div className="d-attach">
      {list.length > 0 ? (
        <ul className="d-files" aria-label="Attachments">
          {list.map((f) => {
            const t = thumbOf(f);
            const body = t && isImage(f) ? <img src={t} alt={f.name} /> : <span className="d-ico" aria-hidden="true">{(f.type ?? '').includes('pdf') ? 'PDF' : 'FILE'}</span>;
            return (
              <li key={f.id} className="d-file">
                {f.viewUrl ? <a className="d-thumb" href={f.viewUrl} target="_blank" rel="noreferrer">{body}</a> : <span className="d-thumb">{body}</span>}
                <span className="d-name">{f.name}</span>
                {onDetach ? <ConfirmButton label="x" armedLabel="Remove?" ariaLabel={`Remove ${f.name}`} className="chip-btn small d-x" onConfirm={() => onDetach(draft, f.id)} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {canAttach ? <button type="button" className="chip-btn small" onClick={() => setPane((p) => !p)}>{pane ? 'Close' : 'Attach'}</button> : null}
      {pane ? (
        <section className="join-pane" aria-label="Attach to this draft">
          {options.length > 0 ? (
            <ul className="d-opts">
              {options.map((f) => (
                <li key={f.id}>
                  <button type="button" className="chip-btn small" onClick={() => onAttachExisting?.(draft, f)}>Attach {f.name ?? 'file'}</button>
                </li>
              ))}
            </ul>
          ) : <p className="mut">No other files on the linked card.</p>}
          {drive ? (
            <>
              <label className="chip-btn">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} /></label>
              <label className="chip-btn">Choose photos or files<input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => pick(e.target.files)} /></label>
            </>
          ) : (
            <button type="button" className="act-ink" onClick={() => { setBusy('Opening Google'); connectDrive().then(() => { setDrive(true); setBusy(''); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not connect')); }}>Connect Google Drive</button>
          )}
          {busy ? <p className="mut" role="status">{busy}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function DraftCard({ onFude, draft, onCopied, onSent, onDiscard, onSend, onEdit, onRevise, onAnswer, cards, watchPics, onAttachExisting, onDetach, onUpload }: { draft: Draft } & Omit<Props, 'drafts'>) {
  const card = cards?.find((c) => c.id === draft.linkedNote);
  const attachProps = { draft, card, watchPics, onAttachExisting, onDetach, onUpload };
  const nAtt = (draft.attachments ?? []).length;
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'revise'>('view');
  const [box, setBox] = useState('');
  const revising = Boolean(draft.revise?.at);
  const open = (m: 'edit' | 'revise') => { setBox(m === 'edit' && draft.status !== 'needs-info' ? (draft.text ?? '') : ''); setMode(m); };
  const done = () => { setMode('view'); setBox(''); };
  const [armed, setArmed] = useState(false);
  const requested = draft.sendRequestedAt && Date.now() - Date.parse(draft.sendRequestedAt) < SEND_VALID_MS;
  const arm = () => {
    if (!armed) {
      setArmed(true);
      window.setTimeout(() => setArmed(false), 6000);
      return;
    }
    setArmed(false);
    onSend(draft);
  };
  const body = draft.text ?? '';
  const to = (draft.to ?? []).join(', ');
  const copy = () => {
    void copyText(body).then((ok) => {
      if (!ok) return;
      setFlash(true);
      onCopied(draft.id);
    });
  };
  return (
    <li className="draft">
      <div className="draft-head">
        <div>
          {to ? <span className="who">TO · {to}</span> : null}
          {draft.contact && draft.contact !== to ? <span className="who">REPLY TO · {draft.contact}</span> : null}
          <h2 className="draft-title">{draft.subject ?? draft.topic ?? draft.id}</h2>
        </div>
        {flash || draft.copiedAt ? <span className="pill-ok">COPIED</span> : null}
      </div>
      {draft.editedAt ? <p className="d-sends">Edited by you {dayHm(draft.editedAt)}</p> : null}
      {draft.revisedAt && !revising ? <p className="d-sends">Revised by Nexo {dayHm(draft.revisedAt)}</p> : null}
      {draft.status === 'needs-info' && draft.answeredAt ? <p className="d-sends">You answered {dayHm(draft.answeredAt)}, Nexo redrafts it next</p> : null}
      {revising ? (
        <p className="revise-wait">Waiting for Nexo to revise since {hhmm(draft.revise?.at)}: “{draft.revise?.text}”</p>
      ) : null}
      {mode === 'edit' ? (
        <div className="editor">
          {draft.status === 'needs-info' ? <p className="need">Needs from you: {draft.need ?? 'more information'}</p> : null}
          <label className="sr" htmlFor={`ed-${draft.id}`}>Draft text</label>
          <textarea id={`ed-${draft.id}`} className="relay-answer" rows={Math.min(14, Math.max(5, box.split('\n').length + 1))} value={box} autoFocus
            placeholder={draft.status === 'needs-info' ? 'Write the reply yourself, or just the missing detail' : 'The text Copy and Send will use'}
            onChange={(e) => setBox(e.target.value)} />
          <div className="draft-actions">
            <button className="copy-main alt" disabled={!box.trim()} onClick={() => { onEdit(draft, box.trim()); done(); }}>
              {draft.status === 'needs-info' ? 'Use as reply' : 'Save'}
            </button>
            <button className="chip-btn" onClick={done}>Cancel</button>
          </div>
          {draft.status === 'needs-info' && draft.linkedNote ? (
            <button className="chip-btn small" disabled={!box.trim()} onClick={() => { onAnswer(draft, box.trim()); done(); }}>Answer for Nexo instead</button>
          ) : null}
        </div>
      ) : mode === 'revise' ? (
        <div className="editor">
          <div className="draft-body">{body}</div>
          <label className="sr" htmlFor={`rv-${draft.id}`}>What to change</label>
          <textarea id={`rv-${draft.id}`} className="relay-answer" rows={3} value={box} autoFocus
            placeholder="What to change. For example: shorter, mention Thursday, drop the apology" onChange={(e) => setBox(e.target.value)} />
          <div className="draft-actions">
            <button className="copy-main alt" disabled={!box.trim()} onClick={() => { onRevise(draft, box.trim()); done(); }}>Ask Nexo to revise</button>
            <button className="chip-btn" onClick={done}>Cancel</button>
          </div>
        </div>
      ) : draft.status === 'needs-info' ? (
        <>
          <p className="need">Needs from you: {draft.need ?? 'more information'}</p>
          <Attachments {...attachProps} />
          <div className="draft-more">
            <button className="chip-btn small" onClick={() => open('edit')}>Write it</button>
            <ConfirmButton label="Discard" onConfirm={() => onDiscard(draft.id)} />
          </div>
        </>
      ) : (
        <>
          <div className="draft-body">{body}</div>
          <Attachments {...attachProps} />
          {nAtt > 0 ? <p className="d-sends">{attachmentLabel(nAtt)}</p> : mentionsAttachment(body) ? <p className="d-warn">The text mentions an attachment but none is attached.</p> : null}
          {requested ? (
            <p className="send-wait">Send requested {hhmm(draft.sendRequestedAt)}. Nexo sends it on its next run; press Call Nexo to hurry it.</p>
          ) : revising ? null : (
            <button className={`send-main ${armed ? 'armed' : ''}`} onClick={arm}>
              {armed ? 'Tap again to send' : 'Send'}
            </button>
          )}
          {armed ? <p className="send-confirm">{to ? `To ${to}` : 'No address on this draft'}{draft.subject ? ` · ${draft.subject}` : ''}</p> : null}
          <div className="draft-actions">
            <button className="copy-main alt" onClick={copy}>{flash || draft.copiedAt ? 'Copy again' : 'Copy'}</button>
            <button className="chip-btn" onClick={() => onSent(draft.id)}>I sent it</button>
          </div>
          <div className="draft-more">
            {revising ? null : <button className="chip-btn small" onClick={() => open('edit')}>Edit</button>}
            {revising || !onFude || !draft.text ? null : <button className="chip-btn small" onClick={() => onFude(draft)}>Edit in Fude</button>}
            {revising ? null : <button className="chip-btn small" onClick={() => open('revise')}>Ask Nexo to revise</button>}
            {draft.subject ? <CopyChip label="Copy subject" text={draft.subject} /> : null}
            {to ? <CopyChip label="Copy address" text={to} /> : null}
            {draft.contact && draft.contact !== to ? <CopyChip label="Copy reply-to" text={draft.contact} /> : null}
            <ConfirmButton label="Discard" onConfirm={() => onDiscard(draft.id)} />
          </div>
        </>
      )}
    </li>
  );
}

export function Drafts({ onFude, drafts, onCopied, onSent, onDiscard, onSend, onEdit, onRevise, onAnswer, onMailCheck, nexo, cards, watchPics, onAttachExisting, onDetach, onUpload }: Props) {
  const [asked, setAsked] = useState(0);
  const pending = Boolean(nexo?.mailCheckSince) || Date.now() - asked < 60_000;
  const waiting = drafts.filter((d) => d.status !== 'sent');
  const dayAgo = Date.now() - 24 * 3600_000;
  const sent = drafts.filter((d) => d.status === 'sent' && Date.parse(d.sentAt ?? '') > dayAgo);
  const earlier = drafts.filter((d) => d.status === 'sent' && !(Date.parse(d.sentAt ?? '') > dayAgo)).sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">READY TO SEND</span>
          <h1>Drafts</h1>
        </div>
      </header>
      {onMailCheck ? (
        <div className="mailbar">
          <button className="chip-btn" disabled={pending} onClick={() => { setAsked(Date.now()); onMailCheck(); }}>
            {pending ? 'Mail check requested' : 'Check my mail now'}
          </button>
          <span className="mut">{pending ? `since ${hhmm(nexo?.mailCheckSince ?? new Date(asked).toISOString())}, waiting for Nexo` : 'Drafts replies; sends nothing'}</span>
        </div>
      ) : null}
      {waiting.length === 0 ? <p className="empty">No drafts waiting.</p> : null}
      <ul className="drafts">
        {waiting.map((d) => <DraftCard key={d.id} onFude={onFude} draft={d} onCopied={onCopied} onSent={onSent} onDiscard={onDiscard} onSend={onSend} onEdit={onEdit} onRevise={onRevise} onAnswer={onAnswer} cards={cards} watchPics={watchPics} onAttachExisting={onAttachExisting} onDetach={onDetach} onUpload={onUpload} />)}
        {sent.map((d) => <SentLine key={d.id} draft={d} />)}
      </ul>
      {earlier.length > 0 ? (
        <details className="shelf-fold"><summary>Sent earlier <span className="mut">{earlier.length}</span></summary>
          <ul className="drafts">{earlier.slice(0, 60).map((d) => <SentLine key={d.id} draft={d} />)}</ul>
        </details>
      ) : null}
    </main>
  );
}
