// lane-bridge.js - the Production Builder lane bridge (build parcel P5, docs/Production-Builder-OS-Architecture_v1.0.md).
//
// Take it further, Write the prompt and Vent call the model through the founder's Gemini account first
// (founder 2026-10-06: "put it on gemini as default"), then the OmniRoute FREE combo on this machine
// (127.0.0.1:20128) as the fallback. The lane is picked by code, named on screen, never chosen by the founder.
//   GET  /api/lane/status   read-only probe: is the lane reachable, is the key present. No model call.
//   POST /api/lane          {prompt, json?, system?, maxTokens?} -> {ok, lane, text, json?, tried}
//
// Free-first law: an OmniRoute combo whose name does not contain "free" is refused ("not_free"), so this
// bridge can never spend a paid OmniRoute lane by accident. The key is read from the one key store
// through the caller's key function and never leaves this process.
//
// Lane order: Gemini, then OmniRoute free. OmniRoute is used ONLY when Gemini is out of quota or credit (founder
// 2026-10-06: "Narrow the fallback to quota errors only"). Any other Gemini failure (bad key, missing key, 5xx,
// timeout, empty answer, wrong shape) stops there and is reported, so the fallback never hides a real fault.
// LANE_GEMINI=0 takes Gemini out and leaves OmniRoute alone.

"use strict";

const DEFAULT_BASE = "http://127.0.0.1:20128/v1";
// Measured 2026-10-06: vscode-free-auto (the key store's OMNIROUTE_COMBO) answered 502, its members return 401 or "not available", while
// auto/best-free answered 200 in about a second. Both names hold "free", so the free-first law passes.
const DEFAULT_COMBO = "auto/best-free";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const CALL_MS = 90 * 1000;
const PROBE_MS = 4 * 1000;
const MAX_PROMPT = 60000;

// Quota or credit trouble, as Gemini reports it: HTTP 429 or 402, a RESOURCE_EXHAUSTED status, or a 403 that
// names quota, billing or credit. A 429 rate limit counts: it is the same status Gemini uses for both.
function isQuotaError(status, body) {
  const t = String(body || "");
  if (status === 429 || status === 402) return true;
  if (/RESOURCE_EXHAUSTED/i.test(t)) return true;
  return status === 403 && /quota|billing|credit/i.test(t);
}

// First balanced {...} object in model text; tolerates ```json fences and chatter around it.
function extractJson(text) {
  const s = String(text || "").replace(/```(?:json)?/gi, "");
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          const v = JSON.parse(s.slice(start, i + 1));
          if (v && typeof v === "object" && !Array.isArray(v)) return v;
        } catch {
          /* not JSON, try the next opening brace */
        }
        break;
      }
    }
  }
  return null;
}

function createLaneBridge({ optionalKey, fetchImpl, env, callMs, probeMs } = {}) {
  const get = optionalKey || (() => undefined);
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const envv = env || process.env;
  const callTimeout = callMs || CALL_MS;
  const probeTimeout = probeMs || PROBE_MS;

  const scrub = (t) => {
    let s = String(t);
    for (const n of ["OMNIROUTE_API_KEY", "GEMINI_API_KEY"]) {
      const v = get(n);
      if (v) s = s.split(v).join("[redacted]");
    }
    return s.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  };

  function lanes() {
    const out = [];
    if (envv.LANE_GEMINI !== "0") {
      const model = String(get("GEMINI_CHAT_MODEL") || "gemini-2.5-flash").replace(/^models\//, "");
      out.push({ id: "gemini", label: "Gemini account (" + model + ")", base: GEMINI_BASE, model, key: get("GEMINI_API_KEY"), keyName: "GEMINI_API_KEY", free: true, quotaOnly: true });
    }
    // Not OMNIROUTE_COMBO: the shared key store sets that to vscode-free-auto for other tools, and that combo is dead
    // upstream today. This bridge has its own override, LANE_OMNIROUTE_COMBO.
    const combo = get("LANE_OMNIROUTE_COMBO") || DEFAULT_COMBO;
    out.push({
      id: "omniroute-free",
      label: "OmniRoute free lane (" + combo + ")",
      base: (get("OMNIROUTE_BASE_URL_V1") || DEFAULT_BASE).replace(/\/+$/, ""),
      model: combo,
      key: get("OMNIROUTE_API_KEY"),
      keyName: "OMNIROUTE_API_KEY",
      free: /free/i.test(combo),
    });
    return out;
  }

  async function timed(url, init, ms, consume) {
    const ac = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error('Response deadline exceeded'), { name: 'AbortError' }));
        ac.abort();
      }, ms);
    });
    try {
      // Headers alone are not a complete response. Keep the deadline active while
      // reading the body, including error bodies and model-list probes.
      return await Promise.race([Promise.resolve().then(async () => consume(await doFetch(url, { ...init, signal: ac.signal }))), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function status() {
    const out = [];
    for (const l of lanes()) {
      const row = { id: l.id, label: l.label, model: l.model, free: l.free, keyPresent: Boolean(l.key), reachable: false, listed: null };
      try {
        const r = await timed(l.base + "/models", { headers: l.key ? { Authorization: "Bearer " + l.key } : {} }, probeTimeout, async response => ({ ok: response.ok, status: response.status, json: response.ok ? await response.json().catch(() => null) : null }));
        row.reachable = r.ok;
        row.httpStatus = r.status;
        if (r.ok) {
          const j = r.json;
          if (j && Array.isArray(j.data)) row.listed = j.data.some((m) => m && String(m.id).replace(/^models\//, "") === l.model);
        }
      } catch (e) {
        row.error = scrub(e && e.name === "AbortError" ? "no answer in " + probeTimeout / 1000 + "s" : (e && e.message) || "unreachable");
      }
      out.push(row);
    }
    return { lanes: out };
  }

  // One model call down the free-first lane list. Never throws for lane trouble: returns ok:false with
  // a plain-words message and the per-lane result, so the page can say what happened.
  async function runLane(input) {
    const b = input || {};
    const prompt = typeof b.prompt === "string" ? b.prompt : "";
    if (!prompt.trim()) return { ok: false, status: 400, code: "bad_request", message: "The lane bridge needs a prompt.", tried: [] };
    if (prompt.length > MAX_PROMPT) return { ok: false, status: 413, code: "too_long", message: "That is too long for one lane call.", tried: [] };
    const messages = [];
    if (typeof b.system === "string" && b.system.trim()) messages.push({ role: "system", content: b.system });
    messages.push({ role: "user", content: prompt });
    const maxTokens = Math.max(64, Math.min(4096, Number(b.maxTokens) || 2048));
    const tried = [];
    for (const l of lanes()) {
      // A quotaOnly lane hands over to the next lane for a quota or credit error and for nothing else.
      const fail = (entry, quota) => {
        tried.push(entry);
        if (l.quotaOnly && !quota) return { ok: false, status: 502, code: "lane_failed", message: entry.message.replace(/\.?$/, ".") + " That is not a quota error, so the next lane was not tried.", tried };
        return null;
      };
      if (!l.free) { tried.push({ id: l.id, ok: false, code: "not_free", message: l.label + " is not a free combo, so it was not used." }); continue; }
      if (!l.key) { const x = fail({ id: l.id, ok: false, code: "missing_key", message: l.keyName + " is not in the key store." }, false); if (x) return x; continue; }
      let r;
      try {
        r = await timed(l.base + "/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + l.key, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ model: l.model, messages, max_tokens: maxTokens, stream: false }),
        }, callTimeout, async response => ({ ok: response.ok, status: response.status, json: response.ok ? await response.json().catch(() => null) : null, raw: response.ok ? '' : await response.text().catch(() => '') }));
      } catch (e) {
        const timedOut = e && e.name === "AbortError";
        const x = fail({ id: l.id, ok: false, code: timedOut ? "timeout" : "unreachable", message: scrub(timedOut ? l.label + " did not answer in " + callTimeout / 1000 + "s." : l.label + " is not reachable: " + ((e && e.message) || "no answer"))}, false);
        if (x) return x;
        continue;
      }
      if (!r.ok) {
        const raw = r.raw;
        const body = scrub(raw).slice(0, 200);
        const x = fail({ id: l.id, ok: false, code: "http_" + r.status, message: l.label + " answered " + r.status + (body ? ": " + body : "") }, isQuotaError(r.status, raw));
        if (x) return x;
        continue;
      }
      const j = r.json;
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (typeof text !== "string" || !text.trim()) { const x = fail({ id: l.id, ok: false, code: "empty", message: l.label + " sent an empty answer." }, false); if (x) return x; continue; }
      const lane = { id: l.id, label: l.label, model: l.model };
      if (b.json) {
        const parsed = extractJson(text);
        if (!parsed) { const x = fail({ id: l.id, ok: false, code: "bad_json", message: l.label + " did not answer in the shape asked for." }, false); if (x) return x; continue; }
        tried.push({ id: l.id, ok: true });
        return { ok: true, lane, text, json: parsed, tried };
      }
      tried.push({ id: l.id, ok: true });
      return { ok: true, lane, text, tried };
    }
    return { ok: false, status: 502, code: "no_lane", message: "No free lane answered. " + tried.map((t) => t.message.replace(/\.?$/, ".")).join(" "), tried };
  }

  return { lanes, status, runLane };
}

// Adds the two routes to the proxy's Express app. The proxy's host and origin guard already covers them.
function mountLaneBridge(app, { optionalKey, apiError }) {
  const bridge = createLaneBridge({ optionalKey });
  app.get("/api/lane/status", async (req, res) => {
    try {
      res.json(await bridge.status());
    } catch (e) {
      apiError(res, 500, e.message, "lane_status_failed");
    }
  });
  app.post("/api/lane", async (req, res) => {
    try {
      const r = await bridge.runLane(req.body);
      res.status(r.ok ? 200 : r.status || 502).json(r);
    } catch (e) {
      apiError(res, 500, e.message, "lane_failed");
    }
  });
  return bridge;
}

module.exports = { createLaneBridge, mountLaneBridge, extractJson, isQuotaError };
