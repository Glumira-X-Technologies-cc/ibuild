# Card 01-23: Structure shows the repo being worked in

Assigned to: Qwen

## The card, verbatim from the build list

Production Builder Conscience: the Structure tab shows the nine law levels for whichever repo is being worked in (founder 2026-10-05: "it is not only 7.2 - it is the repo we are working in - it is called structure"), so an agent reads it instead of re-reading the repo.

## What to build

- Structure tab (`page/src/screens/Structure.tsx`): add a repo picker. It lists the repos the server knows (read them from the server's existing estate data, see `server/builder-scan.js` and `page/src/screens/Estate.tsx`).
- Server: a read-only route that returns the folder tree of the picked repo, levels 1 to 5 deep (Vault, Row, Book, Page, files), from git at origin/main, not the working copy. Reuse the git-object reading in `server/builder-scan.js`.
- Show the levels as a collapsible tree. The selected repo is remembered per browser.
- Tests for the new route beside the existing server tests.

## Done means

Server tests pass, page type-check and build pass, and the tab shows a different tree when a different repo is picked.

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
