# Glumira Production Builder: the program

This folder is the runnable builder. Every file except this README is a byte copy of
`francoissteyn-2026/Daily-Diary` main at `49f781f`, with one recorded edit: `production-builder/index.html`
has a Chat link added at the top (2026-10-07). The hashes are in
`../Page-Git-Production-Builder/PROVENANCE.json`. Founder 2026-10-06, verbatim:
"because we have a vault for everyting - you were instructed to save in 7.2 with no links - you linked the builder - how is that right".

| File | What |
|---|---|
| `apps/ais-builder/dist` (repo root, built, not committed) | The Production Builder page, served at `/` and `/builder` (One Builder, 2026-10-14) |
| `production-builder/index.html` | Retired 2026-10-14: the old dark page, kept for history and its colour test, no longer served |
| `chat.html` | The chat, served at `/chat.html` |
| `server.js` | Local proxy on `127.0.0.1:3001` (Gemini): serves the Builder page and its API in one process |
| `lane-bridge.js` | `/api/lane` and `/api/lane/status` for the builder |
| `test/lane-bridge.test.js` | Lane bridge tests |
| `setup-service.ps1`, `start-proxy.bat` | Run as the Windows service `GlumiraProxy`, or by hand |

## Run

Node.js 24.14 or newer (`package.json` `engines`; the store uses `node:sqlite`). From this folder:

```powershell
npm ci --omit=dev
npm start
```

Builder: http://127.0.0.1:3001/ . Chat: http://127.0.0.1:3001/chat.html . The Builder page is built once per pull:
`cd appsais-builder; npm ci; npm run build` from the repository root. Without it, `/` shows that command.
Keys come from the one key store (`C:/memory-governance-archive/governance/vault/`), never from this folder.
DeepSeek (free) in the chat uses `OPENROUTER_API_KEY` from that store; `OPENROUTER_DEEPSEEK_MODEL` optionally pins one free `deepseek/...:free` model.

## Service

Run `setup-service.ps1` once from this folder in the main checkout, as administrator (the script asks
for it). It finds its folder from its own location, so the command needs no path:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-service.ps1
```

It points the `GlumiraProxy` service at this folder. When this folder moves, run it again from the new folder. After that the proxy restarts itself when
any of its server files changes (`server.js`, `lane-bridge.js`, `builder-*.js`), for example after a `git pull` on main
(`PROXY_SELF_RELOAD=1`). The pages are read fresh on every request, so a new page build needs no restart.
Logs: `proxy.log` and `proxy.err.log` here, never committed.

## Test

```powershell
npm ci
npm test
```

CI runs the same suite on every pull request (`.github/workflows/gates.yml`, the `gates` job, step
"Builder App suite"), and `npm run test:builder` at the repository root runs it too. The tests read
the repository root from git and the queue path from `Library/OS/REPO-REGISTRY.json`, so they hold no
Vault path.

## Outside targets, copied unchanged

- **Save to diary** in the chat writes `data/raw/<date>-<slug>.md` to the `francoissteyn-2026/Daily-Diary`
  repo through the GitHub API (`DIARY_REPO` in `server.js`).
- Keys: the one key store in `C:/memory-governance-archive`.
