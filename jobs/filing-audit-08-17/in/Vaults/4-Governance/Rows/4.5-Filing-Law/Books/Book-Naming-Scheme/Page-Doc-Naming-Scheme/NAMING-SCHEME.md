# Naming scheme: five folder levels, a code per Vault, no edition in a path

edition : Original
status : Mid Flight
date : 2026-10-14

This Page records the naming scheme the founder approved on 2026-10-14. It amends how the filing law of `Page-Doc-Filing-Law/GLUMIRA-FILING-LAW.md` is written on disk. It changes no rule of that law: one home, pointers not copies, never paraphrase, no Vault inside a Vault, one queue, and every missing layer marked, all stand. It changes only the folder depth, the names and the codes.

Nothing has moved. The move is ROADMAP card 08-17 in Row 5.14, and it runs under the move contract of the Six Libraries plan (`Row 5.14, Book-Six-Libraries`): tools first, then the check, then the files.

## Founder words, verbatim

- 2026-10-13: "Please see if we must reduce out filing to 5 and comment"
- 2026-10-14: "Library > Vault > Row > Book > Page."
- 2026-10-14: "we have 8 libraries now"
- 2026-10-14: "I was thinking of alpha numeric per vault"
- 2026-10-14: "please give you input the yellow is the file name?"
- 2026-10-14: "P1-E1-7.1 - this is the source document page / Still too long / Can we remove Library/"
- 2026-10-14: "Approved" (to the three cuts in section 2 below)
- 2026-10-14: "show sample", then "go"

## 1. What was measured before the ruling

At `bfacce6` the repo had 432 tracked files: 314 at folder depth 8, 72 at depth 9, the longest path 165 characters. Of the eight named levels, two were never folders: the Estate is the repository, and the Cabinet is one file at the end of a Row. The Foyer is one file at the root. So the structure on disk was already five folder levels, and the depth came from names that repeated the subject at every level and from the container folders `Rows/` and `Books/`.

## 2. The scheme

Five folder levels. Two files that are not levels.

| Level | On disk | Rule |
|---|---|---|
| Library | a folder at the repo root | The repo root is the Estate. There is no `Library/` container. |
| Vault | `<XX>-<Name>` | XX is the Vault's two-letter code (section 3). |
| Row | `<XX><n>-<Name>` | The Row number follows the Vault code with no separator. |
| Cabinet | `<XX><n>-CABINET.md` at the end of the Row | A file, not a level. The summary and index of the Row. |
| Book | `<Topic>` | The topic once. It never repeats the Row name. |
| Page | `S`, `R`, `D`, `PR`, `G` | A folder per layer (section 4). |
| File | `<topic>.<ext>` | No code, no edition, no Row name. The code is in the stamp line inside the file. |

The Foyer stays one file, `Foyer/FOYER.json`, generated from `Library/OS/JEV-MAP.json`. It is never filed under a subject.

The three cuts the founder approved, verbatim from the sparring reply of 2026-10-14:

- "Drop `Library/`. The repo root is the Estate, so each Library sits at the root."
- "Drop the code prefix from the file name. The path already says where the file lives, and git never loses a file. The code goes in the stamp line inside the file, not in its name."
- "Source is a Page layer, not an edition. Your P1-E1-7.1 becomes layer `S`. The file keeps its 7.1 name as it was in 7.1; the origin goes in the stamp. No edition number in any path."

## 3. Vault codes

Two letters, unique across the Estate, never reused. A letter code cannot be read as an edition, which a Row number could (ERRATA `E-20261011-row-number-read-as-edition`). The Vault keeps its JEV number; the code is the prefix people and file names use.

- AL: Alarms and Alerts (Vault 14)
- AR: Archive (Vault 3)
- AS: Account and Subscription (Vault 19)
- CC: Clinic and Care Team (Vault 20)
- DH: Dashboard and Home (Vault 10)
- EH: Emergency and Hypo Safety (Vault 15)
- EN: Engines (Vault 7)
- GC: Glucose and CGM (Vault 11)
- GO: Governance (Vault 4)
- GR: Gamification and Rewards (Vault 22)
- IL: Insulin Lock (Vault 6)
- IR: Insulin Academic Reference (Vault 21)
- LE: Learning and Education (Vault 17)
- MA: Mira Assistant (Vault 18)
- MC: Meals and Cookbook (Vault 12)
- ME: Memory (Vault 2)
- MO: Modules (Vault 9)
- PB: Production Builder (Vault 5)
- PD: Pumps and Device Integration (Vault 13)
- RL: Reports and Logs (Vault 16)
- UD: User Data Info (Vault 8)

Vault 1 is retired by the Six Libraries plan and gets no code. A new Vault gets its code in the same JEV change that creates it.

The Engine Rows line up with the engine documents of Row 5.14, Book-Document-Set: EN1 IOB Hunter (E01), EN2 What-If (E02), EN3 Food to Curve (E03), EN4 6 Hour Prediction (E04), EN5 Basal Rate Score (E05).

## 4. Page layers

| Layer | Folder | Holds |
|---|---|---|
| Source | `S` | The file as it was in the repository it came from, byte for byte, under its own name. Its origin (repository, path, commit, blob) is in `G/PROVENANCE.json`, never in the file name. |
| Research | `R` | The published sources a document rests on, one file per source, with the citation in the stamp. |
| Documents | `D` | The documents of the Book. The sparred winner is the Original; the rounds stay in the sorting station and `G` points at them. |
| Programming | `PR` | The programs and their tests. |
| Git | `G` | `PROVENANCE.json`: every file of the Book with its origin, and the station commit of every sparred document. |

A layer with no file is marked MISSING in the Cabinet. A Row with no Book is `[OPEN] NO BOOK - unaccounted for`. Doc, Prog and Git of the law map to D, PR and G.

## 5. The stamp

Every authored file carries the stamp under its title. The code lives here and nowhere in the path.

```
code    : EN1 / PK-Model / D
edition : Original
status  : DONE
date    : 2026-10-14
source  : S/insulin-profiles.ts
research: R/heise-2012-degludec.md
```

A byte copy carries no stamp inside it (named exception X-003); its stamp is the three keys of its Book's `G/PROVENANCE.json`.

## 6. Sample, Row EN1

```
Foyer/FOYER.json
OS/
Glumira/
  EN-Engines/
    EN1-IOB-Hunter/
      EN1-CABINET.md
      PK-Model/
        S/   iob-engine.ts
             insulin-profiles.ts
        R/   plank-2005-detemir.md
             heise-2012-degludec.md
        D/   tresiba-depot.md
             levemir-s-curve.md
             iob-baseline-residual.md
        PR/  iob-engine.ts
             iob-engine.test.ts
        G/   PROVENANCE.json
      Stacking/
        S/ R/ D/ PR/ G/
    EN2-What-If/
    EN3-Food-To-Curve/
    EN4-6-Hour-Prediction/
    EN5-Basal-Rate-Score/
```

Longest path in the sample: `Glumira/EN-Engines/EN1-IOB-Hunter/PK-Model/D/iob-baseline-residual.md`, 68 characters, against 165 at `bfacce6`.

## 7. What this amends in the Six Libraries plan

The plan of 2026-10-11 puts the six Libraries under `Library/`. The founder's ruling of 2026-10-14 removes that container: the Libraries sit at the repo root. `Library/OS/` therefore becomes `OS/`, and every tool that names `Library/OS` learns the new path before the move, under the plan's own constraint C4. The plan's other steps, numbers and constraints stand.

## Open

- [OPEN] The founder said "we have 8 libraries now". The approved plan names six (OS, Memory, Governance, Archive, Production Builder, Glumira) and says a seventh needs his word. The two new Libraries are not named yet. They enter the JEV `libraries` block in the same change as this scheme, on his word.
- [OPEN] The path-length gate is a ratchet at 165. After the move it is lowered to the longest path the scheme produces.
- [OPEN] Page-Prog of this Book is MISSING: the gate that checks a path against this scheme lands with card 08-17, in `CHECK.mjs`, with its ERRATA row and test.
