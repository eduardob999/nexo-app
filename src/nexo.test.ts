import { describe, expect, it } from 'vitest';
import { isHis, nexoSection } from './nexo';
import type { Card } from './types';

const now = new Date('2026-11-04T12:00:00+09:00');
const c = (extra: Partial<Card>): Card => ({ id: 'x', status: 'open', for: 'nexo', ...extra });
const nexoSaid = (text: string): Partial<Card> => ({ last: { by: 'nexo', text, ts: 'x' } });

describe('nexoSection', () => {
  it('is Nexo’s move when he wrote last', () => {
    expect(nexoSection(c({ last: { by: 'eduardo', text: 'do it', ts: 'x' }, ask: 'stale?' }), now)).toBe('nexo');
  });
  it('is waiting on him for an open ask or a question mark', () => {
    expect(nexoSection(c({ ask: 'A or B?', ...nexoSaid('hi') }), now)).toBe('you');
    expect(nexoSection(c(nexoSaid('Shall I book it?')), now)).toBe('you');
    expect(nexoSection(c(nexoSaid('どちらですか？')), now)).toBe('you');
  });
  it('should be closed when nothing is owed or the date has passed', () => {
    expect(nexoSection(c(nexoSaid('Done. Nothing is needed from you.')), now)).toBe('close');
    expect(nexoSection(c({ due: '2026-11-01', ...nexoSaid('booked') }), now)).toBe('close');
  });
  it('a question beats a passed date', () => {
    expect(nexoSection(c({ due: '2026-11-01', ...nexoSaid('Which one?') }), now)).toBe('you');
  });
  it('waits on something else for a future date or a waiting phrase', () => {
    expect(nexoSection(c({ due: '2026-11-10', ...nexoSaid('booked') }), now)).toBe('else');
    expect(nexoSection(c(nexoSaid('Waiting for the carrier to confirm')), now)).toBe('else');
  });
  it('otherwise it is Nexo’s move', () => {
    expect(nexoSection(c(nexoSaid('Looking into it')), now)).toBe('nexo');
  });
});

describe('isHis', () => {
  it('his lane is his; Nexo’s lane is his only with an open ask and Nexo last', () => {
    expect(isHis(c({ for: 'you' }))).toBe(true);
    expect(isHis(c({ ask: 'q?', ...nexoSaid('q?') }))).toBe(true);
    expect(isHis(c({ ask: 'q?', last: { by: 'eduardo', text: 'a', ts: 'x' } }))).toBe(false);
    expect(isHis(c({}))).toBe(false);
    expect(isHis(c({ for: 'you', status: 'done' }))).toBe(false);
  });
});
