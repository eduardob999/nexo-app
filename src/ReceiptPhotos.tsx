import { useEffect, useRef, useState } from 'react';
import { connectDrive, driveReady } from './drive';
import type { CardFile, Receipt } from './types';

interface Props {
  receipt: Receipt;
  /** Live pictures for this receipt (the document holds only names). */
  watch: (receiptId: string, on: (f: CardFile[]) => void) => () => void;
  /** Upload the picked files to Drive and record them on the receipt. */
  onAttach: (receipt: Receipt, files: File[]) => Promise<void>;
}

/** The photos on one receipt, and the way to add more: take one, choose some, or connect Drive first. */
export function ReceiptPhotos({ receipt, watch, onAttach }: Props) {
  const [pics, setPics] = useState<CardFile[]>([]);
  const [drive, setDrive] = useState(driveReady());
  const [busy, setBusy] = useState('');
  // The parent builds `watch` fresh on every render; the listener must follow the receipt, not that.
  const watchRef = useRef(watch);
  watchRef.current = watch;
  useEffect(() => watchRef.current(receipt.id, setPics), [receipt.id]);
  const names = receipt.files ?? [];
  const shown = names.map((f) => ({ ...f, thumb: pics.find((p) => p.id === f.id)?.thumb ?? f.thumb }));
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setBusy(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}`);
    onAttach(receipt, files).then(() => setBusy('Attached'), (e: unknown) => { setBusy(e instanceof Error ? e.message : 'Upload failed'); setDrive(driveReady()); });
  };
  return (
    <div className="rc-photos-wrap">
      {shown.length > 0 ? (
        <div className="rc-photos">
          {shown.map((f) => (
            <a key={f.id} href={f.viewUrl ?? f.thumb} target="_blank" rel="noreferrer" aria-label={f.name ?? 'Receipt photo'}>
              {f.thumb ? <img src={f.thumb} alt={f.name ?? 'Receipt photo'} /> : <span className="rc-file">{f.name ?? 'File'}</span>}
            </a>
          ))}
        </div>
      ) : null}
      <div className="draft-more">
        {drive ? (
          <>
            <label className="chip-btn small">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
            <label className="chip-btn small">Choose photos<input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
          </>
        ) : (
          <button type="button" className="chip-btn small" onClick={() => { setBusy('Opening Google'); connectDrive().then(() => { setDrive(true); setBusy(''); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not connect')); }}>Connect Google Drive</button>
        )}
      </div>
      {busy ? <p className="mut" role="status">{busy}</p> : null}
    </div>
  );
}
