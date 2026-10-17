// Pre-prompt interrogation. Asks the single highest-leverage missing lens
// (socratic pattern), stops when intent is clear. Feeds a structured block
// into the final prompt instead of raw chat text.

const MAX_ROUNDS = 4;

const LENSES = [
  { id: 'deliverable', q: 'What exact artifact should this produce? (file, prompt, code, plan, doc)', why: 'defines done' },
  { id: 'audience',    q: 'Who or what consumes the output?',                                          why: 'sets format + register' },
  { id: 'constraints', q: 'What are the hard constraints? (stack, length, licence, must-not)',         why: 'bounds the solution' },
  { id: 'success',     q: 'How will you judge the result as correct?',                                 why: 'defines the gate' },
  { id: 'context',     q: 'What existing files, docs or prior work must be respected?',                why: 'prevents reinvention' },
];

export function missingLenses(answers = {}) {
  return LENSES.filter(l => !answers[l.id] || String(answers[l.id]).trim().length < 2);
}

export function nextQuestion(answers = {}) {
  const missing = missingLenses(answers);
  if (!missing.length) return null;
  const l = missing[0];
  return { id: l.id, question: l.q, rationale: l.why, remaining: missing.length - 1 };
}

export function isReady(answers = {}) {
  return missingLenses(answers).length === 0;
}

export function buildInterrogationBlock(answers = {}) {
  const lines = LENSES.filter(l => answers[l.id]).map(l => `- ${l.id.toUpperCase()}: ${answers[l.id]}`);
  return lines.length ? `## Task Context (clarified)\n${lines.join('\n')}` : '';
}

export { LENSES, MAX_ROUNDS };
