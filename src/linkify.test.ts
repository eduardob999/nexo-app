import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('leaves plain text alone', () => {
    expect(linkify('no links here')).toEqual([{ kind: 'text', text: 'no links here' }]);
  });
  it('links a bare https address and keeps the full stop out of it', () => {
    expect(linkify('See https://example.org/a.')).toEqual([
      { kind: 'text', text: 'See ' }, { kind: 'link', text: 'https://example.org/a', href: 'https://example.org/a' }, { kind: 'text', text: '.' }]);
  });
  it('links a markdown link by its label', () => {
    expect(linkify('Open [the form](https://example.org/f) now')).toEqual([
      { kind: 'text', text: 'Open ' }, { kind: 'link', text: 'the form', href: 'https://example.org/f' }, { kind: 'text', text: ' now' }]);
  });
  it('never links http, javascript or other schemes', () => {
    expect(linkify('http://a.org javascript:alert(1) [x](javascript:alert(1))').every((s) => s.kind === 'text')).toBe(true);
  });
});
