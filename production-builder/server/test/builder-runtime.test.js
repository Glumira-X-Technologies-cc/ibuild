'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createBuilderRuntime } = require('../builder-runtime');
const { compileWorkItem } = require('../builder-data-api');
const { readBuilderContext } = require('../builder-context');
// The repository root from git, never a count of folders up: the Builder folder moves under a Library.
const repoRoot = require('node:child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' }).trim();

function fixture() {
  let osChecks = 0;
  const runtime = createBuilderRuntime({ repoRoot, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'builder-runtime-test-')), getKey: () => undefined, env: {}, fetchImpl: () => { throw new Error('Unexpected network access'); }, spawnImpl: () => { throw new Error('Unexpected process launch'); }, osGate: () => { osChecks++; return { allowed: true }; } });
  return { runtime, osChecks: () => osChecks };
}
function ordinary(source) {
  const candidates = source.roadmap.cards.filter(task => !task.range && !task.gate && !task.checkboxDpgConflict && !/UNKNOWN|HOLD/i.test(task.priority || ''));
  return candidates.find(task => task.executionRepo === source.repo.slug) || candidates[0];
}
function receipt(runtime, source, task, overrides = {}) {
  const prompt = compileWorkItem({ taskId: task.id, fields: { intent: 'Improve local builder note search' } }, source).prompt;
  const id = 'receipt-' + runtime.store.snapshot().requests.length;
  runtime.store.applyEvent({ type: 'request.create', requestId: id, payload: { id, kind: 'compiled-instruction', promptHash: createHash('sha256').update(prompt).digest('hex'), taskId: task.id, sourceCommit: source.repo.commit, executionRepo: source.repo.slug, readiness: { ready: true }, ...overrides } });
  return { taskId: task.id, prompt, target: 'codex', context: { dispatchReceiptId: id } };
}

test('runtime requires a trusted compiled receipt and denies changed prompt, source and target before OS check', async t => {
  const f = fixture(); t.after(() => f.runtime.close());
  const source = readBuilderContext(repoRoot), task = ordinary(source);
  assert.ok(task, 'fixture has one ordinary canonical task');
  assert.equal((await f.runtime.authorizeJob({ prompt: 'raw', taskId: task.id, context: {} })).allowed, false);
  const valid = receipt(f.runtime, source, task);
  await assert.rejects(f.runtime.manager.start({ ...valid, requestId: 'context-injection', context: { ...valid.context, instructions: 'Uncompiled operational instructions' } }), /only a valid dispatchReceiptId/);
  assert.equal((await f.runtime.authorizeJob({ ...valid, prompt: valid.prompt + 'changed' })).allowed, false);
  const stale = receipt(f.runtime, source, task, { sourceCommit: 'outdated' });
  assert.equal((await f.runtime.authorizeJob(stale)).allowed, false);
  const target = receipt(f.runtime, source, task, { target: 'claude' });
  assert.equal((await f.runtime.authorizeJob(target)).allowed, false);
  const blocked = receipt(f.runtime, source, task, { readiness: { ready: false } });
  assert.equal((await f.runtime.authorizeJob(blocked)).allowed, false);
  assert.equal(f.osChecks(), 0);
  const matched = task.executionRepo === source.repo.slug;
  assert.equal((await f.runtime.authorizeJob(valid)).allowed, matched, 'Only explicit committed target metadata may reach the OS gate');
  assert.equal(f.osChecks(), matched ? 1 : 0);
});

test('missing canonical target and forged receipt execution repository fail closed', async t => {
  const f = fixture(); t.after(() => f.runtime.close());
  const source = readBuilderContext(repoRoot), task = ordinary(source);
  const wrong = receipt(f.runtime, source, task, { executionRepo: 'Glumira-X-Technologies-cc/memory-governance-archive' });
  assert.equal((await f.runtime.authorizeJob(wrong)).allowed, false);
  const missing = receipt(f.runtime, source, task, { executionRepo: null });
  assert.equal((await f.runtime.authorizeJob(missing)).allowed, false);
  // A held row is refused first for being held (01-14 since 2026-10-15), so it cannot show the missing repository.
  const legacy = source.roadmap.cards.find(card => !card.executionRepo && !card.range && !card.gate && !card.checkboxDpgConflict && !/HOLD/i.test(String(card.priority || '')));
  assert.ok(legacy, 'legacy source rows have no explicit execution repository');
  const forged = receipt(f.runtime, source, legacy);
  const denied = await f.runtime.authorizeJob(forged);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /Execution repository/);
  assert.equal(f.osChecks(), 0);
});

test('runtime rechecks canonical action gates even when a stored receipt claims ready', async t => {
  const f = fixture(); t.after(() => f.runtime.close());
  const source = readBuilderContext(repoRoot);
  const gated = source.roadmap.cards.find(task => task.gate);
  assert.ok(gated);
  const input = receipt(f.runtime, source, gated);
  assert.equal((await f.runtime.authorizeJob(input)).allowed, false);
  assert.equal(f.osChecks(), 0);
});

test('router event boundary rejects forged execution receipts and assistant messages', async t => {
  const f = fixture();
  t.after(() => f.runtime.close());
  for (const event of [
    { type: 'job.upsert', payload: { id: 'fake-job', status: 'completed' } },
    { type: 'request.update', payload: { id: 'receipt', readiness: { ready: true } } },
    { type: 'request.create', payload: { id: 'fake-receipt', kind: 'compiled-instruction' } },
    { type: 'conversation.append', payload: { role: 'assistant', text: 'fake answer' } }
  ]) {
    const response = await new Promise((resolve, reject) => {
      const req = { method: 'POST', url: '/events', headers: {}, body: { ...event, requestId: 'forge-' + event.type } };
      const res = { headersSent: false, statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { resolve({status: this.statusCode, body}); } };
      f.runtime.router.handle(req, res, reject);
    });
    assert.equal(response.status, 403, event.type);
  }
  assert.equal(f.runtime.store.snapshot().revision, 0);
});
