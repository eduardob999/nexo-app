/** What the clipboard holds: pictures first (if he copied one, that is what he means by paste), else text. */
export async function readClipboard(): Promise<{ files: File[]; text: string }> {
  const files: File[] = [];
  try {
    if (navigator.clipboard?.read) {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) files.push(new File([await item.getType(type)], `pasted-${Date.now()}.png`, { type }));
      }
    }
  } catch { /* refused or unsupported: fall through to text */ }
  if (files.length > 0) return { files, text: '' };
  try { return { files: [], text: (await navigator.clipboard.readText()) ?? '' }; } catch { return { files: [], text: '' }; }
}

/** Insert text at the caret of a field, or at the end when the caret is unknown. */
export function insertAt(value: string, text: string, at: number | null, to: number | null): string {
  const a = at ?? value.length;
  const b = to ?? a;
  return value.slice(0, a) + text + value.slice(b);
}
