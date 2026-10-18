================================================================
PART ONE - THE FILING SYSTEM (TEACHING)
================================================================

CONTEXT - WHAT THIS IS AND WHY IT EXISTS
-----------------------------------------
This is a filing system for AI agents working in the GluMira 7.2
estate. It is not a folder tree. It is a routing map. Its purpose is
to let an agent read ONLY the parts it needs, from the top down,
without loading the whole repository into context.

The problem it solves: an agent boots, guesses a destination, reads a
stale source, injects an old memory, creates a duplicate name, and
files the same information in three places. By the time it reaches the
rules that would have stopped it, it is already too late. The rules
live too deep.

The fix: put the operating commands (OS/START, OS/STOP, OS/RULES,
OS/CHECK) at Library level, above the Foyer. The Foyer becomes purely
a router. Everything below the Foyer is data. Everything in the OS is
governance. They never mix.

HOW IT LOOKS - THE DRAWING
--------------------------
The founder's crude drawing showed this shape:

  Library 7.2
    |
    +-- Foyer
    |     +-- Onboarding
    |     +-- Dashboard
    |     +-- Insulin & What-If
    |     +-- Cookbook & Meals
    |     +-- Special Provisions
    |     +-- Reports & Logs
    |     +-- Education & Library
    |     +-- Care Circle
    |     +-- Alarms & Settings
    |     +-- Mira Media
    |     +-- Subscription Tiers
    |     +-- 3.1 GluMira (Insight, AI, Research, Clinician Interface)
    |     +-- 3.2 Reports & Logs
    |     +-- 3.3 Engines
    |
    +-- Vaults
          +-- Engines
          |     +-- Rows
          |           +-- IOB Hunter
          |           +-- Food to Curve
          |           +-- What-If
          |           +-- IOB Prediction Engine
          |           (and more - the list is not limited)
          |
          +-- Operating System
          +-- Memory
          +-- Governance
          +-- Archive
          +-- Soup Training
          +-- Insulin-Lock
          +-- GluMira 7.2 Production Builder

The left side of the drawing showed the deep nesting:

  Rows -> Everything related to CGM -> Cabinet -> Modules -> Books -> Pages
  Pages: Links/Summaries of modules -> Summary of all in related (Page)
         -> Index Training (Page) -> SOAP Training (Page)
         -> Research and intell (Page)

HOW IT LOOKS - THE FULL NESTED PATH
-----------------------------------
One item, from the router to the file:

  Foyer
    -> Vaults/[Vault Name]
      -> Rows/[Row Name]
        -> Cabinet/Cabinet-[Row Name]
          -> SUMMARY.md                       (the boundary - stop here)
          -> Book-[Row Name]
            -> Page-Doc-[Row Name].md         (Documents layer)
            -> Page-Prog-[Row Name].mjs       (Programming layer)
            -> Page-Git-[Row Name].md         (Git pointer layer)

Every Page is a POINTER: repo + path + commit + blob hash.
No body is ever copied. No rule is ever paraphrased.

HOW IT LOOKS - THE OS LAYER
---------------------------
Library/
  +-- OS/                        <- read FIRST, every time
  |     +-- PROTOCOL.md          the binding contract
  |     +-- GUIDE.md             this filing system (the teaching)
  |     +-- START.md             boot sequence
  |     +-- STOP.md              close sequence
  |     +-- RULES.md             constitutional layer, thin
  |     +-- CHECK.mjs            machine check, must pass
  |     +-- REPO-REGISTRY.json   which repos exist, which is active
  |     +-- JEV-MAP.json         routing records (authority)
  |     +-- MEMORY-GUARD.md      boot path memory rules
  |     +-- ERRATA.json          every past mistake as a permanent check
  |
  +-- Foyer/                     <- read SECOND (router only)
        +-- FOYER.json           generated view of JEV, same revision
        +-- Vaults/
              +-- 1-Operating-System/   <- POINTER only, OS lives at Library/OS/
              +-- 2-Memory/
              +-- 3-Archive/
              +-- 4-Governance/
              +-- 5-GluMira-7.2-Production-Builder/
              +-- 6-Insulin-Lock/

THE READING ORDER (THE ONLY AUTHORITY)
--------------------------------------
This is the only place the boot order is written. Everything else
references it. If anything disagrees with this list, this list wins.

  1. OS/START
  2. OS/PROTOCOL          (the binding contract - Part Two below)
  3. OS/GUIDE             (this filing system - Part One)
  4. OS/REPO-REGISTRY
  5. OS/JEV-MAP           (routing records, read fresh, never cached)
  6. OS/MEMORY-GUARD      (boot path only)
  7. OS/CHECK             (machine check, must pass)
  8. BUILDER              (inline with OS; OS wins on conflict)
  9. FOYER.json           (generated view of JEV; must match JEV revision)
  10. Vault -> Row -> Cabinet -> Book -> Page
  11. OS/STOP

Rule: if any step fails, STOP. Do not proceed with a warning. Stop and
report.
Rule: the Builder is inline with the OS. If Builder and OS disagree, OS
wins.
Rule: the Protocol is read before the Guide because the Protocol is the
law. The Guide explains how the law looks in practice. If the Guide and
the Protocol disagree, the Protocol wins.

THE OS HOME (ONE HOME)
----------------------
The OS has exactly one authoritative home: Library/OS/
Vaults/1-Operating-System/ is NOT a second home. It is a pointer only.
Its only file is POINTER.md saying the OS lives at Library/OS/.
If it currently holds content, that content moves up to Library/OS/ or
into Vaults/4-Governance/Rows/, in one commit, leaving only the pointer.

THE JEV CONTEXT MAP (OWNS THE ROUTING)
--------------------------------------
The JEV map is the routing authority. It is the source of truth for
subject -> Vault -> Row. FOYER.json does not route. FOYER.json is a
generated view of the JEV map, tied to the same revision.

  - JEV-MAP.json lives at OS/JEV-MAP.json
  - FOYER.json is generated from JEV-MAP.json, same revision hash
  - if the revisions differ, STOP
  - the agent never invents a destination not in the JEV map
  - if the subject is not in the JEV map, STOP and request a ruling
  - regenerate JEV-MAP.json whenever a Vault or Row changes;
    regenerate FOYER.json in the same commit

THE MEMORY GUARD (BOOT PATH ONLY)
---------------------------------
The guard protects the boot reading path. It does not police the whole
filesystem. It does not block an intentional read.

  What it scans:  only the files read during steps 1-10 of the boot order
  What counts:    MEMORY.md, memory/, _memory/, NOW.md, CONTEXT.md, or
                  any file whose name marks it as memory, appearing in
                  the boot path before the JEV map has routed the agent
  What the agent does when it fires:
                  STOP, report "Memory file in boot path at <path>",
                  do not proceed, do not accuse
  A matching path is a FLAG, not proof.

  What the guard does NOT block:
                  an intentional read of Vaults/2-Memory/ after the JEV
                  map has routed a task there
                  a legitimate CONTEXT.md inside a Book the JEV map has
                  routed to
                  any file opened after OS/CHECK has passed and the JEV
                  map has named the destination

If a memory ruling is needed, it lives in that Vault's VAULT.md as an
approved ruling. It is never injected as instruction.

THE BUILDER (INLINE WITH OS)
----------------------------
The Builder is the work queue. It is not a second rule set. The OS
governs. The Builder executes.

  - the agent reads the OS first, then opens the Builder
  - the agent checks the Builder version against what OS/CHECK expects
  - if the Builder is not up to date with the OS, STOP and report drift
  - if the Builder is current, read only the cards relevant to the task
  - never read the whole Builder

THE REPO CONFIRMATION
---------------------
Before reading anything else:
  1. read OS/REPO-REGISTRY
  2. state: "I am in repo X at commit Y on branch Z"
  3. if the task names a different repo, STOP
  4. if the commit does not match the registry, STOP

THE SELF-IMPROVING LOOP
-----------------------
Every mistake becomes a permanent check.

  MISTAKE -> ROOT CAUSE -> NEW CHECK -> OS/ERRATA.json -> next boot catches it

The close doctor (OS/STOP) records what went wrong, what new check it
created, which file the check lives in, and the Protocol revision bump.
The OS updates itself only through the close doctor. Never through
chat. Never through an agent's improvisation.

First three ERRATA rows to add now:
  E-001  mistake: loaded 7.1 punch list
         check:   no 7.1 source in the boot reading path
  E-002  mistake: created duplicate task names
         check:   no task name appears in more than one source
  E-003  mistake: memory injected at boot
         check:   no memory file in the boot path

THE HARD RULES (DO NOT REOPEN)
------------------------------
  - No Vault inside a Vault
  - One queue: the Builder is the only queue
  - One home: pointers only, no copies
  - Never paraphrase: write another Page
  - Insulin-Lock: pointer Pages only
  - Everything must be accounted for: use [OPEN] NO BOOK
  - Memory is never loaded as instruction
  - The OS wins over the Builder, always
  - Read fresh: never cache, never guess
