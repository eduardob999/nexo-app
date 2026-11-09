import { useEffect, useState } from 'react';
import { makeThumb, uploadToDrive } from '../../drive';
import type { ModuleProps } from '../types';
import { newDoc, type FudeDoc } from './documents';
import { newSet, type HomeworkSet } from './model';
import { Homework } from './Screen';
import { confirmProposal, createDocument, createSet, saveDocText, watchDocuments, dismissProposal, requestTranscription, saveAnswer, saveItems, savePhoto, watchHomework, watchThumbs } from './store';

export { fudeManifest } from './manifest';

/** The Fude module: homework sets today, whole-text documents next. It watches and saves by itself. */
export function FudeModule({ uid, openId }: ModuleProps) {
  const [sets, setSets] = useState<HomeworkSet[]>([]);
  const [docs, setDocs] = useState<FudeDoc[]>([]);
  useEffect(() => watchDocuments(uid, setDocs, (e) => console.warn('[fude docs]', e)), [uid]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => watchHomework(uid, setSets, (e) => console.warn('[fude]', e)), [uid]);
  useEffect(() => {
    if (!openId) { setThumbs({}); return undefined; }
    return watchThumbs(uid, openId, setThumbs);
  }, [uid, openId]);
  return (
    <Homework sets={sets} openId={openId} thumbs={thumbs} docs={docs}
      onCreateDoc={(title, profile, due) => { const d = newDoc(title, profile, new Date(), due); void createDocument(uid, d).then(() => { window.location.hash = `#/homework/${d.id}`; }); }}
      onSaveDoc={(d, text) => { void saveDocText(uid, d.id, text, new Date()); }}
      onCreate={(title, due) => { const s = newSet(title, new Date(), due); void createSet(uid, s).then(() => { window.location.hash = `#/homework/${s.id}`; }); }}
      onAddItem={(set, n, prompt) => { void saveItems(uid, set, [{ n, prompt }], new Date()); }}
      onAnswer={(set, item, text) => { void saveAnswer(uid, set.id, item, text, new Date()); }}
      onPhotos={async (set, files) => {
        for (const f of files) {
          let thumb = await makeThumb(f, 1600);
          if (thumb && thumb.length > 900_000) thumb = await makeThumb(f, 1200);
          const up = await uploadToDrive(f);
          await savePhoto(uid, set.id, up, thumb, new Date());
        }
      }}
      onRead={(set) => { void requestTranscription(uid, set.id, new Date()); }}
      onConfirm={(set, questions) => { void confirmProposal(uid, set, questions, new Date()); }}
      onDiscard={(set) => { void dismissProposal(uid, set.id); }} />
  );
}
