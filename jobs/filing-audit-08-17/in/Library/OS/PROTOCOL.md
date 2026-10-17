================================================================
PART TWO - THE VAN CLIEF PROTOCOL (BINDING)
================================================================

VAN CLIEF PROTOCOL
Agent Operating Contract
----------------------------------------------------------------
name     : Van Clief Protocol
edition  : Original
revision : D
status   : Binding on every agent, every session, every repo
home     : Library/OS/PROTOCOL.md

parties  : The Agent (builder, verifier, or free lane)
           The Estate (the founder, the OS, the Builder)

PREAMBLE
--------
The Estate exists so that every piece of data has exactly one home,
every route is written down, and every agent reads the same rules in
the same order before touching anything. The Van Clief Protocol binds
the Agent to that order. It is not a suggestion. It is a condition of
working in the Estate.

ARTICLE 1 - THE READING ORDER (THE CONSTITUTIONAL ORDER)
--------------------------------------------------------
The Agent shall read, in this exact order, before taking any action:

  1. OS/START
  2. OS/PROTOCOL
  3. OS/GUIDE
  4. OS/REPO-REGISTRY
  5. OS/JEV-MAP
  6. OS/MEMORY-GUARD
  7. OS/CHECK
  8. BUILDER
  9. FOYER.json
  10. Vault -> Row -> Cabinet -> Book -> Page
  11. OS/STOP

If any step fails, the Agent shall STOP. It shall not proceed with a
warning. It shall report and halt. The Agent shall not reorder these
steps. The Agent shall not substitute its own order.

ARTICLE 2 - THE AGENT'S OBLIGATIONS
-----------------------------------
The Agent shall:

  2.1  Confirm the working repo before reading anything else, and
       state it aloud: "I am in repo X at commit Y on branch Z."

  2.2  Read the JEV map fresh on every boot. Never from cache. Never
       from memory. If the live hash differs from the expected hash,
       STOP.

  2.3  Refuse to load any memory file in the boot path. A memory file
       in the boot path is a FLAG, not proof. The Agent reports and
       stops. It does not accuse. It does not proceed.

  2.4  Read the Builder only after the OS. Check the Builder version
       against what OS/CHECK expects. If the Builder is not current,
       STOP and report drift.

  2.5  Route only to destinations that exist in the JEV map. If a
       subject is not in the JEV map, STOP and request a ruling. Never
       invent a destination.

  2.6  Use pointer Pages only. Never copy a body. Never paraphrase.
       If a Book is full, add another Book.

  2.7  Account for everything. If a Vault or Row is empty, mark it
       [OPEN] NO BOOK - unaccounted for. Never leave silence.

  2.8  File only in the Builder. Never in todos, handovers, chat,
       desktop cards, or any other queue.

  2.9  Close with OS/STOP. Save, commit, push. Update the Builder.
       Bump the Protocol revision if any new mistake was found.

ARTICLE 3 - THE ESTATE'S OBLIGATIONS
------------------------------------
The Estate shall:

  3.1  Keep exactly one OS home: Library/OS/. Vault 1 is a pointer.

  3.2  Keep exactly one queue: the Builder. No second queue.

  3.3  Keep the JEV map as the routing authority. FOYER.json is a
       generated view, tied to the same revision.

  3.4  Regenerate JEV-MAP.json and FOYER.json in the same commit
       whenever a Vault or Row changes.

  3.5  Record every mistake as a permanent check in OS/ERRATA.json.
       The OS updates itself only through the close doctor.

  3.6  Provide the Agent with the correct repo, the correct Builder
       version, and the correct JEV revision, on every boot.

ARTICLE 4 - PROHIBITED ACTS
---------------------------
The Agent shall not:

  4.1  Create a Vault inside a Vault.
  4.2  Create a new Vault without the founder's explicit permission.
  4.3  Load a memory file as instruction.
  4.4  Copy a body, paraphrase a rule, or duplicate a name.
  4.5  File outside the Builder.
  4.6  Proceed past a failed check.
  4.7  Edit a file marked do-not-touch. Log it and stop.
  4.8  Route to a destination not in the JEV map.
  4.9  Read the whole Builder when only one card is needed.

ARTICLE 5 - BREACH AND REMEDY
-----------------------------
  5.1  A breach is any act in Article 4, or any failure to perform an
       obligation in Article 2.

  5.2  On breach, the Agent shall:
         a. STOP immediately
         b. report the breach, the path, and the step at which it
            occurred
         c. not proceed
         d. not attempt to fix it by improvisation

  5.3  The close doctor shall record the breach in OS/ERRATA.json as
       a new permanent check.

  5.4  The remedy is not punishment. The remedy is a new check that
       prevents the same breach on the next boot.

ARTICLE 6 - SELF-AMENDMENT
--------------------------
  6.1  This Protocol is amended only through the close doctor.

  6.2  Every amendment bumps the revision line (A -> B -> C).

  6.3  Every amendment adds one row to OS/ERRATA.json.

  6.4  The Agent shall not amend this Protocol from chat. It shall not
       invent a rule. It shall not improvise a remedy.

  6.5  The edition line names the edition in a word, never a number.
       Changing it is an amendment under 6.1 to 6.3, and its ERRATA row
       names the commit before the change. A Page unchanged since that
       commit keeps its old line. Every Page added or edited after it
       carries the new one.

ARTICLE 7 - ACCEPTANCE
----------------------
The Agent accepts this Protocol by restating, before acting:

  1. The boot order (Article 1, eleven steps, the only authority).
  2. The OS home (Library/OS/ only; Vault 1 is a pointer).
  3. The routing authority (JEV owns the records; Foyer is generated;
     revisions must match or STOP).
  4. The memory guard scope (boot path only; a matching path is a flag,
     not proof; an intentional read after JEV routing is allowed).
  5. The repo rule (confirm the repo before reading anything else).
  6. The Builder rule (Builder is inline with OS; OS wins on conflict).

Silence is not acceptance. A partial restatement is not acceptance.
The Agent shall not act until all six are restated in its own words.

ONE-LINE ACCEPTANCE
-------------------
If the Agent cannot say this line back verbatim, it has not read the
Protocol:

  "I read the OS first, confirm the repo, read the JEV map fresh,
   refuse memory in the boot path, verify the Builder is current,
   route only where the map says, file only in the Builder, and
   close with a receipt."
