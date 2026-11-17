import { useEffect, useState } from 'react';
import { makeThumb, uploadToDrive } from '../../drive';
import type { ModuleProps } from '../types';
import { newDoc, type FudeDoc, type Note } from './documents';
import { newSet, type ChatMsg, type ExportRec, type HomeworkSet } from './model';
import { Homework } from './Screen';
import type { FlowApi } from './Flow';
import { confirmProposal, createDocument, createSet, requestCheck, requestExport, requestReview, requestSelection, clearSelection, sendChat, watchChat, watchExports, saveContext, saveDocFacts, requestTranslation, clearTranslation, saveTranslationDraft, saveDocRequirements, requestAssignmentCheck, clearAssignmentCheck, requestTranslationCheck, clearTranslationCheck, saveDocText, setDocMode, setDocBase, saveFlow, requestEdits, clearEdits, requestCompare, clearCompare, requestContext, clearContextRequest, saveSubmission, reopenSubmission, watchMe, setNoteStatus, watchDocuments, watchNotes, dismissProposal, requestTranscription, saveAnswer, saveItems, savePhoto, watchHomework, watchThumbs } from './store';

export { fudeManifest } from './manifest';
export { openForCard, openForDraft } from './api';
export { FudeCardWidget } from './CardWidget';

/** The Fude module: homework sets today, whole-text documents next. It watches and saves by itself. */
export function FudeModule({ uid, openId, host }: ModuleProps) {
  const [sets, setSets] = useState<HomeworkSet[]>([]);
  const [docs, setDocs] = useState<FudeDoc[]>([]);
  useEffect(() => watchDocuments(uid, setDocs, (e) => console.warn('[fude docs]', e)), [uid]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const openSet = openId?.startsWith('hw') ? openId : undefined;
  useEffect(() => {
    if (!openSet) { setChat([]); return undefined; }
    return watchChat(uid, openSet, setChat);
  }, [uid, openSet]);
  const [exports, setExports] = useState<ExportRec[]>([]);
  useEffect(() => {
    if (!openSet) { setExports([]); return undefined; }
    return watchExports(uid, openSet, setExports);
  }, [uid, openSet]);
  const [notes, setNotes] = useState<Note[]>([]);
  const openDoc = openId?.startsWith('fd') ? openId : undefined;
  useEffect(() => {
    if (!openDoc) { setNotes([]); return undefined; }
    return watchNotes(uid, openDoc, setNotes);
  }, [uid, openDoc]);
  const [me, setMe] = useState('');
  useEffect(() => watchMe(uid, setMe), [uid]);
  const flowApi: FlowApi = {
    me, canCloseCard: !!host?.markCardDone,
    save: (d, patch) => { void saveFlow(uid, d.id, patch); },
    facts: (d, facts) => { void saveDocFacts(uid, d.id, facts); },
    requirements: (d, r) => { void saveDocRequirements(uid, d.id, r); },
    askContext: (d, sources, hint) => { void requestContext(uid, d.id, sources, hint); },
    clearContext: (d) => { void clearContextRequest(uid, d.id); },
    submit: async (d, final) => { await saveSubmission(uid, d.id, final, new Date()); if (d.cardId && host?.markCardDone) await host.markCardDone(d.cardId); },
    reopen: (d) => { void reopenSubmission(uid, d.id); },
    // Keep the old text as the version the Changes panel compares against, unless he is already tracking from an earlier one.
    replaceText: (d, text) => { void (d.base === undefined ? setDocBase(uid, d.id, d.text) : Promise.resolve()).then(() => saveDocText(uid, d.id, text, new Date())); },
    askEdits: (d, text, instructions) => { void requestEdits(uid, d.id, text, instructions); },
    clearEdits: (d) => { void clearEdits(uid, d.id); },
    askCompare: (d, req) => { void requestCompare(uid, d.id, req); },
    clearCompare: (d) => { void clearCompare(uid, d.id); },
  };
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => watchHomework(uid, setSets, (e) => console.warn('[fude]', e)), [uid]);
  useEffect(() => {
    if (!openId) { setThumbs({}); return undefined; }
    return watchThumbs(uid, openId, setThumbs);
  }, [uid, openId]);
  return (
    <Homework flowApi={flowApi} sets={sets} openId={openId} thumbs={thumbs} docs={docs}
      onCreateDoc={(title, profile, due, mode) => { const d = newDoc(title, profile, new Date(), due, mode); void createDocument(uid, d).then(() => { window.location.hash = `#/homework/${d.id}`; }); }}
      onSaveDoc={(d, text) => { void saveDocText(uid, d.id, text, new Date()); }}
      onFactsDoc={(d, facts) => { void saveDocFacts(uid, d.id, facts); }}
      onModeDoc={(d, mode) => { void setDocMode(uid, d.id, mode, new Date()); }}
      exports={exports}
      onExport={(set, fmt, instructions, exportId) => { void requestExport(uid, set.id, fmt, instructions, exportId); }}
      chat={chat}
      onChat={(set, text, n, deep) => { void sendChat(uid, set.id, text, n, deep, new Date()); }}
      notes={notes}
      {...(host?.sendBackDraft ? { onSendBackDraft: host.sendBackDraft } : {})}
      onReviewDoc={(d, profile, auto) => { void requestReview(uid, d.id, profile, new Date(), auto === true); }}
      onSelection={(d, mode, text, question, profile) => { void requestSelection(uid, d.id, mode, text, question, profile); }}
      onClearSelection={(d) => { void clearSelection(uid, d.id); }}
      onRequirements={(d, r) => { void saveDocRequirements(uid, d.id, r); }}
      onAssignmentCheck={(d, text) => { void requestAssignmentCheck(uid, d.id, text); }}
      onClearAssignmentCheck={(d) => { void clearAssignmentCheck(uid, d.id); }}
      onTranslate={(d, text) => { void requestTranslation(uid, d.id, text); }}
      onClearTranslate={(d) => { void clearTranslation(uid, d.id); }}
      onSaveTranslation={(d, ja) => { void saveTranslationDraft(uid, d.id, ja); }}
      onCheckTranslation={(d, en, ja) => { void requestTranslationCheck(uid, d.id, en, ja); }}
      onClearTranslationCheck={(d) => { void clearTranslationCheck(uid, d.id); }}
      onNoteStatus={(d, n, status) => { void setNoteStatus(uid, d.id, n.id, status); }}
      onBase={(d, base) => { void setDocBase(uid, d.id, base); }}
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
      onDiscard={(set) => { void dismissProposal(uid, set.id); }}
      onCheck={(set, item, mode) => { void requestCheck(uid, set.id, item, mode); }}
      onContext={(set, text) => { void saveContext(uid, set.id, text); }} />
  );
}
