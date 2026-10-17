# Job filing-audit-08-17

You are the builder. Everything under `in/` is read-only. Write only under `out/`. Never edit `in/`, never touch main, never merge.

## Founder words, verbatim
- "i first want to get the structure right - please check the updated van clief structure"
- "create a plan deepseek will build"
- "docs/04_Brand / all these old numbering must be removed and renamed undwer new filing rules"
- "move design to its own library"

## Read first, in this order
1. `in/Vaults/4-Governance/Rows/4.5-Filing-Law/Books/Book-Naming-Scheme/Page-Doc-Naming-Scheme/NAMING-SCHEME.md` (the current scheme: five folder levels, two-letter Vault codes, layers S R D PR G, no edition or version number in any name)
2. `in/Vaults/5-Production-Builder/Rows/5.14-Build-Plan/Books/Book-Six-Libraries/Page-Doc-Six-Libraries/SIX-LIBRARIES-PLAN.md` (move contract, steps, proofs a to g; its `Library/` container is removed by the scheme)
3. `in/Vaults/4-Governance/Rows/4.5-Filing-Law/Books/Book-Filing-Law/Page-Doc-Filing-Law/GLUMIRA-FILING-LAW.md`
4. `in/Library/OS/JEV-MAP.json`, `in/Foyer-extract.json`, `in/tracked-paths.txt`, `in/ROADMAP-phase8-extract.md`
5. `in/docs/04_Brand/*` (the old-numbered folder to rename)

## Libraries
OS, Memory, Governance, Archive, Production Builder, Glumira, Design (ruled by the founder). One more slot is OPEN: do not invent its name.

## Produce, in `out/`
1. `FILING-AUDIT.md`: one table over every path in `in/tracked-paths.txt`: current home, target Library, Vault, Row by the JEV map, verdict KEEP, MOVE or UNPLACED, and the rule that decides it. Counts must equal the number of lines in `tracked-paths.txt`. A path with no record in the JEV map is UNPLACED with a reason. Nothing is guessed.
2. `RENAME-MAP.json`: `[{ "from": "<old path>", "to": "<new path>" }]` for every MOVE, named by the scheme. Design takes the Design System Row and the `docs/04_Brand` colour files. `docs/04_Brand` loses its number and the `_v1.0` suffixes.
3. `BUILD-LIST-CHECK.md`: whether Phase 8 of the ROADMAP extract (5 of 17 ticked) is still correct, and which card paths still say `Library/` and need rewording under the scheme.
4. `OLD-NUMBERING.md`: every other path with `NN_` numbering, `_vN.N` suffixes or `<Vault>.<Row>-` prefixes.

## Rules
- Never paraphrase the founder's words; quote them.
- Archive, never delete. Insulin-Lock paths (`src/insulin/**`, `src/iob-hunter/**`) are never touched.
- A new Vault or Library needs the founder's word. If something does not fit, say so in the report.
- No API: this job is run by pasting `JOB.md` and the `in/` files into the free DeepSeek chat, or by a browser driver. Return files exactly as named above.

## Done when
Every count in `FILING-AUDIT.md` matches `tracked-paths.txt`, `RENAME-MAP.json` is valid JSON, and no new name carries a number prefix or a version. Claude then runs the naming gate, checks and commits in the private repo. The builder never grades its own work.
