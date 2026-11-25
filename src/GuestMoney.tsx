import { useCallback, useEffect, useState } from 'react';
import { watchAllocations, watchMarket, watchReceiptFiles, watchReceipts } from './cards';
import { makeThumb, uploadToDrive } from './drive';
import { Money } from './Money';
import { guestMarket, guestMoney, watchShare } from './moneystore';
import { watchMyHousehold } from './modules/kaji/store';
import { flash } from './toast';
import type { Alloc, Market, Receipt } from './types';

/**
 * The Money screen for a household member, with every feature his has, on her own data (his request, 2026-11-25): set-aside
 * list, market, receipts with photos and charts, all under users/{her uid} and private to her. His market and household
 * receipts, read from the household copy, sit in their own fold to read only. `ownerName` names whose they are.
 */
export function GuestMoney({ uid, ownerName = 'Eduardo', embedded }: { uid: string; ownerName?: string; embedded?: boolean }) {
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [hid, setHid] = useState<string | null>(null);
  const [share, setShare] = useState<{ market: Market | null; receipts: Receipt[] }>({ market: null, receipts: [] });
  useEffect(() => {
    const warn = (e: Error) => console.warn('[money]', e);
    const stops = [watchAllocations(uid, setAllocs, warn), watchMarket(uid, setMarket), watchReceipts(uid, setReceipts, warn)];
    return () => stops.forEach((x) => x());
  }, [uid]);
  useEffect(() => watchMyHousehold(uid, (h) => setHid(h ?? null)), [uid]);
  useEffect(() => (hid ? watchShare(hid, setShare) : undefined), [hid]);
  const onSeed = useCallback((m: string) => { void guestMoney.seed(uid, allocs, m); }, [uid, allocs]);
  // No document yet means an empty list of her own, not a missing section.
  const mine: Market = { items: market?.items ?? [], log: market?.log ?? [] };
  return (
    <Money embedded={embedded} allocations={allocs} onAdd={(a) => { void guestMoney.add(uid, a); }} onToggle={(a) => { void guestMoney.toggle(uid, a); }}
      onEdit={(a, c) => { void guestMoney.edit(uid, a, c); }} onRepeat={(a) => { void guestMoney.repeat(uid, a); }} onSeed={onSeed}
      onDismiss={(a, sc) => { void guestMoney.dismiss(uid, a, sc); }} onRestore={(a) => { void guestMoney.restore(uid, a); }}
      market={mine} receipts={receipts} onLog={(i) => { void guestMarket.log(uid, i); }} onAddItem={(n) => { void guestMarket.addItem(uid, n); }}
      onUndo={(id) => { void guestMarket.undo(uid, mine, id); }} onReceipt={(r) => { void guestMarket.addReceipt(uid, r); }}
      onDeleteReceipt={(r) => { void guestMarket.deleteReceipt(uid, r.id); flash('Receipt deleted'); }}
      watchPhotos={(id, on) => watchReceiptFiles(uid, id, on)}
      onAttachReceipt={async (r, files) => { for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); await guestMarket.attach(uid, r.id, up, thumb); } flash('Photo attached'); }}
      shared={{ title: `${ownerName}'s market and receipts`, market: share.market, receipts: share.receipts }} />
  );
}
