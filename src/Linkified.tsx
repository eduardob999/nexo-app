import { linkify } from './linkify';

/** Text with its https links made clickable. They open in a new tab and carry no referrer. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((s, i) => (s.kind === 'link'
        ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">{s.text}</a>
        : <span key={i}>{s.text}</span>))}
    </>
  );
}
