// Three-layer skill resolution: metadata match -> load body -> pull resources.
// Never fails silently: returns {matched, reason, fallback}.

const REGISTRY = [
  { id: 'prompt-compile',  match: /prompt|compile|askkosmo/i,          body: 'Compile structured prompts from clarified intent.' },
  { id: 'code-scaffold',   match: /scaffold|boilerplate|generate code/i, body: 'Scaffold code from repo conventions.' },
  { id: 'file-audit',      match: /read|audit|inspect|which files/i,   body: 'Walk a tree and produce a source ledger.' },
  { id: 'verify',          match: /verify|test|check|grade/i,           body: 'Run assertions and report pass/fail.' },
  { id: 'research',        match: /find|search|look up|mit|github/i,    body: 'Search local + web, record sources.' },
];

export function resolveSkill(input = '') {
  const hits = REGISTRY.filter(s => s.match.test(input));
  if (hits.length === 1) return { matched: hits[0].id, reason: `matched /${hits[0].match.source}/`, fallback: null, body: hits[0].body };
  if (hits.length > 1)   return { matched: hits[0].id, reason: `ambiguous (${hits.map(h=>h.id).join(', ')}), took first`, fallback: hits.slice(1).map(h=>h.id), body: hits[0].body };
  return { matched: null, reason: 'no skill matched', fallback: ['prompt-compile'], body: 'Fall back to prompt compilation.' };
}

export function routingBlock(r) {
  return `## Skill routing\n- selected: ${r.matched ?? '(none)'}\n- reason: ${r.reason}` +
         (r.fallback?.length ? `\n- fallback available: ${r.fallback.join(', ')}` : '');
}

export { REGISTRY };
