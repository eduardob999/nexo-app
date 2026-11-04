export type Segment = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

/**
 * Splits text into plain runs and links. Two forms become links, as in the old board: a bare https address and
 * a markdown link [label](https://address). Only https: text that comes from mail or a page nobody here wrote
 * must not be able to carry a javascript: or http: address.
 */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\[([^\]\n]{1,200})\]\((https:\/\/[^\s)<>"']+)\)|(https:\/\/[^\s<>"')\]]+)/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) });
    if (m[2]) out.push({ kind: 'link', text: m[1] ?? '', href: m[2] });
    else {
      // A trailing full stop or comma belongs to the sentence, not the address.
      const url = (m[3] ?? '').replace(/[.,;:!?]+$/, '');
      out.push({ kind: 'link', text: url, href: url });
      if (url.length < (m[3] ?? '').length) out.push({ kind: 'text', text: (m[3] ?? '').slice(url.length) });
    }
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}
