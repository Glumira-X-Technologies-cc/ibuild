# Handover for SuperGrok: GluMira Production Builder (PB) UI
13 Oct 2026, 14:56 (Windhoek, UTC+2). Repo: Glumira-X-Technologies-cc/Glumira-7.2, app at `apps/ais-builder`.

Superseded 2026-10-15: the founder ruled http://127.0.0.1:3001/ is the only Builder. Do not start a server on 3007.

## 1. Founder ruling
"Keep my header and the changes I gave on a screenshot. Keep the AI Studio design and add functions, don't change my design. Fix the broken functionality that was found. I want my design."

- Target design: `/home/box/shared/founder-design.png` (sha256 5f6549d0…9934). This is his AI Studio screenshot.
- Header notes: `/home/box/shared/pb-header-notes.png`.
- The screenshot shows **layout only**. Do not add or change its sample clinical text.

What the screenshot shows:
- **Header:** shield and "Glumira Production Builder", "Last scanned", Reset, debug/edit/reload icons, theme toggle, version badge.
- **Nav:** IDEAS / DAILY / BUILD / VAN CLIEF / TOOLS, with Start server and the clock at the right.
- **Three columns:** Founder Capture + Take it further + Saved ideas | Build brief | Chat with model picker.

## 2. The only design changes allowed (header only)
1. His IOB shield top left. For now that is the gold Streamline `shield` Icon; his real artwork goes in later. Not the red desktop icon `public/header-logo.png`.
2. Remove the "Reset 350px" button and the "v1.0.ai" version badge.
3. Swap "Last scanned" and the date/time.
4. Start server at the far right, with no port number in any label or tooltip.
5. Smaller nav dropdown arrows.
6. One gold: #C9A24B.
7. Name: "Glumira Production Builder".

8. (Founder request, function) Founder Capture and Chat boxes the same size and both resizable; neither moves.
9. (Founder request, function) Add Grok to the chat search dock beside Claude and Gemini, reading `XAI_API_KEY` and `GROK_MODEL` from the environment only; internet search goes through Grok. No restyling. The key never goes in the repo, docs or logs.

Everything else stays exactly as in founder-design.png. That covers the columns, spacing, tabs, boxes, chat and model picker, and light theme.

## 3. Current state (everything FROZEN by the founder: no pushes, no merges)
- **main:** includes #114 ref-apps, merged as `f79aee2` (as reported; not in the local clones). The local clone's main is at `cfa27b2`.
- **PB branch `agent/ruflo/ais`, head `33f374a`:** PR #117 into main, ON HOLD. Clone at `/tmp/r97`.
  - AI Studio base: #100 `8f9657f` (commits `939bd6f`, `3f3553b`).
- **Sweep `agent/ruflo/ais-sweep`:** `4187e5d` is on GitHub. The local shield fix `23e85e7` is NOT pushed. PR #118, ON HOLD. Clone at `/tmp/sw`, checked out at `d99a394`.
  - The sweep also changed the design: one gold, spacing and tabs, labelled model picker, plain labels, lucide removed. Those parts go against the ruling.
- **Header work so far:** in #115 (`bcc3882` header, `61d69d9` arrows (#112), `05fd8fc` name/gold, `35c979c` Start server, `86aba49`/`bcc3882` added the red logo).
- **Bundles in `/home/box/shared` (sha256):**
  - `b2-ais-sweep3.bundle` (up to `23e85e7`): d74849660091d9c8f3e88ae1f1368609c0d64c0447341d0b3b116d73f7076046
  - `et-ais-final.bundle`: 3c9513ab2ca53a92c5f3b85d8fe70ef7b7b3f496bc95809af99782b06857e820
  - `et-ais115.bundle`: d8c135a84314e0402c11e21deeb2da5f7820402fe3a55140c328960154661f22
  - `b2-ais-jobguard3.bundle`: ba5fff148600bc74951d58427be0d421890aaeabc316b7918454d9981e97d155
  - `ais-base.bundle`: aa7d5fdd0be8de294721eaa944224264db0b436009e7f659e553b3a8e04b2d54
- **Screenshots of the current build:** `/home/box/shared/shots-now/33f374a/`.

## 4. Broken functions to fix (line numbers at `23e85e7` unless noted)
1. **Null crashes:**
   - IdeasWork: fixed by `370742c` and `0242611` (in `33f374a`).
   - Resources: fixed by `561c663`, `9f6ab40`, `17cc428`.
   - PromptKit: fixed by `4a30f6c` and `011447b` (#111).
   - Modules: fixed by `78e8387` and `29313d7`.
   - Conscience: fixed by `c3cf5cf`, `c7af69b`, and sweep `d3d0ba1` (App.tsx and screens/Conscience.tsx).
2. **"[object Object]" option buttons:** fixed in sweep `39c728f`, at `screens/PromptKit.tsx:11-13` plus App.tsx. Structure was fixed earlier by `359fcca`.
3. (Removed: no light-theme gold change; the only gold is #C9A24B.)
4. **Mixed date formats:**
   - en-GB at `App.tsx:84`, `App.tsx:111`, `App.tsx:174`, `screens/Resources.tsx:13`, `screens/Conscience.tsx:20`, `screens/Today.tsx:61`, `screens/PromptKit.tsx:104`.
   - The browser's own locale at `App.tsx:90` and `App.tsx:511` (`toLocaleTimeString([])`).
   - en-CA (YYYY-MM-DD) at `screens/Today.tsx:23` and `screens/Diary.tsx:8,9,17,47`.
   - Founder ruling: every displayed date is ddmmyy, as before. Internal en-CA day keys can stay.
5. **Leaked "Fixes:" notes line:** NOT found by grep in `apps/ais-builder` at `33f374a` or `23e85e7`. Check it on screen before treating it as a bug.
6. **Founder Capture prefill:** none now. `App.tsx:56` is `useState('')` and the placeholder at `App.tsx:719` is "Write your idea."
   - The AI Studio base `8f9657f` had a clinical placeholder (App.tsx:816, :938), removed by `480846a`.
   - When you restore the design, do NOT bring that text back.
7. **Red desktop logo still in the header** in `33f374a`/`4187e5d`: `brand.ts:8`, `App.tsx:7`, `App.tsx:550`. Fixed by `23e85e7`.

8. **Clipping:** Founder Capture box cuts off its text (item 8 in section 2 should fix it), and the Q3 answer placeholder is truncated.
10. **Model ids shown on screen:** lane names from the server show model ids, for example "Gemini account (gemini-2.5-flash)", in Resources and the Ideas lane panel. Strip the ids from the display only.
9. Stella's full bug log: `/home/box/shared/stella-verdicts.md`.

## Branch base
Build on PB head `33f374a` (`agent/ruflo/ais`). Do NOT build on `agent/ruflo/ais-sweep` (`4187e5d`, restyled). Never fetch-merge the bundle's branch: that brings the restyle back. From `b2-ais-sweep3.bundle`, cherry-pick only these, in this order, onto `33f374a` (Stella confirmed they apply cleanly):
1. `39c728f`: fixes the "[object Object]" option buttons.
2. `d3d0ba1`: stops Findings and Scan crashing on empty entries.
3. `23e85e7`: the shield fix. If it doesn't apply, redo the 2-line `App.tsx` change by hand.

## 5. Hard rules
- The only Builder is http://127.0.0.1:3001/ (founder 2026-10-15). Do not start a second server on 3007.
- No clinical text changes. No secrets in repos. No DuckDuckGo.
- Archive, never delete.
- Nothing under `C:\Users\franc`. Worktrees go in `D:\wt\<short>`.
- Use merge, not rebase, on reviewed heads.
- `agent/*` branches only. Charlie merges. Francois approves every push. Never push to main.

## 6. Roles
- **Ruflo:** orchestrator and the founder's channel. New work comes only from Francois through Ruflo.
- **Charlie:** merges.
- **Stella:** tests on http://127.0.0.1:3001/.
- **Engineering Team:** diff review and bundles.
- **Builder 1:** pushes from the ASUS laptop.
- **Builder 2:** screens.

## 7. Next step
1. Make exactly the changes in section 2, plus the function fixes in section 4. Nothing else. No new workstream.
2. Leave all other layout, spacing, colours and boxes as in founder-design.png. That means not taking the sweep's design commits (`6760163`, `0b3f717`, `27864ba`, `b47725b`, `2f6dd0a`, `02e68ff`).
3. Stella checks the result on http://127.0.0.1:3001/ against founder-design.png and pb-header-notes.png, in dark and light.
4. Francois OKs it. Then Builder 1 pushes and Charlie merges.
