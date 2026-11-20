import { useEffect, useState } from 'react';
import { watchHouseholdStrict, watchMyHouseholdStrict, type HouseholdDoc } from './modules/kaji/store';

/**
 * Which app a signed-in person gets. A person who belongs to a household as a plain member (Carla) gets the guest app: the household
 * and nothing else. Everyone else (the owner, and anyone with no household) gets the full app. Pure, so it can be tested.
 */
export type Role = 'guest' | 'owner' | 'unknown';

export function roleOf(uid: string, hid: string | null | undefined, house: HouseholdDoc | null | undefined, joining: boolean): Role {
  if (hid === undefined) return 'unknown';
  if (!hid) return joining ? 'guest' : 'owner';
  if (house === undefined) return 'unknown';
  if (!house) return 'owner';
  return house.members[uid] === 'member' ? 'guest' : 'owner';
}

const KEY = (uid: string) => `nexo-role:${uid}`;
function cached(uid: string): Role {
  try { const v = window.localStorage.getItem(KEY(uid)); return v === 'guest' || v === 'owner' ? v : 'unknown'; } catch { return 'unknown'; }
}

/** Resolves the role from Firestore, answers at once from the last answer saved on this device, and keeps that copy fresh. */
export function useRole(uid: string | null | undefined): Role {
  const joining = typeof window !== 'undefined' && window.location.hash.startsWith('#/kaji/join-');
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [house, setHouse] = useState<HouseholdDoc | null | undefined>(undefined);
  const [saved, setSaved] = useState<Role>(() => (uid ? cached(uid) : 'unknown'));
  useEffect(() => { if (uid) setSaved(cached(uid)); }, [uid]);
  const [retry, setRetry] = useState(0);
  // A failed read leaves the answer unknown and tries again in three seconds; it never turns into "no household".
  const again = () => { setHid(undefined); setHouse(undefined); window.setTimeout(() => setRetry((n) => n + 1), 3000); };
  useEffect(() => (uid ? watchMyHouseholdStrict(uid, setHid, again) : undefined), [uid, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hid) { setHouse(undefined); return undefined; }
    return watchHouseholdStrict(hid, setHouse, again);
  }, [hid, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = uid ? roleOf(uid, hid, hid ? house : null, joining) : 'unknown';
  useEffect(() => {
    if (uid && live !== 'unknown') { try { window.localStorage.setItem(KEY(uid), live); } catch { /* private mode */ } }
  }, [uid, live]);
  return live !== 'unknown' ? live : saved;
}
