import { useEffect, useState } from 'react';
import { addAlloc, addMarketItem, addReceipt, attachFile, deleteReceipt, editAlloc, logPurchase, repeatAlloc, seedAllocMonth, toggleAlloc, undoPurchase, watchAllocations, watchMarket, watchReceiptFiles, watchReceipts } from './cards';
import { makeThumb, uploadToDrive } from './drive';
import { Money } from './Money';
import { PAYDAYS } from './money';
import { dismissAlloc, restoreAlloc } from './moneystore';
import { flash } from './toast';
import type { Alloc, Market, Receipt } from './types';

/** His Money screen, shown in Kaji's money tab. Every write goes through the sync outbox (cards.ts). */
export function OwnerMoney({ uid }: { uid: string }) {
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  useEffect(() => {
    const warn = (e: Error) => console.warn('[money]', e);
    const stops = [watchAllocations(uid, setAllocs, warn), watchMarket(uid, setMarket), watchReceipts(uid, setReceipts, warn)];
    return () => stops.forEach((x) => x());
  }, [uid]);
  return (
    <Money embedded paydays={PAYDAYS} allocations={allocs} onAdd={(a) => { void addAlloc(uid, a); }} onToggle={(a) => { void toggleAlloc(uid, a); }}
      onEdit={(a, c) => { void editAlloc(uid, a, c); }} onRepeat={(a) => { void repeatAlloc(uid, a); }} onSeed={(m) => { void seedAllocMonth(uid, m); }}
      market={market} receipts={receipts} onLog={(i) => { void logPurchase(uid, i); }} onAddItem={(n) => { void addMarketItem(uid, n); }} onReceipt={(r) => { void addReceipt(uid, r); }}
      onUndo={(id) => { if (market) void undoPurchase(uid, market, id); }} onDeleteReceipt={(r) => { void deleteReceipt(uid, r.id); flash('Receipt deleted'); }}
      watchPhotos={(id, on) => watchReceiptFiles(uid, id, on)}
      onDismiss={(a, sc) => { void dismissAlloc(uid, a, sc); flash(sc === 'month' ? `${a.label} dismissed for this month` : `${a.label} dismissed for good`); }}
      onRestore={(a) => { void restoreAlloc(uid, a); flash(`${a.label} restored`); }}
      onAttachReceipt={async (r, files) => { for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); await attachFile(uid, { receiptId: r.id }, up, thumb); } flash('Photo attached'); }} />
  );
}
