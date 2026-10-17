// Wraps LLM/tool calls. Catches the "200 OK but wrong" class:
// empty, stale, mis-routed, swallowed, or non-actionable responses.

const HEDGE = /\b(i cannot|i can't|i'm unable|most likely|it depends|as an ai|i don't have access)\b/i;
const ACTIONABLE = /(```|^\s*[-*]\s|^\s*\d+\.\s|^#{1,6}\s|\bfile:|\bstep\b|\boutput\b)/im;

export async function guarded(fn, { label = 'call', requireActionable = true, timeoutMs = 60_000 } = {}) {
  const t0 = Date.now();
  let raw, err = null;
  try {
    raw = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
  } catch (e) { err = e; }

  const text = typeof raw === 'string' ? raw : raw?.text ?? JSON.stringify(raw ?? '');
  const failures = [];
  if (err) failures.push(`threw: ${err.message}`);
  if (!text || text.trim().length < 8) failures.push('empty response');
  if (HEDGE.test(text)) failures.push('hedging / refusal');
  if (requireActionable && !ACTIONABLE.test(text)) failures.push('no actionable artifact');

  const verdict = failures.length ? 'FAIL' : 'PASS';
  const report = { label, verdict, failures, ms: Date.now() - t0, chars: text.length };
  if (verdict === 'FAIL') console.warn('[guard]', JSON.stringify(report));
  return { verdict, report, text, error: err };
}
