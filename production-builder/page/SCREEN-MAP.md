# SCREEN-MAP: AI Studio Builder screens -> Production Builder routes

Server: the Production Builder `server.js` in
`Vaults/5-Production-Builder/Rows/5.13-Production-Builder/Books/Book-Production-Builder/Page-Prog-Production-Builder/`,
on http://127.0.0.1:3001, the one process that also serves this page (`dist/`). Builder routes are under
`/api/builder` unless marked "outside".
Frontend calls go through `src/api.ts` (`builder()` for /api/builder, `call()` for outside routes). API base:
`VITE_API_BASE` (build time), else same origin. Vite dev (5173, editing only) proxies to `BUILDER_URL` (default
http://127.0.0.1:3001).

| Screen | File | Owner | Routes |
|---|---|---|---|
| Today | src/screens/Today.tsx | Executor (base lane) | GET /bootstrap (roadmap.cards, roadmap.counts, roadmap.warnings, roadmap.phases, repo), GET /reminders, GET /state (requests, jobs), POST /events (reminder.ack) |
| Diary | src/screens/Diary.tsx | Executor (base lane) | GET /state (diary = event log by day, notes), POST /events (note.create), outside POST /api/diary/save-chat (GitHub write; needs key; button asks first) |
| Build list | src/screens/BuildList.tsx | Builder 1 | GET /bootstrap (roadmap.phases, roadmap.cards, roadmap.counts, roadmap.warnings) |
| Library | src/screens/Library.tsx | Builder 1 | GET /bootstrap (foyer, os.documents, os.readPaths, law), GET /ideas/ref?path= |
| Prompt kit | src/screens/PromptKit.tsx | Builder 1 | POST /ideas/step, POST /ideas/prompt (409 ROUTING_MAP_STALE), GET /ideas/toolkit, GET /ideas/ref, GET /ideas/web/:sha, POST /compile |
| Conscience | src/screens/Conscience.tsx | Builder 1 | GET /state (requests = compiled prompt log), GET /debug, GET /export, POST /events |
| Structure | src/screens/Structure.tsx | Builder 2 | GET /bootstrap (law, foyer.rules, foyer.routes, os.jev, os.routingRevision) |
| Estate | src/screens/Estate.tsx | Builder 2 | GET /bootstrap (estate, os.registry) |
| Modules | src/screens/Modules.tsx | Builder 2 | GET /ideas/toolkit, GET /bootstrap (profiles.agents, profiles.councils) |
| Resources | src/screens/Resources.tsx | Builder 2 | GET /providers(?probe=1), GET /providers/:id/models, GET /jobs, GET /jobs/targets, outside GET /api/lane/status, GET /health, GET /v1/models |

## Header controls (base lane)

| Control | Routes | Behaviour |
|---|---|---|
| Scan now | GET /debug (scannedAt, findings); fallback GET /bootstrap | Updates "Last scanned", the one timestamp in the header; time kept in localStorage `ais.lastScan` |
| Report a bug | POST /events {type:"debug.create", requestId, payload} | Saved in the Builder store (state.debugReports); offers a prefilled GitHub issue link, sends nothing |
| Builder status pill | outside GET /health, polled every 15 s | "Builder running" or "Builder offline". Not a button: a browser cannot start a process. Offline shows the start command `Start-Service GlumiraProxy` (click copies it) |

Not yet wired by any lane: POST /chat, /attachments, /jobs POST + /jobs/:id/cancel, /v1/chat/completions, /api/lane (the Chat dock and Ideas column still use the AI Studio demo behaviour).

## Fixed 2026-10-14
GET /api/builder/debug returned 500 BUILDER_INTERNAL_ERROR: `debugFindings` read `context.os.jev.unresolved`, which
bootstrap does not return. It now reads it as an empty list when absent (from PR 123), with a test in
`test/builder-data-api.test.js`.
