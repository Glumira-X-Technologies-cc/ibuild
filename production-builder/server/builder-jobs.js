'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const ACTIVE = new Set(['queued', 'spawning', 'accepted', 'running']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const clone = value => JSON.parse(JSON.stringify(value));
function failure(message, status = 400) { return Object.assign(new Error(message), { status }); }
// The GlumiraProxy service runs as the Windows system account, whose profile is
// C:\Windows\system32\config\systemprofile: no CLI is installed or signed in there, so every agent read "Not
// installed" (live check, 2026-10-15). Under that account the jobs use the founder's own profile: BUILDER_USER_HOME
// when set, else the one C:\Users folder that holds the Claude Code or Grok CLI.
const isSystemProfile = p => /[\\/]system32[\\/]config[\\/]systemprofile/i.test(String(p || ''));
function userHome(env, usersDir = 'C:/Users') {
  if (env.BUILDER_USER_HOME) return env.BUILDER_USER_HOME;
  if (env.USERPROFILE && !isSystemProfile(env.USERPROFILE)) return env.USERPROFILE;
  try {
    for (const name of fs.readdirSync(usersDir)) {
      const h = path.join(usersDir, name);
      if (fs.existsSync(path.join(h, 'AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code')) || fs.existsSync(path.join(h, '.grok/bin/grok.exe'))) return h;
    }
  } catch { /* no users folder */ }
  return env.USERPROFILE || 'C:/Users/franc';
}

function createJobManager({ repoRoot, store, spawnImpl = spawn, env = process.env, clock = () => new Date(), authorizeJob, getKey = () => '', usersDir = 'C:/Users', home = userHome(env, usersDir) } = {}) {
  if (!repoRoot || !store?.snapshot || !store?.applyEvent) throw failure('Repository and durable store are required');
  const root = fs.realpathSync(repoRoot);
  if (!fs.existsSync(path.join(root, '.git'))) throw failure('Job root must be a checked out repository');
  const asSystem = isSystemProfile(env.USERPROFILE) || isSystemProfile(env.APPDATA);
  const roaming = asSystem ? path.join(home, 'AppData/Roaming') : (env.APPDATA || 'C:/Users/franc/AppData/Roaming');
  const local = asSystem ? path.join(home, 'AppData/Local') : (env.LOCALAPPDATA || 'C:/Users/franc/AppData/Local');
  // Under the system account a CLI also reads its sign-in from the founder's profile.
  const profileEnv = asSystem ? { USERPROFILE: home, HOME: home, APPDATA: roaming, LOCALAPPDATA: local } : {};
  const node = process.execPath;
  // A key from the one key store, for one child process only; never logged, never stored with the job.
  const keyOf = (...names) => { for (const n of names) { try { const v = env[n] || getKey(n); if (v) return v; } catch { /* missing */ } } return ''; };
  const claudeExe = path.join(roaming, 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe');
  // The agents a job can go to (founder 2026-10-15, verbatim: "please add grok minimax and fix cli"). Hermes is
  // removed: "Direct connections only" (2026-10-09), and C:/hermes/bin/hermes.exe is gone. Each has its own
  // --help probe; a status says ready, or the exact reason and the fix.
  const definitions = {
    claude: { binary: claudeExe, prefix: [], label: 'Claude Code', fix: 'Install Claude Code: npm install -g @anthropic-ai/claude-code', help: ['--help'], markers: ['--print', '--permission-mode'], args: ['--print', '--permission-mode', 'default', '--output-format', 'text'] },
    codex: { binary: path.join(local, 'OpenAI/Codex/bin/codex.exe'), prefix: [], label: 'Codex', fix: 'Install the Codex app or CLI so codex.exe is in AppData/Local/OpenAI/Codex/bin', help: ['exec', '--help'], markers: ['workspace-write', '--json'], args: ['exec', '--sandbox', 'workspace-write', '--cd', root, '--json', '-'] },
    // Gemini CLI runs unattended only with GEMINI_API_KEY (Lane-Facts: DOWN, unauthenticated) and a trusted folder;
    // its default model (gemini-3.1-pro) has a free-tier quota of 0, so jobs run gemini-2.5-flash (checked 2026-10-15).
    gemini: { binary: node, entry: path.join(roaming, 'npm/node_modules/@google/gemini-cli/bundle/gemini.js'), prefix: [path.join(roaming, 'npm/node_modules/@google/gemini-cli/bundle/gemini.js')], label: 'Gemini CLI', fix: 'npm install -g @google/gemini-cli', keyEnv: () => ({ GEMINI_API_KEY: keyOf('GEMINI_API_KEY', 'AI_STUDIO'), GEMINI_CLI_TRUST_WORKSPACE: 'true' }), keyName: 'GEMINI_API_KEY', help: ['--help'], markers: ['--approval-mode', '--prompt'], args: ['--model', 'gemini-2.5-flash', '--approval-mode', 'default', '--output-format', 'text', '--prompt', 'Perform the scoped task supplied on stdin.'] },
    // Grok Build CLI (1.0.46): single-turn from a prompt file, headless, plain output. Its own default model routes
    // through OmniRoute (removed, "Direct connections only"), so jobs pick grok-45-xai, xAI direct (checked 2026-10-15).
    grok: { binary: path.join(home, '.grok/bin/grok.exe'), prefix: [], label: 'Grok CLI', fix: 'Install the Grok CLI (grok update) so ~/.grok/bin/grok.exe exists', keyEnv: () => ({ XAI_API_KEY: keyOf('XAI_API_KEY', 'GROK_API_KEY') }), keyName: 'XAI_API_KEY', help: ['--help'], markers: ['--prompt-file', '--permission-mode', '--output-format'], promptFile: true, args: ['-m', 'grok-45-xai', '--cwd', root, '--permission-mode', 'default', '--output-format', 'plain'] },
    // MiniMax has no coding CLI on this PC (MiniMax Code's mcode-tools only manages its connectors), so a MiniMax
    // job runs the Claude Code CLI on MiniMax's Anthropic-compatible API (api.minimax.io/anthropic, MiniMax-M2.7)
    // with MINIMAX_API_KEY from the store, set for that child process only. The lowercase model id runs (Claude Code
    // prints an unrecognized-model notice and completes); checked 2026-10-15.
    minimax: { binary: claudeExe, prefix: [], label: 'MiniMax (Claude Code CLI on minimax-m2.7)', fix: 'Install Claude Code (it carries the MiniMax job)', keyEnv: () => { const k = keyOf('MINIMAX_API_KEY'); return { ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic', ANTHROPIC_AUTH_TOKEN: k, ANTHROPIC_API_KEY: '', ANTHROPIC_SMALL_FAST_MODEL: 'minimax-m2.7', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'minimax-m2.7', API_TIMEOUT_MS: '3000000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }; }, keyName: 'MINIMAX_API_KEY', keyCheck: e => !!e.ANTHROPIC_AUTH_TOKEN, help: ['--help'], markers: ['--print', '--permission-mode'], args: ['--print', '--model', 'minimax-m2.7', '--permission-mode', 'default', '--output-format', 'text'] }
  };
  const children = new Map();
  const liveJobs = new Map();
  const pending = new Map();
  const keyReady = d => { if (!d.keyEnv) return true; const e = d.keyEnv(); return d.keyCheck ? d.keyCheck(e) : Object.values(e).every(Boolean); };
  const childEnv = d => ({ ...env, ...profileEnv, ...(d.keyEnv ? d.keyEnv() : {}) });
  const caps = Object.fromEntries(Object.entries(definitions).map(([target, d]) => [target, { target, name: d.label, installed: fs.existsSync(d.binary) && (!d.entry || fs.existsSync(d.entry)), probed: false, ready: false, contractVerified: false, authVerified: false, authenticated: null, keyPresent: d.keyEnv ? keyReady(d) : null, reason: 'CLI help has not been probed', fix: null }]));
  const now = () => new Date(clock()).toISOString();
  const list = () => clone(store.snapshot().jobs || []);
  const get = id => list().find(j => j.id === id) || null;
  function save(job, updates) {
    const next = { ...job, ...updates, updatedAt: now() };
    store.applyEvent({ type: 'job.upsert', payload: next, requestId: `job-event:${randomUUID()}` });
    Object.assign(job, next);
    return clone(next);
  }
  for (const job of list()) if (ACTIVE.has(job.status)) save(job, { status: 'interrupted', endedAt: now(), error: 'Server restarted; previous process ownership was lost. No automatic replay.', verificationPending: true });

  async function probeCapabilities() {
    await Promise.all(Object.entries(definitions).map(([target, d]) => new Promise(resolve => {
      if (!caps[target].installed) { caps[target] = { ...caps[target], probed: true, ready: false, reason: 'Not installed: ' + (d.entry || d.binary) + ' is missing', fix: d.fix }; return resolve(); }
      if (d.keyEnv && !keyReady(d)) { caps[target] = { ...caps[target], probed: true, ready: false, keyPresent: false, reason: d.keyName + ' is not in the key store', fix: 'Add ' + d.keyName + ' to the one key store (vault file named in key-targets.json)' }; return resolve(); }
      let child, output = '', finished = false;
      const finish = (code, reason) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        const valid = code === 0 && d.markers.every(marker => output.includes(marker));
        const missing = d.markers.filter(marker => !output.includes(marker));
        caps[target] = { ...caps[target], probed: true, ready: valid && !!d.args, contractVerified: valid && !!d.args, authVerified: false, keyPresent: d.keyEnv ? true : null, reason: reason || (!valid ? (code !== 0 ? 'The --help probe exited with code ' + code : 'The --help output lacks ' + missing.join(', ')) : !d.args ? 'Headless permission contract has not been verified' : 'Ready: --help passed' + (d.keyEnv ? ', ' + d.keyName + ' from the key store' : '') + '. Sign-in and a real task are checked by the first job.'), fix: valid ? null : d.fix };
        resolve();
      };
      const timer = setTimeout(() => { child?.kill(); finish(null, 'CLI help probe timed out'); }, 15000);
      try {
        child = spawnImpl(d.binary, [...d.prefix, ...d.help], { cwd: root, env: childEnv(d), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout?.on('data', b => { output = (output + b.toString()).slice(-50000); });
        child.stderr?.on('data', b => { output = (output + b.toString()).slice(-50000); });
        child.once('error', () => finish(null, 'CLI help could not start'));
        child.once('close', code => finish(code));
      } catch { finish(null, 'CLI help could not start'); }
    })));
    return capabilities();
  }
  function capabilities() { return clone(Object.values(caps)); }
  function validate(input) {
    if (!input || !ID.test(input.requestId || '') || !ID.test(input.taskId || '')) throw failure('requestId and taskId are required');
    if (!Object.hasOwn(definitions, input.target)) throw failure('Unsupported agent target');
    if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 30000) throw failure('A task prompt of 1–30000 characters is required');
    if (!input.context || Object.getPrototypeOf(input.context) !== Object.prototype || Object.keys(input.context).length !== 1 || !ID.test(input.context.dispatchReceiptId || '')) throw failure('Context must contain only a valid dispatchReceiptId from the server compiler');
    for (const name of ['cwd', 'repoRoot']) if (input[name]) {
      let requested; try { requested = fs.realpathSync(input[name]); } catch { throw failure('Job repository does not exist'); }
      if (requested !== root) throw failure('Job repository must exactly match the builder repository');
    }
    if (['command', 'binary', 'args', 'env', 'shell', 'executable'].some(key => Object.hasOwn(input, key))) throw failure('Caller supplied process settings are forbidden');
  }
  async function start(input) {
    validate(input);
    const digest = createHash('sha256').update(JSON.stringify({ taskId: input.taskId, target: input.target, prompt: input.prompt, context: input.context })).digest('hex');
    const previous = list().find(j => j.requestId === input.requestId);
    if (previous) { if (previous.inputDigest !== digest) throw failure('requestId already belongs to a different job', 409); return previous; }
    if (pending.has(input.requestId)) { const p = pending.get(input.requestId); if (p.digest !== digest) throw failure('requestId already pending with different content', 409); return p.promise; }
    const promise = launch(input, digest);
    pending.set(input.requestId, { digest, promise });
    try { return await promise; } finally { pending.delete(input.requestId); }
  }
  async function launch(input, digest) {
    if (typeof authorizeJob !== 'function') throw failure('Source and action gate is not configured; launch is blocked', 403);
    const gate = await authorizeJob(clone(input));
    if (!gate || gate.allowed !== true) throw failure(gate?.reason || 'Source or action gate denied this job', 403);
    if (!caps[input.target].probed) await probeCapabilities();
    if (!caps[input.target].ready) throw failure(caps[input.target].reason, 503);
    const job = { id: randomUUID(), requestId: input.requestId, inputDigest: digest, taskId: input.taskId, target: input.target, prompt: input.prompt, context: input.context, cwd: root, status: 'queued', createdAt: now(), updatedAt: now(), logTail: '', totalOutputBytes: 0, outputTruncated: false, pid: null, verificationPending: true, gate: { allowed: true, checkedAt: now() } };
    save(job, {});
    const d = definitions[input.target];
    save(job, { status: 'spawning' });
    let child;
    const log = (stream, b) => {
      const text = b.toString();
      const combined = `${job.logTail}[${stream}] ${text}`;
      save(job, { logTail: combined.slice(-60000), totalOutputBytes: job.totalOutputBytes + Buffer.byteLength(text), outputTruncated: job.outputTruncated || combined.length > 60000 });
    };
    const scopedPrompt = `Repository: ${root}\nTask: ${job.taskId}\nKeep clinical, production-data, external-send, merge and production-release gates. Do not perform those actions without their explicit separate authorization. Report completed work and unresolved checks.\n\n${job.prompt}`;
    // An agent that takes its prompt from a file (Grok) gets it in the gitignored runtime folder, not on stdin.
    let promptPath = null;
    if (d.promptFile) { const dir = path.join(root, '.runtime', 'production-builder', 'jobs'); fs.mkdirSync(dir, { recursive: true }); promptPath = path.join(dir, job.id + '.prompt.txt'); fs.writeFileSync(promptPath, scopedPrompt); }
    try {
      child = spawnImpl(d.binary, [...d.prefix, ...d.args, ...(promptPath ? ['--prompt-file', promptPath] : [])], { cwd: root, env: childEnv(d), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      children.set(job.id, child);
      liveJobs.set(job.id, job);
      child.stdout?.on('data', b => { if (job.status === 'accepted') save(job, { status: 'running' }); log('stdout', b); });
      child.stderr?.on('data', b => log('stderr', b));
      child.stdin?.on('error', e => log('stdin', e.message));
      child.once('spawn', () => {
        if (!child.pid) return;
        if (job.status === 'cancelled') { child.kill(); return; }
        save(job, { status: 'accepted', pid: child.pid, acceptedAt: now() });
        child.stdin?.end(promptPath ? '' : scopedPrompt);
      });
      child.once('error', e => { children.delete(job.id); liveJobs.delete(job.id); if (job.status !== 'cancelled') save(job, { status: 'failed', error: e.message, endedAt: now() }); });
      child.once('close', (code, signal) => {
        children.delete(job.id);
        liveJobs.delete(job.id);
        if (job.status === 'cancelled') save(job, { exitCode: code, signal });
        if (job.status !== 'cancelled' && job.status !== 'failed') save(job, { status: code === 0 && job.pid ? 'completed' : 'failed', exitCode: code, signal, endedAt: now(), verificationPending: true, ...(code === 0 && job.pid ? {} : { error: `Agent process exited with code ${code}` }) });
      });
    } catch (e) { children.delete(job.id); liveJobs.delete(job.id); save(job, { status: 'failed', error: e.message, endedAt: now() }); }
    return clone(job);
  }
  function cancel(id) {
    const stored = get(id); if (!stored) throw failure('Job not found', 404);
    const child = children.get(id);
    if (!ACTIVE.has(stored.status)) return stored;
    if (!child) throw failure('Process is no longer owned by this server', 409);
    const live = liveJobs.get(id);
    const priorStatus = live.status;
    save(live, { status: 'cancelled', endedAt: now(), cancellation: 'Owned child process signalled; descendant termination is not asserted' });
    if (!child.kill()) { save(live, { status: priorStatus, endedAt: null, error: 'Owned process could not be signalled' }); throw failure('Owned process could not be signalled', 409); }
    return get(id);
  }
  return { start, list, get, cancel, capabilities, probeCapabilities };
}

function createJobsRouter({ manager }) {
  const router = require('express').Router();
  router.get('/', (_req, res) => res.json({ jobs: manager.list(), targets: manager.capabilities() }));
  router.get('/:id', (req, res) => { const job = manager.get(req.params.id); res.status(job ? 200 : 404).json(job || { error: 'Job not found' }); });
  router.post('/', async (req, res, next) => { try { res.status(202).json(await manager.start(req.body)); } catch (e) { next(e); } });
  router.post('/:id/cancel', (req, res, next) => { try { res.json(manager.cancel(req.params.id)); } catch (e) { next(e); } });
  router.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  return router;
}
module.exports = { createJobManager, createJobsRouter, userHome, isSystemProfile };
