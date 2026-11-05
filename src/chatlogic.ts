export type ChatStatus = 'new' | 'working' | 'done' | 'error';

export interface ChatMsg {
  id: string;
  by: 'you' | 'nexo';
  text: string;
  ts: string;
  status?: ChatStatus;
  route?: 'answer' | 'act' | 'call';
  did?: string[];
}

/** Oldest first, newest at the bottom. Messages with the same time keep their id order so the list does not shuffle. */
export function sortChat(msgs: ChatMsg[]): ChatMsg[] {
  return [...msgs].sort((a, b) => {
    const t = Date.parse(a.ts) - Date.parse(b.ts);
    if (Number.isNaN(t) || t === 0) return a.id.localeCompare(b.id, undefined, { numeric: true });
    return t;
  });
}

/** What the typing area should show, decided from his latest message. */
export function chatState(msgs: ChatMsg[]): 'thinking' | 'error' | 'idle' {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i] as ChatMsg;
    if (m.by !== 'you') continue;
    if (m.status === 'new' || m.status === 'working') return 'thinking';
    if (m.status === 'error') return 'error';
    return 'idle';
  }
  return 'idle';
}

/** The text to send, or null when there is nothing worth sending. */
export function outgoing(text: string): string | null {
  const t = text.trim();
  return t ? t : null;
}

export const CHAT_SUGGESTIONS = ['What is left today?', 'Add a task: ', 'When do I need to leave tomorrow?'] as const;
