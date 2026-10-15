'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createJobManager } = require('../builder-jobs');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-jobs-test-'));
  fs.mkdirSync(path.join(root, '.git'));
  const local = path.join(root, 'local');
  const binary = path.join(local, 'OpenAI/Codex/bin/codex.exe');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, 'mock binary; never executed');
  const state = { jobs: options.jobs || [] };
  const store = { snapshot: () => structuredClone(state), applyEvent: ({ payload }) => {
    const index = state.jobs.findIndex(j => j.id === payload.id);
    if (index < 0) state.jobs.push(structuredClone(payload)); else state.jobs[index] = structuredClone(payload);
  } };
  const calls = [];
  function spawnImpl(binary, args, opts) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
    child.stdin.end = text => { child.input = text; };
    child.kill = () => { child.killed = true; return true; };
    calls.push({ binary, args, opts, child });
    if (args.includes('--help')) process.nextTick(() => { child.stdout.emit('data', 'workspace-write --json --print --permission-mode --approval-mode --prompt'); child.emit('close', 0); });
    else if (options.spawnError) process.nextTick(() => child.emit('error', new Error('spawn failed')));
    else process.nextTick(() => { child.pid = 12345; child.emit('spawn'); });
    return child;
  }
  const manager = createJobManager({ repoRoot: root, store, spawnImpl, env: { LOCALAPPDATA: local, APPDATA: path.join(root, 'missing') }, authorizeJob: options.noGate ? undefined : async () => ({ allowed: !options.denyGate }) });
  const input = { requestId: 'req-1', taskId: 'task-1', target: 'codex', prompt: 'Edit scoped test files', context: { dispatchReceiptId: 'compile-receipt-1' }, cwd: root };
  return { root, manager, input, calls, state };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('fixed command, stdin prompt, durable output and honest completion', async () => {
  const f = fixture();
  const started = await f.manager.start(f.input);
  assert.equal(started.status, 'spawning');
  await tick();
  const call = f.calls.find(c => !c.args.includes('--help'));
  assert.equal(call.opts.shell, false);
  assert.equal(call.opts.cwd, f.root);
  assert.deepEqual(call.args, ['exec', '--sandbox', 'workspace-write', '--cd', f.root, '--json', '-']);
  assert.match(call.child.input, /Edit scoped test files/);
  assert.equal(call.child.input.includes('compile-receipt-1'), false);
  assert.equal(f.manager.get(started.id).status, 'accepted');
  call.child.stdout.emit('data', 'actual output');
  assert.equal(f.manager.get(started.id).status, 'running');
  call.child.emit('close', 0, null);
  const done = f.manager.get(started.id);
  assert.equal(done.status, 'completed');
  assert.equal(done.verificationPending, true);
  assert.match(done.logTail, /actual output/);
});

test('duplicate request launches one process, mismatched duplicate rejected', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.manager.start(f.input), f.manager.start(f.input)]);
  assert.equal(a.id, b.id);
  assert.equal(f.calls.filter(c => !c.args.includes('--help')).length, 1);
  await assert.rejects(f.manager.start({ ...f.input, prompt: 'different' }), /different job/);
});

test('invalid target, cwd, arbitrary process options and missing gates fail closed', async () => {
  const f = fixture();
  await assert.rejects(f.manager.start({ ...f.input, target: 'shell' }), /Unsupported/);
  await assert.rejects(f.manager.start({ ...f.input, cwd: os.tmpdir() }), /exactly match/);
  await assert.rejects(f.manager.start({ ...f.input, args: ['--dangerously-bypass-approvals-and-sandbox'] }), /forbidden/);
  await assert.rejects(f.manager.start({ ...f.input, context: { dispatchReceiptId: 'compile-receipt-1', scope: 'Unapproved action' } }), /only a valid dispatchReceiptId/);
  const no = fixture({ noGate: true });
  await assert.rejects(no.manager.start(no.input), /gate is not configured/);
  const deny = fixture({ denyGate: true });
  await assert.rejects(deny.manager.start(deny.input), /denied/);
  assert.equal(f.calls.length + no.calls.length + deny.calls.length, 0);
});

test('spawn error never creates accepted state', async () => {
  const f = fixture({ spawnError: true });
  const job = await f.manager.start(f.input); await tick();
  const failed = f.manager.get(job.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.pid, null); assert.equal(failed.acceptedAt, undefined);
});

test('cancel signals only owned child and retains output despite late data', async () => {
  const f = fixture(); const job = await f.manager.start(f.input); await tick();
  const child = f.calls.find(c => !c.args.includes('--help')).child;
  child.stdout.emit('data', 'before');
  assert.equal(f.manager.cancel(job.id).status, 'cancelled');
  assert.equal(child.killed, true);
  child.stdout.emit('data', 'after'); child.emit('close', null, 'SIGTERM');
  assert.equal(f.manager.get(job.id).status, 'cancelled');
  assert.match(f.manager.get(job.id).logTail, /before[\s\S]*after/);
});

test('restart interrupts active persisted jobs without replay', () => {
  const f = fixture({ jobs: [{ id: 'old-job', requestId: 'old-request', status: 'running', logTail: 'retained' }] });
  assert.equal(f.manager.get('old-job').status, 'interrupted');
  assert.equal(f.manager.get('old-job').logTail, 'retained');
  assert.equal(f.calls.length, 0);
});

test('help verifies contract only; truncated output is explicitly accounted for', async () => {
  const f = fixture();
  const job = await f.manager.start(f.input); await tick();
  const capability = f.manager.capabilities().find(c => c.target === 'codex');
  assert.equal(capability.contractVerified, true);
  assert.equal(capability.authVerified, false);
  assert.equal(capability.authenticated, null);
  const child = f.calls.find(c => !c.args.includes('--help')).child;
  child.stdout.emit('data', Buffer.from('é'.repeat(40000)));
  child.stderr.emit('data', Buffer.from('x'.repeat(40000)));
  const updated = f.manager.get(job.id);
  assert.equal(updated.totalOutputBytes, 120000);
  assert.equal(updated.outputTruncated, true);
  assert.equal(updated.logTail.length, 60000);
});

// Agents (founder 2026-10-15, verbatim: "please add grok minimax and fix cli"): no hermes, grok and minimax present,
// every agent with a status, a key-based agent not ready without its key, its key only in its own child process.
test('agents: claude, codex, gemini, grok and minimax, each with a status and a fix, keys only in the child', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-agents-test-')); fs.mkdirSync(path.join(root, '.git'));
  const roaming = path.join(root, 'roaming'), local = path.join(root, 'local'), home = path.join(root, 'home');
  for (const f of [path.join(roaming, 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'), path.join(roaming, 'npm/node_modules/@google/gemini-cli/bundle/gemini.js'), path.join(local, 'OpenAI/Codex/bin/codex.exe'), path.join(home, '.grok/bin/grok.exe')]) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'mock'); }
  const state = { jobs: [] }, calls = [];
  const store = { snapshot: () => structuredClone(state), applyEvent: ({ payload }) => { const i = state.jobs.findIndex(j => j.id === payload.id); if (i < 0) state.jobs.push(structuredClone(payload)); else state.jobs[i] = structuredClone(payload); } };
  const spawnImpl = (binary, args, opts) => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
    child.stdin.end = t => { child.input = t; }; child.kill = () => true; calls.push({ binary, args, opts, child });
    if (args.includes('--help')) process.nextTick(() => { child.stdout.emit('data', 'workspace-write --json --print --permission-mode --approval-mode --prompt --prompt-file --output-format'); child.emit('close', 0); });
    else process.nextTick(() => { child.pid = 4242; child.emit('spawn'); });
    return child;
  };
  const env = { APPDATA: roaming, LOCALAPPDATA: local };
  const noKeys = createJobManager({ repoRoot: root, store, spawnImpl, env, home, getKey: () => '', authorizeJob: async () => ({ allowed: true }) });
  assert.deepEqual(noKeys.capabilities().map(c => c.target), ['claude', 'codex', 'gemini', 'grok', 'minimax'], 'no hermes');
  const bare = await noKeys.probeCapabilities();
  for (const c of bare) assert.ok(c.reason && c.name, c.target + ' has a name and a status');
  for (const t of ['gemini', 'grok', 'minimax']) { const c = bare.find(x => x.target === t); assert.equal(c.ready, false, t); assert.match(c.reason, /not in the key store/); assert.match(c.fix, /^Add [A-Z_]+ to the one key store/); }
  assert.equal(bare.find(c => c.target === 'codex').ready, true);
  const KEYS = { GEMINI_API_KEY: 'g-secret', XAI_API_KEY: 'x-secret', MINIMAX_API_KEY: 'm-secret' };
  const m = createJobManager({ repoRoot: root, store, spawnImpl, env, home, getKey: n => KEYS[n] || '', authorizeJob: async () => ({ allowed: true }) });
  const caps = await m.probeCapabilities();
  for (const c of caps) assert.equal(c.ready, true, c.target + ': ' + c.reason);
  const job = await m.start({ requestId: 'grok-req', taskId: 'task-9', target: 'grok', prompt: 'Scoped grok task', context: { dispatchReceiptId: 'compile-receipt-9' } });
  await new Promise(r => setImmediate(r));
  const run = calls.find(c => !c.args.includes('--help') && c.binary.endsWith('grok.exe'));
  assert.deepEqual(run.args.slice(0, 2), ['-m', 'grok-45-xai']); assert.ok(run.args.includes('--prompt-file'));
  assert.match(fs.readFileSync(run.args[run.args.indexOf('--prompt-file') + 1], 'utf8'), /Scoped grok task/);
  assert.equal(run.opts.env.XAI_API_KEY, 'x-secret'); assert.equal(run.child.input, '', 'the prompt is in the file, not on stdin');
  assert.doesNotMatch(JSON.stringify(state.jobs), /x-secret|m-secret|g-secret/, 'no key in the stored job'); assert.equal(job.target, 'grok');
  await m.start({ requestId: 'mm-req', taskId: 'task-10', target: 'minimax', prompt: 'Scoped minimax task', context: { dispatchReceiptId: 'compile-receipt-10' } });
  await new Promise(r => setImmediate(r));
  const mm = calls.find(c => !c.args.includes('--help') && c.binary.endsWith('claude.exe') && c.opts.env.ANTHROPIC_BASE_URL);
  assert.equal(mm.opts.env.ANTHROPIC_BASE_URL, 'https://api.minimax.io/anthropic'); assert.equal(mm.opts.env.ANTHROPIC_AUTH_TOKEN, 'm-secret'); assert.ok(mm.args.includes('minimax-m2.7'));
});

// The service runs as the Windows system account (live check, 2026-10-15: every agent "Not installed" under
// C:\Windows\system32\config\systemprofile). Under that account the jobs find and use the founder's profile.
test('agents under the service account use the founder profile for the CLIs and their sign-in', async () => {
  const { isSystemProfile, userHome } = require('../builder-jobs');
  assert.equal(isSystemProfile('C:\\Windows\\system32\\config\\systemprofile'), true);
  assert.equal(isSystemProfile('C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming'), true);
  assert.equal(isSystemProfile('C:\\Users\\franc'), false);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-svc-test-')); fs.mkdirSync(path.join(root, '.git'));
  const users = path.join(root, 'Users'), founder = path.join(users, 'founder');
  fs.mkdirSync(path.join(users, 'Public'), { recursive: true });
  for (const f of [path.join(founder, 'AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'), path.join(founder, '.grok/bin/grok.exe')]) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'mock'); }
  const sys = 'C:\\Windows\\system32\\config\\systemprofile';
  const env = { USERPROFILE: sys, APPDATA: sys + '\\AppData\\Roaming', LOCALAPPDATA: sys + '\\AppData\\Local' };
  assert.equal(userHome(env, users), founder, 'the Users folder that holds the CLIs');
  assert.equal(userHome({ ...env, BUILDER_USER_HOME: 'D:\\me' }, users), 'D:\\me', 'an explicit home wins');
  const state = { jobs: [] }, calls = [];
  const store = { snapshot: () => structuredClone(state), applyEvent: ({ payload }) => { const i = state.jobs.findIndex(j => j.id === payload.id); if (i < 0) state.jobs.push(structuredClone(payload)); else state.jobs[i] = structuredClone(payload); } };
  const spawnImpl = (binary, args, opts) => { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); calls.push({ binary, args, opts }); process.nextTick(() => { child.stdout.emit('data', '--print --permission-mode --prompt-file --output-format'); child.emit('close', 0); }); return child; };
  const m = createJobManager({ repoRoot: root, store, spawnImpl, env, usersDir: users, getKey: n => (n === 'XAI_API_KEY' ? 'x' : ''), authorizeJob: async () => ({ allowed: true }) });
  const caps = await m.probeCapabilities();
  assert.equal(caps.find(c => c.target === 'claude').ready, true, caps.find(c => c.target === 'claude').reason);
  assert.equal(caps.find(c => c.target === 'grok').ready, true, caps.find(c => c.target === 'grok').reason);
  const probe = calls.find(c => c.binary.startsWith(founder));
  assert.equal(probe.opts.env.USERPROFILE, founder); assert.equal(probe.opts.env.APPDATA, path.join(founder, 'AppData/Roaming'));
});
