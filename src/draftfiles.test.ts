import { describe, expect, it } from 'vitest';
import { attachableFiles, attachmentLabel, mentionsAttachment } from './draftfiles';

describe('mentionsAttachment', () => {
  it('spots the usual wording', () => {
    expect(mentionsAttachment('Please find the form attached.')).toBe(true);
    expect(mentionsAttachment("I'm attaching my CV")).toBe(true);
    expect(mentionsAttachment('See the PDF')).toBe(true);
    expect(mentionsAttachment('書類を添付します')).toBe(true);
  });
  it('ignores plain text', () => {
    expect(mentionsAttachment('See you Saturday.')).toBe(false);
    expect(mentionsAttachment(undefined)).toBe(false);
  });
});

describe('attachableFiles', () => {
  const files = [{ id: 'a', driveId: 'x' }, { id: 'b', driveId: 'y' }, { id: 'c' }];
  it('drops attached and driveless files', () => {
    expect(attachableFiles(files, [{ id: 'a', name: 'a', driveId: 'x' }]).map((f) => f.id)).toEqual(['b']);
    expect(attachableFiles(undefined, undefined)).toEqual([]);
  });
});

describe('attachmentLabel', () => {
  it('pluralises', () => {
    expect(attachmentLabel(1)).toBe('Sends with 1 attachment');
    expect(attachmentLabel(3)).toBe('Sends with 3 attachments');
  });
});
