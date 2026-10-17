// Deterministic gates evaluated before generation and before release.
// Every block is reported with the rule id — no silent skips.

const RULES = [
  { id: 'R-01', desc: 'Clarifying questions answered before prompt compile',
    test: ctx => ctx.answers && Object.keys(ctx.answers).length >= 4, onFail: 'block', phases: ['pre', 'post'] },
  { id: 'R-02', desc: 'Sources ledger is non-empty',
    test: ctx => ctx.sources?.length > 0, onFail: 'warn', phases: ['pre', 'post'] },
  { id: 'R-03', desc: 'Model family resolved',
    test: ctx => !!ctx.family, onFail: 'warn', phases: ['pre', 'post'] },
  { id: 'R-04', desc: 'Skill routing produced a selection or explicit fallback',
    test: ctx => !!ctx.skill?.matched || ctx.skill?.fallback?.length, onFail: 'block', phases: ['pre', 'post'] },
  { id: 'R-05', desc: 'Output contains an actionable artifact',
    test: ctx => /(```|^\s*[-*]\s|^\s*\d+\.\s|^#{1,6}\s)/m.test(ctx.output || ''), onFail: 'block', phases: ['post'] },
  { id: 'R-06', desc: 'No hedging language in final output',
    test: ctx => !/\b(i cannot|i can't|most likely)\b/i.test(ctx.output || ''), onFail: 'block', phases: ['post'] },
];

export function evaluate(ctx = {}, phase = 'pre') {
  const active = RULES.filter(r => !r.phases || r.phases.includes(phase));
  const results = active.map(r => {
    let pass = false;
    try { pass = !!r.test(ctx); } catch { pass = false; }
    return { id: r.id, desc: r.desc, pass, onFail: r.onFail };
  });
  const blockers = results.filter(r => !r.pass && r.onFail === 'block');
  return {
    phase,
    ok: blockers.length === 0,
    blockers: blockers.map(b => b.id),
    results,
    report: results.map(r => `${r.pass ? 'PASS' : 'FAIL'} ${r.id} — ${r.desc}`).join('\n'),
  };
}
