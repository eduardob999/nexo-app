import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './firebase';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Nexo attachments';
const TOKEN_KEY = 'nexo.drive.token';
const FOLDER_KEY = 'nexo.drive.folder';

interface Token { value: string; until: number }

function readToken(): Token | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Token;
    return t.until > Date.now() + 60_000 ? t : null;
  } catch { return null; }
}

const LINK_KEY = 'nexo.drive.linked';

function isLinked(): boolean {
  try { return localStorage.getItem(LINK_KEY) === '1'; } catch { return false; }
}
function setLinked(on: boolean): void {
  try { if (on) localStorage.setItem(LINK_KEY, '1'); else localStorage.removeItem(LINK_KEY); } catch { /* private window */ }
}

/**
 * True once Drive has been connected on this device, even when the hour-long token has lapsed, so the attach
 * buttons stay on screen and a new token is fetched when it is needed. It turns false again only when a
 * refresh fails, which is when the Connect button has to come back.
 */
export function driveReady(): boolean { return readToken() !== null || isLinked(); }

let inflight: Promise<string> | null = null;

/**
 * One Google popup for a fresh token. Google keeps the grant, and the account hint skips the account picker, so
 * after the first consent this opens and closes by itself. Needs a tap or a click in progress: browsers block popups otherwise.
 * Concurrent callers share the same popup.
 */
function refreshToken(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const provider = new GoogleAuthProvider();
    provider.addScope(SCOPE);
    if (user.email) provider.setCustomParameters({ login_hint: user.email });
    const result = await reauthenticateWithPopup(user, provider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new Error('Google did not give access to Drive');
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ value: token, until: Date.now() + 55 * 60_000 } satisfies Token)); } catch { /* private window */ }
    setLinked(true);
    return token;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** The Connect Google Drive button. */
export async function connectDrive(): Promise<void> { await refreshToken(); }

/** Start getting a new token now, from inside a tap, so the upload that follows finds it ready. Never throws. */
export function warmDrive(): void {
  if (isLinked() && readToken() === null) refreshToken().catch(() => setLinked(false));
}

/** A usable token: the stored one, or a fresh one when Drive was connected before. */
async function driveToken(): Promise<string> {
  const t = readToken();
  if (t) return t.value;
  if (!isLinked()) throw new Error('Connect Google Drive first');
  try { return await refreshToken(); } catch { setLinked(false); throw new Error('Google needs one tap: use Connect Google Drive'); }
}

async function api(url: string, init: RequestInit, token: string): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
  if (!res.ok) throw new Error(`Drive said ${res.status}`);
  return res;
}

async function folderId(token: string): Promise<string> {
  try { const cached = localStorage.getItem(FOLDER_KEY); if (cached) return cached; } catch { /* ignore */ }
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = (await (await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`, {}, token)).json()) as { files?: { id: string }[] };
  let id = found.files?.[0]?.id;
  if (!id) {
    const made = (await (await api('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    }, token)).json()) as { id: string };
    id = made.id;
  }
  try { localStorage.setItem(FOLDER_KEY, id); } catch { /* ignore */ }
  return id;
}

/** A small JPEG of an image for lists and the thread, or undefined for other file types. */
export async function makeThumb(file: File, max = 1024): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch { return undefined; }
}

export interface Uploaded { id: string; name: string; type: string; size: number; driveId: string; viewUrl: string }

/** Upload one file into the Nexo folder of his Drive. Throws if the token is missing or Drive refuses. */
export async function uploadToDrive(file: File): Promise<Uploaded> {
  const token = await driveToken();
  const folder = await folderId(token);
  const boundary = `nexo${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: file.name || 'attachment', parents: [folder] });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`, file, `\r\n--${boundary}--`]);
  const res = (await (await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  }, token)).json()) as { id: string; name: string; mimeType: string; size?: string; webViewLink?: string };
  return { id: `f${res.id.slice(0, 10)}`, name: res.name, type: res.mimeType, size: Number(res.size ?? file.size), driveId: res.id, viewUrl: res.webViewLink ?? `https://drive.google.com/file/d/${res.id}/view` };
}
