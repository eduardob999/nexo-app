import { describe, expect, it } from 'vitest';
import { chatState, outgoing, sortChat, type ChatMsg } from './chatlogic';

const m = (id: string, by: 'you' | 'nexo', ts: string, status?: ChatMsg['status']): ChatMsg => ({ id, by, text: id, ts, ...(status ? { status } : {}) });

describe('sortChat', () => {
  it('puts the oldest first without changing the input', () => {
    const input = [m('b', 'nexo', '2026-11-05T10:01:00Z'), m('a', 'you', '2026-11-05T10:00:00Z')];
    expect(sortChat(input).map((x) => x.id)).toEqual(['a', 'b']);
    expect(input[0]?.id).toBe('b');
  });
  it('breaks ties by id', () => {
    const t = '2026-11-05T10:00:00Z';
    expect(sortChat([m('2', 'you', t), m('10', 'nexo', t)]).map((x) => x.id)).toEqual(['2', '10']);
  });
});

describe('chatState', () => {
  it('is idle for an empty chat', () => expect(chatState([])).toBe('idle'));
  it('is thinking while his latest message is new or working', () => {
    expect(chatState([m('1', 'you', '2026-11-05T10:00:00Z', 'new')])).toBe('thinking');
    expect(chatState([m('1', 'you', '2026-11-05T10:00:00Z', 'working')])).toBe('thinking');
  });
  it('is idle once the latest of his messages is done', () => {
    expect(chatState([m('1', 'you', '2026-11-05T10:00:00Z', 'done'), m('2', 'nexo', '2026-11-05T10:00:05Z')])).toBe('idle');
  });
  it('reports an error on his latest message', () => {
    expect(chatState([m('1', 'you', '2026-11-05T10:00:00Z', 'error')])).toBe('error');
  });
  it('looks only at his latest message, not older ones', () => {
    expect(chatState([m('1', 'you', '2026-11-05T10:00:00Z', 'error'), m('2', 'you', '2026-11-05T10:05:00Z', 'done')])).toBe('idle');
  });
});

describe('outgoing', () => {
  it('rejects whitespace', () => { expect(outgoing('  \n ')).toBeNull(); });
  it('trims real text', () => { expect(outgoing('  hi ')).toBe('hi'); });
});
