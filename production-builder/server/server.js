// server.js - GluMira local model proxy and chat page, on the founder's Gemini account.
//
// One file, Express is the only dependency. Listens on 127.0.0.1 only. One backend: Google Gemini
// through its OpenAI-compatible endpoint (founder 2026-10-06, verbatim: "CONNECT CHAT TO MY GEMINI
// ACCOUNT / REMOVE ALL OTHERS").
//   GET  /health                 {ok, key_present}
//   GET  /v1/models              live Gemini chat models on the account
//   POST /v1/chat/completions    OpenAI-compatible passthrough, stream and non-stream
//   POST /api/chat               chat.html backend, always SSE, system prompt prepended
//   POST /api/lane               Production Builder lane bridge: OmniRoute free combo, lane named in the reply
//   GET  /api/lane/status        read-only lane probe
//   POST /api/diary/save-chat    writes data/raw/<date>-<slug>.md to Daily-Diary on GitHub
//   POST /api/builder/github     localhost GitHub read/write for the + menu
//   POST /api/builder/bash       localhost terminal in the repo checkout
//   POST /api/builder/service/start   start the GlumiraProxy Windows service
//   GET  /, /builder             the Production Builder page (apps/ais-builder/dist), and chat.html
//
// Keys: one key store (founder 2026-10-06, verbatim: "put all keys and secrets in 1 place - 1 rule
// for all"). Process env first, then the vault file named in key-targets.json. No .env here.
// Never prints a key value.

"use strict";

const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { mountLaneBridge } = require("./lane-bridge");

const HERE = __dirname;

// Seven PB fix modules are ESM (.mjs). Load once via dynamic import from this CommonJS server.
let pbLibPromise = null;
function loadPbLib() {
  if (!pbLibPromise) {
    pbLibPromise = Promise.all([
      import("./lib/questions.mjs"),
      import("./lib/sources.mjs"),
      import("./lib/modelFormat.mjs"),
      import("./lib/skills.mjs"),
      import("./lib/guard.mjs"),
      import("./lib/rules.mjs"),
      import("./lib/complete.mjs"),
    ]).then(([questions, sources, modelFormat, skills, guard, rules, complete]) => ({
      questions, sources, modelFormat, skills, guard, rules, complete,
    }));
  }
  return pbLibPromise;
}
const PORT = Number(process.env.PORT) || 3001;
const HOST = "127.0.0.1";
const HUB = process.env.GOVERNANCE_HUB || "C:/memory-governance-archive";
const KEY_TARGETS = path.join(HUB, "governance/tools/vault/key-targets.json");

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const FALLBACK_MODEL = "gemini-2.5-flash"; // used only when the vault has no GEMINI_CHAT_MODEL
// Chat models only: voice, image, embedding, live-audio and tool-preview models are left out.
const NOT_CHAT = /tts|image|embedding|audio|live|transcribe|robotics|computer-use|customtools/;
const MODELS_TTL_MS = 10 * 60 * 1000;
const FIRST_BYTE_MS = 90 * 1000; // upstream must start answering within this
const RETRY_DELAYS_MS = [1000, 3000]; // busy (429/503) retries, inside the first-byte budget
const DIARY_REPO = "francoissteyn-2026/Daily-Diary";
// Founder's prompt compiler, verbatim from his server.js of 2026-10-06.
const SYSTEM_PROMPT =
  "You are a prompt compiler. You do not answer questions. You do not build things. " +
  "You do not write diary entries. You compile ideas into prompts. " +
  "If the user gives you an idea without enough context, ask 4-6 numbered clarifying " +
  "questions, no preamble, just the questions. Once you have answers, output a single " +
  "structured prompt using this exact shape: " +
  "<role>...</role><context>...</context><task>...</task>" +
  "<constraints>- ...</constraints><done_when>...</done_when>. " +
  "Never produce diary sections. Never produce Wins, Losses, Key Decisions, Signals, " +
  "or Tomorrow's Focus. Never explain your own behavior.";

// ---------- keys ----------

// Same parsing as governance/tools/vault/sync-keys.mjs: KEY=VALUE, may be indented or exported,
// # lines skipped, surrounding quotes stripped, trailing " # comment" dropped on unquoted values.
const LINE = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
function unquote(raw) {
  const v = raw.trim();
  if (/^".*"$|^'.*'$/.test(v)) return v.slice(1, -1);
  return v.replace(/\s+#.*$/, "");
}
function parseEnv(text) {
  const out = {};
  for (const l of text.split(/\r?\n/)) {
    if (/^\s*#/.test(l)) continue;
    const m = l.match(LINE);
    if (!m) continue;
    const v = unquote(m[4]);
    if (v) out[m[2]] = v;
  }
  return out;
}

let vaultPath = null;
let vaultCache = null;
function vaultFile() {
  if (vaultPath) return vaultPath;
  if (!fs.existsSync(KEY_TARGETS)) {
    throw new Error(`Key store index not found: ${KEY_TARGETS} (set GOVERNANCE_HUB if the hub lives elsewhere)`);
  }
  vaultPath = JSON.parse(fs.readFileSync(KEY_TARGETS, "utf8")).vault;
  return vaultPath;
}
function key(name) {
  if (process.env[name]) return process.env[name];
  if (vaultCache === null) {
    const file = vaultFile();
    if (!fs.existsSync(file)) throw new Error(`Vault file not found: ${file}`);
    vaultCache = parseEnv(fs.readFileSync(file, "utf8"));
  }
  return vaultCache[name] || undefined;
}
function optionalKey(name) {
  try {
    return key(name);
  } catch {
    return undefined;
  }
}
function mask(k) {
  if (!k) return "(missing)";
  return k.length > 12 ? `${k.slice(0, 6)}xxxx...${k.slice(-4)}` : "xxxx";
}

// Strip anything that looks like a credential before text leaves this process.
function scrub(text) {
  let s = String(text);
  for (const n of ["GEMINI_API_KEY", "AI_STUDIO", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "XAI_API_KEY", "GROK_API_KEY", "MINIMAX_API_KEY", "MINIMAX_KEY", "OPENROUTER_API_KEY", "NVIDIA_API_KEY", "CEREBRAS_API_KEY", "GH_TOKEN"]) {
    const v = optionalKey(n);
    if (v) s = s.split(v).join("[redacted]");
  }
  if (appTokenCache) s = s.split(appTokenCache.token).join("[redacted]");
  return s.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

function apiError(res, status, message, code) {
  if (res.headersSent) return;
  res.status(status).json({ error: { message: scrub(message), type: "proxy_error", code: code || status } });
}

// ---------- backends ----------

function defaultModel() {
  return optionalKey("GEMINI_CHAT_MODEL") || FALLBACK_MODEL;
}

// The verifier endpoint routes by model name (founder 2026-10-15, "please add grok minimax"; gemini-flash-latest
// answered 503 all day). grok-* goes to xAI, MiniMax-* (any case) to MiniMax direct, everything else to Gemini.
// The order a session should try is in Production-Builder-Operations.md: Gemini flash, MiniMax, Grok (it costs
// the founder money), Gemini flash-lite.
const XAI_BASE = "https://api.x.ai/v1";
const MINIMAX_BASE = "https://api.minimax.io/v1";
function backendFor(model = "") {
  if (/^grok-/i.test(model)) {
    const k = optionalKey("XAI_API_KEY") || optionalKey("GROK_API_KEY");
    if (!k) return { error: "XAI_API_KEY is not in the vault or the environment." };
    return { name: "grok", base: XAI_BASE, key: k, firstByteMs: FIRST_BYTE_MS };
  }
  if (/^minimax-/i.test(model)) {
    const k = optionalKey("MINIMAX_API_KEY");
    if (!k) return { error: "MINIMAX_API_KEY is not in the vault or the environment." };
    return { name: "minimax", base: MINIMAX_BASE, key: k, firstByteMs: FIRST_BYTE_MS };
  }
  const k = optionalKey("GEMINI_API_KEY");
  if (!k) return { error: "GEMINI_API_KEY is not in the vault or the environment." };
  return { name: "gemini", base: GEMINI_BASE, key: k, firstByteMs: FIRST_BYTE_MS };
}

function prepareBody(body) {
  const out = { ...body };
  // Gemini lists ids as "models/gemini-..."; the chat endpoint takes the bare id.
  out.model = String(out.model || defaultModel()).replace(/^models\//, "");
  // MiniMax ids are "MiniMax-M2.7"; accept any case. reasoning_split keeps its thinking out of the answer text.
  if (/^minimax-/i.test(out.model)) {
    const rest = out.model.slice("minimax-".length);
    out.model = "MiniMax-" + rest.charAt(0).toUpperCase() + rest.slice(1);
    out.reasoning_split = true;
  }
  return out;
}

// Calls the upstream chat endpoint and relays the answer. Non-stream: JSON. Stream: SSE frames are
// piped as they arrive and the response always ends with "data: [DONE]". Headers are only sent once
// the first upstream byte arrives, so a hang still becomes a clean JSON 504.
async function relayChat(req, res, body) {
  const payload = prepareBody(body);
  const backend = backendFor(payload.model);
  if (backend.error) return apiError(res, 400, backend.error, "missing_key");
  const stream = payload.stream === true;

  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, backend.firstByteMs);
  res.on("close", () => {
    if (!res.writableEnded) ac.abort();
  });
  const timeoutMsg = () =>
    `Upstream ${backend.name} did not start answering within ${backend.firstByteMs / 1000}s for model ${payload.model}.`;

  // A busy model answers 429/503, sometimes as an SSE error frame inside a 200. Retry those twice
  // before anything reaches the client.
  let up;
  let firstChunk = null;
  let reader = null;
  const decoder = new TextDecoder();
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < RETRY_DELAYS_MS.length;
    try {
      up = await fetch(`${backend.base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backend.key}`,
          "Content-Type": "application/json",
          Accept: stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      let busy = up.status === 429 || up.status === 503;
      if (!busy && up.ok && stream) {
        reader = up.body.getReader();
        const r = await reader.read();
        firstChunk = r.done ? "" : decoder.decode(r.value, { stream: true });
        busy = /^\s*data:\s*\{"error"/.test(firstChunk) && /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit|too many/i.test(firstChunk);
      }
      if (!busy || !canRetry) break;
      if (reader) reader.cancel().catch(() => {});
      else await up.text().catch(() => {});
      reader = null;
      firstChunk = null;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      if (timedOut || res.destroyed) throw new Error("aborted");
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) return apiError(res, 504, timeoutMsg(), "upstream_timeout");
      if (res.destroyed) return;
      return apiError(res, 502, `Upstream ${backend.name} unreachable: ${e.message}`, "upstream_unreachable");
    }
  }

  if (!up.ok || !stream) {
    let text;
    try {
      text = await up.text();
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) return apiError(res, 504, timeoutMsg(), "upstream_timeout");
      return apiError(res, 502, `Upstream ${backend.name} read failed: ${e.message}`, "upstream_read");
    }
    clearTimeout(timer);
    if (!up.ok) {
      let detail = text.slice(0, 500);
      try {
        let j = JSON.parse(text);
        if (Array.isArray(j)) j = j[0] || {}; // Gemini wraps some errors in a one-item array
        detail = (j.error && (j.error.message || j.error)) || j.detail || j.message || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch {}
      return apiError(res, up.status, `Upstream ${backend.name} HTTP ${up.status}: ${detail}`, "upstream_error");
    }
    res.status(200).type("application/json").send(text);
    return;
  }

  // Streaming: the first chunk already arrived inside the retry loop, so the first byte is in.
  clearTimeout(timer);
  if (res.destroyed) {
    reader.cancel().catch(() => {});
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  let tail = firstChunk.slice(-64);
  if (firstChunk) res.write(firstChunk);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      tail = (tail + chunk).slice(-64);
      res.write(chunk);
    }
  } catch (e) {
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ error: { message: scrub(`Stream interrupted: ${e.message}`) } })}\n\n`);
    }
  }
  if (res.destroyed) return;
  if (!/data:\s*\[DONE\]/.test(tail)) {
    if (tail && !tail.endsWith("\n\n")) res.write("\n\n");
    res.write("data: [DONE]\n\n");
  }
  res.end();
}

// ---------- models ----------

let modelsCache = { at: 0, data: null };
async function geminiModels() {
  if (modelsCache.data && Date.now() - modelsCache.at < MODELS_TTL_MS) return modelsCache.data;
  const k = optionalKey("GEMINI_API_KEY");
  if (!k) throw new Error("GEMINI_API_KEY is not in the vault or the environment.");
  const r = await fetch(`${GEMINI_BASE}/models`, {
    headers: { Authorization: `Bearer ${k}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Gemini /models HTTP ${r.status}`);
  const j = await r.json();
  const data = (Array.isArray(j.data) ? j.data : [])
    .map((m) => ({ ...m, id: String(m.id).replace(/^models\//, "") }))
    .filter((m) => /^gemini-/.test(m.id) && !NOT_CHAT.test(m.id));
  modelsCache = { at: Date.now(), data };
  return data;
}

// ---------- GitHub (diary save) ----------

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function appJwt(appId, pem) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claims}`).sign(pem);
  return `${head}.${claims}.${b64url(sig)}`;
}
async function gh(pathname, token, init = {}) {
  const r = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "glumira-local-proxy",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {}
  return { status: r.status, ok: r.ok, json };
}

let appTokenCache = null; // { token, expiresAt, coversRepo }
async function appToken() {
  if (appTokenCache && Date.now() < appTokenCache.expiresAt - 5 * 60 * 1000) return appTokenCache;
  const appId = optionalKey("GITHUB_APP_ID");
  const inst = optionalKey("GITHUB_APP_INSTALLATION_ID");
  const pemPath = optionalKey("GITHUB_APP_PRIVATE_KEY_PATH");
  if (!appId || !inst || !pemPath) return null;
  if (!fs.existsSync(pemPath)) throw new Error("GitHub App private key file named in the vault does not exist.");
  const jwt = appJwt(appId, fs.readFileSync(pemPath, "utf8"));
  const t = await gh(`/app/installations/${inst}/access_tokens`, jwt, { method: "POST" });
  if (!t.ok) throw new Error(`GitHub App token exchange HTTP ${t.status}`);
  const repos = await gh("/installation/repositories?per_page=100", t.json.token);
  const coversRepo =
    repos.ok && (repos.json.repositories || []).some((r) => r.full_name.toLowerCase() === DIARY_REPO.toLowerCase());
  appTokenCache = { token: t.json.token, expiresAt: Date.parse(t.json.expires_at), coversRepo };
  return appTokenCache;
}

// Returns the auth candidates in order: the App when it is installed on Daily-Diary, then GH_TOKEN.
async function diaryAuth() {
  const out = [];
  const notes = [];
  try {
    const a = await appToken();
    if (a && a.coversRepo) out.push({ via: "github-app", token: a.token });
    else if (a) notes.push(`GitHub App is not installed on ${DIARY_REPO}`);
    else notes.push("GitHub App keys not in the vault");
  } catch (e) {
    notes.push(e.message);
  }
  const pat = optionalKey("GH_TOKEN");
  if (pat) out.push({ via: "GH_TOKEN", token: pat });
  else notes.push("GH_TOKEN not in the vault");
  return { candidates: out, notes };
}

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "chat"
  );
}

async function saveChat({ date, title, markdown, dryRun }) {
  const notes = [];
  const { candidates, notes: authNotes } = await diaryAuth();
  notes.push(...authNotes);
  if (!candidates.length) throw Object.assign(new Error(`No GitHub credential works: ${notes.join("; ")}`), { status: 503 });
  const base = `${date}-${slugify(title)}`;
  for (const auth of candidates) {
    // Never overwrite: if the name is taken, add the time.
    let file = `data/raw/${base}.md`;
    const probe = await gh(`/repos/${DIARY_REPO}/contents/${file}`, auth.token);
    if (probe.status === 401 || probe.status === 403) {
      notes.push(`${auth.via}: HTTP ${probe.status} reading the repo`);
      continue;
    }
    if (probe.ok) file = `data/raw/${base}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.md`;
    if (dryRun) return { ok: true, dryRun: true, via: auth.via, path: file, notes };
    const put = await gh(`/repos/${DIARY_REPO}/contents/${file}`, auth.token, {
      method: "PUT",
      body: JSON.stringify({ message: `diary: ${title}`, content: Buffer.from(markdown, "utf8").toString("base64") }),
    });
    if (put.ok) {
      return { ok: true, via: auth.via, path: file, url: put.json && put.json.content && put.json.content.html_url };
    }
    notes.push(`${auth.via}: HTTP ${put.status} ${(put.json && put.json.message) || ""}`.trim());
  }
  throw Object.assign(new Error(`Could not save to ${DIARY_REPO}: ${notes.join("; ")}`), { status: 502 });
}

// ---------- app ----------

const app = express();
app.disable("x-powered-by");

// Only this machine, only by its own name: a foreign Host (DNS rebinding) or a foreign Origin
// (another website in the browser) is refused, so no page elsewhere can spend the keys.
const LOCAL_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
app.use((req, res, next) => {
  if (!LOCAL_HOSTS.has(String(req.headers.host || "").toLowerCase())) {
    return apiError(res, 403, "This proxy only answers on 127.0.0.1.", "bad_host");
  }
  const origin = req.headers.origin;
  if (origin && !LOCAL_HOSTS.has(origin.replace(/^http:\/\//, "").toLowerCase())) {
    return apiError(res, 403, "Cross-origin requests are refused.", "bad_origin");
  }
  next();
});
app.use(express.json({ limit: "23mb" }));

// Initialise once on first use, never while importing helpers in a test.
let builderRuntime;
function getBuilderRuntime() {
  if (!builderRuntime) {
    const { createBuilderRuntime, findRepoRoot } = require("./builder-runtime");
    builderRuntime = createBuilderRuntime({
      repoRoot: findRepoRoot(HERE),
      dataDir: path.join(findRepoRoot(HERE), ".runtime", "production-builder"),
      getKey: optionalKey,
    });
  }
  return builderRuntime;
}
function repoCwd() {
  let dir = HERE;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return HERE;
}
app.post("/api/builder/bash", (req, res) => {
  const command = String((req.body && req.body.command) || "").trim();
  if (!command) return apiError(res, 400, "No command.", "no_command");
  // Interactive terminal from the page opens at C:\. Pass cwd in the body to override; otherwise C:\.
  // Jobs and other repo tools keep using repoCwd() elsewhere.
  const asked = String((req.body && req.body.cwd) || "").trim();
  const cwd = asked === "C:\\" || asked === "C:/" || asked.toLowerCase() === "c:\\" || asked === "C:"
    ? "C:\\"
    : (asked && path.isAbsolute(asked) && !asked.includes("..") ? asked : "C:\\");
  exec(command, { cwd, timeout: 20000, maxBuffer: 200000, windowsHide: true }, (err, stdout, stderr) => {
    const text = `${stdout || ""}${stderr || ""}`.slice(0, 20000);
    if (err && !text) return apiError(res, 500, scrub(err.message), "bash");
    res.json({ ok: !err, text: scrub(text || (err ? err.message : "")), cwd });
  });
});
app.post("/api/builder/github", async (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action === "write" ? "write" : "read";
    const repo = String(body.repo || "Glumira-X-Technologies-cc/Glumira-7.2");
    const branch = String(body.branch || "agent/grok/builder");
    const filePath = String(body.path || "").replace(/^\/+/, "");
    if (!/^[^.][^\\]*\/[^\\]+$/.test(repo) || filePath.includes("..") || !filePath) {
      return apiError(res, 400, "Repository and path are required.", "path");
    }
    const pat = optionalKey("GH_TOKEN");
    if (!pat) return apiError(res, 503, "GH_TOKEN is not in the vault.", "no_token");
    const encoded = filePath.split("/").map(encodeURIComponent).join("/");
    const ref = encodeURIComponent(branch);
    if (action === "read") {
      const got = await gh(`/repos/${repo}/contents/${encoded}?ref=${ref}`, pat);
      if (!got.ok) return apiError(res, got.status, (got.json && got.json.message) || "Could not read that file.", "github");
      const text = Buffer.from(String(got.json.content || "").replace(/\n/g, ""), "base64").toString("utf8");
      return res.json({ ok: true, text, sha: got.json.sha });
    }
    const current = await gh(`/repos/${repo}/contents/${encoded}?ref=${ref}`, pat);
    const putBody = {
      message: `builder: ${filePath}`,
      content: Buffer.from(String(body.content || ""), "utf8").toString("base64"),
      branch,
    };
    if (current.ok && current.json && current.json.sha) putBody.sha = current.json.sha;
    const put = await gh(`/repos/${repo}/contents/${encoded}`, pat, { method: "PUT", body: JSON.stringify(putBody) });
    if (!put.ok) return apiError(res, put.status, (put.json && put.json.message) || "Could not write that file.", "github");
    res.json({ ok: true, text: `Wrote ${filePath} on ${branch}.`, url: put.json && put.json.content && put.json.content.html_url });
  } catch (error) {
    apiError(res, 500, error.message, "github");
  }
});
app.post("/api/builder/service/start", (req, res) => {
  exec("powershell.exe -NoProfile -NonInteractive -Command \"Start-Service -Name GlumiraProxy\"", { timeout: 20000, windowsHide: true }, (err, stdout, stderr) => {
    const detail = `${stdout || ""} ${stderr || ""} ${err ? err.message : ""}`;
    if (err && !/already running|already been started/i.test(detail)) return apiError(res, 500, scrub(detail).trim() || "The service did not start.", "service");
    res.json({ ok: true });
  });
});
app.use("/api/builder", (req, res, next) => {
  try { getBuilderRuntime().router(req, res, next); } catch (error) { next(error); }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, key_present: Boolean(optionalKey("GEMINI_API_KEY")) });
});

// Gemini's live list, plus the Grok and MiniMax models this endpoint also routes, when their keys are present.
app.get("/v1/models", async (req, res) => {
  let data = [], geminiError = null;
  try { data = await geminiModels(); } catch (e) { geminiError = e; }
  if (optionalKey("MINIMAX_API_KEY")) data = data.concat(["MiniMax-M3", "MiniMax-M2.7"].map((id) => ({ id, object: "model", owned_by: "minimax" })));
  if (optionalKey("XAI_API_KEY") || optionalKey("GROK_API_KEY")) data = data.concat([{ id: optionalKey("GROK_MODEL") || "grok-4.5", object: "model", owned_by: "xai" }]);
  if (!data.length && geminiError) return apiError(res, 502, `Model list unavailable: ${geminiError.message}`, "models_unavailable");
  res.json({ object: "list", data, default: defaultModel() });
});

app.post("/v1/chat/completions", (req, res) => {
  const body = req.body;
  if (!body || !Array.isArray(body.messages)) return apiError(res, 400, "Body needs a messages array.", "bad_request");
  relayChat(req, res, body).catch((e) => apiError(res, 500, e.message, "proxy_failure"));
});

// Lane bridge first so callLane can wrap runLane for the governed chat flow.
const laneBridge = mountLaneBridge(app, { optionalKey, apiError }); // /api/lane and /api/lane/status

async function callLane(prompt, _lane) {
  const r = await laneBridge.runLane({ prompt });
  if (!r.ok) throw new Error(r.message || "lane failed");
  return { text: r.text, lane: r.lane };
}

// Governed build flow: { message, answers, lane } → clarify | blocked | done.
// Legacy chat.html keeps { messages } SSE through relayChat.
async function handleGovernedChat(req, res) {
  const lib = await loadPbLib();
  const { nextQuestion, isReady, buildInterrogationBlock } = lib.questions;
  const { SourceLedger } = lib.sources;
  const { formatPrompt, detectFamily } = lib.modelFormat;
  const { resolveSkill, routingBlock } = lib.skills;
  const { guarded } = lib.guard;
  const { evaluate } = lib.rules;
  const { ensureArtifact } = lib.complete;

  const { message, answers = {}, lane = process.env.MODEL_LANE || "gemini" } = req.body || {};

  // 1. Interrogate before doing anything else
  if (!isReady(answers)) {
    const q = nextQuestion(answers);
    return res.json({ phase: "clarify", ...q, answers });
  }

  // 2. Gather sources
  const ledger = new SourceLedger();
  for (const f of String(answers.context || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean)) {
    try {
      await ledger.readFile(process.cwd(), f);
    } catch {
      /* refused paths stay out of the ledger */
    }
  }

  // 3. Route skill
  const skill = resolveSkill(message);

  // 4. Pre-flight gate
  const pre = evaluate({ answers, sources: ledger.toJSON().entries, skill, family: detectFamily(lane) }, "pre");
  if (!pre.ok) return res.status(422).json({ phase: "blocked", ...pre });

  // 5. Compile
  const task = message;
  const prompt = formatPrompt({
    task,
    lane,
    blocks: [buildInterrogationBlock(answers), routingBlock(skill), ledger.toBlock()],
  });

  // 6. Generate under guard + artifact enforcement
  const { text, retries, ok, reason } = await ensureArtifact({
    task: prompt,
    generate: async (p) => {
      const g = await guarded(() => callLane(p, lane), { label: "chat" });
      if (g.verdict === "FAIL" && !g.text) throw new Error(g.report.failures.join("; "));
      return g.text;
    },
  });

  // 7. Post-flight gate
  const post = evaluate(
    { answers, sources: ledger.toJSON().entries, skill, family: detectFamily(lane), output: text },
    "post"
  );
  if (!post.ok) return res.status(422).json({ phase: "blocked", ...post, output: text });

  res.json({
    phase: "done",
    text,
    retries,
    artifactOk: ok,
    reason,
    sources: ledger.toJSON(),
    skill,
    rules: post.report,
  });
}

app.post("/api/chat", (req, res) => {
  const b = req.body || {};
  // New governed flow (message string). Existing chat.html keeps messages + SSE.
  if (typeof b.message === "string") {
    handleGovernedChat(req, res).catch((e) => apiError(res, 500, e.message, "proxy_failure"));
    return;
  }
  if (!Array.isArray(b.messages)) return apiError(res, 400, "Body needs a messages array.", "bad_request");
  const messages = b.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));
  const body = {
    model: b.model || defaultModel(),
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: true,
    max_tokens: 4096,
  };
  relayChat(req, res, body).catch((e) => apiError(res, 500, e.message, "proxy_failure"));
});

app.post("/api/diary/save-chat", async (req, res) => {
  const { date, title, markdown, dryRun } = req.body || {};
  if (dryRun !== true && req.body?.confirmExternalSend !== true) {
    return apiError(res, 409, "Publishing to the external diary requires explicit confirmation. Local notes are saved through the Builder.", "external_send_confirmation_required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return apiError(res, 400, "date must be YYYY-MM-DD.", "bad_request");
  if (!title || typeof title !== "string") return apiError(res, 400, "title is required.", "bad_request");
  if (!markdown || typeof markdown !== "string") return apiError(res, 400, "markdown is required.", "bad_request");
  try {
    res.json(await saveChat({ date, title: title.slice(0, 120), markdown, dryRun: dryRun === true }));
  } catch (e) {
    apiError(res, e.status || 500, e.message, "diary_save_failed");
  }
});

// The Production Builder page, built into apps/ais-builder/dist of this checkout (the folder with .git and
// Foyer/FOYER.json above this one, never another checkout). One process serves that page and the API.
function aisDist() {
  let dir = HERE;
  while (path.dirname(dir) !== dir) {
    if (fs.existsSync(path.join(dir, ".git")) && fs.existsSync(path.join(dir, "Foyer", "FOYER.json"))) {
      const dist = path.join(dir, "apps", "ais-builder", "dist");
      return fs.existsSync(path.join(dist, "index.html")) ? dist : null;
    }
    dir = path.dirname(dir);
  }
  return null;
}
// One Builder (2026-10-14): the AI Studio page in apps/ais-builder/dist is the only Builder page. The old
// production-builder/index.html is retired and no longer served. With no built page, a short notice
// names the build command instead of falling back to the old page.
const BUILD_COMMAND = "cd apps\\ais-builder; npm ci; npm run build";
function sendBuilder(res, next) {
  const dist = aisDist();
  // root option: only the part below it is checked for dot-folders, so a checkout under .claude works.
  if (dist) return res.sendFile("index.html", { root: dist }, (err) => err && next(err));
  res.status(503).type("html").send(
    '<!doctype html><meta charset="utf-8"><title>Production Builder</title>' +
    '<body style="font:15px system-ui;margin:3rem;background:#F7F6F1;color:#102347">' +
    "<h1>The Builder page is not built yet</h1>" +
    "<p>From the repository root, in PowerShell:</p><pre>" + BUILD_COMMAND + "</pre>" +
    "<p>Then reload this page. The API is running.</p></body>"
  );
}
app.get("/", (req, res, next) => { sendBuilder(res, next); });
app.get("/builder", (req, res, next) => { sendBuilder(res, next); });
// Old /index.html bookmarks land on the builder.
app.get("/index.html", (req, res) => {
  res.redirect(302, "/builder");
});
app.get("/chat.html", (req, res, next) => {
  res.sendFile("chat.html", { root: HERE }, (err) => err && next(err));
});
// Built page assets (JS, CSS, icons), found on each request so a build after start needs no restart.
// API routes above are already matched, so this cannot hide them. Never the store, server code or keys.
const statics = new Map();
app.use((req, res, next) => {
  const dist = aisDist();
  if (!dist) return next();
  if (!statics.has(dist)) statics.set(dist, express.static(dist, { dotfiles: "deny", index: false }));
  statics.get(dist)(req, res, next);
});

app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return apiError(res, 400, "Body is not valid JSON.", "bad_json");
  const status = (err && (err.status || err.statusCode)) || 500;
  apiError(res, status, (err && err.message) || "Unexpected error", status === 404 ? "not_found" : "proxy_failure");
});

// ---------- start ----------

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[builder] http://${HOST}:${PORT}/`);
  });
  server.on("error", (e) => {
    console.error(`[proxy] cannot listen on ${HOST}:${PORT}: ${e.message}`);
    process.exit(1);
  });

  // Under the service (PROXY_SELF_RELOAD=1): exit when any server file of this folder changes (server.js,
  // lane-bridge.js, builder-*.js), e.g. after a git pull, so NSSM starts the new code. No admin needed for
  // code updates: a fix in builder-web.js alone once stayed unloaded until a manual restart. One stat per
  // file every 2 seconds.
  if (process.env.PROXY_SELF_RELOAD === "1") {
    const watched = fs.readdirSync(HERE).filter((f) => /^(server|lane-bridge|builder-[\w-]+)\.js$/.test(f));
    let exiting = false;
    for (const f of watched) {
      fs.watchFile(path.join(HERE, f), { interval: 2000 }, (cur, prev) => {
        if (exiting || cur.mtimeMs === prev.mtimeMs) return;
        exiting = true;
        console.log(`[proxy] ${f} changed, exiting so the service starts the new code`);
        server.close();
        setTimeout(() => process.exit(0), 300);
      });
    }
    console.log(`[proxy] self-reload on: restarts when ${watched.length} server files change`);
  }
}

module.exports = { app, parseEnv, mask, scrub, slugify, backendFor, prepareBody };
