# GluMira Living Light/Shadow — Application Plan v1.0

**Date:** 2026-06-14 · **Source:** founder colour method ([[founder-color-method-three-primary-light-shadow]]) + 5-agent page review (`wf_4857c8b1-90f`), firewall-verified (ok, 0 violations). **Not wired** — plan + proof for sign-off.

## The method, in CSS terms (the digital translation)
Paint is subtractive (3 primaries → dark); RGB is additive. So we DON'T add black or RGB-mix to darken. We **pre-mix the shadow as a real hex** (the 3-primary paint-mix result) and run a gradient **light-stop → its-own-shadow-stop**, lightening highlights with white. The shadow's temperature is a dial: warm (yellow+red dominant) for gold/earth; cool (cobalt+alizarin dominant) for sapphire/violet.

| Family | Highlight (white-lightened) | Light (1–2 primaries) | Shadow (3-primary mix — NEVER black) |
|---|---|---|---|
| `.ai` gold (warm) | `#E8D9B5` | `#C9A24B` | `#8B6F47` (warm earth) |
| `.app` sapphire (cool) | `#92C5E0` | `#5B9BC8` | `#0D3D52` (cool violet-dark) |
| `.app` dark-mode Aegean | `#C4E8FA` | `#8DD5F0` | `#1B4A62` |
*(Starting anchors — to be PINNED to your exact swatch hexes when wiring. Cobalt Blue + Permanent Alizarin Crimson + Yellow Ochre.)*

## What comes ALIVE (light → mixed-shadow gradients)
- `.ai`: clinical-UI card surfaces (ClinicalModeller/Dashboard cards), gold accents + focus rings, dividers; buttons deepen toward shadow on hover/active (resting = light).
- `.app`: suite card surfaces + section bands, Aegean/sapphire chrome accents, headings/wordmark; buttons on hover/active.
- Rule: resting state = light; interaction (hover/focus/active) = walk toward the mixed shadow.

## What STAYS FLAT (the firewall — verified)
- **Clinical data:** IOB gold `#C9A24B`, glucose `#1A5FB4`, all chart colours — locked solid in chart JS, never gradient.
- **Body text + headlines + data labels:** solid, WCAG-AA — reading text is never a gradient.
- **Grounds:** bone `#F7F6F1`/`#F7F5EF`, paper, parchment, vellum plates — the calm canvas doesn't animate.
- **Elevation drop-shadows:** keep the current subtractive navy shadow system (not a colour gradient).
- **White** used freely to lighten; **black** only where absolutely necessary.

## Open question for the founder
The review kept the `.ai`/`.app` **landing identity surfaces** (hero, footer, brand bands) FLAT as brand locks. Your "bring it to life everywhere" intent may want those animated too. **Decision needed:** living treatment on the landing identity surfaces as well, or interior/chrome + interaction only (landing stays the flat brand anchor)?

## RESONANCE (founder, 2026-06-14) — sets each painting's shadow foundation
- **`.app` = GREEN resonance.** The shadow foundation leans green (Yellow Ochre + Cobalt, Alizarin to deepen). Sage/forest is the *world*; sapphire is the *jewel* that sparkles against it. Every `.app` colour — and the insulin-graph chrome — rides this green-biased shadow.
- **`.ai` = NAVY-BLUE + gold light.** Navy is the world/shadow foundation (Cobalt + Alizarin, Ochre to warm); shiny gold is the light that moves across it.
- **Mood is tuned by the SHADOW bias**, not the light: bluer shadow → bluer mood; redder shadow → darker. Light = the "yellow strokes"/subject; shadow = the foundation everything rides → cohesion.

## Insulin graphs — "in the same range" WITHOUT breaking the lock
The founder's note "your curve isn't a colour match, not in the same range" = chart colours were chosen off the shared foundation. **Resolution (Insulin-Lock-safe):** the LOCKED data hues do NOT move — IOB gold `#C9A24B` and glucose `#1A5FB4` stay exactly as frozen (non-neg #1 + data-colour law). What comes *into range* is the chart's **non-data chrome** — plate/background, gridlines, axis labels, zone fills — re-tuned to ride the `.app` green-resonance shadow foundation, so the locked data lines read as belonging to the painting instead of floating on a foreign background. Any change to engine/chart files is Insulin-Lock-gated (`APPROVE-INSULIN-EDIT`).

## Separation + locks held
`.ai` (navy+gold) and `.app` (sage+sapphire+green) stay separate; bone is the only shared connector; clinical firewall intact. Verifier: ok, 0 violations.
