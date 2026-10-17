# STOP: close

Library/OS/STOP.md. Step 11 of the boot order, `PROTOCOL.md` Article 1.

Close means the work is saved where the next session will find it, and the check is no weaker than it was. `CLOSE.mjs` is the close doctor: `npm run os:close` prints one PASS or FAIL line per gate (tree-clean, pushed, os-check, handover). Print SESSION CLOSED only after it prints "RESULT PASS". The OS updates itself only through the close doctor (Article 3.5).

## The close, in order

1. Run `npm run os:check`. Every FAIL is fixed.

2. A mistake found this session becomes a check in the same PR (Article 5.3). Add a row to `ERRATA.json` only together with the gate it names (a gate in `CHECK.mjs`) and the test it names (a `test("...")` in `CHECK.test.mjs`). The `errata` gate fails a row whose gate or test does not exist. A new mistake bumps the `revision` line of `PROTOCOL.md` (Article 6.2) and adds one row (Article 6.3).

3. If a Vault or Row changed, change its record in `JEV-MAP.json` and run `node Library/OS/CHECK.mjs --regen`. It recomputes the JEV revision and regenerates `Foyer/FOYER.json` with the same revision, in the same commit (Article 3.4).

4. If a Cabinet, Book or Page changed, work bottom-up. Pages first, each with its three-line stamp. Then `node Library/OS/CHECK.mjs --blobs <dir>` prints the git blob of every file under `<dir>`: put those blobs in the Foyer (Doc Pages) and in each `PROVENANCE.json`. Then the Cabinet file, then the Foyer summary: `foyer-valid` fails if the summary is not word for word what the Cabinet file derives. The Foyer `version` is frozen and is never raised (ERRATA row `E-20261011-edition-is-a-word`; `edition-stamp` fails a raised counter). A Page added or edited carries the Protocol's edition line; a past edition line stays only on a Page unchanged since the edition change (Article 6.5).

5. When a copy becomes worthless, ask the founder once, at the end, in one blue block (AskUserQuestion) with Archive or Delete for each item. Founder, verbatim: "the old copies are fucking worthless - why would i carry them into an archive of the thing i am trying to save / In such occasions give me aq blue bliock with arichive or delete". It is never assumed.

6. Write the handover, the receipt of Article 2.9. One new file in `Vaults/4-Governance/Rows/4.7-Handover/Books/Book-Handover/Page-Doc-Handover`, named `<UTC date>T<HHMM>Z-<slug>.md`, with the stamp and an "## Outstanding" section: what is still open, each with its fix, or the word none. Then run `node Library/OS/CLOSE.mjs --pin-handover`, which rewrites that Book's `PROVENANCE.json`. Commit both.

7. Stage by explicit path. Commit on `agent/<name>/<slug>`. A 7.2 commit carries no credit line. Push, open the PR, wait for the `gates` check, then merge with `gh pr merge --merge`. Never squash: each `PROVENANCE.json` pins the commit the files were filed on, and that commit must stay in history.

8. A worker outside the builder verifies the change and the verifier is never the builder. The outside verifier is Gemini through the local proxy.

9. Run `npm run os:close`. Exit 0 means the tree is clean, the work is pushed, the OS check passes and today's handover exists and is pinned. Then print SESSION CLOSED.

## Open

- An Outstanding item is free text in a handover, and Article 2.8 says to file only in the Builder. The Builder (the ROADMAP) is a byte copy, so a card needs an edit and a new pin. Founder to decide.
