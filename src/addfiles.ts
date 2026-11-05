/** Files chosen in the Add sheet before the card exists. Pure list handling, so it can be tested. */
const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

export function addPicked(current: File[], more: File[]): File[] {
  const out = [...current];
  for (const f of more) if (!out.some((o) => same(o, f))) out.push(f);
  return out;
}

export function removePicked(current: File[], index: number): File[] {
  return current.filter((_, i) => i !== index);
}

export function uploadFailText(reason: unknown): string {
  const why = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'upload failed';
  return `Card added, photo could not upload: ${why}`;
}
