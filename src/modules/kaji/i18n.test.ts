import { describe, expect, it } from 'vitest';
import { DICT, faces, t } from './i18n';

describe('i18n', () => {
  it('gives every language the same keys', () => {
    const base = Object.keys(DICT.en).sort();
    expect(Object.keys(DICT.es).sort()).toEqual(base);
    expect(Object.keys(DICT.ja).sort()).toEqual(base);
  });
  it('falls back to English for an unknown key and returns the key itself last', () => {
    expect(t('es', 'start')).toBe('Empezar');
    expect(t('ja', 'nope')).toBe('nope');
  });
  it('has five labels for every face scale in every language', () => {
    for (const l of ['en', 'es', 'ja'] as const) for (const k of ['facesHard', 'facesMind', 'facesLike'] as const) expect(faces(l, k)).toHaveLength(5);
  });
  it('has no em dash in any string', () => {
    for (const l of ['en', 'es', 'ja'] as const) for (const k of ['kaji', 'setupAbout', 'nothingToday', 'inviteAbout']) expect(t(l, k).includes('—')).toBe(false);
  });
});
