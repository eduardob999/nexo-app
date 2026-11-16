import { describe, expect, it } from 'vitest';
import { tally, type ReqItem } from './assignment';

const it1 = (status: ReqItem['status']): ReqItem => ({ req: 'x', status, evidence: '', gap: '' });

describe('tally', () => {
  it('counts met items', () => expect(tally([it1('met'), it1('partial'), it1('missing')])).toEqual({ met: 1, total: 3, done: false }));
  it('is done only when every item is met', () => expect(tally([it1('met'), it1('met')]).done).toBe(true));
  it('an empty list is not done', () => expect(tally([]).done).toBe(false));
});
