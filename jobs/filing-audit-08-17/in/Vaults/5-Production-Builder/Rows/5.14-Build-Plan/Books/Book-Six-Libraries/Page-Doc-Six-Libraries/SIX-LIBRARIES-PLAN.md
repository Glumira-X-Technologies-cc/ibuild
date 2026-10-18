# Spar: the Estate as six Libraries

edition : Original
status : DONE
date : 2026-10-11

This plan answers the founder's ruling of 2026-10-10. It covers questions 1 to 7, with a recommendation for each. The steps are ordered so that the machine check passes after every one. No step makes the check look at fewer files. The tools that read these folders keep working: the Builder app, the verifier proxy, the Vault 5 programs and the /start boot in the other repo.

Every repo fact below was read or run in a session. Glumira-7.2 `origin/main` is `d3099dd`. The JEV revision there is `baa516f4d45cb874`, with 22 Vaults and 99 records, the same as at `1da4787`, where `node Library/OS/CHECK.mjs` gave 9 of 9 PASS with 159 stamped Pages and 139 byte copies. The other repo is memory-governance-archive at `3e1c8789f`. Line numbers refer to those commits.

---

## The answer in one read

1. **The proposal is sound, with four conditions.**
   - There is one JEV map and one Foyer for the whole Estate.
   - All six Libraries sit under the existing `Library/` folder, so `Library/OS/` does not move.
   - Vault numbers stay unique across the Estate and are never reused.
   - Every tool that reads a path learns the new layout before anything moves. That covers the check, the Builder app, the Vault 5 programs and the /start boot.
2. **One Foyer for the Estate.** `Foyer/FOYER.json` stays where it is, generated from `Library/OS/JEV-MAP.json`. The JEV map gains a `libraries` block, and each Vault names its Library. A route reads Library > Vault > Row.
3. **Insulin-Lock goes to Library Glumira** as Vault 6. Its number, its route and X-001 stay the same.
4. **Vault 1 is retired** and its number is never reused. Vaults 2, 3, 4 and 5 each become the single Vault of their own Library. Vaults 6 to 22 go to Library Glumira. Every surviving number stays the same.
5. **Tools first, then the check, then the moves.** That is 14 small steps (0 to 13), each a PR that leaves 9 of 9 PASS. Each move proves seven things by command:
   - the check passes;
   - the same coverage counts as before;
   - no live file or open card still names the old path;
   - the Builder's tests pass;
   - the Builder still sees every Page;
   - /start still finds the queue and the handover;
   - the Vault 5 programs give the same output.
6. **Rename Vault 5 to "Production Builder".** Rename Row 5.13's subject to "Builder App", so no name sits on two levels. Rename the package to `glumira`. Remove "7.2" from every name and title people read. The edition stamp becomes the word `Original` (question 6b). Five questions stay open, each with a recommendation.
7. **One question before anything else (step 0):** may the edition stamp become `Original` and the Foyer counter stop? This is a Protocol amendment, so it needs his word.
8. **Smallest safe first step.** File his words in the Foyer and put the steps on the Builder as cards. No code changes and nothing moves.

---

## Assumptions

- The six Libraries are OS, Memory, Governance, Archive, Production Builder and Glumira. Their folders are `Library/OS`, `Library/Memory`, `Library/Governance`, `Library/Archive`, `Library/Production-Builder` and `Library/Glumira`.
- "OS Cannot have a vault" means no Vault anywhere is the OS, the pointer Vault 1 included.
- His message gives the permission Article 4.2 requires for these six Libraries only. A seventh Library needs a new permission.
- "Do not add any version numbers in the 7.2 documents" covers every line a document carries, the stamp line included. It forbids adding numbers. It does not order a rewrite of documents already filed.
- The product Vaults 7 to 22 keep their names. This change is structure only.
- Product source code, when it arrives, stays at the repo root next to `index.html` and `vercel.json`. Library Glumira holds the product's documents and points at the code.

---

## The hard constraints that shape the plan

| # | Constraint | Where it is written | What it forces |
|---|---|---|---|
| C1 | One routing authority | Article 3.3, gate `single-routing-source` | One JEV map. The Foyer is generated from it. No third table. |
| C2 | Never proceed past a failed check | Article 4.6, `CHECK.mjs` exit 1 | Every step leaves all 9 gates at PASS, including every new rule run on the data of that same step. |
| C3 | A PASS must mean something | Article 2.7 "Account for everything" | No gate may pass by checking fewer files. Counts are compared before and after each step. |
| C4 | A green check is not a working Estate | Question 1 below | The check does not run the Builder's tests, the Vault 5 programs or the other repo. Each move runs those too, by command. |
| C5 | The Protocol changes only through the close doctor | Articles 6.1 to 6.4, gate `errata` | Each text change bumps the revision and adds one ERRATA row, with a real gate and a named test. |
| C6 | No Vault inside a Vault, no new Vault unasked | Articles 4.1 and 4.2 | Exactly six Libraries. No Row is promoted to a Vault. |
| C7 | Pointers only. Never copy, never paraphrase. One name, one item. | Articles 2.6 and 4.4, the filing law | Byte copies keep their bytes. Founder text is quoted. A program quotes law text from its source at run time and never holds its own copy. |
| C8 | Archive, never delete. Generated output is recreated. | Filing law items 6 and 7 | `POINTER.md` and the old Article 6.5 go to the Archive. Program outputs are rebuilt by their program. |
| C9 | One queue, the Builder | Article 3.2, gate `single-queue`, E-002 | The steps become ROADMAP cards. No second checklist. |
| C10 | No version in names, and no version numbers added to documents | Gate `edition-stamp` (E-004), the 2026-10-10 ruling | New names and new stamp lines carry no number. |
| C11 | Merge, never squash | STOP step 7 | Each `PROVENANCE.json` and the edition ERRATA row pin a commit that must stay in history. |
| C12 | Read-only Row 5.13 | X-004 | The Builder app changes only in one named upgrade PR that he approves. That PR must cover everything the later steps need. It never runs at the same time as card 01-29. |
| C13 | Founder actions are batched | Founder working style | One UAC, at one step, for the proxy service. |

**The tightest constraints are C2, C3, C4 and C12 together.** `CHECK.mjs` hard-codes today's layout in at least 12 places, and seven of them are scans that read only `Vaults/`. Outside the check, the Builder app, 7 Vault 5 programs, 3 input files, one open ROADMAP card, the proxy service and four /start files in the other repo hard-code paths or law text too. If folders move first, things break while every gate stays green. So every reader learns the new layout before any folder moves. The read-only Builder gets one upgrade PR, so that PR must cover every later need. Each move then proves by command that every reader still works.

---

## Question 1. Is the proposal sound?

### Options scored (3 = best)

| Criterion | A. Keep today's layout (1 Library, 22 Vaults) | B. Six Libraries, one JEV, one Foyer (recommended) | C. Six Libraries, each with its own map and Foyer |
|---|---|---|---|
| Matches the 2026-10-10 ruling | 1 | 3 | 3 |
| One routing authority (C1) | 3 | 3 | 0 (six maps) |
| The OS is never mistaken for data | 2 (a pointer Vault) | 3 | 3 |
| The Builder can be lifted out as a toolbox | 1 | 3 | 3 |
| Size of the change to the check and the tools | 3 | 1 | 0 |
| Fits the filing law as written | 3 | 2 | 2 |
| **Total** | **13** | **15** | **11** |

**Recommendation: B.** C breaks the one-map rule, so it cannot pass. B costs more work than it first seems (see below), but it is the only option that matches his ruling and keeps one map.

### What gets simpler

- The OS stops posing as a Vault. Vault 1 and its special code (`os_pointer`, `POINTER_TEXT`, `VAULT1`) go away.
- The Builder becomes one folder you can lift out. That meets his rule: "if i remove builder from the tree - nothing must break once complete / After a job is finished you take your toolbox and leave".
- Every scan reads one list of Vault roots from the JEV map instead of a fixed `Vaults/`.
- Every outside reader finds its path, and its law text, through the registry, the Protocol and the Foyer instead of a copied string. Today one of those strings is already wrong (see below).
- The Guide's drawing matches the disk. Today it shows `Foyer/` and `Vaults/` inside `Library/`, but on disk both sit at the repo root.

### What breaks if folders move first (each item is fixed in question 5)

**Inside the check (`Library/OS/CHECK.mjs`):**
- **foyer-valid** fails at once. Any file under `Library/` that is not one of the 14 OS files is an error (line 818).
- The Vault path rule `^Vaults/<n>-` (line 760) and the Row depth rule fail for `Library/<X>/Vaults/...`.
- **Silent holes.** These read only `Vaults/`, so moved files stop being checked while the gate still says PASS:
  - the foyer-valid disk scan (line 812) and its Vault-inside-Vault test;
  - `listSpecial`, the symlink and submodule scan (line 304);
  - the edition-stamp PROVENANCE scan (line 1160) and Page stamp scan (line 1169). After the last move these would check 0 of 159 stamped Pages and still pass.
- `isMemoryPath` hard-codes `Vaults/2-Memory/` (line 1085). `single-queue` requires the queue to start with `Vaults/` (line 974).
- `routeSubject` (line 1234) and the `--route` print (line 1346) cannot return a Library. `generateFoyer` (line 883) would write `undefined` for a Library record.
- `--regen` keeps every Cabinet `file`, Book and Page `path` and `summary_source` from the old Foyer. After a move, about 90 Foyer paths would point at nothing.
- Hard-coded paths: `ROW_513` (line 104, X-004), X-005 and X-007 (lines 132 to 134, 145), `HANDOVER_BOOK` in `CLOSE.mjs`, `REPO-REGISTRY.json` `builder` and `source`, START line 40, STOP steps 3 and 6, RULES line 9, README.md line 43, the paths in `CHECK.test.mjs` (including the `./Vaults/1-Operating-System/` form at line 948), and `fixture.mjs` line 50.

**Outside the check, so no gate fails:**
- **The Builder app (Row 5.13).**
  - `builder-context.js` line 59 reads `foyer.routes['GluMira 7.2 Production Builder']` and fails with `FOYER_ROADMAP_ROUTE_INVALID` without it.
  - `builder-context.js` line 10 accepts only ROADMAP version `72-roadmap-1` (line 63 fails with `OS_BUILDER_VERSION_MISMATCH`). So the ROADMAP's "72" cannot be removed without a Builder change.
  - `builder-ideas.js` line 312 lists files with `git ls-tree ... -- Vaults`, and line 131 groups them into Pages only under a root `Vaults/`. After a move the Ideas page loses every moved Page, and the command still exits 0.
  - **It carries its own copy of the law.** `builder-data-api.js` line 7 holds `BOOT_ORDER`, whose third line is "Then follow Foyer → Vault → Row → Cabinet → Book → Page". `builder-ideas.js` line 219 prints it under "Boot order (Article 1)" in every work prompt, and `builder-ideas.test.js` line 117 asserts it. `production-builder/index.html` lines 1043 and 2187 print the chain "Estate → Library → Foyer → Vaults → ...". Once Article 1 changes, every prompt the Builder sends would carry a different "Article 1".
  - It shows the Foyer counter (`'Foyer '+app.boot.foyer.version` in `builder-client.js`).
  - `test/builder-ideas.test.js` lines 32 to 34 hard-code the Vault 5 folder. `npm test` and `gates.yml` never run these tests.
- **The verifier proxy.** The Windows service `GlumiraProxy` has its nssm AppDirectory set to `C:\Glumira-7.2\Vaults\5-GluMira-7.2-Production-Builder\...\Page-Prog-Production-Builder`. After the main checkout pulls the move, that folder has no `server.js`, so the service dies. STOP step 8 names this proxy as the outside verifier. The 5.13 README (line 35) also prints the old path.
- **Vault 5 programs and inputs.**
  - Row 5.14 programs: `cards.mjs`, `docset.mjs`, `docset-check.mjs` and `docset-report.mjs` hold the Vault 5 path as literals.
  - Row 5.16: `toolbox.mjs` holds it in literals (lines 152 to 155, 403 to 415) and as an escaped regex (line 315). It also classifies anything that `startsWith("Vaults/")` as "product Vaults" (line 160), so a moved Memory or Governance Page would be filed in the wrong area with no error.
  - Three input files hold the Vault 5 path as data: `docset-inputs.json`, `spar-inputs.json` and `provenance-inputs.json`.
  - Two generated Doc outputs also carry it: `SLOTS.json` and `FINAL.json` in Book-Document-Set.
- **The queue itself.** Open card 01-29 (ROADMAP line 98) says `WRITE_SCOPE:Vaults/5-GluMira-7.2-Production-Builder/Rows/5.13-Production-Builder`. The Builder compiles WRITE_SCOPE into the agent prompt's "Files you may create or change". After a move, an agent sent on 01-29 would write into a folder that no longer exists.
- **/start in memory-governance-archive.**
  - `governance/agent-os/boot-card.mjs` line 36 hard-codes the handover folder.
  - `governance/tests/gates/os-first-72.test.mjs` line 94 asserts that same folder as a literal, and line 24 binds `HDIR` from it.
  - `governance/agent-os/roadmap-source.mjs` line 16 hard-codes the ROADMAP path.
  - `governance/tools/jev-system/lib/law-source.mjs` line 13 hard-codes the filing law path.
  - The /start skill text says "read the whole Library, every time". After the moves, `Library/` holds 375+ files, not 14.
- **A live bug that proves the point:** `law-source.mjs` already names `GLUMIRA-72-FILING-LAW_v1.0.md`. The file is now `GLUMIRA-FILING-LAW.md`, so that reader is broken today and nothing reported it.

**In the law text:** Article 1 step 10, Article 3.1, Article 7 item 2, and several Guide and START lines would become false (full list in question 5).

### What is lost

- The filing law's literal chain `Estate > Library > Foyer > Vaults` becomes `Estate > Foyer > Library > Vault > Row > Cabinet > Book > Page`, with one Foyer as the Estate's door. This needs his approval. His 2026-09-27 structure block is never edited.
- Short paths. The longest path grows from 177 to 191 characters (see Risks).
- Vault 1 as a safety net. An agent who asks for "Operating System" still gets an answer, from a JEV Library record.
- Row 5.13's read-only status, for one approved upgrade PR.

---

## Question 2. One Foyer or one per Library? How does a subject route?

### Options scored

| Criterion | One Estate Foyer (recommended) | One Foyer per Library, all generated from one JEV |
|---|---|---|
| One routing authority | 3 | 3 |
| Generated files to keep in step | 3 (one) | 1 (five) |
| Change to the check and to the Builder (both read `Foyer/FOYER.json`) | 3 | 0 |
| One key lookup per level | 3 | 2 |
| Literal fit with "Library > Foyer" | 1 | 3 |
| Builder removal | 3 | 3 |
| **Total** | **16** | **12** |

**Recommendation: one Estate Foyer at `Foyer/FOYER.json`, generated from `Library/OS/JEV-MAP.json`.** The JEV map stays in Library OS, so the OS still owns routing.

### The schema, defined once

The Library is stored once, on the Vault. `vault_root` lives on the Library only. `moved` records every path prefix that a step retired.

```json
"libraries": {
  "OS":                 { "name": "OS",                 "path": "Library/OS" },
  "Memory":             { "name": "Memory",             "path": "Library/Memory",             "vault_root": "Vaults" },
  "Governance":         { "name": "Governance",         "path": "Library/Governance",         "vault_root": "Vaults" },
  "Archive":            { "name": "Archive",            "path": "Library/Archive",            "vault_root": "Vaults" },
  "Production-Builder": { "name": "Production Builder", "path": "Library/Production-Builder", "vault_root": "Vaults" },
  "Glumira":            { "name": "Glumira",            "path": "Library/Glumira",            "vault_root": "Vaults" }
},
"vaults": {
  "7": { "name": "Engines", "library": "Glumira", "path": "Vaults/7-Engines" }
},
"records": [
  { "subject": "IOB Hunter", "vault": "7", "row": "7.1", "path": "Vaults/7-Engines/Rows/7.1-IOB-Hunter" },
  { "subject": "Production Builder", "vault": "5" },
  { "subject": "OS", "library": "OS" },
  { "subject": "Operating System", "library": "OS" },
  { "subject": "Glumira", "library": "Glumira" }
],
"moved": [
  { "from": "Vaults/1-Operating-System", "to": "archived to Row 3.1", "step": 5 },
  { "from": "Vaults/2-Memory", "to": "Library/Memory/Vaults/2-Memory", "step": 8 }
]
```

- **`vault_root` life cycle.** Step 5 adds it with the value `Vaults` for the five Libraries that hold Vaults. Each move sets it to `<Library path>/Vaults` for one Library. Step 12 deletes the field. From then on the check derives `<Library path>/Vaults` and fails if the field comes back.
- **`moved` life cycle.** It starts empty at step 2. Each step that retires a path prefix adds one entry and keeps it forever, like an ERRATA row. Old `PROVENANCE.json` `source_path` values stay true, because each one is read together with its pinned `commit`.
- **Vault path rule.** A Vault path is `<its Library's vault root>/<n>-<name>`. A Row path is `<its Vault path>/Rows/<id>-<name>`. Depth counts from the Vault.
- **One helper for every scan.** `inVault(f)` is true when `f` starts with any Library's vault root.

### How a route works

- `--route "IOB Hunter"` prints `ROUTE "IOB Hunter" -> Row 7.1 IOB Hunter (Library Glumira, Vault 7 Engines) at <path>`.
- `--route "Operating System"` prints `-> Library OS at Library/OS (read at boot steps 1 to 7)`.
- **A Library record answers "where does it live". It is never a filing destination.** Nothing is filed into Library OS, because only the 14 `OS_FILES` may sit there. Filing always goes to a Vault and a Row.
- `routes` in the Foyer stays Vault-only, as today. A second generated block, `library_routes`, carries the Library records. Neither block is hand-edited.
- The JEV revision hash includes `libraries` and `moved`.

### One name, one item: the rule the check enforces

The rule is keyed on **records**, never on a Vault's display name. A Vault's display name can lag behind (Vault 5 is still "GluMira 7.2 Production Builder" until step 11). Its route record does not.

1. **One subject, one record.** Across all records, a subject has exactly one record. The code that lets a Vault record and a Row record share a subject (`jevErrors`, lines 864 to 867) is removed. ERRATA row "one name on two levels". Today the only case among the 99 records is "Production Builder", on Vault 5 and on Row 5.13. Row 5.13's subject becomes "Builder App". Its folder `5.13-Production-Builder` keeps its name under X-004. The check does not require a Row folder to spell its subject. Several subjects may route to one destination, as "GluMira 7.2 Production Builder" and "Production Builder" both do to Vault 5 today.
2. **When a Library is answered by its Vault.** A Library holds exactly one Vault, and a Vault-level record whose subject is the Library's name routes to that Vault. Then the Library has no Library record, and that Vault record answers for both. It stays in `routes`, where the Builder reads it.
3. **Otherwise the Library has its own record.** At least one Library record carries the Library's own name. More subjects may point to the same Library.
4. **What this gives today (checked against the 99 records at `d3099dd`):**
   - Memory: record "Memory" -> 2. No Library record.
   - Archive: record "Archive" -> 3. No Library record.
   - Governance: record "Governance" -> 4. No Library record.
   - Production Builder: record "Production Builder" -> 5. It exists today, and after step 2 it is the only record with that subject. No Library record. The Builder keeps reading `routes['Production Builder']`.
   - OS holds no Vault. Library records "OS" and "Operating System". The second one replaces today's record "Operating System" -> 1.
   - Glumira holds 17 Vaults. Library record "Glumira".
5. **What `jevErrors` checks.** It checks items 1 to 3 both ways:
   - a Library answered by a Vault record must not also have a Library record;
   - a Library with no such Vault record must have one.
   - A record targets a Vault, a Row or a Library, never two.
6. **The echo is named, never quiet.** This is **X-008** in `NAMED_EXCEPTIONS`: "A Library that holds exactly one Vault is routed by that Vault's record under the Library's name. Both are one destination."

---

## Question 3. Where does Insulin-Lock go?

| Criterion | Library Glumira (recommended) | Library Governance | Its own Library |
|---|---|---|---|
| Founder rulings | 3 ("both are vaults", and it is "not a Row under Governance") | 1 (back next to Governance, which he separated it from) | 0 (a seventh Library; he named six) |
| Sits with what it guards (`src/insulin/**`, `src/iob-hunter/**`, Engines in Vault 7, Insulin Academic Reference in Vault 21) | 3 | 1 | 2 |
| Survives Builder removal | 3 | 3 | 3 |
| Change to the check | 3 (Vault 6 and X-001 unchanged) | 2 | 0 |
| **Total** | **12** | **7** | **5** |

**Recommendation: Library Glumira, Vault 6, number kept.**

- Governance keeps its pointer `"Insulin Lock": "Vault 6"`. Pointers name Vault numbers, which stay unique across the Estate, so a pointer from another Library still works.
- One line is added to `checkRoutes`: the Insulin-Lock Vault must sit in Library Glumira. The rule that "Insulin Lock" routes to that top-level Vault stays.
- X-001 stays open. The enforcer files live in glumira-7.1. "Launch with everything in 1 repo" points toward moving them in, under the Insulin-Lock exact-PR rules. That is his decision, and this plan does not change it.

---

## Question 4. Where each Vault lands

Numbers are unique across the whole Estate. **No surviving Vault is renumbered.** That keeps every Row id ("Row 5.14", "Row 7.1") valid. It also keeps every ROADMAP card and handover reference, `builder-context.js`'s `rows['5.14']` lookup, and X-001's key on Vault 6.

| Today | Lands in | Number | Disk move | Note |
|---|---|---|---|---|
| Vault 1 Operating System (pointer) | Retired at step 5. The OS is Library OS at `Library/OS/`. | 1 retired, never reused | `POINTER.md` archived to Row 3.1 Superseded | Library record "Operating System" -> Library OS, in the same PR. Vault 1 never needs a Library. |
| Vault 2 Memory | Library Memory | 2 | 28 files, step 8 | Name stays "Memory". |
| Vault 3 Archive | Library Archive | 3 | 3 files, step 9 | |
| Vault 4 Governance | Library Governance | 4 | 48 files plus the step-5 filing-law Page, step 10 | Rows 4.1 to 4.7 unchanged. Row 4.6 "Agent OS" stays (question 6e). |
| Vault 5 GluMira 7.2 Production Builder | Library Production Builder | 5 | 295 files, step 11 | Renamed "Production Builder", folder `5-Production-Builder`, in the same `git mv`. Row 5.13 subject "Builder App". Rows 5.14 to 5.16 unchanged. |
| Vault 6 Insulin-Lock | Library Glumira | 6 | none (pointer Pages only), step 7 | |
| Vaults 7 to 22 (Engines through Gamification and Rewards) | Library Glumira | 7 to 22 | none (records only), step 7 | They hold no files yet, so only JEV records change. |

**Do not promote Rows to Vaults.** Each new Vault needs his permission (Article 4.2), and every Book path would change for no gain.

---

## Question 5. What changes, and in what order

### Where the six Libraries live on disk (options scored)

| Criterion | `Library/<Name>/` (recommended) | `Libraries/<Name>/` | Six root folders `Library-<Name>/` |
|---|---|---|---|
| `Library/OS/` path unchanged (Article 3.1, START, `npm run os:check`, `gates.yml`, the Builder's `OS_PATHS`, /start) | 3 | 0 | 0 |
| Already inside the snapshot fingerprint (it hashes `Library`, `Foyer`, `Vaults`) | 3 | 0 | 0 |
| Already allowed by the Builder's `validSourcePath` (`^(Library\|Foyer\|Vaults)/`) | 3 | 0 | 0 |
| Folder reads as the name | 3 | 3 | 2 |
| **Total** | **12** | **3** | **2** |

### The moved-prefix rule, defined exactly (added in step 2, with an empty list)

It is a foyer-valid rule. Its ERRATA row is "a live file names a moved path".

- **What it reads (live text):**
  - every file in `Library/OS/` **except `JEV-MAP.json`**, which holds the `moved` list itself; its paths are already checked by the Vault path rule;
  - the root `README.md` and the root config files;
  - `.githooks/` and `.github/`;
  - every file in a Prog layer (`Page-Prog-*`). It is not exempted under X-004, so Row 5.13 is covered;
  - **the open cards (`- [ ]` lines) in the queue file** named by `REPO-REGISTRY.json` `builder`. An open card is a live instruction to the next agent. Closed cards (`- [x]`) are records and are not read.
- **Four forms of each prefix count.** For `Vaults/2-Memory`, these are:
  - plain, as written;
  - plain with a leading `./` or `.\`;
  - backslash form, `Vaults\2-Memory` and `Vaults\\2-Memory`;
  - regex-escaped form, `Vaults\/2-Memory`, with any `.` written as `\.`.
- **When a match counts as a hit.** It must stand on its own.
  - Before it: the start of the text, or a character that is not a letter, digit, `_`, `.`, `/`, `\` or `-`. A leading `./` or `.\` is allowed.
  - For the escaped form, a bare `/` before it is allowed (a regex delimiter), but `\/` is not.
  - After it: the end of the text, a path separator, or a character that is not a letter, digit, `_`, `.` or `-`.
  - So `Library/Memory/Vaults/2-Memory/...` and `Library\/Memory\/Vaults\/2-Memory` are **not** hits, and `Vaults/2-Memory-Old` is not a hit. `"Vaults/2-Memory/NOW.md"`, `"./Vaults/2-Memory/"`, `"Vaults\\2-Memory"` and `/Vaults\/2-Memory|x/` **are** hits.
- **A `from` that ends in `/` needs that separator.** Step 12 adds the bare root as `"from": "Vaults/"`. The word "Vaults" in prose is then never a hit, but a path such as `"Vaults/"` or `startsWith("Vaults/")` is.
- **Tests** use a made-up prefix, `Vaults/99-Fixture`, in the fixture's own JEV map. The test file therefore never holds a real moved prefix. The tests cover:
  - every hit form above fails;
  - a new nested path passes, plain and escaped;
  - a longer name passes;
  - the JEV map's own `moved` block passes;
  - an open card that names the prefix fails, and a closed card that names it passes.
- **Proof it works.** A prototype of exactly this rule ran on `origin/main` (`d3099dd`) over 98 live files and the queue's open cards. It returned the hit and non-hit results listed above. It catches `toolbox.mjs` line 315 (escaped) and `CHECK.test.mjs` line 948 (`./` form). It also gives each move its exact rewrite list:

| Prefix | Live files hit at `d3099dd` | Open cards hit | Left for the move step after steps 4 and 6 |
|---|---|---|---|
| `Vaults/1-Operating-System` | 3: `CHECK.mjs`, `CHECK.test.mjs`, `GUIDE.md` | 0 | all 3, in step 5 |
| `Vaults/2-Memory` | 5: `CHECK.mjs`, `CHECK.test.mjs`, `GUIDE.md`, `MEMORY-GUARD.md`, `builder-ideas.test.js` | 0 | 4, in step 8 (`builder-ideas.test.js` drops out at step 4) |
| `Vaults/3-Archive` | 0 | 0 | none, step 9 |
| `Vaults/4-Governance` | 5: `CHECK.test.mjs`, `CLOSE.mjs`, `GUIDE.md`, `RULES.md`, `STOP.md` | 0 | all 5, in step 10 |
| `Vaults/5-GluMira-7.2-Production-Builder` | 15: `CHECK.mjs`, `CHECK.test.mjs`, `REPO-REGISTRY.json`, `START.md`, `fixture.mjs`, `README.md`, `builder-ideas.test.js`, `cards.mjs`, `docset.mjs`, `docset-check.mjs`, `docset-report.mjs`, `toolbox.mjs`, `docset-inputs.json`, `spar-inputs.json`, `provenance-inputs.json` | 1 (card 01-29) | 9 files and card 01-29, in step 11 (the Builder test drops out at step 4; the five programs at step 6) |

**A grep cannot prove behaviour.** `toolbox.mjs` line 160 (`startsWith("Vaults/")`) is not a moved prefix, yet it misfiles moved Pages. That is why step 6 makes the programs path-free, and why every move also runs proof (g) below.

### The move contract: every move step (8 to 11) does all of this in one PR

1. `git mv` the Vault folder under its Library. Bytes do not change, so blobs do not change.
2. Set that Library's `vault_root`, add one `moved` entry and run `--regen`, which rebases every Foyer path and `summary_source`.
3. Rewrite the retired prefix in every live file and open card on that step's list above. The exception is a byte copy of another repo, which keeps its bytes. Re-pin each edited Page in its `PROVENANCE.json`.
4. Re-run every program whose generated Doc output names the prefix, then re-pin the output (filing law item 7: "Change the source file and recreate generated output").
5. Leave **records** untouched: handovers, memory Pages, closed ROADMAP cards, audit and scan outputs (`TOOLBOX.json`, `GAP.md`, `GAP.jsonl`, `BASELINE.md`, `SUMMARY.json`). They describe a past state at a pinned commit.
6. **Add no Page and remove no Page.** New content goes in its own PR.
7. Prove it, in the PR body:
   - (a) `node Library/OS/CHECK.mjs --snapshot HEAD` gives 9 of 9 PASS;
   - (b) the foyer-valid `pages=` and `books=` and the edition-stamp `stamped=` and `copies=` counts **equal** `main`'s;
   - (c) the moved-prefix rule finds 0 hits;
   - (d) the Builder suite is green in CI;
   - (e) in memory-governance-archive, the /start readers run with `--ref <branch>` and resolve the ROADMAP, the newest handover and the filing law, and `node --test governance/tests/gates/os-first-72.test.mjs` passes with the same `--ref`;
   - (f) the Builder's Page-area count (`pageAreas(gitFiles(...))`, exported in step 4) on the branch commit equals the count on `main`;
   - (g) the Vault 5 programs that read the tree (`toolbox.mjs`, `docset-check.mjs`, `catalogue.mjs`) run on `main` and on the branch, with output sent to a temp folder. After the retired prefix is replaced by the new one, the outputs are identical, so every Page still lands in the same area.

**Every non-move PR (steps 1 to 7, 12, 13)** shows the same counts as `main`, plus the Pages it adds and minus the Pages it removes, each listed by path in the PR body. A count that moves without a listed path is a FAIL.

A PR that passes by checking less, or that leaves a tool broken, is a FAIL even when every gate says PASS.

### The freeze rule

- Card 01-29 (the Builder build, WRITE_SCOPE Row 5.13) and step 4 (the Builder upgrade) are never open at the same time. Whichever starts first lands first. The other rebases on it.
- While a move PR is open, no card whose WRITE_SCOPE lies inside that Library is dispatched. The move PR rewrites that WRITE_SCOPE (step 11 rewrites 01-29's).
- One session owns steps 2 to 12 on one branch line. Other filing waits, because the fingerprint changes at every merge.

### Every rule text that changes, and the step that changes it

A text change lands in the same PR as the code that makes it true.

| # | Where | Today | Proposed | Step |
|---|---|---|---|---|
| T1 | PROTOCOL Article 1 step 10 (line 38) and GUIDE reading order (line 125) | "Vault -> Row -> Cabinet -> Book -> Page" | "Library -> Vault -> Row -> Cabinet -> Book -> Page" | 5 |
| T2 | Article 3.3 | "Keep the JEV map as the routing authority. FOYER.json is a generated view, tied to the same revision." | "Keep the JEV map as the one routing authority for the Estate: subject -> Library -> Vault -> Row. FOYER.json is the one Estate Foyer, a generated view tied to the same revision." | 5 |
| T3 | GUIDE "THE JEV CONTEXT MAP" (line 147) | "subject -> Vault -> Row" | "subject -> Library -> Vault -> Row" | 5 |
| T4 | Article 3.4 and STOP step 3 (line 13) | "whenever a Vault or Row changes" / "If a Vault or Row changed" | "whenever a Library, Vault or Row changes" / "If a Library, Vault or Row changed" | 5 |
| T5 | Article 4.1 | "Create a Vault inside a Vault." | "Create a Vault inside a Vault, a Library inside a Library, or a Library inside a Vault." | 5 |
| T6 | Article 4.2 | "Create a new Vault without the founder's explicit permission." | "Create a new Library or a new Vault without the founder's explicit permission. A Vault number is never reused." | 5 |
| T7 | START line 13 (boot step 10) | "Vault, Row, Cabinet, Book, Page" | "Library, Vault, Row, Cabinet, Book, Page" | 5 |
| T8 | START line 19 (snapshot) and line 25 (edition-stamp) | "`Library`, `Foyer` and `Vaults` trees" / "under `Library` or `Vaults`" | unchanged until step 12, then "`Library` and `Foyer` trees" / "under `Library`" | 12 |
| T9 | START line 20 (foyer-valid) | "Vault 1 holds only `POINTER.md`" ... "no file under `Vaults` or `Library` is unaccounted for" | drop the Vault 1 clause and add "no Vault is the OS" at step 5; at step 12, "no file under `Library` is unaccounted for" | 5, 12 |
| T10 | Article 3.1 | "Keep exactly one OS home: Library/OS/. Vault 1 is a pointer." | "Keep exactly one OS home: Library OS, at Library/OS/. The OS is not a Vault and has no Vault anywhere." | 5 |
| T11 | Article 7 item 2 | "Library/OS/ only; Vault 1 is a pointer" | "Library/OS/ only; the OS has no Vault" | 5 |
| T12 | GUIDE "THE OS HOME" | Vault 1 pointer paragraph | one line: "The OS has no Vault. Library OS is read at boot steps 1 to 7 by fixed path." | 5 |
| T13 | GUIDE "THE MEMORY GUARD" and `MEMORY-GUARD.md` | `Vaults/2-Memory/` | `Library/Memory/Vaults/2-Memory/`, both files in the same commit, word for word, or the memory-guard gate fails | 8 |
| T14 | RULES line 9 | `Vaults/4-Governance/Rows/4.6-Agent-OS` | `Library/Governance/Vaults/4-Governance/Rows/4.6-Agent-OS` | 10 |
| T15 | STOP step 6 (line 19) | `Vaults/4-Governance/Rows/4.7-Handover/...` | `Library/Governance/Vaults/4-Governance/Rows/4.7-Handover/...` | 10 |
| T16 | START line 22 (single-queue) and line 40 (reading list) | "filed in Vault 5" / `Vaults/5-GluMira-7.2-Production-Builder/...ROADMAP.md` | "filed in Library Production Builder" / `Library/Production-Builder/Vaults/5-Production-Builder/...ROADMAP.md` | 11 |
| T17 | GUIDE drawing, "HOW IT LOOKS - THE OS LAYER", "THE FULL NESTED PATH" (line 74) | `Library 7.2` tree, Vault 1 pointer, `Vaults/[Vault Name]` | the new drawing below; nested path "Foyer -> Library/[Library Name] -> Vaults/[Vault Name] -> ..." | 12 |
| T18 | Filing law | `GLUMIRA-FILING-LAW.md` is a pinned byte copy | **Do not edit it.** Add a new Page in Book-Filing-Law with his 2026-10-10 words verbatim and the new chain. Change the Foyer `law` string to the new chain. ("never paraprase - write another page") | 5 (Page), 12 (`law`) |
| T19 | Foyer `rules` | `read`, `populate`, `no_nesting`, `new_vault` | add the Library level to each, in the words of T1, T5 and T6 | 5 |
| T20 | STOP step 8 | "The outside verifier is Gemini through the local proxy." | unchanged. Step 11 ends with one founder action: repoint the proxy service, then run its health check. | 11 |
| T21 | Article 6.5 and the Protocol `edition` line (only if he says yes at step 0) | "A change of edition (7.2 -> 7.2.1) is not an amendment. It is a copy. The name travels. Only the edition line changes." / `edition  : 7.2` | "The edition line names the edition in a word, never a number. Changing it is an amendment under 6.1 to 6.3, and its ERRATA row names the commit before the change. A Page unchanged since that commit keeps its old line. Every Page added or edited after it carries the new one." / `edition  : Original` | 0 |

**The stale-law guard, defined exactly (added in step 5).** It is a new foyer-valid rule. Its ERRATA row is "OS text named a path that no longer exists".
- **Files:** `PROTOCOL.md`, `GUIDE.md`, `START.md`, `STOP.md`, `RULES.md`, `MEMORY-GUARD.md`, `CHECK.mjs`, `CLOSE.mjs`, `REPO-REGISTRY.json` and `fixture.mjs` in `Library/OS/`, plus the root `README.md`.
- **Extraction:** the regex `(?<![\w./-])((?:Library|Vaults|Foyer)/[A-Za-z0-9_./-]+)`. A trailing `.` and a trailing `/` are stripped. A match followed by `[`, `*`, `<` or `${` is a template and is skipped.
- **Exists means:** a tracked file has that path, or a tracked file starts with that path plus `/`. Folders count. It reads `ctx.files` at the checked commit, so it also works with `--snapshot`.
- **Proof it stays green:** a prototype of exactly this rule ran on `1da4787` over those 11 files and found 0 missing paths. In step 5, T12, the Vault 1 code removal and the `CHECK.test.mjs` rewrite take out all three files that name `Vaults/1-Operating-System`, so the guard stays at 0.
- **Why Prog files are not in this list:** over all live files, the same prototype gives 23 false misses, mostly `toolbox.mjs`'s planned `Library/Builder/...` paths. The moved-prefix rule and proof (g) cover Prog files instead.

**No program holds its own copy of law text.** The Builder quotes Article 1 step 10 from `PROTOCOL.md` and the chain from the Foyer `law` string, at the pinned commit (step 4). A law change therefore reaches every prompt in the same commit, and the Builder's test fails if the prompt and the Protocol differ.

**New Guide drawing.** Folder names are written with hyphens, such as `7-Engines`. Never write "Vault 7 Engines" or "7: Engines" in a repo file. Three such pairs in one file fail `single-routing-source` as a third routing table. That has happened four times already (ERRATA rows of 2026-10-08 and 2026-10-09). The same applies to the ROADMAP cards in step 1.

```
Estate: Glumira (one repo)
  +-- Library/OS/                 read FIRST (steps 1-7). Never filed into. No Vault.
  +-- Foyer/FOYER.json            the one door. Generated from Library/OS/JEV-MAP.json.
  +-- Library/Memory/Vaults/2-Memory/
  +-- Library/Archive/Vaults/3-Archive/
  +-- Library/Governance/Vaults/4-Governance/
  +-- Library/Production-Builder/Vaults/5-Production-Builder/
  +-- Library/Glumira/Vaults/6-Insulin-Lock/ ... 22-Gamification-and-Rewards/
```

### The machine check changes, function by function

| Function (line) | Change | Step |
|---|---|---|
| `editionStamp` (1137 to 1187) | Only if he says yes at step 0. A Page or `PROVENANCE.json` may carry the past edition only if its blob equals its blob at the commit named in the edition ERRATA row. Every other Page must carry the Protocol's edition. CI's checkout fetches full history (`fetch-depth: 0`) so that commit is readable. | 0 |
| `EDITION_NAME` in `editionStamp` | **Fix a bug that is live today.** `/72\|7\.2\|-v0\|-v1\.0/` matches Row folders `7.2-What-If` and `17.2-Learning-Suite-Lessons`, so the first Page filed in either Row fails the gate. Strip a leading Row or Vault number (`^\d+(\.\d+)?-`) before the test. | 2 |
| `regen` and `generateFoyer` (883) | When a Vault or Row path changes, rebase every Cabinet `file`, Book `path`, Page `path` and `summary_source` under the old prefix. | 2 |
| `jevErrors` (864 to 867) | Remove the Vault-and-Row same-subject allowance: one subject, one record. | 2 |
| `foyerValid` moved-prefix rule | New, as defined above, with an empty `moved` list. | 2 |
| `jevRevision` | Hash `libraries` and `moved` together with `vaults` and `records`. | 2 (`moved`), 5 (`libraries`) |
| `generateFoyer` (883) | Copy `libraries` and each Vault's `library`. `routes` takes Vault and Row records only; Library records go to `library_routes`. Drop `version` if he said yes at step 0. | 5 |
| `foyerValid` top level (518) | Drop `"version"` from the required keys, if he said yes at step 0. | 5 |
| `jevErrors` | Require `libraries`. Each Library has a name and a path under `Library/`. `vault_root`, when present, is `Vaults` or `<path>/Vaults`. Every Vault names a declared Library other than OS. Plus the record rule in question 2, items 1 to 5. | 5 |
| `foyerValid` routes checks (522 to 548) | Accept `library_routes`. Add: the Insulin-Lock Vault's Library is Glumira. | 5 |
| `routeSubject` (1234) and `--route` (1346) | Match Vault records, then Row records, then Library records. A Library record returns `kind: "Library"`. The print line names the Library for every hit. | 5 |
| New helper `inVault(f)` | True when `f` starts with any Library's vault root. | 5 |
| `foyerValid` Vault path rule (760) | `^Vaults/<n>-` becomes `^<Library vault root>/<n>-<name>$`. Row depth counted from the Vault. | 5 |
| `foyerValid` disk scan (812) | `startsWith("Vaults/")` becomes `inVault(f)`. The Vault-inside-Vault test counts from the Vault root. | 5 |
| `foyerValid` OS home (818) | Every file under `Library/OS/` is in `OS_FILES`. Every other file under `Library/` satisfies `inVault(f)`. Any other `Library/<X>/` folder fails. ERRATA row "undeclared Library folder". | 5 |
| `foyerValid` stale-law guard | New, as defined above. | 5 |
| Vault 1 logic (`VAULT1` line 43, `os_pointer`, `POINTER_PATH`, `POINTER_TEXT`) | Delete, in the same PR that adds `libraries`. Add: no Vault is named Operating System and none carries `os_pointer`. ERRATA row "OS filed as a Vault". | 5 |
| `listSpecial` (304) | `^(?:Vaults\|Foyer)\/` becomes `^(?:Library\|Vaults\|Foyer)\/`, then `^(?:Library\|Foyer)\/` at step 12. | 5, 12 |
| `editionStamp` scans (1160, 1169) | `startsWith("Vaults/")` becomes `inVault(f)`. The detail adds `stamped=<n> copies=<n>`. | 5 |
| `singleQueue` (974) | "Filed in a Vault" becomes `inVault(f)`. At step 11, "filed in Library Production Builder". | 5, 11 |
| `isMemoryPath` (1085) | Read the Memory Vault's path from the JEV map. | 5 |
| `NAMED_EXCEPTIONS` | Add X-008 (step 5). Update the X-007 path at step 8, and the X-004 and X-005 paths at step 11. | 5, 8, 11 |
| `snapshotTree` (489, 505) | Keep `Library`, `Foyer`, `Vaults` until step 12, then drop `Vaults`. | 12 |
| `CLOSE.mjs` `HANDOVER_BOOK`, `REPO-REGISTRY.json`, README.md, `CHECK.test.mjs`, `fixture.mjs` | Updated by the move contract, in the PR that moves their Library. `fixture.mjs` already copies `Library/`. | 8 to 11 |

**New tests in step 5, so the holes stay closed.** In `CHECK.test.mjs`, with a fixture that has one Library moved to `Library/Memory/Vaults/`:
- an unstamped Page there FAILS edition-stamp;
- a byte copy listed in `PROVENANCE.json` there is skipped by the stamp test, as under `Vaults/`;
- a symlink there FAILS foyer-valid;
- a file there that no Page names FAILS foyer-valid;
- a folder `Library/Extra/` FAILS foyer-valid;
- an OS text naming a missing path FAILS, and naming an existing folder passes;
- a Vault named Operating System, or carrying `os_pointer`, FAILS;
- **a one-Vault Library whose Vault's display name differs from the Library name, but whose Vault-level record carries the Library name, PASSES with no Library record.** This is today's Production Builder case;
- a Library record for Memory (answered by its Vault record) FAILS, and a missing record for Glumira FAILS;
- a second record with the subject "Production Builder" FAILS;
- `--route "Operating System"` prints Library OS, `--route "Production Builder"` still returns Vault 5 from `routes`, and a subject with no record still FAILS.

### The tools outside the check, and what each move changes

| Tool | Hard-coded today | Made path-free in | Then each move does |
|---|---|---|---|
| Builder app, Row 5.13 | route `'GluMira 7.2 Production Builder'` (line 59); ROADMAP version list `['72-roadmap-1']` (line 10); ls-tree pathspec `-- Vaults` (line 312); Page regex `^(Vaults\/...` (line 131); `BOOT_ORDER` (`builder-data-api.js` line 7); chain text in `index.html` (lines 1043, 2187); Foyer counter display; test paths (lines 32 to 34); README line 35 | Step 4 (one upgrade PR) | nothing; its suite runs in CI on every PR, and proof (f) compares the Page-area count |
| Proxy service `GlumiraProxy` | nssm AppDirectory = the old 5.13 folder in the main checkout | `setup-service.ps1` already derives its folder from its own location (line 22) | step 11 only: after the main checkout pulls, run it once from the new folder (one UAC), then the health check |
| Row 5.14 and 5.16 programs | `cards.mjs`, `docset.mjs`, `docset-check.mjs`, `docset-report.mjs`, `toolbox.mjs` (literals, escaped regex at 315, bare root test at 160) | Step 6 | proof (g) compares their output |
| Row 5.14 and 5.16 input files | `docset-inputs.json`, `spar-inputs.json`, `provenance-inputs.json` | stay data; the moved-prefix rule makes a miss fail | step 11: rewrite the prefix and re-pin; re-run `docset` to rebuild `SLOTS.json` and `FINAL.json`, then re-pin. `TOOLBOX.json` is a scan record and is not rewritten. |
| The queue's open cards | card 01-29 WRITE_SCOPE (line 98) | the moved-prefix rule reads open cards; the freeze rule | step 11: rewrite 01-29's WRITE_SCOPE |
| /start (memory-governance-archive) | `boot-card.mjs` line 36, `os-first-72.test.mjs` lines 24 and 94, `roadmap-source.mjs` line 16, `law-source.mjs` line 13 (already broken), skill text "read the whole Library" | Step 3 (one PR in that repo) | proof (e) with `--ref <branch>` in each move PR |

### The order. Each step is one PR and leaves 9 of 9 PASS.

Each step runs `node Library/OS/CHECK.mjs --snapshot HEAD` on its branch, as CI already does in `gates.yml`. A step that changes Protocol text or adds an ERRATA row goes through STOP: one revision letter up, one ERRATA row with its gate and test. Merge, never squash. Each step's ROADMAP card is closed (`- [x]`) in that step's own PR.

| Step | What | Rule text | Why everything still works |
|---|---|---|---|
| **0** | He answers the edition question (6b). **If yes (recommended):** one PR, one commit, through the close doctor. The old Article 6.5 bytes go to Row 3.1. Article 6.5 is amended and the edition line becomes `Original` (T21). The `editionStamp` past-edition rule lands with its tests. The ERRATA row names the base commit and the old value. The Foyer `version` counter is frozen at its current value and never raised again. **If no:** nothing is written, and 6.5 stays as it is. | T21 | In the same commit: every existing Page is unchanged since the named commit, so it passes with its old line. A test proves that a new Page with the old line FAILS and a new Page with `Original` passes. No record is rewritten. |
| **1** | File his 2026-10-10 words in Foyer `founder_rulings_verbatim`. Add steps 2 to 13 as ROADMAP cards, plus the step-11 UAC card, and the launch-day repo card if he says yes to 6f. Cards name the step and the Library only, never a path or a Vault number-and-name pair. | none | No code, nothing moves. Neither the ruling text nor the cards hold a moved path or Vault-number pairs. |
| **2** | Check prep, no move. The edition-name fix, `--regen` rebasing, one subject one record with Row 5.13's subject renamed "Builder App", and the moved-prefix rule with an empty `moved` list and its tests (made-up prefix). ERRATA rows: "Row number read as an edition", "one name on two levels", "a live file names a moved path". Protocol revision up. | none | Today's tree is unchanged. The only duplicate subject is fixed in the same PR, and "Production Builder" -> 5 remains as the Vault-level record. The moved list is empty, so the rule finds nothing. `builder-context.js` does not read Row 5.13's name. |
| **3** | **Other repo:** one PR in memory-governance-archive. `roadmap-source.mjs` reads the ROADMAP path from Glumira-7.2 `REPO-REGISTRY.json` `builder`. `boot-card.mjs` reads the handover folder from the Foyer's Row 4.7 `Page-Doc-Handover`. `os-first-72.test.mjs` line 94 asserts that `handoverDir` equals that Foyer path, not a literal, and line 24 keeps binding `HDIR` from the table. `law-source.mjs` reads the law from Row 4.5's Page, which fixes today's broken path. All three readers take `--ref` (default `origin/main`). The /start skill text says "every file in `Library/OS`" instead of "the whole Library", and "the newest handover in the Row the JEV map routes Handover to". | none in 7.2 | /start and the hub's gate suite run on today's main and resolve the ROADMAP, the newest handover and the law. They read 7.2's own data, so they stay right after every later move. |
| **4** | **Builder upgrade, Row 5.13, one PR, X-004 lifted for this PR only by his word. Not open while card 01-29 is open.** `builder-context.js` line 59 reads the route "Production Builder", which exists today and routes to 5. Line 10 accepts `72-roadmap-1` and `roadmap-1`. `builder-ideas.js` builds its ls-tree pathspec (line 312) and its Page grouping (line 131) from the Foyer's Vault paths, so no literal `Vaults` is left. `BOOT_ORDER` line 3 quotes Article 1 step 10 from `PROTOCOL.md`. The two chain texts in `index.html` (lines 1043, 2187) show the Foyer `law` string. Both are read at the pinned commit. The Library tree shows `jev_revision` instead of the Foyer counter. `gitFiles` and a new `pageAreas(files)` are exported for proof (f). New tests: one runs the real `gitFiles` on a temp git repo with a Page under `Library/Memory/Vaults/` and asserts the Page is found; one asserts the prompt's boot step equals Article 1 step 10 in `PROTOCOL.md`. The tests take the ROADMAP and Builder paths from `REPO-REGISTRY.json`. The README service text says "run `setup-service.ps1` from this folder", with no path. Title "Glumira Production Builder". `npm test` and `gates.yml` add the Builder suite (`npm ci`, then `node --test test/*.test.js` in its folder). Re-pin, and close X-002 by pinning the README in the same PR. | none | The suite runs first on today's layout and must be green. If a test already fails on main, fixing it is part of this PR, before CI depends on it. The Page-area count on this commit is recorded as the baseline for proof (f). Paths, law text and the counter now all come from their one source, so no second Builder PR is ever needed. |
| **5** | **Teach Libraries and retire Vault 1, in one PR.** Every step-5 row of the function table, X-008, the stale-law guard and the new tests. Add `libraries` with `vault_root: "Vaults"`, and give each of Vaults 2 to 22 its `library`. Archive `POINTER.md` as a stamped Page in Row 3.1 Superseded, with its line quoted word for word and its old blob and commit. Remove the Vault 1 folder, record and code. Turn the record "Operating System" into a Library record, and add "OS" and "Glumira". Add the `moved` entry for `Vaults/1-Operating-System`, and rewrite its 3 live mentions. File the new filing-law Page (T18) in Row 4.5. ERRATA rows: "undeclared Library folder", "OS text named a path that no longer exists", "OS filed as a Vault". | T1 to T7, T9 (Vault 1 clause), T10, T11, T12, T18 (Page), T19 | Vault 1 and the `libraries` block never exist in the same commit, so no Vault ever lacks a legal Library. The record rule passes: Memory, Archive, Governance and Production Builder are answered by their existing Vault records, and OS and Glumira get Library records. Every vault root is still `Vaults`, so every scan sees the same files. The PR body lists the two added Pages (archive, filing law), so the counts are `main` + 2. The guard finds 0 missing paths. T1 reaches the Builder's prompts through step 4's quote. |
| **6** | **Vault 5 programs path-free.** `toolbox.mjs`, `cards.mjs`, `docset.mjs`, `docset-check.mjs` and `docset-report.mjs` read Vault and Row paths from the JEV map. `toolbox.mjs`'s area test (line 160) becomes "under any Vault path in the JEV map", and its reference regex (line 315) is built from the JEV map's Vault 5 path. Record each program's output on this commit as the baseline for proof (g). | none | The JEV map still holds today's paths, so each program's output equals its output on `main`. The PR shows that diff as empty. |
| **7** | Library Glumira: set its `vault_root` to `Library/Glumira/Vaults`, change the Vault 6 to 22 paths, `--regen`. | none | Vaults 6 to 22 hold no files, so only records and Foyer paths change. Vault 1 is already gone, so nothing is left at a root path that the rule would reject. |
| **8** | Move Library Memory under the move contract. Live files: `CHECK.mjs` (X-007, `isMemoryPath` test data), `CHECK.test.mjs`, GUIDE and `MEMORY-GUARD.md` (T13). Also the harness memory index link `.../tree/main/Vaults/2-Memory`. | T13 | The move contract's proofs (a) to (g). |
| **9** | Move Library Archive (3 files) under the move contract. The prototype finds 0 live mentions. | none | Same. |
| **10** | Move Library Governance under the move contract. Live files: `CLOSE.mjs` `HANDOVER_BOOK`, RULES, STOP, GUIDE, `CHECK.test.mjs`. The filing-law Page from step 5 moves with its Row. | T14, T15 | Same, plus `os:close` runs on the branch, which proves the handover path. /start and `os-first-72.test.mjs` with `--ref` find the handover and the law at their new home. |
| **11** | Move Library Production Builder and rename Vault 5 in the same `git mv`. Live files: the registry `builder` and `source`, `singleQueue`, `ROW_513`, X-004, X-005, START line 40, README line 43, `fixture.mjs`, `CHECK.test.mjs` and the 3 input files. Rewrite card 01-29's WRITE_SCOPE. Re-run `docset` for `SLOTS.json` and `FINAL.json`, then re-pin. Delete the JEV record "GluMira 7.2 Production Builder". After step 4 no program reads it, and the Vault's own name is now "Production Builder". **After merge, as one batched founder action:** pull the main checkout, run `setup-service.ps1` from the new 5.13 folder (one UAC; it stops the service, repoints AppDirectory, installs Express and starts it), and check that the proxy answers. Only then does STOP step 8's verifier run. | T16, T20 | START, the registry and the queue file agree in one commit. The Builder suite is green against the new paths, its Page-area count equals main's, and the programs' output matches the step-6 baseline. The PR's own outside review runs before the pull, while the service still runs from the old folder in the main checkout. The fallback with no admin is `start-proxy.bat` from the new folder. |
| **12** | Close the transition. Delete `vault_root` from every Library; the check derives it and fails if the field is present. Root `Vaults/` must not exist. Add the `moved` entry `"from": "Vaults/"`. Drop `Vaults` from the fingerprint, `listSpecial` and START's gate text. Final Guide drawing, nested path and Foyer `law` string (the Builder shows the new string at once, through step 4). Add `--without "Production Builder"`: a dry run proving that no route, pointer, OS file or live file outside Library Production Builder points into it. | T8, T9 (final), T17, T18 (`law`) | His "nothing must break" becomes a test, not a promise. After steps 4 and 6 no live file holds a bare root `Vaults/`, so the new entry finds 0 hits. |
| **13** | The naming sweep from question 6, after his answers. It includes the ROADMAP line `version: 72-roadmap-1` -> `version: roadmap-1`, which the Builder accepts from step 4. | none | Text only. Re-pin each edited Page. Each edited Page takes the current edition line. |

---

## Question 6. The naming ruling

His words: "The official launch name is Glumira / Do not add any version numbers in the 7.2 documents - that is only for you to keep track".

### Must be renamed

| Item | From | To | Step |
|---|---|---|---|
| Edition stamp line (if yes at step 0) | `edition : 7.2` on every new or edited Page | `edition : Original` | 0 |
| Vault 5 name and folder | GluMira 7.2 Production Builder, `5-GluMira-7.2-Production-Builder` | Production Builder, `5-Production-Builder` | 11 |
| JEV record | "GluMira 7.2 Production Builder" -> 5 | Deleted. "Production Builder" -> 5 already exists, and the check needs each Vault routed under its own name. | 11 (the Builder stops reading it at step 4) |
| Row 5.13 subject | "Production Builder" (same as Vault 5) | "Builder App". Folder unchanged under X-004. | 2 |
| X-005 | three names | Drop the Vault 5 entry. Two remain (6c). | 11 |
| ROADMAP version line | `version: 72-roadmap-1` | `version: roadmap-1` | 13 (enabled by step 4) |
| Foyer `foyer` | "GluMira 7.2" | "Glumira" | 13 |
| START repo-confirm text (line 18) | "the 7.2 repo" | "the active repo" | 13 |
| STOP step 7 | "A 7.2 commit carries no credit line" | "A commit in this repo carries no credit line" | 13 |
| Guide context line and drawing title | "GluMira 7.2 estate", "Library 7.2" | "Glumira estate", the new drawing | 12 |
| `package.json` `name` and `description`, `CHECK.mjs` header | `glumira-7.2`, "GluMira 7.2" | `glumira`, "Glumira" | 13 |
| Builder app title (`production-builder/index.html` lines 1 and 813) | "GluMira 7.2 Production Builder" | "Glumira Production Builder" | 4 (same upgrade PR) |

The package rename is free. The package is `private`, has no lock file at the root, and `.githooks/check-gates.mjs` reads only its `scripts` block.

### Must NOT be renamed now

- **Byte copies and founder quotes,** including `GLUMIRA-FILING-LAW.md`, the ROADMAP's own title, every `founder_rulings_verbatim` entry (his ruling itself says "7.2 documents"), and file names such as `GluMira-7.2-Production-Builder-Prompt-Kit.md` in Row 5.13. Changing bytes breaks the pin, and rewording breaks "never paraphrase".
- **Records:** handovers, memory Pages, closed cards and scan outputs. They describe a past state. Their `edition : 7.2` lines stay, because "do not add" does not order a rewrite, and the past-edition rule accepts them only while they are unchanged.
- **The repo name, until he rules on 6f.**

### Open questions, each with a recommendation

a. **Spelling.** "GluMira" appears about 8,500 times in 195 files. "Glumira" appears about 6,900 times in 163 files, mostly as repo and org names. **Recommendation:** use "Glumira" in every name and in every new or edited text. Founder quotes and byte copies keep their spelling. Step 13 sweeps the OS files, the Foyer and README once. Other pinned Pages change only when next edited, which avoids hundreds of re-pins for no reader gain. Routing compares names case-insensitively, so it is not at risk either way.

b. **The edition stamp and the other tracking fields. Asked first, at step 0.** Every field that carries a number is listed here, so none is changed or kept by surprise:

| Field | Where | What reads it | Number visible in the document? |
|---|---|---|---|
| `edition : 7.2` stamp line | the Protocol header, 159 stamped Pages (for example, the third line of every handover), 24 `PROVENANCE.json` files | gate `edition-stamp`: every new Page must carry the Protocol's value | yes |
| Foyer `"version"` (today `2.11`) | `Foyer/FOYER.json` | `foyerValid` line 518 requires it; the Builder's Library tree shows it | yes |
| ROADMAP `version: 72-roadmap-1` | the queue Page | the Builder (`builder-context.js` line 10) | yes |
| `revision : A` | the Protocol header | Article 6.2 | no, it is a letter |

| Option | Cost | Fit with his words |
|---|---|---|
| A. Keep the `7.2` stamp and the counter | none | Every new Page and every Foyer change adds a number. This breaks "Do not add any version numbers". |
| **B. Stamp becomes `Original`. Old unchanged Pages keep their line. The counter freezes, then goes (recommended)** | Step 0: one PR with the 6.5 amendment, the edition line and the past-edition rule. No mass re-stamp. Steps 4 and 5 retire the counter. Step 13 drops "72" from the ROADMAP line. | Adds no number from step 0 on. Uses his own word, "Original launch version". Records stay untouched. The one place the old value is written is the ERRATA row, the agent's own ledger, which is "only for you to keep track". |
| C. Re-stamp every Page to `Original` | About 185 files re-stamped and re-pinned, records included | Strictest. Rewrites records, which breaks "records describe a past state". |
| D. Remove the stamp line | Same as C, plus a code change; the edition gate loses its value | Strictest, but the gate then cannot tell a stale Page. |

   **Recommendation: B.** It is the only option that adds no number and rewrites no record. It is lawful because Article 6.5 is amended first, in the same commit, through the close doctor (T21).

c. **The two folders `glumira-7.2` and `glumira-7.2.1`** in Row 5.16 Estate Mapping. **Recommendation:** keep them under X-005. They are named after repos and are audit evidence.

d. **Article 6.5 (`7.2 -> 7.2.1` copy).** Option B in 6b depends on it, so it is amended at step 0 (T21), not left alone. "It becomes the Original launch version" means this repo becomes the launch edition, not a copy of it. **Recommendation:** approve T21 together with 6b. If he answers no to 6b, 6.5 stays word for word and nothing in the plan touches it.

e. **Row 4.6 "Agent OS".** It holds byte copies of the old agent rules. **Recommendation:** it stays a Governance Row. He confirms it is not "the OS" that "cannot have a vault".

f. **The repo name `Glumira-7.2` at launch.** "The official launch name is Glumira" points toward a repo called `Glumira`. A rename touches six places:
   - `REPO-REGISTRY.json`;
   - the identity test in `.githooks/check-gates.mjs`;
   - the Builder's `EXPECTED_REPO`;
   - `roadmap-source.mjs` `SLUG_72` and `law-source.mjs` `LAW_REPO` in the other repo;
   - the Vercel link and the local folder;
   - every PROVENANCE `repo` field that names this repo.

   The last one is a trap. `editionStamp` treats a source whose `repo` equals the slug as a self-copy. A rename that misses those fields would suddenly demand stamps on files that are not ours. GitHub redirects the old URL, so outside links survive. **Recommendation:** keep `Glumira-7.2` through the build. Rename it once, on launch day, as one ROADMAP card with one PR per repo. He answers yes or no now, so the card exists.

---

## Question 7. Risks and the smallest safe first step

| Risk | Fix in this plan |
|---|---|
| The first new Library folder fails foyer-valid | Step 5 changes that rule before any folder exists. |
| A gate passes after a move only because it stopped scanning | Step 5 moves every `Vaults/`-only scan onto `inVault`, with tests. Each move shows equal `pages`, `books`, `stamped` and `copies` counts. Moves add no Pages, so equality is strict. |
| **Step 5's record rule fails because Vault 5's name still says "7.2"** | The rule is keyed on records. "Production Builder" -> 5 already answers Library Production Builder. A test covers this exact case. |
| **A new rule fails on its own data** (the `moved` list lives in an OS file; new paths contain old ones) | The moved-prefix rule skips `JEV-MAP.json` by name and matches only a standalone prefix. Prototype proof on `d3099dd`. Tests use a made-up prefix. |
| **A stale path hides in an escaped regex, a `./` path or a bare root test** | The rule matches all four forms. Step 6 makes the programs path-free. Proof (g) compares program output on every move, because a grep cannot prove behaviour. |
| **An open card sends an agent to a folder that is gone** (card 01-29's WRITE_SCOPE) | The rule reads open cards. Step 11 rewrites the WRITE_SCOPE. The freeze rule stops dispatch while a move is open. |
| **Card 01-29 and the Builder upgrade edit the same files** | They are never open at the same time. The second one rebases on the first. |
| **The Builder hands agents an old "Article 1"** | Step 4 makes it quote Article 1 step 10 and the chain from their sources, with a test. T1 at step 5 reaches every prompt in the same commit. |
| **Vault 1 has no legal Library while Libraries are taught** | Vault 1 is retired in the same PR that adds `libraries` (step 5). |
| `--regen` leaves about 90 Foyer paths stale | Step 2 teaches it to rebase them, `summary_source` included. |
| **The Builder app cannot find the queue** (it reads the old route name) | Step 4 switches it to "Production Builder", which exists today and stays in `routes`. Its suite runs in CI from step 4 on. The old record is deleted only at step 11. |
| **The Builder silently stops seeing moved Pages** (file list and Page regex) | Step 4 builds both from the Foyer's Vault paths, with a test on a real temp repo. Proof (f) compares the Page-area count at every move. |
| **The ROADMAP's "72" cannot be removed** (Builder version list) | Step 4 accepts `roadmap-1`. Step 13 changes the line. |
| **New documents keep adding "7.2"** | Step 0 option B: the stamp becomes `Original`, and the counter stops. |
| **Changing the edition breaches Article 6.5** | Step 0 amends 6.5 first, in the same commit, through the close doctor (T21). If he says no, nothing changes. |
| **The past-edition rule cannot read its commit in CI** | `gates.yml` checkout uses `fetch-depth: 0`, checked in the step-0 PR. Merge, never squash, keeps the commit in history. |
| **The verifier proxy dies after the pull** | Step 11 ends with one batched founder action: pull, run `setup-service.ps1` from the new folder (one UAC), health check. STOP's verifier runs only after that. Fallback with no admin: `start-proxy.bat`. |
| **/start or its gate test cannot find the handover or the queue** after steps 10 and 11 | Step 3 makes the readers and `os-first-72.test.mjs` resolve paths from 7.2's own registry and Foyer. Each move proves both with `--ref <branch>`. |
| **`law-source.mjs` is broken today** | Step 3 fixes it in the same PR. This bug is live with or without the six Libraries. |
| **/start "read the whole Library" grows to 375+ files** | Step 3 narrows it to "every file in `Library/OS`". |
| A name sits on two levels (Vault 5 and Row 5.13) | Step 2: Row 5.13 becomes "Builder App" and the allowance is removed. The Library/Vault echo is the named exception X-008, with one enforced rule. |
| The law text describes a tree that no longer exists | T1 to T21 list every changed line with its step. The stale-law guard fails any OS path not on disk. |
| A text with "Vault 7 Engines"-style pairs becomes a third routing table | Hyphenated folder names only. ROADMAP cards name a step and a Library, never pairs. The Vault map lives only in the JEV map. |
| This plan's step list becomes a second queue | The steps go into the ROADMAP as cards (step 1), nowhere else. |
| Row folders `7.2-What-If` and `17.2-...` fail the edition gate on their first Page | Step 2 fixes it. This bug is live today. |
| Windows path length: 191 characters plus a 61-character worktree root is 252, near the 260 limit | `git config core.longpaths true`. Step 11 checks the longest path. Keep worktree names short. |
| Windows holds the old 5.13 folder while the service runs from it | `setup-service.ps1` stops the service first. The old folder then holds only untracked `node_modules` and logs. The logs are copied to the new folder and the empty folder is removed. |
| Squash-merge drops pinned commits | Merge only (STOP step 7). |
| Parallel sessions conflict on `FOYER.json` | One owner for steps 2 to 12. Other filing waits. Every window runs `--fetch`. |
| Guide and Protocol are his own text | Each wording change is shown to him and lands through the close doctor. The old bytes are archived in Row 3.1. |
| The Builder cannot actually be removed yet: with no queue, `single-queue` fails | Step 12's dry run proves nothing else depends on it. "Builder retired" is his call at launch, written as a ROADMAP card now. |
| A repo rename breaks self-copy detection and the cross-repo readers | 6f: one launch-day card, one PR per repo, all fields together. |
| Deploy exposure | None. `.vercelignore` allowlists five root files, so nothing under `Library/` is deployed. |

**Smallest safe first step: step 1, after his step-0 answer.**
- Add his 2026-10-10 words to `founder_rulings_verbatim` in `Foyer/FOYER.json`.
- Add steps 2 to 13 as ROADMAP cards, with the edit note and re-pin, as in commit `6b44957`. Cards name the step and the Library, never a path. Add the step-11 UAC card and, if he says yes to 6f, the launch-day rename card.
- Do not raise the Foyer counter if step 0 froze it. Run the check: 9 of 9 PASS.

No code changes and no folder moves. The decision is on record, so it is not argued again. **The first code step is step 2.** It fixes one live bug and one live duplicate name, and changes no layout. **The first structural step is step 5,** and it moves no Vault folder; it only retires the pointer Vault.

---

## What he approves in one word each

0. The edition stamp becomes `Original`. Article 6.5 is amended as T21. Old unchanged Pages keep their line. The Foyer counter stops. (Yes or no, before anything else.)
1. Six Libraries under `Library/`, one JEV map, one Estate Foyer. Filing chain: Estate > Foyer > Library > Vault > Row > Cabinet > Book > Page.
2. Insulin-Lock in Library Glumira as Vault 6.
3. Vault 1 retired, in the same step that teaches Libraries. All other numbers kept.
4. Vault 5 renamed "Production Builder". Row 5.13's subject renamed "Builder App". Package renamed `glumira`.
5. One Builder upgrade PR in Row 5.13 (step 4), with X-004 lifted for that PR only, never open at the same time as card 01-29.
6. One PR in memory-governance-archive (step 3), so /start and its gate test read 7.2's paths from 7.2 itself.
7. One UAC from him at step 11 to repoint the proxy service.
8. The rule wording T1 to T21 and the named exception X-008.
9. Open questions a, c, d, e and f, each with its recommended answer.
