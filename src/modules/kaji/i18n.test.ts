import { describe, expect, it } from 'vitest';
import { DICT, faces, t } from './i18n';

describe('i18n (English only)', () => {
  it('has only English', () => {
    expect(Object.keys(DICT)).toEqual(['en']);
  });
  it('ignores the language argument and returns the key itself for an unknown key', () => {
    expect(t('en', 'start')).toBe('Start');
    expect(t('es', 'start')).toBe('Start');
    expect(t('ja', 'start')).toBe('Start');
    expect(t('en', 'nope')).toBe('nope');
  });
  it('has five labels for every face scale', () => {
    for (const k of ['facesHard', 'facesMind', 'facesLike'] as const) expect(faces('en', k)).toHaveLength(5);
  });
  it('has no em dash in any string', () => {
    for (const [k, v] of Object.entries(DICT.en)) expect(v.includes('—'), k).toBe(false);
  });
  it('has the Let Nexo pick label', () => {
    expect(t('en', 'letNexoPick')).toBe('Let Nexo pick');
  });
});
