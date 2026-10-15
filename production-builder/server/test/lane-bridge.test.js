"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createLaneBridge, extractJson, isQuotaError } = require("../lane-bridge");

function keys(map) { return (n) => map[n]; }
const OK_KEYS = { OMNIROUTE_API_KEY: "sk-test-omni", LANE_OMNIROUTE_COMBO: "vscode-free-auto", OMNIROUTE_BASE_URL_V1: "http://omni.test/v1" };
const omni = (r) => r.tried.find((t) => t.id === "omniroute-free");
const reply = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => "" });

test("extractJson: fences, chatter, nested braces, strings holding braces", () => {
  assert.deepEqual(extractJson('Sure.\n```json\n{"a":1,"b":{"c":"}{"}}\n```\nDone'), { a: 1, b: { c: "}{" } });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("[1,2]"), null);
  assert.deepEqual(extractJson('{bad} {"ok":true}'), { ok: true });
});

test("runLane: free combo answers, lane is named, key goes only in the header", async () => {
  const calls = [];
  const b = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async (url, init) => { calls.push({ url, init }); return reply('{"sure": 40}'); } });
  const r = await b.runLane({ prompt: "hello", json: true });
  assert.equal(r.ok, true);
  assert.equal(r.lane.id, "omniroute-free");
  assert.equal(r.lane.label, "OmniRoute free lane (vscode-free-auto)");
  assert.deepEqual(r.json, { sure: 40 });
  assert.equal(calls[0].url, "http://omni.test/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test-omni");
  assert.equal(JSON.parse(calls[0].init.body).model, "vscode-free-auto");
  assert.ok(!JSON.stringify(r).includes("sk-test-omni"));
});

test("runLane: a combo without 'free' in its name is refused and nothing is sent", async () => {
  let sent = 0;
  const b = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, LANE_OMNIROUTE_COMBO: "premium-opus" }), env: { LANE_GEMINI: "0" }, fetchImpl: async () => { sent++; return reply("x"); } });
  const r = await b.runLane({ prompt: "hello" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "no_lane");
  assert.equal(r.tried[0].code, "not_free");
  assert.equal(sent, 0);
});

test("runLane: missing key, unreachable, 401, empty and bad json each say so in words", async () => {
  const noKey = createLaneBridge({ optionalKey: keys({}), env: { LANE_GEMINI: "0" }, fetchImpl: async () => reply("x") });
  assert.equal((await noKey.runLane({ prompt: "p" })).tried[0].code, "missing_key");

  const down = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  const d = await down.runLane({ prompt: "p" });
  assert.equal(d.tried[0].code, "unreachable");
  assert.match(d.message, /No free lane answered/);

  const denied = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => ({ ok: false, status: 401, text: async () => "bad Bearer sk-test-omni" }) });
  const u = await denied.runLane({ prompt: "p" });
  assert.equal(u.tried[0].code, "http_401");
  assert.ok(!u.message.includes("sk-test-omni"));

  const empty = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => reply("   ") });
  assert.equal((await empty.runLane({ prompt: "p" })).tried[0].code, "empty");

  const prose = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => reply("just words") });
  assert.equal((await prose.runLane({ prompt: "p", json: true })).tried[0].code, "bad_json");
  assert.equal((await prose.runLane({ prompt: "p" })).ok, true);
});

test("runLane: timeout is reported, not hung", async () => {
  const slow = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, callMs: 30, fetchImpl: (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  const r = await slow.runLane({ prompt: "p" });
  assert.equal(r.tried[0].code, "timeout");
});

test("response deadline covers successful and error bodies after headers without quota fallback", async () => {
  for (const status of [200, 429]) {
    let calls = 0, signal;
    const bridge = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, GEMINI_API_KEY: 'fake-key' }), env: {}, callMs: 20, fetchImpl: async (_url, init) => {
      calls++; signal = init.signal;
      return { ok: status === 200, status, json: () => new Promise(() => {}), text: () => new Promise(() => {}) };
    } });
    const result = await bridge.runLane({ prompt: 'p' });
    assert.equal(result.ok, false);
    assert.equal(result.tried[0].code, 'timeout');
    assert.equal(calls, 1, 'A stalled body is not a completed quota response');
    assert.equal(signal.aborted, true);
  }
});

test("model status deadline also covers a stalled response body", async () => {
  const bridge = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: '0' }, probeMs: 20, fetchImpl: async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) });
  const result = await bridge.status();
  assert.equal(result.lanes[0].reachable, false);
  assert.match(result.lanes[0].error, /no answer in/);
});

test("runLane: bad input", async () => {
  const b = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => reply("x") });
  assert.equal((await b.runLane({})).code, "bad_request");
  assert.equal((await b.runLane({ prompt: "x".repeat(60001) })).code, "too_long");
});

test("Gemini is the default lane, OmniRoute free is the fallback", async () => {
  assert.deepEqual(createLaneBridge({ optionalKey: keys(OK_KEYS), env: {} }).lanes().map((l) => l.id), ["gemini", "omniroute-free"]);
  assert.deepEqual(createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" } }).lanes().map((l) => l.id), ["omniroute-free"]);

  const calls = [];
  const gem = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, GEMINI_API_KEY: "g-key" }), env: {}, fetchImpl: async (url, init) => { calls.push({ url, init }); return reply("from gemini"); } });
  const r = await gem.runLane({ prompt: "p" });
  assert.equal(r.ok, true);
  assert.equal(r.lane.id, "gemini");
  assert.equal(r.lane.label, "Gemini account (gemini-2.5-flash)");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer g-key");
  assert.equal(JSON.parse(calls[0].init.body).model, "gemini-2.5-flash");
  assert.ok(!JSON.stringify(r).includes("g-key"));
});

const G_KEYS = { ...OK_KEYS, GEMINI_API_KEY: "g-key" };
const omniCalls = (calls) => calls.filter((u) => u.startsWith("http://omni.test")).length;

test("isQuotaError: 429, 402, RESOURCE_EXHAUSTED, and a 403 that names quota, billing or credit", () => {
  assert.equal(isQuotaError(429, ""), true);
  assert.equal(isQuotaError(402, ""), true);
  assert.equal(isQuotaError(200, '{"error":{"status":"RESOURCE_EXHAUSTED"}}'), true);
  assert.equal(isQuotaError(403, "Billing account is not active"), true);
  assert.equal(isQuotaError(403, "You have no credit left"), true);
  assert.equal(isQuotaError(403, "PERMISSION_DENIED: API key not valid for this service"), false);
  for (const s of [400, 401, 404, 500, 502, 503]) assert.equal(isQuotaError(s, "busy"), false);
});

test("Gemini quota errors fall through to OmniRoute: 429, 402, and a 403 about billing", async () => {
  for (const [status, body] of [[429, "slow down"], [402, "pay up"], [403, "Billing account is not active"]]) {
    const urls = [];
    const b = createLaneBridge({ optionalKey: keys(G_KEYS), env: {}, fetchImpl: async (url) => { urls.push(url); return url.startsWith("http://omni.test") ? reply("from omni") : { ok: false, status, text: async () => body }; } });
    const r = await b.runLane({ prompt: "p" });
    assert.equal(r.ok, true, "status " + status);
    assert.equal(r.lane.id, "omniroute-free");
    assert.deepEqual(r.tried.map((t) => t.id), ["gemini", "omniroute-free"]);
    assert.equal(r.tried[0].code, "http_" + status);
    assert.equal(omniCalls(urls), 1);
  }
});

test("Any other Gemini failure stops there: OmniRoute is never called and the cause is named", async () => {
  const cases = {
    "400 bad key": () => ({ ok: false, status: 400, text: async () => "Please pass a valid API key" }),
    "401": () => ({ ok: false, status: 401, text: async () => "unauthorized" }),
    "403 plain": () => ({ ok: false, status: 403, text: async () => "PERMISSION_DENIED" }),
    "500": () => ({ ok: false, status: 500, text: async () => "boom" }),
    "503 busy": () => ({ ok: false, status: 503, text: async () => "busy" }),
    "empty answer": () => reply("   "),
    "unreachable": () => { throw new Error("ECONNREFUSED"); },
  };
  for (const [name, answer] of Object.entries(cases)) {
    const urls = [];
    const b = createLaneBridge({ optionalKey: keys(G_KEYS), env: {}, fetchImpl: async (url) => { urls.push(url); if (url.startsWith("http://omni.test")) return reply("from omni"); return answer(); } });
    const r = await b.runLane({ prompt: "p" });
    assert.equal(r.ok, false, name);
    assert.equal(r.code, "lane_failed", name);
    assert.equal(r.status, 502, name);
    assert.match(r.message, /not a quota error, so the next lane was not tried/, name);
    assert.equal(omniCalls(urls), 0, name + ": OmniRoute must not be called");
    assert.deepEqual(r.tried.map((t) => t.id), ["gemini"], name);
  }
});

test("Gemini timeout, missing key and wrong JSON shape also stop", async () => {
  const slow = createLaneBridge({ optionalKey: keys(G_KEYS), env: {}, callMs: 30, fetchImpl: (url, init) => (url.startsWith("http://omni.test") ? Promise.resolve(reply("from omni")) : new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) });
  const t = await slow.runLane({ prompt: "p" });
  assert.equal(t.code, "lane_failed");
  assert.equal(t.tried[0].code, "timeout");
  assert.equal(t.tried.length, 1);

  let omni = 0;
  const keyless = createLaneBridge({ optionalKey: keys(OK_KEYS), env: {}, fetchImpl: async () => { omni++; return reply("from omni"); } });
  const k = await keyless.runLane({ prompt: "p" });
  assert.equal(k.code, "lane_failed");
  assert.equal(k.tried[0].code, "missing_key");
  assert.match(k.message, /GEMINI_API_KEY is not in the key store/);
  assert.equal(omni, 0);

  const prose = createLaneBridge({ optionalKey: keys(G_KEYS), env: {}, fetchImpl: async (url) => (url.startsWith("http://omni.test") ? reply('{"ok":true}') : reply("just words")) });
  const j = await prose.runLane({ prompt: "p", json: true });
  assert.equal(j.code, "lane_failed");
  assert.equal(j.tried[0].code, "bad_json");
});

test("With LANE_GEMINI=0 OmniRoute failures are still reported as no_lane (the quota rule is Gemini only)", async () => {
  const b = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async () => ({ ok: false, status: 503, text: async () => "busy" }) });
  const r = await b.runLane({ prompt: "p" });
  assert.equal(r.code, "no_lane");
});

test("Gemini out of credit (429 quota) falls through to the default OmniRoute combo, auto/best-free", async () => {
  const calls = [];
  const noCombo = { OMNIROUTE_API_KEY: "sk-test-omni", OMNIROUTE_BASE_URL_V1: "http://omni.test/v1", GEMINI_API_KEY: "g-key" };
  const b = createLaneBridge({ optionalKey: keys(noCombo), env: {}, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return url.startsWith("http://omni.test") ? reply("from omni") : { ok: false, status: 429, text: async () => '{"error":{"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for g-key"}}' };
  } });
  const r = await b.runLane({ prompt: "p" });
  assert.equal(r.ok, true);
  assert.equal(r.lane.id, "omniroute-free");
  assert.equal(r.lane.label, "OmniRoute free lane (auto/best-free)");
  assert.equal(JSON.parse(calls[1].init.body).model, "auto/best-free");
  assert.equal(r.tried[0].code, "http_429");
  assert.ok(!JSON.stringify(r).includes("g-key"));
});

test("The shared OMNIROUTE_COMBO key is ignored: this bridge uses LANE_OMNIROUTE_COMBO or auto/best-free", () => {
  const b = createLaneBridge({ optionalKey: keys({ OMNIROUTE_API_KEY: "k", OMNIROUTE_COMBO: "vscode-free-auto" }), env: { LANE_GEMINI: "0" } });
  assert.equal(b.lanes()[0].model, "auto/best-free");
});

test("Gemini json mode: fenced json from the Gemini lane is parsed", async () => {
  const b = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, GEMINI_API_KEY: "g-key" }), env: {}, fetchImpl: async () => reply('```json\n{"sure": 90}\n```') });
  const r = await b.runLane({ prompt: "p", json: true });
  assert.equal(r.lane.id, "gemini");
  assert.deepEqual(r.json, { sure: 90 });
});

test("status: read-only probe, GET only, no chat call", async () => {
  const seen = [];
  const b = createLaneBridge({ optionalKey: keys(OK_KEYS), env: { LANE_GEMINI: "0" }, fetchImpl: async (url, init) => { seen.push([url, (init && init.method) || "GET"]); return { ok: true, status: 200, json: async () => ({ data: [{ id: "vscode-free-auto" }] }) }; } });
  const s = await b.status();
  assert.deepEqual(seen, [["http://omni.test/v1/models", "GET"]]);
  assert.equal(s.lanes[0].reachable, true);
  assert.equal(s.lanes[0].listed, true);
  assert.equal(s.lanes[0].keyPresent, true);
  assert.ok(!JSON.stringify(s).includes("sk-test-omni"));
});

test("status: Gemini row matches the bare model id against models/<id> and never leaks the key", async () => {
  const b = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, GEMINI_API_KEY: "g-key" }), env: {}, fetchImpl: async (url) => ({ ok: true, status: 200, json: async () => ({ data: [{ id: url.includes("generativelanguage") ? "models/gemini-2.5-flash" : "vscode-free-auto" }] }) }) });
  const s = await b.status();
  assert.deepEqual(s.lanes.map((l) => l.id), ["gemini", "omniroute-free"]);
  assert.equal(s.lanes[0].listed, true);
  assert.equal(s.lanes[0].keyPresent, true);
  assert.ok(!JSON.stringify(s).includes("g-key"));
});

test("end to end over real HTTP against a stub OmniRoute", async () => {
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers.authorization !== "Bearer sk-test-omni") { res.writeHead(401).end("{}"); return; }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: 'Here: {"restated":"x","sure":10,"questions":[]}' } }], echoModel: JSON.parse(body).model }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${srv.address().port}/v1`;
    const b = createLaneBridge({ optionalKey: keys({ ...OK_KEYS, OMNIROUTE_BASE_URL_V1: base }), env: { LANE_GEMINI: "0" } });
    const r = await b.runLane({ prompt: "an idea", json: true });
    assert.equal(r.ok, true);
    assert.equal(r.json.sure, 10);
  } finally { srv.close(); }
});
