# Cabinet: Filing Law (end of Row 4.5)

Vault 4, Governance. Row 4.5 holds the GluMira 7.2 filing law that `Foyer/FOYER.json` names in its
`law` field. Row 4.4 is not reused: it was Insulin-Lock until the founder moved it to Vault 6 on
2026-10-06 ("Insulin-Lock is not a Row under Governance. Remove Row 4.4 from Vault 4.").

## Books in this Cabinet

| Book | Pages | What it holds |
|---|---|---|
| Book-Filing-Law | Page-Doc, Page-Git | The law, word for word, and where it came from |
| Book-Naming-Scheme | Page-Doc, Page-Prog (MISSING), Page-Git | The naming scheme the founder approved on 2026-10-14: five folder levels, a two-letter code per Vault, five Page layers, no edition in any path, and his words that set it |

### Book-Filing-Law

- **Page-Doc-Filing-Law**: `GLUMIRA-FILING-LAW.md`, byte copy of memory-governance-archive
  `governance/00_CANON/GLUMIRA-72-FILING-LAW_v1.0.md` (blob `c891747`).
- **Page-Git-Filing-Law**: `PROVENANCE.json`. Source repo, commit and blob hash.

This Page is the law `Foyer/FOYER.json` reads for 7.2. An amendment is filed as a new Page version;
this Page is never edited. Its own "Home:" line names memory-governance-archive because the bytes are
kept as they were (founder 2026-10-06, on the original there: Delete).

### Book-Naming-Scheme

Founder 2026-10-14, verbatim: "Library > Vault > Row > Book > Page."; "I was thinking of alpha numeric per vault"; "Can we remove Library/"; "Approved"; "go".

- **Page-Doc-Naming-Scheme**: `NAMING-SCHEME.md`, written in this repo from the founder's rulings. The scheme, the Vault codes, the Page layers, the stamp and a sample Row.
- **Page-Prog-Naming-Scheme**: MISSING. See Missing layers.
- **Page-Git-Naming-Scheme**: `PROVENANCE.json`. The session the rulings were given in, and the blob of the Page.

## Read the Book if

you file anything in 7.2, add a Row, a Book or a Page, or ask whether something needs a new Vault.

- you name a folder or a file, or pick a Vault code (Book-Naming-Scheme).

## Stop here if

you only read a Page that is already filed.

## Missing layers

- **Page-Prog: MISSING.** The program that enforces the law is the filing guard
  (`governance/tools/filing/check-filing.mjs` and `governance/30_REGISTRY/filing-maps/glumira-7.2.json`
  in memory-governance-archive). It is not copied into 7.2.
- **Page-Prog: MISSING in Book-Naming-Scheme.** The gate that checks a path against the scheme lands with ROADMAP card 08-17 in `CHECK.mjs`, with its ERRATA row and test.

## Open

- [OPEN] Nothing is filed under the naming scheme yet. Card 08-17 moves the files, tools first. Until it is ticked, the paths on disk follow the law Page and the Six Libraries plan.
- [OPEN] The founder said "we have 8 libraries now"; two Libraries are not named yet.
