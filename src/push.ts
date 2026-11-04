import { doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, db } from './firebase';

/** The public Web Push key of the Firebase project. Public by design, like the rest of the web config. */
const VAPID = 'BGAZR4eDe4YzKziKe8eyvCamklI1ZnWhp2iZt8ZBnYBU1wuEkaQ8S0Ci0PNxHUkx-cSAT_wTAAnbpcmieCPV6h0';
const DEVICE_KEY = 'nexo-device-id';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'device'; }
}

export async function pushState(): Promise<PushState> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && localStorage.getItem(`${DEVICE_KEY}-on`) === '1' ? 'on' : 'off';
}

/** Ask permission, get this phone's push address and store it where the sync on his computer can find it. Run from a tap. */
export async function enablePush(uid: string): Promise<PushState> {
  if ((await pushState()) === 'unsupported') return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  if (!token) throw new Error('No push address was issued');
  const ua = navigator.userAgent.includes('Android') ? 'Android' : 'Browser';
  await setDoc(doc(db, 'users', uid, 'meta', 'push'), { devices: { [deviceId()]: { token, ua, at: new Date().toISOString() } } }, { merge: true });
  try { localStorage.setItem(`${DEVICE_KEY}-on`, '1'); } catch { /* ignore */ }
  return 'on';
}

/** Show a notification now through the service worker, to confirm this phone can display them. */
export async function testPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Notifications are on', { body: 'Nexo will tell you about questions, answers and urgent things.', tag: 'test', icon: 'icons/icon-192.png' });
}
