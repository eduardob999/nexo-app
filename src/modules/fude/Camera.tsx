import { useEffect, useRef, useState } from 'react';

interface Shot { file: File; url: string }

/**
 * A camera that stays open: take as many pages as you like in a row, then Done sends them all. The phone's own
 * camera picker (`capture`) returns after every photo, which is what this replaces. Uses the full-resolution still
 * (ImageCapture) where the browser has it, else a frame of the live video. Needs HTTPS and the camera permission.
 */
export function Camera({ onDone, onCancel }: { onDone: (files: File[]) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const shots = useRef<Shot[]>([]);
  const [list, setList] = useState<Shot[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser cannot open the camera here. Use Choose photos instead.'); return undefined; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false }).then((s) => {
      if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
      stream.current = s;
      if (video.current) { video.current.srcObject = s; void video.current.play().then(() => setReady(true), () => setReady(true)); }
    }, (e: unknown) => setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera permission was refused. Allow it in the browser settings, or use Choose photos.' : 'Could not open the camera. Use Choose photos instead.'));
    return () => { alive = false; stream.current?.getTracks().forEach((t) => t.stop()); shots.current.forEach((x) => URL.revokeObjectURL(x.url)); };
  }, []);

  const still = async (): Promise<Blob | null> => {
    const track = stream.current?.getVideoTracks()[0];
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
    if (track && IC) { try { return await new IC(track).takePhoto(); } catch { /* fall back to the video frame */ } }
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.92));
  };

  const shoot = async () => {
    const blob = await still();
    if (!blob) return;
    setFlash(true); window.setTimeout(() => setFlash(false), 120);
    try { navigator.vibrate?.(25); } catch { /* not everywhere */ }
    const file = new File([blob], `page-${Date.now()}-${shots.current.length + 1}.jpg`, { type: blob.type || 'image/jpeg' });
    const shot = { file, url: URL.createObjectURL(file) };
    shots.current = [...shots.current, shot];
    setList(shots.current);
  };

  const remove = (i: number) => { const x = shots.current[i]; if (x) URL.revokeObjectURL(x.url); shots.current = shots.current.filter((_, j) => j !== i); setList(shots.current); };

  return (
    <div className="cam" role="dialog" aria-label="Camera">
      <div className="cam-top">
        <button type="button" className="cam-btn" onClick={onCancel}>Cancel</button>
        <span className="cam-hint">{list.length ? `${list.length} photo${list.length > 1 ? 's' : ''}` : 'Keep the page flat and the text sharp'}</span>
      </div>
      {error ? <p className="cam-error" role="alert">{error}</p> : <video ref={video} className="cam-video" playsInline muted />}
      {flash ? <div className="cam-flash" /> : null}
      <div className="cam-bottom">
        <div className="cam-strip" aria-label="Photos taken">
          {list.map((x, i) => <button key={x.url} type="button" className="cam-thumb" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)}><img src={x.url} alt="" /></button>)}
        </div>
        <button type="button" className="cam-shutter" aria-label="Take photo" disabled={!ready || !!error} onClick={() => { void shoot(); }} />
        <button type="button" className="cam-btn cam-done" disabled={list.length === 0} onClick={() => onDone(shots.current.map((x) => x.file))}>Done{list.length ? ` (${list.length})` : ''}</button>
      </div>
    </div>
  );
}
