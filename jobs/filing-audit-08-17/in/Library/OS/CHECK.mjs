#!/usr/bin/env node
// CHECK.mjs - the GluMira 7.2 OS check.
// Home: Library/OS/CHECK.mjs, the one home of the OS (PROTOCOL.md Article 3.1). Step 7 of Article 1.
//
// One deterministic check. Node only, zero dependencies, no network unless --fetch is given.
// It prints one PASS or FAIL line per gate and exits 1 if any gate fails. A fact it cannot
// determine is a FAIL with the reason, never a skip and never a warning.
//
//   node CHECK.mjs [--root <dir>] [--task-repo <repo>] [--fetch] [--snapshot <ref>] [--expect <fingerprint>]
//   node CHECK.mjs --route "<subject>"      look a subject up in JEV-MAP.json (never guessed)
//   node CHECK.mjs --regen                  recompute the JEV revision and regenerate Foyer/FOYER.json from it
//   node CHECK.mjs --blobs [<dir>]          print the git blob of every file under <dir> (default Library/OS)
//
//   --root <dir>        the checkout to check (default: git toplevel of the current directory)
//   --task-repo <repo>  the repo the task names; a different repo fails repo-confirm
//   --fetch             run `git fetch origin` first, so the pinned snapshot is current
//   --snapshot <ref>    the pinned snapshot (default origin/main)
//   --expect <fp>       a fingerprint another window printed; a different one fails
//   --verbose           print every failure on a gate line, not the first six
//   --actor <name>      accepted and ignored (the /start harness passes it)
//
// Gates, in the order they print: repo-confirm, snapshot-fingerprint, foyer-valid,
// single-routing-source, single-queue, no-71-source, memory-guard, edition-stamp, errata.
// Every rule here has a row in ERRATA.json whose check id is a gate in this file, and a test in
// CHECK.test.mjs named by the row. A row with no implementation fails, so a rule cannot be added
// by assertion.
//
// The phrase test in no-71-source is a heuristic over the `read` files of the reading list: it
// catches a pointer in plain words, and it cannot catch every phrasing. It guards against an
// accident, not against a determined rewrite. The founder's verbatim text is quoted, not read as
// an instruction, so the phrase test skips it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ------------------------------------------------------------------ constants */

export const OPEN_MARK = "[OPEN] NO BOOK - unaccounted for";
export const OS_DIR = "Library/OS";
export const FOYER_PATH = "Foyer/FOYER.json";
export const VAULT1 = "Vaults/1-Operating-System";
export const POINTER_PATH = `${VAULT1}/POINTER.md`;
export const POINTER_TEXT = "The OS lives at Library/OS/. This Vault holds no OS content. Any OS-related documentation filed here must move to Library/OS/ or to a Governance Row.\n";
export const START_PATH = `${OS_DIR}/START.md`;
export const STOP_PATH = `${OS_DIR}/STOP.md`;
export const PROTOCOL_PATH = `${OS_DIR}/PROTOCOL.md`;
export const GUIDE_PATH = `${OS_DIR}/GUIDE.md`;
export const RULES_PATH = `${OS_DIR}/RULES.md`;
export const REGISTRY_PATH = `${OS_DIR}/REPO-REGISTRY.json`;
export const JEV_PATH = `${OS_DIR}/JEV-MAP.json`;
export const MEMORY_GUARD_PATH = `${OS_DIR}/MEMORY-GUARD.md`;
export const CHECK_PATH = `${OS_DIR}/CHECK.mjs`;
export const TEST_PATH = `${OS_DIR}/CHECK.test.mjs`;
export const ERRATA_PATH = `${OS_DIR}/ERRATA.json`;
// Every file the OS home holds. A file under Library/ that is not here is unaccounted for.
export const OS_FILES = [
  PROTOCOL_PATH,
  GUIDE_PATH,
  START_PATH,
  STOP_PATH,
  RULES_PATH,
  CHECK_PATH,
  TEST_PATH,
  `${OS_DIR}/CHECK-repo.test.mjs`,
  `${OS_DIR}/CHECK-foyer.test.mjs`,
  `${OS_DIR}/CHECK-routing.test.mjs`,
  `${OS_DIR}/CHECK-queue.test.mjs`,
  `${OS_DIR}/CHECK-errata.test.mjs`,
  `${OS_DIR}/fixture.mjs`,
  `${OS_DIR}/CLOSE.mjs`,
  `${OS_DIR}/CLOSE.test.mjs`,
  REGISTRY_PATH,
  JEV_PATH,
  MEMORY_GUARD_PATH,
  ERRATA_PATH,
];
// The founder's text, filed word for word. Quotes, never instructions to a phrase gate.
export const VERBATIM = [PROTOCOL_PATH, GUIDE_PATH, MEMORY_GUARD_PATH];
// The files of PROTOCOL.md Article 1 in its order: step, kind and path. BUILDER is the queue named
// in REPO-REGISTRY.json. Step 10 is routed, so it has no fixed file.
export const ARTICLE_1 = [
  [1, "read", START_PATH],
  [2, "read", PROTOCOL_PATH],
  [3, "read", GUIDE_PATH],
  [4, "read", REGISTRY_PATH],
  [5, "read", JEV_PATH],
  [6, "read", MEMORY_GUARD_PATH],
  [7, "run", CHECK_PATH],
  [8, "version", "BUILDER"],
  [9, "read", FOYER_PATH],
  [11, "read", STOP_PATH],
];
export const GATES = [
  "repo-confirm",
  "snapshot-fingerprint",
  "foyer-valid",
  "single-routing-source",
  "single-queue",
  "no-71-source",
  "memory-guard",
  "edition-stamp",
  "path-length",
  "errata",
];
export const LAYERS = ["Doc", "Prog", "Git"];
export const RULE_KEYS = ["populate", "read", "no_nesting", "new_vault", "one_home", "accountability", "pages"];
export const STATUS_VALUES = ["DONE", "Mid Flight"];
const ROW_513 = "Vaults/5-Production-Builder/Rows/5.13-Production-Builder/";

// Exceptions are named, never quiet. The check prints every one on every run.
export const NAMED_EXCEPTIONS = [
  {
    id: "X-001",
    vault: "6",
    repo: "glumira-x-technologies-cc/glumira-7.1",
    reason: "Foyer files Insulin-Lock as pointer Pages only (the note on Vault 6) and the enforcer files are in glumira-7.1. Open founder decision: do they stand, or move into this repo?",
  },
  // X-002 is closed (card 08-04): the Builder README is pinned in its Book's PROVENANCE.json. Its number is not reused.
  {
    id: "X-003",
    stamp: "byte-copy",
    reason: "A Page file that is a byte copy of another repo is pinned by its blob, so a stamp inside it would break the pin. Its stamp is the three keys of its Book's PROVENANCE.json.",
  },
  {
    id: "X-004",
    prefix: ROW_513,
    reason: "Row 5.13 Production Builder is read-only, an artifact under upgrade: its names and files are not changed, so neither name, stamp nor routing content is checked there.",
  },
  {
    id: "X-005",
    names: [
      "Vaults/5-Production-Builder/Rows/5.16-Build-Audits-Documents/Books/Book-Estate-Mapping/Page-Doc-Estate-Mapping/glumira-7.2",
      "Vaults/5-Production-Builder/Rows/5.16-Build-Audits-Documents/Books/Book-Estate-Mapping/Page-Doc-Estate-Mapping/glumira-7.2.1",
    ],
    reason: "A folder named for a repo keeps the repo's name, edition and all: the two folders named for the repos Glumira-7.2 and GluMira-7.2.1. (The Vault 5 folder left this list on 2026-10-13: it is 5-Production-Builder now.)",
  },
  {
    id: "X-006",
    stamp: "pure-data",
    reason: "A pure data file with no header (.jsonl, .gz, .csv, or binary) has no place for a stamp. Its stamp is the three keys of its Book's PROVENANCE.json.",
  },
  {
    id: "X-007",
    prose_route_mention: "Vaults/2-Memory/Rows/2.1-Agent-Memory/Books/Book-Agent-Memory/Page-Doc-Agent-Memory/project-van-clief-governance-insulin-lock-vaults.md",
    reason: "A founder-dictation memory file whose prose names several Vaults next to their numbers while quoting a past Foyer summary. It is history recording a founder ruling, not a second routing table: JEV-MAP.json, which it quotes, is still the one routing authority.",
  },
  {
    id: "X-009",
    prose_route_mention: "Vaults/5-Production-Builder/Rows/5.14-Build-Plan/Books/Book-Six-Libraries/Page-Doc-Six-Libraries/SIX-LIBRARIES-PLAN.md",
    reason: "The founder-approved Six Libraries spar plan, filed word for word. Its tables name today's Vaults next to their numbers to say where each one lands. It is the design the Phase 8 cards build, not a second routing table: JEV-MAP.json is still the one routing authority. (X-008 is the plan's own name for the Library echo of card 08-05.)",
  },
];

const HEX40 = /^[0-9a-f]{40}$/;
const TEXT_EXT = /\.(md|markdown|txt|json|mjs|js|cjs|html|htm|yml|yaml|sh|toml|css|ps1|bat|rs|sql|csv|tsv|ts)$/i;
const DOC_EXT = /\.(md|markdown|txt|json|ya?ml|csv|tsv|html?)$/i;
const READ_CAP = 8_000_000;
const QUEUE_NAME = /(?:^|[^a-z])(?:roadmap|punch[-_ ]?list|build[-_ ]?plan|workstream[-_ ]?registry|backlogs?|to[-_ ]?dos?|queue|kanban)(?:[^a-z]|$)/i;
// A card line of the one queue: "- [ ] 01-02: ..." or "- [ ] K01a ...". Three of them make a file a queue.
const CARD_LINE = /^\s*[-*] \[[ xX]\] (?:\d{2}-\d{2}|[A-Z]{1,3}\d{2,3}[a-z]?)[: ]/;
const CARD_LINES_MAKE_A_QUEUE = 3;
const ROUTE_NAME = /jev[-_ ]?map|rout(?:e|ing)[-_ ]?(?:table|map)|subject[-_ ]?(?:map|route)|vault[-_ ]?map|subject[-_ ]?vault/i;
const VAULTISH = /^vaults?(?:$|[-_ ]?\d)/i;
const PAGE_FOLDER_NESTING = /^(?:page-(?:doc|prog|git)-|book-|cabinet-|rows?$)/i;
const GITHUB_URL = /^(?:https?:\/\/(?:[^@/\s]+@)?(?:www\.)?github\.com(?::\d+)?\/|git@github\.com:|ssh:\/\/git@(?:ssh\.)?github\.com(?::\d+)?\/)/i;
// A pointer to the task list of the frozen 7.1 repo.
const PUNCH71 = /7\.1[^\n]{0,80}punch|punch[^\n]{0,80}7\.1|glumira-7\.1[^\n]{0,60}(?:task list|queue|roadmap|state\b)|(?:task list|queue|roadmap)[^\n]{0,40}glumira-7\.1/i;
const NEGATION = /(?<![-\w])(?:never|not|no|nothing|none|without)(?![-\w])|n't\b/i;
// MEMORY-GUARD.md, "What counts": MEMORY.md, memory/, _memory/, NOW.md, CONTEXT.md, or any file
// whose name marks it as memory. MEMORY-GUARD.md is the guard itself, step 6, and is named apart.
const MEMORY_NAME = /^(?:memory\.md|now\.md|context\.md)$|memor(?:y|ies)/i;
const MEMORY_DIR = /^_?memory$/i;
// E-004: a name carries the subject, never the edition. A leading UTC time stamp is a time, not an edition.
const EDITION_NAME = /72|7\.2|-v0|-v1\.0/;
const TIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{4}Z-/;
// A Vault or Row folder starts with its number ("7-Engines", "7.2-What-If"): a number, not an edition.
const NUMBER_PREFIX = /^\d+(?:\.\d+)?-/;
// The edition test of one name segment, after its time stamp is taken off and, for a Vault folder (the
// segment after "Vaults") or a Row folder (the segment after "Rows"), its number.
export function nameCarriesEdition(seg, parent = "") {
  let s = String(seg).replace(TIME_PREFIX, "");
  if (parent === "Vaults" || parent === "Rows") s = s.replace(NUMBER_PREFIX, "");
  return EDITION_NAME.test(s);
}
// A line of a task list: "- [ ] <task>". The one queue's task names may not appear in a second source.
const TASK_LINE = /^\s*[-*] \[[ xX]\] (.+)$/;
const PURE_DATA = /\.(?:jsonl|gz|csv|tsv|png|jpe?g|gif|webp|ico|pdf|zip)$/i;

/* ------------------------------------------------------------------ helpers */

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = v => typeof v === "string" && v.trim() !== "";
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const ws = s => String(s).replace(/\s+/g, " ").trim();
const fp10 = s => createHash("sha256").update(s).digest("hex").slice(0, 10);
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function gitIn(root, args) {
  try {
    const out = execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1 << 28,
      timeout: 120000,
      windowsHide: true,
    });
    return { ok: true, out: out.replace(/\r?\n$/, "") };
  } catch (e) {
    return { ok: false, out: "", err: String(e.stderr || e.message).trim().split(/\r?\n/)[0] };
  }
}

// UTF-8, UTF-8 with a BOM, UTF-16 LE or BE with a BOM (what PowerShell 5.1 writes).
export function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const b = Buffer.from(buf.subarray(2));
    b.swap16();
    return b.toString("utf16le");
  }
  return buf.toString("utf8").replace(/^﻿/, "");
}

function readText(root, rel) {
  return decode(readFileSync(join(root, rel)));
}

// A JSON.parse that keeps the last duplicate key silently hides the first. This lists them.
export function duplicateKeys(text) {
  const dups = [];
  let i = 0;
  const skip = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const str = () => {
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const value = path => {
    skip();
    const c = text[i];
    if (c === "{") {
      i++;
      skip();
      if (text[i] === "}") return void i++;
      const seen = new Set();
      for (;;) {
        skip();
        const k = str();
        skip();
        i++;
        if (seen.has(k)) dups.push(`${path}.${k}`);
        seen.add(k);
        value(`${path}.${k}`);
        skip();
        if (text[i++] !== ",") return;
      }
    } else if (c === "[") {
      i++;
      skip();
      if (text[i] === "]") return void i++;
      for (let n = 0; ; n++) {
        value(`${path}[${n}]`);
        skip();
        if (text[i++] !== ",") return;
      }
    } else if (c === '"') str();
    else while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  try {
    value("$");
  } catch {
    return dups;
  }
  return dups;
}

function loadJson(root, rel) {
  if (!existsSync(join(root, rel))) return { ok: false, err: "file is missing" };
  try {
    const text = readText(root, rel);
    return { ok: true, data: JSON.parse(text), dups: duplicateKeys(text) };
  } catch (e) {
    return { ok: false, err: `not valid JSON (${e.message})` };
  }
}

function isFile(root, rel) {
  try {
    return statSync(join(root, rel)).isFile();
  } catch {
    return false;
  }
}

export function slugOf(originUrl) {
  const m = String(originUrl || "").match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  return m ? m[1] : "";
}

function listFiles(root) {
  const r = gitIn(root, ["ls-files", "-z", "-c", "-o", "--exclude-standard"]);
  if (!r.ok) return null;
  const set = new Set(r.out.split("\0").filter(Boolean).filter(f => !f.startsWith(".claude/worktrees/")));
  return [...set].sort().filter(f => isFile(root, f));
}

// Symlinks (120000) and submodules (160000) under Foyer or Vaults hide content the check cannot read.
function listSpecial(root) {
  const r = gitIn(root, ["ls-files", "-s", "-z"]);
  if (!r.ok) return null;
  const out = [];
  for (const rec of r.out.split("\0").filter(Boolean)) {
    const m = rec.match(/^(\d+) [0-9a-f]+ \d\t([\s\S]*)$/);
    if (m && (m[1] === "120000" || m[1] === "160000") && /^(?:Vaults|Foyer)\//.test(m[2])) out.push(`${m[2]} (${m[1] === "120000" ? "symlink" : "submodule"})`);
  }
  return out;
}

// Read one file for a scan. A file the check cannot read or is too large to scan is a failure.
// Several gates scan the same files; each file is read once per run and the result is shared.
function scanText(ctx, f) {
  ctx.scanned ??= new Map();
  if (!ctx.scanned.has(f)) ctx.scanned.set(f, readForScan(ctx, f));
  return ctx.scanned.get(f);
}

function readForScan(ctx, f) {
  let size;
  try {
    size = statSync(join(ctx.root, f)).size;
  } catch (e) {
    return { error: `${f} is unreadable (${e.code || e.message})` };
  }
  if (size > READ_CAP) return { error: `${f} is over ${READ_CAP} bytes and cannot be scanned` };
  try {
    const text = decode(readFileSync(join(ctx.root, f)));
    return text.includes("\u0000") ? { binary: true } : { text };
  } catch (e) {
    return { error: `${f} is unreadable (${e.code || e.message})` };
  }
}

// Units a phrase gate reads: every line, and for prose every wrapped paragraph split into sentences.
function units(text, prose) {
  const lines = text.split(/\r?\n/);
  const out = lines.map((s, i) => ({ at: i + 1, s }));
  if (!prose) return out;
  let para = [];
  let start = 0;
  const flush = () => {
    if (para.length > 1) for (const s of para.join(" ").split(/(?<=[.!?])\s+/)) out.push({ at: start + 1, s });
    para = [];
  };
  lines.forEach((l, i) => {
    if (l.trim() === "") flush();
    else {
      if (/^\s*(?:[-*]|\d+\.)\s/.test(l)) flush();
      if (!para.length) start = i;
      para.push(l.trim());
    }
  });
  flush();
  return out;
}

// A unit that matches `re` is a hit unless it is negated ("never stops", "is not a gate").
// A unit that matches `always` is a hit even when it carries a negation word ("do not continue").
function phraseHit(text, re, prose, always) {
  const hit = units(text, prose).find(u => (re.test(u.s) && !NEGATION.test(u.s)) || (always && always.test(u.s)));
  return hit ? hit.at : -1;
}

/* ------------------------------------------------------------------ Cabinet summary */

// The Foyer copies a Cabinet's summary word for word from its Cabinet file. This is the one
// derivation: every "## Heading" section except "Books in this Cabinet", one line per bullet or
// paragraph, written "Heading: text" with the whitespace joined.
export function deriveSummary(md) {
  const out = [];
  let heading = null;
  let cur = null;
  const flush = () => {
    if (cur && heading) out.push(`${heading}: ${ws(cur.join(" "))}`);
    cur = null;
  };
  for (const raw of String(md).replace(/^﻿/, "").split(/\r?\n/)) {
    const h = raw.match(/^## (.+?)\s*$/);
    if (h) {
      flush();
      heading = h[1];
      continue;
    }
    if (/^#{1,6} /.test(raw)) {
      flush();
      if (/^# /.test(raw)) heading = null;
      continue;
    }
    if (!heading || heading === "Books in this Cabinet") continue;
    if (raw.trim() === "") {
      flush();
      continue;
    }
    if (/^\s*- /.test(raw)) {
      flush();
      cur = [raw.trim()];
      continue;
    }
    if (cur) cur.push(raw.trim());
    else cur = [raw.trim()];
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ moved paths */

// The four forms of a retired path prefix: plain, backslash, double backslash, and regex-escaped.
export function movedForms(from) {
  const forms = [
    { kind: "plain", s: from },
    { kind: "backslash", s: from.replace(/\//g, "\\") },
    { kind: "backslash", s: from.replace(/\//g, "\\\\") },
    { kind: "escaped", s: from.replace(/\./g, "\\.").replace(/\//g, "\\/") },
  ];
  return forms.filter((x, i) => forms.findIndex(y => y.s === x.s) === i);
}

const PATH_BEFORE = /[A-Za-z0-9_./\\-]/;
const PATH_AFTER = /[A-Za-z0-9_.-]/;

// Every place `text` names the retired prefix `from` as a path of its own. Before it: the start, a
// character that is not part of a path, or a leading "./" or ".\"; for the escaped form also a bare "/"
// (a regex delimiter). After it: the end, a path separator, or a character that is not part of a name
// (a "." that ends a sentence counts as the end). A `from` that ends in "/" carries its separator.
// So "Library/Memory/Vaults/2-Memory" and "Vaults/2-Memory-Old" are not hits for "Vaults/2-Memory".
export function movedHits(text, from) {
  const out = [];
  const endsSep = /[/\\]$/.test(from);
  for (const { kind, s } of movedForms(from)) {
    for (let i = text.indexOf(s); i >= 0; i = text.indexOf(s, i + 1)) {
      const dotSlash = (text[i - 1] === "/" || text[i - 1] === "\\") && text[i - 2] === "." && (i - 2 === 0 || !PATH_BEFORE.test(text[i - 3]));
      const before =
        i === 0 || dotSlash || (kind === "escaped" && text[i - 1] === "/" && text[i - 2] !== "\\") || !PATH_BEFORE.test(text[i - 1]);
      if (!before) continue;
      const k = i + s.length;
      const sentenceEnd = text[k] === "." && (k + 1 === text.length || /\s/.test(text[k + 1]));
      const after = endsSep || k === text.length || text[k] === "/" || text[k] === "\\" || sentenceEnd || !PATH_AFTER.test(text[k]);
      if (after) out.push({ line: text.slice(0, i).split("\n").length, form: kind });
    }
  }
  return out;
}

// The live text a moved path must leave: the OS files (not JEV-MAP.json, which holds the moved list), the
// root README and config files, .githooks and .github, every file of a Prog layer, and the open cards of
// the queue. Records (handovers, memory, Doc Pages, closed cards) describe a past state and are not read.
const ROOT_LIVE = /^(?:README\.md|[^/]+\.(?:json|ya?ml|toml)|\.[^/]+)$/;
export function isLiveFile(f) {
  if (f === JEV_PATH) return false;
  return f.startsWith(`${OS_DIR}/`) || ROOT_LIVE.test(f) || f.startsWith(".githooks/") || f.startsWith(".github/") || f.split("/").some(s => /^Page-Prog-/.test(s));
}

function movedErrors(ctx) {
  const jev = ctx.jev.ok && isObj(ctx.jev.data) ? ctx.jev.data : null;
  const moved = jev && Array.isArray(jev.moved) ? jev.moved.filter(m => isObj(m) && nonEmpty(m.from)) : [];
  const e = [];
  if (!moved.length) return { errors: e, files: 0, prefixes: 0 };
  const builder = ctx.registry.ok && isObj(ctx.registry.data) ? ctx.registry.data.builder : undefined;
  let files = 0;
  for (const f of ctx.files) {
    const live = isLiveFile(f);
    if (!live && f !== builder) continue;
    if (!TEXT_EXT.test(f) && !/(?:^|\/)\.[^/]+$|(?:^|\/)[^./]+$/.test(f)) continue;
    const r = scanText(ctx, f);
    if (r.error) {
      e.push(r.error);
      continue;
    }
    if (!r.text) continue;
    files++;
    // In the queue, only the open cards are live: a closed card is a record.
    const text = live ? r.text : r.text.split(/\r?\n/).map(l => (/^\s*[-*] \[ \]/.test(l) ? l : "")).join("\n");
    for (const m of moved) for (const h of movedHits(text, m.from)) e.push(`a live file names the moved path ${m.from} (${h.form} form): ${f}:${h.line}. Fix: write ${m.to}`);
  }
  return { errors: e, files, prefixes: moved.length };
}

/* ------------------------------------------------------------------ context */

async function loadIdentity(root) {
  const file = join(root, ".githooks", "check-gates.mjs");
  if (!existsSync(file)) return { error: "no .githooks/check-gates.mjs in this checkout" };
  try {
    const m = await import(pathToFileURL(file).href);
    if (typeof m.identityErrors !== "function") return { error: ".githooks/check-gates.mjs exports no identityErrors" };
    return { identityErrors: m.identityErrors };
  } catch (e) {
    return { error: `cannot load .githooks/check-gates.mjs (${e.message})` };
  }
}

export async function buildContext(root, opts = {}) {
  const git = args => gitIn(root, args);
  const ctx = { root, opts, git, files: listFiles(root), special: listSpecial(root) };
  ctx.fileSet = new Set(ctx.files || []);
  ctx.origin = git(["remote", "get-url", "origin"]);
  ctx.push = git(["remote", "get-url", "--push", "origin"]);
  ctx.slug = slugOf(ctx.origin.out);
  ctx.head = git(["rev-parse", "HEAD"]);
  ctx.identity = await loadIdentity(root);
  ctx.foyer = loadJson(root, FOYER_PATH);
  ctx.jev = loadJson(root, JEV_PATH);
  ctx.registry = loadJson(root, REGISTRY_PATH);
  if (opts.fetch) {
    const identityOk = ctx.identity.identityErrors && ctx.identity.identityErrors(ctx.origin.out).length === 0 && GITHUB_URL.test(ctx.origin.out);
    if (!identityOk) ctx.fetchError = "not fetched: origin is not the 7.2 repo";
    else {
      const f = git(["fetch", "origin", "--quiet"]);
      if (!f.ok) ctx.fetchError = `git fetch origin failed (${f.err})`;
    }
  }
  return ctx;
}

/* ------------------------------------------------------------------ gate: repo-confirm */

function repoConfirm(ctx) {
  const e = [];
  if (!ctx.head.ok) return { errors: [`indeterminate: not a git checkout with a commit (${ctx.head.err || "no HEAD"})`] };
  const branch = ctx.git(["symbolic-ref", "--short", "-q", "HEAD"]);
  const branchName = branch.ok && branch.out ? branch.out : "(detached)";
  if (ctx.identity.error) e.push(ctx.identity.error);
  else {
    // The fetch URL and the push URL both have to be this repo: the 2026-10-05 fixes were pushed to the wrong one.
    const urls = [["origin", ctx.origin.out]];
    if (ctx.push.ok && ctx.push.out !== ctx.origin.out) urls.push(["push", ctx.push.out]);
    for (const [kind, url] of urls) {
      e.push(...ctx.identity.identityErrors(url));
      if (url && !GITHUB_URL.test(url)) e.push(`the ${kind} URL ${url} is not on github.com`);
    }
  }
  const task = ctx.opts.taskRepo;
  if (task) {
    const want = norm(String(task).replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, ""));
    const have = norm(ctx.slug);
    const haveName = norm(ctx.slug.split("/")[1] || "");
    if (want !== have && want !== haveName) e.push(`the task names ${task}, this checkout is ${ctx.slug || "unknown"}: stop and tell the founder`);
  }
  // GUIDE.md, THE REPO CONFIRMATION: read OS/REPO-REGISTRY; if the commit does not match the registry, STOP.
  e.push(...registryErrors(ctx));
  return {
    errors: [...new Set(e)],
    detail: `I am in repo ${ctx.slug || "unknown"}, at commit ${ctx.head.out.slice(0, 12)}, on branch ${branchName}`,
  };
}

// The registry names exactly one active repo: this checkout. Its registered commit is in this history.
function registryErrors(ctx) {
  const r = ctx.registry;
  if (!r.ok) return [`${REGISTRY_PATH} ${r.err}`];
  const e = r.dups.map(d => `duplicate key ${d} in ${REGISTRY_PATH}`);
  const d = r.data;
  if (!isObj(d) || !Array.isArray(d.repos) || !d.repos.length) return [...e, `${REGISTRY_PATH} needs a non-empty "repos" list`];
  const active = d.repos.filter(x => isObj(x) && x.active === true);
  if (active.length !== 1) return [...e, `${REGISTRY_PATH} names ${active.length} active repos, exactly one is allowed`];
  const a = active[0];
  if (!nonEmpty(d.active) || d.active.toLowerCase() !== String(a.repo).toLowerCase()) e.push(`${REGISTRY_PATH}: "active" is ${d.active}, the active entry is ${a.repo}`);
  if (String(a.repo).toLowerCase() !== ctx.slug.toLowerCase()) e.push(`${REGISTRY_PATH} names ${a.repo} as the active repo, this checkout is ${ctx.slug || "unknown"}: stop`);
  else if (!HEX40.test(a.commit || "")) e.push(`${REGISTRY_PATH}: the active repo needs a 40-hex commit`);
  else {
    const at = commitInHistory(ctx, a.commit);
    if (at === "missing") e.push(`the registered commit ${a.commit.slice(0, 12)} is not in this checkout: stop`);
    else if (at === "not-ancestor") e.push(`the registered commit ${a.commit.slice(0, 12)} is not in the history of HEAD: stop`);
  }
  return e;
}

// Every commit in the history of HEAD from one git call, so the check does not spawn git twice per
// pinned commit. A commit the list does not hold is asked of git the old way, so every failure and
// its text are the same as before.
function commitInHistory(ctx, commit) {
  if (!ctx.history) {
    const r = ctx.git(["rev-list", "HEAD"]);
    ctx.history = new Set(r.ok ? r.out.split(/\r?\n/).filter(Boolean) : []);
  }
  if (ctx.history.has(commit)) return "ok";
  if (!ctx.git(["cat-file", "-e", `${commit}^{commit}`]).ok) return "missing";
  if (!ctx.git(["merge-base", "--is-ancestor", commit, "HEAD"]).ok) return "not-ancestor";
  return "ok";
}

/* ------------------------------------------------------------------ gate: snapshot-fingerprint */

// NUL-separated, so the fingerprint does not depend on core.quotepath.
function snapshotTree(ctx, ref) {
  const r = ctx.git(["ls-tree", "-r", "-z", ref, "--", "Library", "Foyer", "Vaults"]);
  return r.ok ? r.out : null;
}

function snapshotFingerprint(ctx) {
  const e = [];
  const pinned = ctx.opts.snapshot || "origin/main";
  if (ctx.fetchError) return { errors: [`indeterminate: ${ctx.fetchError}`] };
  const pin = ctx.git(["rev-parse", "--verify", "--quiet", `${pinned}^{commit}`]);
  if (!pin.ok || !pin.out) return { errors: [`indeterminate: the pinned snapshot ${pinned} does not resolve. Run with --fetch.`] };
  const pinnedTree = snapshotTree(ctx, pinned);
  const headTree = snapshotTree(ctx, "HEAD");
  if (pinnedTree === null || headTree === null) return { errors: ["indeterminate: cannot list the Foyer and Vaults trees"] };
  const pinnedFp = fp10(pinnedTree);
  const headFp = fp10(headTree);
  if (pinnedFp !== headFp) e.push(`this checkout reads snapshot ${headFp}, the pinned snapshot ${pinned} is ${pinnedFp}: stop. Fix: git fetch origin, then git merge --ff-only origin/main. If this branch is where you change Library, Foyer or Vaults, check with --snapshot HEAD`);
  const dirty = ctx.git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "Library", "Foyer", "Vaults"]);
  if (!dirty.ok) e.push(`indeterminate: git status failed (${dirty.err})`);
  else if (dirty.out) {
    const paths = dirty.out.split("\0").filter(Boolean).map(r => r.slice(3));
    e.push(`uncommitted changes under Library, Foyer or Vaults differ from the snapshot: ${paths.slice(0, 3).join(", ")}${paths.length > 3 ? ` (+${paths.length - 3} more)` : ""}`);
  }
  if (ctx.opts.expect && ctx.opts.expect !== pinnedFp) e.push(`expected fingerprint ${ctx.opts.expect}, the pinned snapshot is ${pinnedFp}: stop`);
  return { errors: e, detail: `fingerprint=${pinnedFp} snapshot=${pinned}@${pin.out.slice(0, 12)}` };
}

/* ------------------------------------------------------------------ gate: foyer-valid */

function checkTopLevel(d, e) {
  for (const k of ["foyer", "version", "date", "status", "law"]) if (!nonEmpty(d[k])) e.push(`top level: "${k}" must be a non-empty string`);
  if (!Array.isArray(d.founder_rulings_verbatim) || !d.founder_rulings_verbatim.length) e.push('top level: "founder_rulings_verbatim" must be a non-empty array');
  if (!isObj(d.rules)) e.push('top level: "rules" must be an object');
  else for (const k of RULE_KEYS) if (!nonEmpty(d.rules[k])) e.push(`rules: "${k}" is missing`);
  if (!isObj(d.routes) || !Object.keys(d.routes).length) e.push('top level: "routes" must be a non-empty object');
  if (!isObj(d.vaults) || !Object.keys(d.vaults).length) e.push('top level: "vaults" must be a non-empty object');
}

function checkRoutes(d, e) {
  const vaults = d.vaults;
  const byName = new Map();
  for (const [name, target] of Object.entries(d.routes)) {
    if (typeof target !== "string" || !/^\d+$/.test(target)) e.push(`routes: "${name}" must route to a Vault number, not "${target}"`);
    else if (!vaults[target]) e.push(`routes: "${name}" routes to Vault ${target}, which does not exist`);
    const k = norm(name);
    byName.set(k, new Set([...(byName.get(k) || []), String(target)]));
  }
  for (const [k, targets] of byName) if (targets.size > 1) e.push(`routes: the name "${k}" routes to more than one Vault (${[...targets].join(", ")})`);
  const names = new Map();
  for (const [id, v] of Object.entries(vaults)) {
    const hit = Object.entries(d.routes).some(([name, target]) => target === id && norm(name) === norm(v.name));
    if (!hit) e.push(`routes: Vault ${id} "${v.name}" has no route under its own name`);
    const k = norm(v.name);
    if (names.has(k)) e.push(`Vault ${id} and Vault ${names.get(k)} have the same name "${v.name}"`);
    names.set(k, id);
  }
  const lock = Object.entries(vaults).find(([, v]) => norm(v.name) === "insulinlock");
  const lockRoute = Object.entries(d.routes).find(([name]) => norm(name) === "insulinlock");
  if (!lock) e.push("routes: there is no Vault named Insulin-Lock");
  else if (!lockRoute) e.push('routes: "Insulin Lock" has no route');
  else if (lockRoute[1] !== lock[0]) e.push(`routes: "Insulin Lock" must route to the top-level Vault ${lock[0]}, not "${lockRoute[1]}"`);
}

function checkPointers(owner, where, vaults, e) {
  if (owner.pointers === undefined) return;
  if (!isObj(owner.pointers)) return void e.push(`${where}: "pointers" must be an object`);
  for (const [k, v] of Object.entries(owner.pointers)) {
    const m = String(v).match(/^Vault (\d+)$/);
    if (!m || !vaults[m[1]]) e.push(`${where}: pointer "${k}" names ${v}, which is not a Vault`);
  }
}

// A Vault never holds a Vault: no key named vault or vaults anywhere below a Vault.
function vaultKeys(node, path, e) {
  if (Array.isArray(node)) return void node.forEach((x, i) => vaultKeys(x, `${path}[${i}]`, e));
  if (!isObj(node)) return;
  for (const [k, v] of Object.entries(node)) {
    if (/^vaults?$/i.test(k)) e.push(`${path}: holds a Vault (key "${k}"). A Vault never holds a Vault.`);
    vaultKeys(v, `${path}.${k}`, e);
  }
}

// Every blob at HEAD from one git call, so the check does not spawn git once per file.
function headBlob(ctx, path) {
  if (!ctx.headBlobs) {
    ctx.headBlobs = new Map();
    const r = ctx.git(["ls-tree", "-r", "-z", "HEAD"]);
    if (r.ok) {
      for (const rec of r.out.split("\0").filter(Boolean)) {
        const m = rec.match(/^\d+ blob ([0-9a-f]{40})\t([\s\S]*)$/);
        if (m) ctx.headBlobs.set(m[2], m[1]);
      }
    }
  }
  return ctx.headBlobs.get(path) || null;
}

function checkProvenance(ctx, bookPath, key, filePath, e, stats) {
  const j = loadJson(ctx.root, filePath);
  if (!j.ok) return void e.push(`${key}: ${filePath} ${j.err}`);
  for (const d of j.dups) e.push(`${key}: duplicate key ${d} in ${filePath}`);
  const p = j.data;
  if (!isObj(p)) return void e.push(`${key}: ${filePath} is not an object`);
  if (p.page !== key) e.push(`${key}: PROVENANCE "page" is "${p.page}", expected "${key}"`);
  if (p.layer !== "Git") e.push(`${key}: PROVENANCE "layer" must be "Git"`);
  if (!nonEmpty(p.method)) e.push(`${key}: PROVENANCE "method" is missing`);
  if (!Array.isArray(p.sources) || !p.sources.length) return void e.push(`${key}: PROVENANCE "sources" is empty`);
  for (const [i, s] of p.sources.entries()) {
    if (!isObj(s) || !nonEmpty(s.repo) || !HEX40.test(s.commit || "") || !Array.isArray(s.files) || !s.files.length) {
      e.push(`${key}: PROVENANCE sources[${i}] needs repo, a 40-hex commit and files`);
      continue;
    }
    if (s.repo.toLowerCase() === ctx.slug.toLowerCase()) {
      const at = commitInHistory(ctx, s.commit);
      if (at === "missing") e.push(`${key}: pinned commit ${s.commit.slice(0, 12)} is not in this checkout (shallow clone?)`);
      else if (at === "not-ancestor") e.push(`${key}: pinned commit ${s.commit.slice(0, 12)} is not an ancestor of HEAD`);
    }
    for (const f of s.files) {
      if (!isObj(f) || !nonEmpty(f.copy) || !HEX40.test(f.blob || "")) {
        e.push(`${key}: PROVENANCE file entry needs "copy" and a 40-hex "blob"`);
        continue;
      }
      stats.provenanceFiles++;
      const at = `${bookPath}/${f.copy}`;
      stats.pinned.add(at);
      const got = headBlob(ctx, at);
      if (!got) e.push(`${key}: ${f.copy} is not committed in this checkout`);
      else if (got !== f.blob) e.push(`${key}: ${f.copy} is stale: blob ${got.slice(0, 12)} in git, ${f.blob.slice(0, 12)} in PROVENANCE`);
    }
  }
}

function checkPage(ctx, vid, row, book, bookKey, key, page, acc, e, stats) {
  const where = `Page ${key}`;
  if (!isObj(page)) return void e.push(`${where}: must be an object`);
  if (!LAYERS.includes(page.layer)) return void e.push(`${where}: layer must be Doc, Prog or Git`);
  if (!key.startsWith(`Page-${page.layer}-`)) e.push(`${where}: a ${page.layer} Page is named Page-${page.layer}-<name>`);
  stats.pages++;
  if (page.status === "MISSING") {
    stats.missing.push(`${bookKey}:${page.layer}`);
    return;
  }
  if (page.kind === "file") {
    if (!book.path) return void e.push(`${where}: a file Page needs its Book to have a path`);
    if (!nonEmpty(page.path) || !page.path.startsWith(`${book.path}/${key}/`)) return void e.push(`${where}: path must sit inside ${book.path}/${key}/`);
    if (!ctx.fileSet.has(page.path)) return void e.push(`${where}: ${page.path} does not exist`);
    acc.files.add(page.path);
    stats.hasFilePage.add(book.path);
    if (page.layer === "Git") {
      if (!page.path.endsWith("/PROVENANCE.json")) e.push(`${where}: a Git Page file is PROVENANCE.json`);
      else checkProvenance(ctx, book.path, key, page.path, e, stats);
    } else if (!HEX40.test(page.blob || "")) e.push(`${where}: a file Page carries the 40-hex blob of its file`);
    else {
      stats.pinned.add(page.path);
      const got = headBlob(ctx, page.path);
      if (!got) e.push(`${where}: ${page.path} is not committed in this checkout`);
      else if (got !== page.blob) e.push(`${where}: stale blob: git has ${got.slice(0, 12)}, the Foyer has ${page.blob.slice(0, 12)}`);
    }
  } else if (page.kind === "folder") {
    if (!book.path) return void e.push(`${where}: a folder Page needs its Book to have a path`);
    if (page.path !== `${book.path}/${key}`) return void e.push(`${where}: path must be ${book.path}/${key}`);
    stats.hasFilePage.add(book.path);
    const prefix = `${page.path}/`;
    const inside = ctx.files.filter(f => f.startsWith(prefix));
    if (!inside.length) return void e.push(`${where}: the folder holds no file`);
    for (const f of inside) {
      const dirs = f.slice(prefix.length).split("/").slice(0, -1);
      if (dirs.some(s => PAGE_FOLDER_NESTING.test(s) || VAULTISH.test(s))) e.push(`${where}: hidden structure inside a Page folder: ${f}`);
    }
    if (page.files !== undefined) {
      if (!Array.isArray(page.files)) return void e.push(`${where}: "files" must be an array`);
      for (const name of page.files) {
        if (!ctx.fileSet.has(prefix + name)) e.push(`${where}: listed file ${name} does not exist`);
        else acc.files.add(prefix + name);
      }
    } else acc.folders.push(prefix);
  } else if (page.kind === "pointer") {
    if (!nonEmpty(page.repo) || !HEX40.test(page.commit || "")) return void e.push(`${where}: a pointer needs repo and a 40-hex commit`);
    const shaped = (nonEmpty(page.path) && HEX40.test(page.blob || "")) || (Array.isArray(page.files) && page.files.length && page.files.every(f => nonEmpty(f.path) && HEX40.test(f.blob || "")));
    if (!shaped) e.push(`${where}: a pointer needs path and blob, or files with path and blob`);
    if (page.repo.toLowerCase() === ctx.slug.toLowerCase()) e.push(`${where}: content in this repo is a file or folder Page, not a pointer`);
    else if (!NAMED_EXCEPTIONS.some(x => x.vault === vid && x.repo === page.repo.toLowerCase())) e.push(`${where}: a pointer to ${page.repo} is not a named exception`);
    else stats.external++;
  } else e.push(`${where}: kind must be file, folder or pointer, or the Page is status MISSING`);
}

function checkCabinet(ctx, vid, rid, row, acc, e, stats) {
  const where = `Row ${rid} Cabinet`;
  const c = row.cabinet;
  if (!isObj(c)) return void e.push(`${where}: must be an object`);
  if (!nonEmpty(c.name) || !nonEmpty(c.position)) e.push(`${where}: needs name and position`);
  if (!Array.isArray(c.summary) || !c.summary.every(nonEmpty)) return void e.push(`${where}: summary must be an array of lines`);
  const needs = [
    ["Read the Book if (or Open the Book if)", /^(?:Read|Open) the Book if: /],
    ["Stop here if", /^Stop here if: /],
    ["Missing layers", /^Missing layers: /],
  ];
  for (const [label, re] of needs) if (!c.summary.some(l => re.test(l))) e.push(`${where}: summary has no "${label}" line`);
  if (c.file !== undefined) {
    if (!nonEmpty(c.file) || !c.file.startsWith(`${row.path}/Cabinet-`) || !c.file.endsWith(".md")) e.push(`${where}: file must be ${row.path}/Cabinet-<name>.md`);
    else if (!ctx.fileSet.has(c.file)) e.push(`${where}: ${c.file} does not exist`);
    else {
      acc.files.add(c.file);
      const derived = deriveSummary(readText(ctx.root, c.file));
      if (JSON.stringify(derived) !== JSON.stringify(c.summary)) {
        const i = derived.findIndex((l, n) => l !== c.summary[n]);
        e.push(`${where}: the Foyer summary differs from ${c.file} (first difference at line ${i < 0 ? derived.length + 1 : i + 1})`);
      }
    }
  }
  if (!isObj(c.books) || !Object.keys(c.books).length) return void e.push(`${where}: books must be a non-empty object`);
  const missingBefore = stats.missing.length;
  let filePages = false;
  for (const [bookKey, book] of Object.entries(c.books)) {
    const bw = `Book ${bookKey}`;
    if (!/^Book-/.test(bookKey)) e.push(`${bw}: a Book is named Book-<name>`);
    if (!isObj(book)) {
      e.push(`${bw}: must be an object`);
      continue;
    }
    stats.books++;
    if (typeof book.full !== "boolean" || !nonEmpty(book.overflow)) e.push(`${bw}: needs "full" (boolean) and "overflow" (the name of the next Book)`);
    if (book.path !== undefined && book.path !== `${row.path}/Books/${bookKey}`) e.push(`${bw}: path must be ${row.path}/Books/${bookKey}`);
    if (!isObj(book.pages)) {
      e.push(`${bw}: pages must be an object`);
      continue;
    }
    for (const L of LAYERS) if (!Object.values(book.pages).some(p => isObj(p) && p.layer === L)) e.push(`${bw}: has no ${L} Page. Add one, or add a Page with status MISSING.`);
    for (const [pageKey, page] of Object.entries(book.pages)) checkPage(ctx, vid, row, book, bookKey, pageKey, page, acc, e, stats);
    if (book.path && stats.hasFilePage.has(book.path)) filePages = true;
    if (book.path) {
      // Every file in a Book is pinned: by a blob in the Foyer or by an entry in PROVENANCE.json.
      for (const f of ctx.files.filter(x => x.startsWith(`${book.path}/`) && !x.endsWith("/PROVENANCE.json"))) {
        if (!stats.pinned.has(f) && !NAMED_EXCEPTIONS.some(x => x.unpinned === f)) e.push(`${bw}: ${f.slice(book.path.length + 1)} is not pinned by a Foyer blob or by PROVENANCE.json`);
      }
    }
  }
  if (c.file === undefined && filePages) e.push(`${where}: a Row with file or folder Pages has a Cabinet file. Only a Row of pointer Pages has none.`);
  const mine = stats.missing.slice(missingBefore);
  const line = c.summary.find(l => /^Missing layers: /.test(l)) || "";
  const allLines = c.summary.filter(l => /^Missing layers: /.test(l)).join(" ");
  if (!mine.length && !/\bnone\b/i.test(line)) e.push(`${where}: no Page is MISSING, so the "Missing layers:" line must say none`);
  for (const m of mine) {
    const layer = m.split(":")[1];
    if (!allLines.includes(`Page-${layer}`)) e.push(`${where}: Book ${m.split(":")[0]} has a MISSING ${layer} Page that the "Missing layers:" line does not name (Page-${layer})`);
  }
}

function foyerValid(ctx) {
  const e = [];
  if (!ctx.foyer.ok) return { errors: [`${FOYER_PATH} ${ctx.foyer.err}`] };
  if (!ctx.files || !ctx.special) return { errors: ["indeterminate: cannot list the checkout files"] };
  const d = ctx.foyer.data;
  if (!isObj(d)) return { errors: [`${FOYER_PATH} is not an object`] };
  for (const k of ctx.foyer.dups) e.push(`${FOYER_PATH}: duplicate key ${k}`);
  checkTopLevel(d, e);
  // Every agent reads the OS before the Foyer: the Foyer names the Page to read first.
  if (d.start !== START_PATH) e.push(`top level: "start" must be ${START_PATH}: every agent reads the OS before the Foyer`);
  else if (!ctx.fileSet.has(START_PATH)) e.push(`top level: "start" names ${START_PATH}, which does not exist`);
  if (!isObj(d.vaults) || !isObj(d.routes)) return { errors: e };
  checkRoutes(d, e);
  vaultKeys(d.vaults, "vaults", e);
  const acc = { files: new Set(), folders: [] };
  const stats = { vaults: 0, rows: 0, books: 0, pages: 0, open: 0, external: 0, provenanceFiles: 0, missing: [], pinned: new Set(), hasFilePage: new Set() };
  const rowNames = new Map();
  for (const [vid, v] of Object.entries(d.vaults)) {
    const vw = `Vault ${vid}`;
    if (!/^\d+$/.test(vid) || !isObj(v)) {
      e.push(`${vw}: a Vault key is a number and its value an object`);
      continue;
    }
    stats.vaults++;
    if (!nonEmpty(v.name)) e.push(`${vw}: needs a name`);
    if (!nonEmpty(v.path) || !new RegExp(`^Vaults/${vid}-[^/]+$`).test(v.path)) e.push(`${vw}: path must be Vaults/${vid}-<name>`);
    if (!isObj(v.rows)) {
      e.push(`${vw}: rows must be an object`);
      continue;
    }
    if (v.os_pointer !== undefined) {
      // PROTOCOL.md Article 3.1: Vault 1 is a pointer. Its only file is POINTER.md.
      if (v.path !== VAULT1 || v.os_pointer !== `${OS_DIR}/`) e.push(`${vw}: only ${VAULT1} is the OS pointer, and it points to ${OS_DIR}/`);
      if (Object.keys(v.rows).length) e.push(`${vw}: is a pointer only and holds no Row`);
      const pf = v.pointer_file;
      if (!isObj(pf) || pf.path !== POINTER_PATH || !HEX40.test(pf.blob || "")) e.push(`${vw}: pointer_file must name ${POINTER_PATH} with its 40-hex blob`);
      else if (!ctx.fileSet.has(POINTER_PATH)) e.push(`${vw}: ${POINTER_PATH} does not exist`);
      else {
        acc.files.add(POINTER_PATH);
        const got = headBlob(ctx, POINTER_PATH);
        if (!got) e.push(`${vw}: ${POINTER_PATH} is not committed in this checkout`);
        else if (got !== pf.blob) e.push(`${vw}: stale blob: git has ${got.slice(0, 12)}, the Foyer has ${pf.blob.slice(0, 12)}`);
        if (readText(ctx.root, POINTER_PATH).replace(/\r\n/g, "\n") !== POINTER_TEXT) e.push(`${vw}: ${POINTER_PATH} must say exactly: ${POINTER_TEXT.trim()}`);
      }
      for (const f of ctx.files.filter(x => x.startsWith(`${VAULT1}/`) && x !== POINTER_PATH)) e.push(`Vault 1 is a pointer only, this file must move to ${OS_DIR}/ or to a Governance Row: ${f}`);
    } else if (!Object.keys(v.rows).length) {
      if (v.status !== OPEN_MARK) e.push(`${vw}: holds no Row, so its status must be "${OPEN_MARK}"`);
      else stats.open++;
    }
    checkPointers(v, vw, d.vaults, e);
    for (const [rid, row] of Object.entries(v.rows)) {
      const rw = `Row ${rid}`;
      if (!new RegExp(`^${vid}\\.\\d+$`).test(rid) || !isObj(row)) {
        e.push(`${rw}: a Row under Vault ${vid} is numbered ${vid}.<n>`);
        continue;
      }
      stats.rows++;
      if (!nonEmpty(row.name)) e.push(`${rw}: needs a name`);
      else {
        const k = norm(row.name);
        if (rowNames.has(k)) e.push(`Row ${rid} and Row ${rowNames.get(k)} have the same name "${row.name}"`);
        rowNames.set(k, rid);
      }
      if (!nonEmpty(row.path) || !row.path.startsWith(`${v.path}/Rows/${rid}-`) || row.path.split("/").length !== 4) e.push(`${rw}: path must be ${v.path}/Rows/${rid}-<name>`);
      checkPointers(row, rw, d.vaults, e);
      if (row.cabinet === undefined) {
        if (row.status !== OPEN_MARK) e.push(`${rw}: has no Cabinet, so its status must be "${OPEN_MARK}"`);
        else stats.open++;
      } else {
        if (row.status === OPEN_MARK) e.push(`${rw}: has a Cabinet and must not be marked open`);
        if (nonEmpty(row.path)) checkCabinet(ctx, vid, rid, row, acc, e, stats);
      }
    }
  }
  // The disk and the Foyer must agree, both ways.
  for (const s of ctx.special) e.push(`${s} hides content the check cannot read`);
  const known = f => acc.files.has(f) || acc.folders.some(p => f.startsWith(p));
  for (const f of ctx.files.filter(x => x.startsWith("Vaults/"))) {
    if (f.split("/").slice(2).some(s => VAULTISH.test(s))) e.push(`a Vault inside a Vault on disk: ${f}`);
    else if (f.startsWith(`${VAULT1}/`)) continue;
    else if (!known(f)) e.push(`unaccounted file, no Page in the Foyer names it: ${f}`);
  }
  // The OS home holds the OS files and nothing else.
  for (const f of ctx.files.filter(x => x.startsWith("Library/"))) if (!OS_FILES.includes(f)) e.push(`unaccounted file in the OS home, CHECK.mjs OS_FILES does not name it: ${f}`);
  for (const f of OS_FILES) if (!ctx.fileSet.has(f)) e.push(`the OS file ${f} is missing`);
  // The move contract: no live file and no open card names a retired path prefix (JEV-MAP.json "moved").
  const mv = movedErrors(ctx);
  e.push(...mv.errors);
  const named = NAMED_EXCEPTIONS.map(x => `${x.id}: ${x.reason}`).join(" ");
  return {
    errors: e,
    detail: `vaults=${stats.vaults} rows=${stats.rows} books=${stats.books} pages=${stats.pages} open=${stats.open} external-pointers=${stats.external} moved-prefixes=${mv.prefixes} (named exceptions ${named})`,
  };
}

/* ------------------------------------------------------------------ gate: single-routing-source */

// How many Vault names does this text map to a Vault number, in any of the usual syntaxes?
// Only the Vault's own number counts: "Engines: 7" is a route; "Engines 560" or "Modules | 18" is a count.
// The three patterns of each Vault name, built once per run, not once per file.
function routePatterns(names) {
  return names.map(name => ({
    name,
    // Every pattern holds the name itself, so a text without it cannot match. For an ASCII name the
    // lower-case test gives the same answer as the case-insensitive pattern; any other name always runs them.
    lower: /^[\x00-\x7f]*$/.test(name) ? name.toLowerCase() : null,
    res: [
      new RegExp(`${esc(name)}["']?[ \\t]*[:=,|][ \\t]*["']?(?:vaults?[ /]*)?(\\d[\\d,]*)(?![\\w])`, "gi"),
      new RegExp(`(?<![\\w,.])(\\d[\\d,]*)["']?(?:[ \\t]*[:=,|][ \\t]*|[ \\t]+)["']?${esc(name)}`, "gi"),
      new RegExp(`vaults?[ \\t]*(\\d+)(?![\\w])(?:[ \\t]*[:=,|][ \\t]*|[ \\t]+)["']?${esc(name)}`, "gi"),
    ],
  }));
}

function routeHits(text, patterns, vaultOf) {
  const isVault = (s, name) => vaultOf.get(name) === String(Number(s.replace(/,/g, "")));
  const lowered = text.toLowerCase();
  let n = 0;
  for (const { name, lower, res } of patterns) {
    if (lower !== null && !lowered.includes(lower)) continue;
    // matchAll copies the pattern, so a shared global pattern keeps no state between texts.
    const hit = re => [...text.matchAll(re)].some(m => isVault(m[1].replace(/,$/, ""), name));
    if (res.some(hit)) n++;
  }
  return n;
}

// The JEV revision is the hash of its records: a hand edit that skips --regen shows as a mismatch.
export function jevRevision(jev) {
  return createHash("sha256").update(JSON.stringify({ vaults: jev.vaults, records: jev.records, moved: jev.moved ?? [] })).digest("hex").slice(0, 16);
}

// The shape of JEV-MAP.json: vaults by number (name, path), records of subject -> Vault (-> Row).
export function jevErrors(jev) {
  const e = [];
  if (!isObj(jev)) return ["JEV-MAP.json is not an object"];
  if (!nonEmpty(jev.revision)) e.push('JEV-MAP.json: "revision" is missing');
  if (!isObj(jev.vaults) || !Object.keys(jev.vaults).length) return [...e, 'JEV-MAP.json: "vaults" must be a non-empty object'];
  for (const [id, v] of Object.entries(jev.vaults)) if (!/^\d+$/.test(id) || !isObj(v) || !nonEmpty(v.name) || !nonEmpty(v.path)) e.push(`JEV-MAP.json: Vault ${id} needs a number, a name and a path`);
  if (!Array.isArray(jev.records) || !jev.records.length) return [...e, 'JEV-MAP.json: "records" must be a non-empty list'];
  const seen = new Map();
  for (const [i, r] of jev.records.entries()) {
    if (!isObj(r) || !nonEmpty(r.subject) || !nonEmpty(r.vault) || !jev.vaults[r.vault]) {
      e.push(`JEV-MAP.json: record ${i} needs a subject and a Vault that exists`);
      continue;
    }
    if (r.row !== undefined && (!new RegExp(`^${r.vault}\\.\\d+$`).test(r.row) || !nonEmpty(r.path))) e.push(`JEV-MAP.json: record "${r.subject}" names Row ${r.row}, which needs ${r.vault}.<n> and a path`);
    // One subject, one record: a name never sits on two levels, and never on two destinations.
    const k = norm(r.subject);
    const prev = seen.get(k);
    if (prev) e.push(`JEV-MAP.json: the subject "${r.subject}" has two records (${prev.row ?? `Vault ${prev.vault}`} and ${r.row ?? `Vault ${r.vault}`}): one subject, one record`);
    seen.set(k, r);
  }
  // The retired path prefixes (the move contract). Empty until a step moves a folder.
  if (jev.moved !== undefined) {
    if (!Array.isArray(jev.moved)) e.push('JEV-MAP.json: "moved" must be a list');
    else for (const [i, m] of jev.moved.entries()) if (!isObj(m) || !nonEmpty(m.from) || !nonEmpty(m.to)) e.push(`JEV-MAP.json: moved[${i}] needs "from" and "to"`);
  }
  return e;
}

// FOYER.json is a generated view of JEV-MAP.json: routes, Vault names and paths, and Row names and
// paths come from JEV; Cabinets, Books, Pages, notes and pointers are kept from the Foyer as it is.
// When a Vault or Row path changes in the JEV map, every path the Foyer keeps under the old one (a Cabinet
// file, a Book or Page path, a summary_source) is rebased onto the new one. A path matches only whole:
// "Vaults/2-Memory" rebases "Vaults/2-Memory/x" but never "Vaults/2-Memory-Old" or "Library/Memory/Vaults/2-Memory".
export function rebasePaths(node, from, to) {
  if (!nonEmpty(from) || !nonEmpty(to) || from === to) return node;
  const re = new RegExp(`(?<![\\w./-])${esc(from)}(?=/|$|[^\\w.-])`, "g");
  const walk = v => {
    if (typeof v === "string") return v.replace(re, to);
    if (Array.isArray(v)) return v.map(walk);
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(node);
}

export function generateFoyer(jev, foyer) {
  const out = {};
  for (const [k, v] of Object.entries(foyer)) {
    if (k === "routes" || k === "vaults") continue;
    out[k] = v;
    if (k === "start") out.jev_revision = jev.revision;
  }
  out.jev_revision = jev.revision;
  out.routes = Object.fromEntries(jev.records.filter(r => r.row === undefined).map(r => [r.subject, r.vault]));
  out.vaults = {};
  for (const [id, jv] of Object.entries(jev.vaults)) {
    const old = (foyer.vaults || {})[id] || {};
    const v = { name: jv.name, path: jv.path };
    if (jv.os_pointer !== undefined) v.os_pointer = jv.os_pointer;
    const vaultRebase = x => rebasePaths(x, old.path, jv.path);
    for (const [k, x] of Object.entries(old)) if (!["name", "path", "os_pointer", "rows"].includes(k)) v[k] = vaultRebase(x);
    v.rows = {};
    for (const r of jev.records.filter(x => x.vault === id && x.row !== undefined)) {
      const oldRow = (old.rows || {})[r.row];
      const row = { name: r.subject, path: r.path };
      if (oldRow) for (const [k, x] of Object.entries(oldRow)) if (k !== "name" && k !== "path") row[k] = vaultRebase(rebasePaths(x, oldRow.path, r.path));
      if (!oldRow) row.status = OPEN_MARK;
      v.rows[r.row] = row;
    }
    out.vaults[id] = v;
  }
  return out;
}

function singleRoutingSource(ctx) {
  const e = [];
  if (!ctx.jev.ok) return { errors: [`${JEV_PATH} ${ctx.jev.err}: it is the one routing authority`] };
  if (!ctx.foyer.ok || !isObj(ctx.foyer.data)) return { errors: [`indeterminate: ${FOYER_PATH} is not readable`] };
  if (!ctx.files) return { errors: ["indeterminate: cannot list the checkout files"] };
  const jev = ctx.jev.data;
  for (const d of ctx.jev.dups) e.push(`duplicate key ${d} in ${JEV_PATH}`);
  const shape = jevErrors(jev);
  if (shape.length) return { errors: [...e, ...shape] };
  const live = jevRevision(jev);
  if (jev.revision !== live) e.push(`${JEV_PATH} revision ${jev.revision} is not the hash of its records (${live}): stop. Fix: node ${CHECK_PATH} --regen`);
  const foyer = ctx.foyer.data;
  if (foyer.jev_revision !== jev.revision) e.push(`${FOYER_PATH} has JEV revision ${foyer.jev_revision}, ${JEV_PATH} has ${jev.revision}: different revisions, stop. Fix: node ${CHECK_PATH} --regen`);
  else if (JSON.stringify(generateFoyer(jev, foyer)) !== JSON.stringify(foyer)) e.push(`${FOYER_PATH} is not the generated view of ${JEV_PATH} (a route, Vault or Row differs): stop. Fix: change the record in ${JEV_PATH}, then node ${CHECK_PATH} --regen`);
  // Any third routing table fails: by name, or by content that maps Vault names to numbers.
  const names = Object.values(jev.vaults).map(v => v.name).filter(nonEmpty);
  const vaultOf = new Map(Object.entries(jev.vaults).map(([k, v]) => [v.name, k]));
  const patterns = routePatterns(names);
  // X-007 and X-009: named documents of record whose prose names Vaults next to their numbers.
  const proseIds = new Map(NAMED_EXCEPTIONS.filter(x => nonEmpty(x.prose_route_mention)).map(x => [x.prose_route_mention, x.id]));
  const exemptedBy = new Map();
  let scanned = 0;
  let exempted = 0;
  for (const f of ctx.files) {
    if (f === FOYER_PATH || f === JEV_PATH) continue;
    if (DOC_EXT.test(f) && ROUTE_NAME.test(f.split("/").pop())) e.push(`a third routing table by name: ${f}`);
    if (!TEXT_EXT.test(f)) continue;
    // X-004: Row 5.13 is read-only, an artifact under upgrade; its text describes, it never routes.
    if (f.startsWith(ROW_513)) continue;
    const r = scanText(ctx, f);
    if (r.error) e.push(r.error);
    if (!r.text) continue;
    scanned++;
    const hits = routeHits(r.text, patterns, vaultOf);
    if (hits >= 3) {
      if (proseIds.has(f)) {
        exempted++;
        exemptedBy.set(proseIds.get(f), (exemptedBy.get(proseIds.get(f)) || 0) + 1);
        continue;
      }
      e.push(`a third routing table by content (${hits} Vault names mapped to numbers): ${f}`);
    }
  }
  const x7note = exempted ? ` (${[...exemptedBy].sort().map(([id, n]) => `named exception ${id}: ${n} file exempted as a document of record, not a second table`).join("; ")})` : "";
  return { errors: e, detail: `${JEV_PATH} is the one routing authority, revision ${jev.revision} (${jev.records.length} records); ${FOYER_PATH} is its generated view with the same revision; no third table (${scanned} files scanned)${x7note}` };
}

/* ------------------------------------------------------------------ gate: single-queue */

function singleQueue(ctx) {
  if (!ctx.files) return { errors: ["indeterminate: cannot list the checkout files"] };
  const e = [];
  // A Cabinet file is the summary at the end of a Row, never a queue, even when its Row is named after one.
  // A handover is named for what the session did, which can be the ROADMAP. Card lines inside either still count below.
  const byName = ctx.files.filter(f => DOC_EXT.test(f) && QUEUE_NAME.test(f.split("/").pop()) && !/^Cabinet-/.test(f.split("/").pop()) && !f.includes("/Page-Doc-Handover/"));
  const byContent = [];
  for (const f of ctx.files) {
    if (byName.includes(f) || !TEXT_EXT.test(f)) continue;
    const r = scanText(ctx, f);
    if (r.error) e.push(r.error);
    else if (r.text && r.text.split(/\r?\n/).filter(l => CARD_LINE.test(l)).length >= CARD_LINES_MAKE_A_QUEUE) byContent.push(f);
  }
  const hits = [...byName, ...byContent].sort();
  if (hits.length === 0) {
    e.push(`${OPEN_MARK}: no queue file is filed in this repo yet, so there is nothing to confirm. Failing closed until the ROADMAP is filed.`);
    const builder = ctx.registry.ok && isObj(ctx.registry.data) ? ctx.registry.data.builder : undefined;
    if (builder !== OPEN_MARK) e.push(`${REGISTRY_PATH} names the Builder ${builder}, and no queue is filed: write "${OPEN_MARK}" there`);
    // /start runs a repo's doctor:boot and blocks the session on its exit 1. Until the queue is filed that would block every session.
    const pkg = loadJson(ctx.root, "package.json");
    if (pkg.ok && isObj(pkg.data) && isObj(pkg.data.scripts) && "doctor:boot" in pkg.data.scripts) {
      e.push("package.json defines doctor:boot while the queue is [OPEN]: /start runs it and blocks every session on its exit 1. Name the script os:check until the ROADMAP is filed.");
    }
    return { errors: e };
  }
  if (hits.length > 1) {
    e.push(`${hits.length} queue files, one is allowed: ${hits.join(", ")}${byContent.length ? ` (found by card lines in ${byContent.join(", ")})` : ""}`);
    return { errors: e };
  }
  if (!hits[0].startsWith("Vaults/")) e.push(`the queue ${hits[0]} is not filed in a Vault`);
  const q = ctx.foyer.ok && isObj(ctx.foyer.data) ? ctx.foyer.data.queue : undefined;
  if (q !== undefined && q !== hits[0]) e.push(`the Foyer names the queue ${q}, the file found is ${hits[0]}`);
  // PROTOCOL.md Article 3.2: one queue, the Builder. The registry names the same file.
  const builder = ctx.registry.ok && isObj(ctx.registry.data) ? ctx.registry.data.builder : undefined;
  if (builder !== hits[0]) e.push(`${REGISTRY_PATH} names the Builder ${builder}, the one queue is ${hits[0]}`);
  // E-002: no task name appears in more than one source.
  const taskKey = t => {
    const s = t.replace(/\*\*/g, "").trim();
    const id = s.match(/^(\d{2}-\d{2}|[A-Z]{1,3}\d{2,3}[a-z]?)[: ]/);
    return id ? id[1] : norm(s.split(" - ")[0]);
  };
  const qr = scanText(ctx, hits[0]);
  const keys = new Set((qr.text || "").split(/\r?\n/).map(l => l.match(TASK_LINE)).filter(Boolean).map(m => taskKey(m[1])).filter(Boolean));
  const dupes = [];
  for (const f of ctx.files) {
    if (f === hits[0] || !TEXT_EXT.test(f)) continue;
    const r = scanText(ctx, f);
    if (!r.text) continue;
    for (const l of r.text.split(/\r?\n/)) {
      const m = l.match(TASK_LINE);
      if (m && keys.has(taskKey(m[1]))) dupes.push(`${taskKey(m[1])} in ${f}`);
    }
  }
  if (dupes.length) e.push(`a task name of the queue appears in a second source: ${dupes.slice(0, 4).join(", ")}${dupes.length > 4 ? ` (+${dupes.length - 4} more)` : ""}. One queue: move the task into ${hits[0]}`);
  const blob = headBlob(ctx, hits[0]);
  return { errors: e, detail: `the one queue is the Builder ${hits[0]}, version ${blob ? blob.slice(0, 12) : "uncommitted"}; ${keys.size} task names, none in a second source` };
}

/* ------------------------------------------------------------------ reading list */

// START.md's reading-list block: one line per step of PROTOCOL.md Article 1, "<kind> <path>", in its
// order. A list that drops, adds or reorders a step is a FAIL: the Agent shall not substitute its own order.
export function readingList(ctx) {
  if (!ctx.fileSet.has(START_PATH)) return { error: `${START_PATH} is missing` };
  const m = readText(ctx.root, START_PATH).match(/```reading-list\r?\n([\s\S]*?)```/);
  if (!m) return { error: "START.md has no reading-list block" };
  const lines = m[1].split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return { error: "the reading-list block is empty" };
  const list = [];
  for (const l of lines) {
    const p = l.match(/^(read|run|version) (\S+)$/);
    if (!p) return { error: `reading list line "${l}" is not "<read|run|version> <path>"` };
    list.push({ kind: p[1], path: p[2] });
  }
  for (const x of list) if (/^(?:[A-Za-z]:|\/|\\)/.test(x.path) || x.path.split(/[\\/]/).includes("..")) return { error: `reading list entry ${x.path} leaves this repo` };
  const builder = ctx.registry.ok && isObj(ctx.registry.data) ? ctx.registry.data.builder : undefined;
  const want = ARTICLE_1.filter(([, , p]) => p !== "BUILDER" || builder !== OPEN_MARK).map(([, kind, p]) => ({ kind, path: p === "BUILDER" ? builder : p }));
  const show = a => a.map(x => `${x.kind} ${x.path}`).join("; ");
  if (JSON.stringify(list) !== JSON.stringify(want)) return { error: `the reading list must be PROTOCOL.md Article 1 in its order: ${show(want)}. It is: ${show(list)}` };
  return { list };
}

// The text of a reading-list file as a phrase gate should read it. The founder's verbatim text, and
// the Foyer's founder quotes, are quotes, not instructions.
function readingText(ctx, f) {
  if (VERBATIM.includes(f)) return { text: "" };
  const r = scanText(ctx, f);
  if (r.error || !r.text) return r;
  if (f !== FOYER_PATH) return r;
  try {
    const o = JSON.parse(r.text);
    delete o.founder_rulings_verbatim;
    return { text: JSON.stringify(o, null, 2) };
  } catch {
    return r;
  }
}

/* ------------------------------------------------------------------ gate: no-71-source */

// E-001: no 7.1 source in the boot reading path. Every step's file is in this repo and exists, no
// `read` file points at the glumira-7.1 task list, and the registry never makes glumira-7.1 active.
function no71Source(ctx) {
  const rl = readingList(ctx);
  if (rl.error) return { errors: [rl.error] };
  const e = [];
  for (const { kind, path: f } of rl.list) {
    if (!ctx.fileSet.has(f)) {
      e.push(`reading list entry ${f} does not exist`);
      continue;
    }
    if (kind !== "read") continue;
    const r = readingText(ctx, f);
    if (r.error) e.push(r.error);
    else if (r.text === undefined) e.push(`reading list entry ${f} is not text`);
    else {
      const at = phraseHit(r.text, PUNCH71, /\.(md|markdown|txt)$/i.test(f));
      if (at >= 0) e.push(`${f}:${at} points at the glumira-7.1 task list`);
    }
  }
  if (ctx.registry.ok && isObj(ctx.registry.data)) {
    const d = ctx.registry.data;
    const is71 = s => /(?:^|\/)glumira-7\.1$/i.test(String(s || ""));
    if (is71(d.active) || (Array.isArray(d.repos) && d.repos.some(x => isObj(x) && x.active === true && is71(x.repo)))) e.push(`${REGISTRY_PATH} makes glumira-7.1 the active repo: it is a frozen source, never the boot`);
  }
  return { errors: e, detail: `${rl.list.length} steps on the boot reading path, all in this repo, none points at the glumira-7.1 task list; the registry's active repo is not glumira-7.1` };
}

/* ------------------------------------------------------------------ gate: memory-guard */

// MEMORY-GUARD.md is the Guide's section "THE MEMORY GUARD (BOOT PATH ONLY)", word for word.
export function guideSection(guide) {
  const a = guide.indexOf("THE MEMORY GUARD (BOOT PATH ONLY)");
  const z = guide.indexOf("THE BUILDER (INLINE WITH OS)");
  return a < 0 || z < a ? null : guide.slice(a, z).replace(/\n+$/, "\n");
}

export function isMemoryPath(p) {
  if (p === MEMORY_GUARD_PATH) return false;
  const segs = p.split("/");
  if (p.startsWith("Vaults/2-Memory/")) return true;
  return segs.slice(0, -1).some(s => MEMORY_DIR.test(s)) || MEMORY_NAME.test(segs[segs.length - 1]);
}

// E-003, PROTOCOL.md Article 2.3. FAIL only on a memory file in the boot reading path (steps 1 to 10),
// before the JEV map has routed. A matching path is a flag, not proof. An intentional read after the
// JEV map has routed is never a failure, so nothing off the reading list is looked at.
function memoryGuard(ctx) {
  const e = [];
  const rl = readingList(ctx);
  if (rl.error) return { errors: [rl.error] };
  const boot = rl.list.filter(x => x.path !== STOP_PATH);
  for (const { path } of boot) if (isMemoryPath(path)) e.push(`Memory file in boot path at ${path}`);
  if (!ctx.fileSet.has(GUIDE_PATH) || !ctx.fileSet.has(MEMORY_GUARD_PATH)) e.push(`${GUIDE_PATH} and ${MEMORY_GUARD_PATH} must both exist`);
  else {
    const want = guideSection(readText(ctx.root, GUIDE_PATH).replace(/\r\n/g, "\n"));
    if (want === null) e.push(`${GUIDE_PATH} has no section "THE MEMORY GUARD (BOOT PATH ONLY)"`);
    else if (readText(ctx.root, MEMORY_GUARD_PATH).replace(/\r\n/g, "\n") !== want) e.push(`${MEMORY_GUARD_PATH} is not the Guide's section "THE MEMORY GUARD (BOOT PATH ONLY)" word for word`);
  }
  if (ctx.foyer.ok && isObj(ctx.foyer.data?.vaults) && !Object.values(ctx.foyer.data.vaults).some(v => norm(v.name) === "memory")) e.push("the Foyer has no Vault named Memory, so memory has no home");
  return { errors: e, detail: `no memory file on the boot reading path (${boot.length} steps before routing); a read after the JEV map has routed is never a failure; Vault 2 Memory is its home` };
}

/* ------------------------------------------------------------------ gate: edition-stamp */

export function protocolEdition(text) {
  const m = String(text).match(/^edition\s*:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

// The three stamp lines near the top of a text Page file, as comments or plain lines.
export function textStamp(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/).slice(0, 25)) {
    const l = raw.replace(/^\s*(?:\/\/|#|<!--|\/\*|\*)\s?/, "").replace(/\s*(?:-->|\*\/)\s*$/, "").trim();
    const m = l.match(/^(edition|status|date) : (.+)$/);
    if (m && out[m[1]] === undefined) out[m[1]] = m[2];
  }
  return out;
}

// PROTOCOL.md Article 6.5: a Page unchanged since an edition change keeps its old line. The past
// editions are the ERRATA rows that carry "edition_change": { from, to, commit }, where commit is the
// commit before the change. A past edition passes only on a file whose blob equals its blob there.
export function editionChanges(errataData) {
  const rows = errataData && Array.isArray(errataData.rows) ? errataData.rows : [];
  return rows.filter(r => isObj(r) && isObj(r.edition_change)).map(r => ({ id: r.id, ...r.edition_change }));
}

function blobAt(ctx, commit, path) {
  ctx.blobsAt ??= new Map();
  if (!ctx.blobsAt.has(commit)) {
    const m = new Map();
    const r = ctx.git(["ls-tree", "-r", "-z", commit]);
    if (!r.ok) return undefined;
    for (const rec of r.out.split("\0").filter(Boolean)) {
      const x = rec.match(/^\d+ blob ([0-9a-f]{40})\t([\s\S]*)$/);
      if (x) m.set(x[2], x[1]);
    }
    ctx.blobsAt.set(commit, m);
  }
  return ctx.blobsAt.get(commit).get(path) || null;
}

// The path a file had before the moves of the JEV moved list: the longest "to" prefix it sits under is
// put back to its "from", until no move matches. A git mv keeps the bytes, so the old path finds the old blob.
export function pathBeforeMoves(moved, f) {
  const list = (Array.isArray(moved) ? moved : []).filter(m => isObj(m) && nonEmpty(m.from) && nonEmpty(m.to));
  let p = f;
  for (let n = 0; n < list.length; n++) {
    const m = list.filter(x => p === x.to || p.startsWith(`${x.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
    if (!m) break;
    p = m.from + p.slice(m.to.length);
  }
  return p;
}

// A stamp whose edition is a past one passes only when the file is the byte it was at the change. A Page
// that moved since then is looked up at its path before the move.
function pastEditionOk(ctx, f, stamp, edition, changes) {
  if (stamp.edition === edition) return true;
  const c = changes.find(x => x.from === stamp.edition);
  if (!c) return false;
  const moved = ctx.jev.ok && isObj(ctx.jev.data) ? ctx.jev.data.moved : [];
  const was = blobAt(ctx, c.commit, f) || blobAt(ctx, c.commit, pathBeforeMoves(moved, f));
  return !!was && was === headBlob(ctx, f);
}

function stampErrors(stamp, edition, past = () => false) {
  const e = [];
  if (stamp.edition !== edition && !past(stamp)) e.push(`edition is ${stamp.edition === undefined ? "missing" : `"${stamp.edition}"`}, the Protocol says ${edition}`);
  if (!STATUS_VALUES.includes(stamp.status)) e.push(`status is ${stamp.status === undefined ? "missing" : `"${stamp.status}"`}, it is DONE or Mid Flight`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp.date || "")) e.push(`date is ${stamp.date === undefined ? "missing" : `"${stamp.date}"`}, it is YYYY-MM-DD`);
  return e;
}

// E-004. A name under Library or Vaults never carries an edition, and every Page file carries the
// three-line stamp: edition, status (DONE or Mid Flight), date. The edition's one source is the
// Protocol header. Named exceptions X-003 to X-006 are printed on the gate line.
function editionStamp(ctx) {
  if (!ctx.files) return { errors: ["indeterminate: cannot list the checkout files"] };
  const e = [];
  if (!ctx.fileSet.has(PROTOCOL_PATH)) return { errors: [`${PROTOCOL_PATH} is missing, so the edition has no source`] };
  const edition = protocolEdition(readText(ctx.root, PROTOCOL_PATH));
  if (!edition) return { errors: [`${PROTOCOL_PATH} has no "edition :" line`] };
  // Article 6.5: the edition line names the edition in a word, never a number.
  if (/\d/.test(edition)) e.push(`${PROTOCOL_PATH} edition is "${edition}": the edition is a word, never a number (Article 6.5)`);
  // The past editions, each with the commit before its change (ERRATA rows with "edition_change").
  const errataJ = loadJson(ctx.root, ERRATA_PATH);
  const changes = errataJ.ok ? editionChanges(errataJ.data) : [];
  for (const c of changes) {
    if (!nonEmpty(c.from) || !nonEmpty(c.to) || !HEX40.test(c.commit || "")) e.push(`${c.id}: "edition_change" needs from, to and a 40-hex commit`);
    else if (blobAt(ctx, c.commit, PROTOCOL_PATH) === undefined) e.push(`${c.id}: the edition-change commit ${c.commit.slice(0, 12)} is not in this checkout (a shallow clone? fetch full history)`);
  }
  const live = changes.filter(c => HEX40.test(c.commit || "") && ctx.blobsAt?.has(c.commit));
  const latest = changes[changes.length - 1];
  if (latest && latest.to !== edition) e.push(`${latest.id}: the last edition change is to "${latest.to}", the Protocol says ${edition}`);
  // The Foyer counter is frozen at the edition change: it is never raised again.
  const frozen = latest && latest.foyer_version_frozen;
  if (frozen !== undefined && ctx.foyer.ok && isObj(ctx.foyer.data) && ctx.foyer.data.version !== undefined && ctx.foyer.data.version !== frozen) e.push(`${FOYER_PATH} version is "${ctx.foyer.data.version}": the counter is frozen at "${frozen}" (${latest.id}) and is never raised`);
  const past = f => s => pastEditionOk(ctx, f, s, edition, live);
  const x5 = NAMED_EXCEPTIONS.find(x => x.id === "X-005").names;
  const x4 = NAMED_EXCEPTIONS.find(x => x.id === "X-004").prefix;
  // Names: every folder and file segment below Library/ and Vaults/.
  const badNames = new Set();
  for (const f of ctx.files.filter(x => x.startsWith("Library/") || x.startsWith("Vaults/"))) {
    if (f.startsWith(x4)) continue;
    const segs = f.split("/");
    for (let i = 1; i < segs.length; i++) {
      const at = segs.slice(0, i + 1).join("/");
      if (x5.includes(at)) continue;
      if (nameCarriesEdition(segs[i], segs[i - 1])) badNames.add(at);
    }
  }
  for (const n of [...badNames].sort()) e.push(`a name carries the edition, rename it to its subject only: ${n}`);
  // Stamps: the byte copies of another repo, from every PROVENANCE.json under Vaults.
  const copies = new Set();
  let stamped = 0;
  for (const p of ctx.files.filter(x => x.startsWith("Vaults/") && x.endsWith("/PROVENANCE.json") && !x.startsWith(x4))) {
    const j = loadJson(ctx.root, p);
    if (!j.ok || !isObj(j.data)) continue;
    const book = dirname(dirname(p));
    for (const s of Array.isArray(j.data.sources) ? j.data.sources : []) {
      if (!isObj(s) || String(s.repo).toLowerCase() === ctx.slug.toLowerCase()) continue;
      for (const f of Array.isArray(s.files) ? s.files : []) if (isObj(f) && nonEmpty(f.copy)) copies.add(`${book}/${f.copy}`);
    }
  }
  for (const f of ctx.files.filter(x => x.startsWith("Vaults/") && x.split("/").some(s => /^Page-(?:Doc|Prog|Git)-/.test(s)))) {
    if (f.startsWith(x4) || copies.has(f)) continue;
    let errs;
    if (f.endsWith(".json")) {
      const j = loadJson(ctx.root, f);
      if (!j.ok || !isObj(j.data)) errs = ["is not a JSON object, so it has no place for the stamp keys"];
      else errs = stampErrors(j.data, edition, past(f));
    } else if (PURE_DATA.test(f)) continue;
    else {
      const r = scanText(ctx, f);
      if (r.error) errs = [r.error];
      else if (r.binary) continue;
      else errs = stampErrors(textStamp(r.text), edition, past(f));
    }
    if (errs.length) e.push(`${f}: ${errs.join("; ")}`);
    else stamped++;
  }
  const named = NAMED_EXCEPTIONS.filter(x => ["X-003", "X-004", "X-005", "X-006"].includes(x.id)).map(x => `${x.id}: ${x.reason}`).join(" ");
  const pastNote = live.length ? `; past edition ${live.map(c => `${c.from} only on a Page unchanged since ${c.commit.slice(0, 12)} (${c.id})`).join(", ")}${frozen !== undefined ? `; Foyer counter frozen at ${frozen}` : ""}` : "";
  return { errors: e, detail: `edition ${edition} from ${PROTOCOL_PATH}${pastNote}; no name carries the edition; ${stamped} Page files stamped, ${copies.size} byte copies stamped through their PROVENANCE.json (named exceptions ${named})` };
}

/* ------------------------------------------------------------------ gate: path-length */

// The longest path, in characters, any file under Library/, Foyer/ or Vaults/ may have. It is the longest
// such path after the Vault 5 rename of 2026-10-13 (founder order "fix"), when brand and edition words
// left the names. A ratchet: it may be lowered when the longest path gets shorter, never raised. The
// reason is Windows: its classic path limit is 260 characters for the whole path, and a worktree
// checkout root (C:\Glumira-7.2\.claude\worktrees\<name>\) takes about 60 of them.
export const MAX_PATH_LENGTH = 165;
const PATH_LENGTH_ROOTS = ["Library/", "Foyer/", "Vaults/"];

function pathLength(ctx) {
  if (!ctx.files) return { errors: ["indeterminate: cannot list the checkout files"] };
  const e = [];
  let n = 0;
  let longest = "";
  for (const f of ctx.files) {
    if (!PATH_LENGTH_ROOTS.some(r => f.startsWith(r))) continue;
    n++;
    if (f.length > longest.length) longest = f;
    if (f.length > MAX_PATH_LENGTH) e.push(`a path is ${f.length} characters, the limit is ${MAX_PATH_LENGTH}: ${f}. Fix: shorten a name in it to its subject, never raise the limit`);
  }
  return { errors: e, detail: `${n} paths under ${PATH_LENGTH_ROOTS.join(", ")}; the longest is ${longest.length} characters, the limit is ${MAX_PATH_LENGTH} (a ratchet: lowered, never raised)` };
}

/* ------------------------------------------------------------------ gate: errata */

// E-YYYYMMDD-slug (the ledger before the Protocol) or E-NNN (GUIDE.md, THE SELF-IMPROVING LOOP).
const ID_RE = /^E-(?:(\d{8})-[a-z0-9]+(?:-[a-z0-9]+)*|\d{3})$/;

function errata(ctx, results) {
  const j = loadJson(ctx.root, ERRATA_PATH);
  if (!j.ok) return { errors: [`${ERRATA_PATH} ${j.err}`] };
  const e = j.dups.map(d => `duplicate key ${d} in ERRATA.json`);
  const rows = j.data && j.data.rows;
  if (!Array.isArray(rows) || !rows.length) return { errors: [...e, "ERRATA.json has no rows"] };
  const proofs = ctx.fileSet.has(TEST_PATH) ? readText(ctx.root, TEST_PATH) : null;
  if (proofs === null) return { errors: [...e, `${TEST_PATH} is missing, so no row can be proven`] };
  const seen = new Set();
  const open = [];
  const byGate = new Map(results.map(r => [r.gate, r]));
  for (const row of rows) {
    const id = row && row.id;
    const idm = ID_RE.exec(id || "");
    if (!idm) {
      e.push(`row id "${id}" is not E-YYYYMMDD-slug or E-NNN`);
      continue;
    }
    if (seen.has(id)) e.push(`${id}: duplicate id`);
    seen.add(id);
    for (const k of ["date", "error", "root_cause", "source", "check", "proof"]) if (!nonEmpty(row[k])) e.push(`${id}: "${k}" is missing`);
    if (idm[1] && nonEmpty(row.date) && row.date.replace(/-/g, "") !== idm[1]) e.push(`${id}: date ${row.date} does not match the id`);
    if (!GATES.includes(row.check) || row.check === "errata") e.push(`${id}: check "${row.check}" is not implemented in CHECK.mjs`);
    else {
      const r = byGate.get(row.check);
      if (!r) e.push(`${id}: check ${row.check} did not run`);
      else if (!r.ok && r.open) open.push(row.check);
      else if (!r.ok) e.push(`${id}: check ${row.check} does not pass`);
      if (nonEmpty(row.proof) && !row.proof.startsWith(`${row.check}: `)) e.push(`${id}: proof "${row.proof}" must be a test of ${row.check}, named "${row.check}: ..."`);
    }
    if (nonEmpty(row.proof) && !new RegExp(`^\\s*test\\("${esc(row.proof)}"`, "m").test(proofs)) e.push(`${id}: proof test "${row.proof}" is not in CHECK.test.mjs`);
  }
  const rest = open.length ? `; ${open.length} rest on a gate that is [OPEN], reported on its own line` : "";
  return { errors: e, detail: `${rows.length} rows, each with an implemented check that passes and a named proof test${rest}` };
}

/* ------------------------------------------------------------------ route and blobs */

// PROTOCOL.md Article 2.5: route only to destinations that exist in the JEV map. Never guessed.
export function routeSubject(jev, subject) {
  const key = norm(subject);
  if (!key || !isObj(jev) || !Array.isArray(jev.records) || !isObj(jev.vaults)) return null;
  // A Vault record first, then a Row record: the same order the Foyer routes used.
  const hits = jev.records.filter(r => isObj(r) && (norm(r.subject) === key || (r.row !== undefined && r.row === String(subject).trim())));
  const rec = hits.find(r => r.row === undefined) || hits[0];
  if (!rec || !jev.vaults[rec.vault]) return null;
  const v = jev.vaults[rec.vault];
  if (rec.row === undefined) return { kind: "Vault", id: rec.vault, name: v.name, path: v.os_pointer ? `${v.path} (a pointer: the OS lives at ${v.os_pointer})` : v.path };
  return { kind: "Row", id: rec.row, name: rec.subject, path: rec.path, vault: `${rec.vault} ${v.name}` };
}

// Recompute the JEV revision and regenerate the Foyer from it, in one step (PROTOCOL.md Article 3.4).
export function regen(root) {
  const jevJ = loadJson(root, JEV_PATH);
  if (!jevJ.ok) throw new Error(`${JEV_PATH} ${jevJ.err}`);
  const foyerJ = loadJson(root, FOYER_PATH);
  if (!foyerJ.ok) throw new Error(`${FOYER_PATH} ${foyerJ.err}`);
  const jev = jevJ.data;
  const shape = jevErrors({ ...jev, revision: jev.revision || "x" });
  if (shape.length) throw new Error(shape.join(" | "));
  jev.revision = jevRevision(jev);
  writeFileSync(join(root, JEV_PATH), JSON.stringify(jev, null, 2) + "\n");
  writeFileSync(join(root, FOYER_PATH), JSON.stringify(generateFoyer(jev, foyerJ.data), null, 2) + "\n");
  return jev.revision;
}

/* ------------------------------------------------------------------ runner */

const IMPLEMENTATION = {
  "repo-confirm": repoConfirm,
  "snapshot-fingerprint": snapshotFingerprint,
  "foyer-valid": foyerValid,
  "single-routing-source": singleRoutingSource,
  "single-queue": singleQueue,
  "no-71-source": no71Source,
  "memory-guard": memoryGuard,
  "edition-stamp": editionStamp,
  "path-length": pathLength,
};

export async function runChecks(root, opts = {}) {
  const ctx = await buildContext(root, opts);
  const results = [];
  for (const gate of GATES) {
    let r;
    try {
      r = gate === "errata" ? errata(ctx, results) : IMPLEMENTATION[gate](ctx);
    } catch (err) {
      r = { errors: [`indeterminate: the gate crashed (${err.message})`] };
    }
    // A gate whose only failure is the [OPEN] marker is a named open item, not a broken check.
    const open = r.errors.length > 0 && r.errors.every(x => x.startsWith(OPEN_MARK));
    results.push({ gate, ok: r.errors.length === 0, open, errors: r.errors, detail: r.detail || "" });
  }
  return results;
}

export function formatReport(results, verbose = false) {
  const lines = results.map(r => {
    if (r.ok) return `PASS ${r.gate}: ${r.detail}`;
    const cap = verbose ? r.errors.length : 6;
    const shown = r.errors.slice(0, cap).join(" | ");
    const more = r.errors.length > cap ? ` | (+${r.errors.length - cap} more)` : "";
    return `FAIL ${r.gate}: ${shown}${more}`;
  });
  const passed = results.filter(r => r.ok).length;
  lines.push(`RESULT ${passed === results.length ? "PASS" : "FAIL"}: ${passed} of ${results.length} gates passed`);
  return lines.join("\n");
}

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--root") o.root = take();
    else if (a === "--task-repo") o.taskRepo = take();
    else if (a === "--fetch") o.fetch = true;
    else if (a === "--verbose") o.verbose = true;
    else if (a === "--snapshot") o.snapshot = take();
    else if (a === "--expect") o.expect = take();
    else if (a === "--route") o.route = take();
    else if (a === "--regen") o.regen = true;
    else if (a === "--blobs") o.blobs = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : OS_DIR;
    else if (a === "--actor") take();
    else if (a.startsWith("--actor=")) continue;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.log(`FAIL args: ${e.message}`);
    process.exit(1);
  }
  const top = gitIn(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const root = resolve(o.root || (top.ok ? top.out : process.cwd()));
  if (o.route !== undefined) {
    const f = loadJson(root, JEV_PATH);
    const hit = f.ok ? routeSubject(f.data, o.route) : null;
    if (!hit) {
      console.log(`FAIL route: "${o.route}" has no record in ${JEV_PATH}. Do not guess: stop and request a ruling.`);
      process.exit(1);
    }
    console.log(`ROUTE "${o.route}" -> ${hit.kind} ${hit.id} ${hit.name}${hit.vault ? ` (Vault ${hit.vault})` : ""} at ${hit.path}`);
    return;
  }
  if (o.regen) {
    try {
      console.log(`REGEN ${JEV_PATH} revision ${regen(root)}; ${FOYER_PATH} regenerated with the same revision. Commit both.`);
    } catch (e) {
      console.log(`FAIL regen: ${e.message}`);
      process.exit(1);
    }
    return;
  }
  if (o.blobs !== undefined) {
    const dir = o.blobs.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    const files = (listFiles(root) || []).filter(f => f.startsWith(`${dir}/`));
    if (!files.length) {
      console.log(`FAIL blobs: no file under ${dir}`);
      process.exit(1);
    }
    let bad = 0;
    for (const f of files) {
      const h = gitIn(root, ["hash-object", "--", f]);
      if (!h.ok) bad++;
      console.log(`${h.ok ? h.out : "ERROR"} ${f}`);
    }
    if (bad) process.exit(1);
    return;
  }
  const results = await runChecks(root, o);
  console.log(formatReport(results, !!o.verbose));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}

// Run only when this file is the entry point. Compare real paths: a symlink or junction to this
// file must still run, and an import must not.
const isEntry = (() => {
  try {
    return !!process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isEntry) await main();
