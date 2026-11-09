/** Which kind of Fude document an assignment card should open, from its words. Pure, so it can be tested. */
export type Kind = { kind: 'set' } | { kind: 'doc'; profile: string };

const EXERCISE = /文型|練習|宿題|exercise|workbook|homework|\bL\d{1,2}\b|\bpp?\.\s?\d/i;
const REPORT = /report|レポート|essay|lecture report|感想/i;

export function kindForCard(title: string, text = ''): Kind {
  const t = `${title} ${text}`;
  if (EXERCISE.test(t) && !REPORT.test(title)) return { kind: 'set' };
  if (REPORT.test(t)) return { kind: 'doc', profile: 'report-en' };
  return { kind: 'doc', profile: 'free' };
}
