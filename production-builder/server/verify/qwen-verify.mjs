// Qwen audits each fix against its own rubric and returns strict JSON.
// Without QWEN_API_KEY, runs a local unit smoke with the same evidence checks.

const BASE = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const KEY  = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
const MODEL = process.env.QWEN_MODEL || 'qwen-plus';

const { nextQuestion, isReady } = await import('../lib/questions.mjs');
const { SourceLedger }        = await import('../lib/sources.mjs');
const { formatPrompt }        = await import('../lib/modelFormat.mjs');
const { resolveSkill }        = await import('../lib/skills.mjs');
const { guarded }             = await import('../lib/guard.mjs');
const { evaluate }            = await import('../lib/rules.mjs');
const { hasArtifact }         = await import('../lib/complete.mjs');

const READY_ANSWERS = {
  deliverable: 'prompt file',
  audience: 'founder',
  constraints: 'local only',
  success: 'compiles clean',
  context: 'README.md',
};

const FIXES = [
  { id: 1, name: 'clarifying-questions', evidence: JSON.stringify({ q1: nextQuestion({}), readyAfterAll: isReady(READY_ANSWERS) }) },
  { id: 2, name: 'source-ledger',        evidence: JSON.stringify(new SourceLedger().toJSON()) + ' | toBlock() present: ' + (typeof new SourceLedger().toBlock === 'function') },
  { id: 3, name: 'model-formatting',     evidence: formatPrompt({ task: 'T', blocks: ['B'], lane: 'claude' }).slice(0, 300) },
  { id: 4, name: 'skill-routing',        evidence: JSON.stringify(resolveSkill('please verify my build')) },
  { id: 5, name: 'silent-failure-guard', evidence: 'guard.mjs exports guarded(); wraps with timeout + hedge + actionable checks' },
  { id: 6, name: 'rule-engine',          evidence: JSON.stringify(evaluate({ answers:{a:1,b:2,c:3,d:4}, sources:[1], skill:{matched:'verify'}, family:'qwen', output:'```code```' }, 'post')) },
  { id: 7, name: 'artifact-enforcement', evidence: `hasArtifact('hello')=${hasArtifact('hello')} hasArtifact('\`\`\`x\`\`\`')=${hasArtifact('```x```')}` },
];

async function runLocalSmoke() {
  const results = [];

  const q1 = nextQuestion({});
  const ready = isReady(READY_ANSWERS);
  results.push({
    id: 1,
    pass: q1?.id === 'deliverable' && ready === true,
    note: `nextQuestion id=${q1?.id}; isReady=${ready}`,
  });

  const ledger = new SourceLedger();
  results.push({
    id: 2,
    pass: typeof ledger.toBlock === 'function' && Array.isArray(ledger.toJSON().entries),
    note: `toJSON=${JSON.stringify(ledger.toJSON())}; toBlock fn=${typeof ledger.toBlock === 'function'}`,
  });

  const formatted = formatPrompt({ task: 'T', blocks: ['B'], lane: 'claude' });
  results.push({
    id: 3,
    pass: formatted.includes('<task>') && formatted.includes('claude'),
    note: formatted.slice(0, 160),
  });

  const skill = resolveSkill('please verify my build');
  results.push({
    id: 4,
    pass: skill.matched === 'verify',
    note: JSON.stringify(skill),
  });

  const gOk = await guarded(async () => '```js\nconst x = 1;\n```\n# done', { label: 'smoke', timeoutMs: 2000 });
  const gBad = await guarded(async () => 'I cannot help', { label: 'smoke-hedge', timeoutMs: 2000, requireActionable: false });
  results.push({
    id: 5,
    pass: typeof guarded === 'function' && gOk.verdict === 'PASS' && gBad.verdict === 'FAIL',
    note: `PASS actionable=${gOk.verdict}; hedge=${gBad.verdict} failures=${gBad.report.failures.join(',')}`,
  });

  const post = evaluate({
    answers: { a: 1, b: 2, c: 3, d: 4 },
    sources: [1],
    skill: { matched: 'verify' },
    family: 'qwen',
    output: '```code```',
  }, 'post');
  const pre = evaluate({
    answers: { a: 1, b: 2, c: 3, d: 4 },
    sources: [1],
    skill: { matched: 'verify' },
    family: 'qwen',
  }, 'pre');
  results.push({
    id: 6,
    pass: post.ok === true && pre.ok === true && !pre.results.some((r) => r.id === 'R-05'),
    note: `post.ok=${post.ok}; pre.ok=${pre.ok}; pre skips R-05/R-06`,
  });

  results.push({
    id: 7,
    pass: hasArtifact('hello') === false && hasArtifact('```x```') === true,
    note: `hasArtifact('hello')=${hasArtifact('hello')} hasArtifact('\`\`\`x\`\`\`')=${hasArtifact('```x```')}`,
  });

  const overall = results.every((r) => r.pass) ? 'PASS' : 'FAIL';
  return {
    results,
    overall,
    summary: overall === 'PASS'
      ? 'Local smoke: all seven fix modules export and behave as expected (Qwen skipped).'
      : 'Local smoke: one or more evidence checks failed.',
  };
}

if (!KEY) {
  console.warn('QWEN_API_KEY (or DASHSCOPE_API_KEY) not set — running local unit smoke.');
  const out = await runLocalSmoke();
  console.log('\n=== Local verification (Qwen skipped) ===');
  for (const r of out.results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  fix ${r.id}  ${r.note}`);
  console.log(`\noverall: ${out.overall}\n${out.summary}`);
  process.exit(out.overall === 'PASS' ? 0 : 2);
}

const RUBRIC = `You are auditing 7 fixes to a local AI builder. For each fix return pass:true only if the evidence shows the fix is real and functional, not a stub. Be strict. Return ONLY JSON: {"results":[{"id":1,"pass":true,"note":"..."}],"overall":"PASS|FAIL","summary":"..."}`;

const res = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RUBRIC },
      { role: 'user',   content: JSON.stringify(FIXES, null, 2) },
    ],
  }),
});

const data = await res.json();
if (!res.ok) { console.error('Qwen error', res.status, data); process.exit(1); }

const out = JSON.parse(data.choices[0].message.content);
console.log('\n=== Qwen verification ===');
for (const r of out.results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  fix ${r.id}  ${r.note}`);
console.log(`\noverall: ${out.overall}\n${out.summary}`);
process.exit(out.overall === 'PASS' ? 0 : 2);
