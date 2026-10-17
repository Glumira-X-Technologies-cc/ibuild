// Adapts the compiled prompt to the target model family. Auto-detect by
// lane name; override with {family}.

const xmlWrap   = (t, b) => `<task>\n${t}\n</task>\n<context>\n${b}\n</context>`;
const mdWrap    = (t, b) => `### Task\n${t}\n\n### Context\n${b}`;
const plainWrap = (t, b) => `TASK:\n${t}\n\nCONTEXT:\n${b}`;

const FAMILIES = {
  claude:   { wrap: xmlWrap,   header: '## ', note: 'Use XML tags for structure.' },
  gemini:   { wrap: plainWrap, header: '# ',  note: 'Markdown headers; explicit output schema.' },
  gpt:      { wrap: mdWrap,    header: '### ',note: 'Markdown; put deliverable first.' },
  qwen:     { wrap: mdWrap,    header: '## ', note: 'Markdown; numbered steps; no preamble.' },
  generic:  { wrap: plainWrap, header: '## ', note: '' },
};

export function detectFamily(lane = '') {
  const l = lane.toLowerCase();
  if (l.includes('claude') || l.includes('anthropic')) return 'claude';
  if (l.includes('gemini') || l.includes('google'))    return 'gemini';
  if (l.includes('qwen') || l.includes('dashscope'))   return 'qwen';
  if (l.includes('gpt') || l.includes('openai'))       return 'gpt';
  return 'generic';
}

export function formatPrompt({ task, blocks = [], family, lane }) {
  const fam = FAMILIES[family || detectFamily(lane)] || FAMILIES.generic;
  const body = blocks.filter(Boolean).join('\n\n');
  return `${fam.wrap(task, body)}\n\n---\n_Model family: ${family || detectFamily(lane)}. ${fam.note}_`;
}

export { FAMILIES };
