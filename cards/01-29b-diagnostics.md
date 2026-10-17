# Card 01-29 slice B: searchable Library and deterministic diagnostics

Assigned to: MiniMax

## The card, verbatim from the build list (this slice)

Complete the founder-approved Production Builder in its filed GluMira 7.2 home: ... searchable Library, operational views and deterministic diagnostics ...

## What to build

- Library screen (`page/src/screens/Library.tsx`): one search box that filters by title and text, with matches highlighted. Search runs on data the server already returns; add a server search route only if the list is too large to filter in the page.
- Diagnostics: the existing Debug output (server route `/api/builder/debug` in `server/builder-data-api.js`) returns the same findings in the same order for the same repo state. No timestamps or random ids inside the findings list; put the scan time in one separate field.
- Tests: two debug calls on the same state return identical findings; search finds a known item and hides the rest.

## Done means

Server tests pass including the new ones, page type-check and build pass.

## Repo and files

Public repo: https://github.com/Glumira-X-Technologies-cc/ibuild (main). Work only inside `production-builder/`.
- `production-builder/server/` is the Node server (Express, port 3001, binds to 127.0.0.1). Tests: `cd production-builder/server && npm ci && npm test`.
- `production-builder/page/` is the React page (Vite, TypeScript, Tailwind). Checks: `cd production-builder/page && npm ci && npx tsc --noEmit && npx vite build`.

## Design rules (founder, binding)

- Desktop only. No phone or narrow-width work.
- Every blue comes from navy #102347, lifted with bone #F7F6F1. Never black, grey or outside blues.
- Gold buttons use only the lower band of the gradient (about #E9CB40 to #D7B838). Only Send is gold; other buttons stay navy.
- Bold only for headings. No bold in body text.
- No notes or explanations written on the UI. Plain short labels.
- Delete in the Builder hides with Undo; it never erases.
- GluMira users are insulin dependent. Never write "people with diabetes".

## Hard rules

- Nothing gets deleted from the repo in this round. Add or change files only.
- No API keys, tokens or personal data in any file.
- Do not invent product facts. If something is unclear, write the question in your PR.

## Hand back

Open a pull request to `main` of the ibuild repo from a branch named `agent/<your-name>/<card>`. If you cannot open a PR, reply with a unified diff. In the PR: what changed, how you tested it, and the test and build output. Claude checks it with another model and ports it into the private Glumira-7.2 repo.
