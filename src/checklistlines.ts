/** Turn text typed one item per line into checklist items: bullets and empty lines are dropped, at most 60 kept. */
export function checklistLines(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : input.split(/\r?\n/);
  return raw
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*(?:\[[ xX]?\]\s*)?/, '').trim())
    .filter(Boolean)
    .slice(0, 60);
}
