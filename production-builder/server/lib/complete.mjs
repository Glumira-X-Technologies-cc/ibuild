// If the model produced only explanation, re-drive it once toward a concrete
// deliverable. Second failure returns a structured "cannot" with the reason.

const ARTIFACT = /(```[\s\S]+?```|^\s*\d+\.\s.+\n|^\s*[-*]\s.+\n|^#{1,6}\s.+)/m;

export function hasArtifact(text = '') { return ARTIFACT.test(text); }

export function reDrivePrompt(originalTask, priorText) {
  return [
    'You produced explanation but no deliverable.',
    'Return ONLY the concrete artifact (code block, file, numbered steps, or table).',
    'No preamble, no apology, no restating the question.',
    '',
    `TASK: ${originalTask}`,
    '',
    'Your previous output (do not repeat its framing):',
    priorText.slice(0, 1200),
  ].join('\n');
}

export async function ensureArtifact({ task, generate, maxRetries = 1 }) {
  let text = await generate(task);
  if (hasArtifact(text)) return { text, retries: 0, ok: true };
  for (let i = 1; i <= maxRetries; i++) {
    text = await generate(reDrivePrompt(task, text));
    if (hasArtifact(text)) return { text, retries: i, ok: true };
  }
  return { text, retries: maxRetries, ok: false,
    reason: 'model returned no artifact after re-drive; surface to user, do not silently pass' };
}
