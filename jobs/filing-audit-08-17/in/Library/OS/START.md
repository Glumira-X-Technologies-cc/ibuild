# START: boot

Library/OS/START.md. Step 1 of the boot order.

The boot order is written once, in `PROTOCOL.md` Article 1 (and shown in `GUIDE.md`, "THE READING ORDER"). This file does not restate it. It maps each step to its file and says what the machine check proves. If this file and the Protocol disagree, the Protocol wins.

## The boot

1. Read the files of the reading list below, in its order. Each line is one step of Article 1.
2. At step 4, state the repo line before reading anything else: "I am in repo X at commit Y on branch Z". `REPO-REGISTRY.json` names the one active repo and the commit it was registered at.
3. At step 7, run the check: `npm run os:check` (it runs `node Library/OS/CHECK.mjs --fetch`). If the task names a repo, add `--task-repo <that repo>`. It prints one PASS or FAIL line per gate and exits 1 on any FAIL. A FAIL stops the session: state the failing line, state the fix, and halt. There is no warning-and-proceed.
4. At step 8, the Builder: check its version, then read only the cards the task needs. The check proves the version.
5. At step 9, `Foyer/FOYER.json`: the generated view of `JEV-MAP.json`. Then step 10, top-down: Vault, Row, Cabinet, Book, Page. `node Library/OS/CHECK.mjs --route "<subject>"` prints where a subject routes, from `JEV-MAP.json`. A subject with no record is never guessed: stop and request a ruling. The Cabinet is the boundary.
6. First reply: the repo line, the snapshot fingerprint, the JEV revision, the Builder path and version, and any memory file in the boot path.

## The gates

- **repo-confirm.** The checkout is the 7.2 repo, `REPO-REGISTRY.json` names it as the one active repo, and the registered commit is in its history. A task that names another repo is a FAIL.
- **snapshot-fingerprint.** One fingerprint of the `Library`, `Foyer` and `Vaults` trees at `origin/main`. Every window prints the same one. A different snapshot, or an uncommitted change under them, is a FAIL.
- **foyer-valid.** The Foyer parses, no Vault holds a Vault, Vault 1 holds only `POINTER.md`, every empty Vault or Row is marked `[OPEN] NO BOOK - unaccounted for`, every Page and Cabinet file exists, every pinned blob equals git, no file under `Vaults` or `Library` is unaccounted for, and no live file or open card names a path the JEV map lists as moved.
- **single-routing-source.** `JEV-MAP.json` is the one routing authority. Its revision is the hash of its records and its moved list. One subject has one record. `FOYER.json` is its generated view with the same revision; `--regen` rebases the Foyer paths of a Vault or Row whose path changed. Different revisions are a FAIL. Any third routing table is a FAIL.
- **single-queue.** One queue, the Builder, filed in Vault 5. `REPO-REGISTRY.json` names the same file. No task name of the queue appears in a second source.
- **no-71-source.** No file on the boot reading path is a glumira-7.1 source, and the registry never makes glumira-7.1 the active repo.
- **memory-guard.** No memory file on the boot reading path (steps 1 to 10), before the JEV map has routed. A matching path is a flag, not proof. An intentional read after routing is never a failure.
- **edition-stamp.** No name under `Library` or `Vaults` carries an edition, and every Page file carries the three-line stamp. The edition is a word, never a number. A past edition stays only on a Page unchanged since the edition change, and the Foyer counter is frozen. The named exceptions are printed on the gate line.
- **path-length.** No tracked path under `Library`, `Foyer` or `Vaults` is longer than `MAX_PATH_LENGTH` in `CHECK.mjs` (165 characters, the longest path after the Vault 5 rename of 2026-10-13). The limit is a ratchet: it is lowered when paths get shorter, never raised. A path that is too long is fixed by shortening a name to its subject.
- **errata.** Every row of `ERRATA.json` names a gate that is implemented and passes, and a proof test in `CHECK.test.mjs` that exists.

## Reading list

The files of Article 1, steps 1 to 9 and 11, for the check. `read` is read in full. `run` is run. `version` is checked by its version, never read whole (Article 4.9). Step 10 is routed, so it has no fixed file.

```reading-list
read Library/OS/START.md
read Library/OS/PROTOCOL.md
read Library/OS/GUIDE.md
read Library/OS/REPO-REGISTRY.json
read Library/OS/JEV-MAP.json
read Library/OS/MEMORY-GUARD.md
run Library/OS/CHECK.mjs
version Vaults/5-Production-Builder/Rows/5.14-Build-Plan/Books/Book-ROADMAP/Page-Doc-ROADMAP/ROADMAP.md
read Foyer/FOYER.json
read Library/OS/STOP.md
```

## What the check cannot see

It checks what this repo tells an agent to read. It does not control the harness, the global rules file, or memory the harness injects before any file is read. Report such text in the first reply as "Memory file in boot path at <path>".

The phrase gate `no-71-source` reads plain words in the `read` files. It skips the founder's verbatim text (`PROTOCOL.md`, `GUIDE.md`, `MEMORY-GUARD.md` and the Foyer's `founder_rulings_verbatim`): those are quotes, not instructions. `repo-confirm` takes its identity test from `.githooks/check-gates.mjs` in the checkout. Add `--verbose` to print every failure on a gate line.
