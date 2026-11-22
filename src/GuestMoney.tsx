import { useCallback, useEffect, useState } from 'react';
import { watchAllocations } from './cards';
import { Money } from './Money';
import { guestMoney, watchShare } from './moneystore';
import { watchMyHousehold } from './modules/kaji/store';
import type { Alloc, Market, Receipt } from './types';

/**
 * The Money tab for a household member, laid out like his. His request, 2026-11-22: "The money tab in Carla's nexo should be a lot
 * more like mine, in fact we share a lot of things like the market so I would like that and the receipts to be [visible] to her."
 * Her set-aside list is her own (users/{her uid}/allocations, private to her); the market and the household receipts are his,
 * read from the household copy and shown to read only. `ownerName` names whose they are.
 */
export function GuestMoney({ uid, ownerName = 'Eduardo' }: { uid: string; ownerName?: string }) {
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [hid, setHid] = useState<string | null>(null);
  const [share, setShare] = useState<{ market: Market | null; receipts: Receipt[] }>({ market: null, receipts: [] });
  useEffect(() => watchAllocations(uid, setAllocs, (e) => console.warn('[money]', e)), [uid]);
  useEffect(() => watchMyHousehold(uid, setHid), [uid]);
  useEffect(() => (hid ? watchShare(hid, setShare) : undefined), [hid]);
  const onSeed = useCallback((m: string) => { void guestMoney.seed(uid, allocs, m); }, [uid, allocs]);
  return (
    <Money allocations={allocs} onAdd={(a) => { void guestMoney.add(uid, a); }} onToggle={(a) => { void guestMoney.toggle(uid, a); }}
      onEdit={(a, c) => { void guestMoney.edit(uid, a, c); }} onRepeat={(a) => { void guestMoney.repeat(uid, a); }} onSeed={onSeed}
      onDismiss={(a, sc) => { void guestMoney.dismiss(uid, a, sc); }} onRestore={(a) => { void guestMoney.restore(uid, a); }}
      market={share.market} receipts={share.receipts}
      sharedNote={`Market and receipts are ${ownerName}'s, shared with you to see. Your set-aside list above is yours alone.`} />
  );
}
