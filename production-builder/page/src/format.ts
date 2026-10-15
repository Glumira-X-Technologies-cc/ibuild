const pad = (n: number) => String(n).padStart(2, '0');

/** Displayed dates are ddmmyy. Stored YYYY-MM-DD day keys are not changed. */
export function fmtDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`;
}

export function fmtTime(d: Date, withSeconds = false): string {
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${t}:${pad(d.getSeconds())}` : t;
}

export function fmtDateTime(d: Date): string {
  const date = fmtDate(d);
  return date ? `${date} ${fmtTime(d)}` : '';
}

export function fmtWhen(v: unknown): string {
  if (v == null || v === '') return '';
  return fmtDateTime(new Date(String(v)));
}

export function fmtDayKey(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
}

/** Drop a trailing model id from a lane name, for example "Gemini account (gemini-2.5-flash)". */
export function laneName(name: string): string {
  return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** A chat reply as lines: markdown bold shows as regular text (bold is for headings only, founder 2026-10-15:
 *  "remove BOLD from conversational text / Bold reserved for headings and sub headings"); # to ### lines are
 *  headings. */
export function replyLines(text: string): { heading: boolean; text: string }[] {
  return String(text || '').split(/\r?\n/).map(line => {
    const plain = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/<\/?(?:strong|b)>/gi, '');
    const h = /^\s{0,3}#{1,3}\s+(.*)$/.exec(plain);
    return h ? { heading: true, text: h[1].trim() } : { heading: false, text: plain };
  });
}
