# GluMira Living-Colour System v1.0 (.ai / bone / .app)

**Date:** 2026-06-14 · **Source:** founder living-colour ruling + 6-agent design pass (`wf_69c6659d-308`), adversarially contrast- + separation-verified.
**Law:** colours are **alive = sheen gradients** (deep edge → bright centre → deep edge) on display surfaces (wordmark, headings, hero, dividers, accents). **Body text + clinical data stay SOLID + WCAG-AA** (gradient text is illegible). **Blue, gold and bone: no colour restriction on `.app` or `.ai`** (2026-10-12) — every blue, gold and bone below may be used on either site. Founder, 2026-10-12: *"update color that there are no color restriction for blue and gold and bone for .app and .ai"*. The old split (".ai and .app are separate identities; bone/ivory is the only shared connector") is retired. Still locked, because they are data, not site colour: the clinical lines IOB gold `#C9A24B` and glucose `#1A5FB4` (never chrome).
**Status:** design system, signed-off pending founder; NOT wired. Verifier confirms: all solid text AA/AAA. The live code still uses flat hexes for wordmarks/headings — applying these gradients is the wiring step.

---

## 1 — .ai  (navy + shiny gold)  · top of the stack
- **Navy surfaces (solid):** `#102347` primary · `#0B1733` deep edge.
- **Shiny-gold sheen (gradient — wordmark / dividers / accents / buttons) · LOCKED 2026-10-12, both sites, the one gold everywhere:**
  Founder, 2026-10-12, sent from the slider Lock button: *"Lock this shiny gold"*. The lock, verbatim as sent:
  `background-image: radial-gradient(circle at 30% 40%,rgba(255,255,255,0.00) 0,rgba(255,255,255,0.00) 0.6px,rgba(255,255,255,0.00) 1.6px),radial-gradient(circle at 70% 65%,rgba(255,255,255,0.00) 0,rgba(255,255,255,0.00) 1.3px),radial-gradient(circle at 50% 20%,rgba(255,255,255,0.00) 0,rgba(255,255,255,0.00) 1px),linear-gradient(180deg,rgba(255,255,255,0.00) 4.50%,rgba(255,255,255,0.50) 4.85%,rgba(255,255,255,1.00) 5.00%,rgba(255,255,255,0.50) 5.15%,rgba(255,255,255,0.00) 5.50%),linear-gradient(180deg,rgba(255,255,255,0.60) 0%,rgba(255,255,255,0.25) 38%,rgba(255,255,255,0.05) 49%,rgba(255,255,255,0.00) 50%,rgba(255,255,255,0.00) 100%),linear-gradient(180deg,#BEA106 0%,#C3A609 4%,#C9AD0E 8%,#D0B414 12%,#D7BC1C 16%,#DFC526 20%,#E6CD32 24%,#ECD53F 28%,#F1DC4C 32%,#F5E259 36%,#F8E663 40%,#F9E96B 44%,#FAEB6F 48%,#FAEB6F 52%,#F9E96B 56%,#F8E663 60%,#F5E259 64%,#F1DC4C 68%,#ECD53F 72%,#E6CD32 76%,#DFC526 80%,#D7BC1C 84%,#D0B414 88%,#C9AD0E 92%,#C3A609 96%,#BEA106 100%); background-size: 23px 19px,37px 31px,53px 41px,100% 100%,100% 100%,100% 100%`
  Render-identical working token (pointer, not the rule): the three sparkle layers above are fully transparent (alpha 0.00), so code uses the last three layers as one custom property `--gm-gold-shiny`:
  `linear-gradient(180deg,rgba(255,255,255,0.00) 4.50%,rgba(255,255,255,0.50) 4.85%,rgba(255,255,255,1.00) 5.00%,rgba(255,255,255,0.50) 5.15%,rgba(255,255,255,0.00) 5.50%),linear-gradient(180deg,rgba(255,255,255,0.60) 0%,rgba(255,255,255,0.25) 38%,rgba(255,255,255,0.05) 49%,rgba(255,255,255,0.00) 50%,rgba(255,255,255,0.00) 100%),linear-gradient(180deg,#BEA106 0%,#C3A609 4%,#C9AD0E 8%,#D0B414 12%,#D7BC1C 16%,#DFC526 20%,#E6CD32 24%,#ECD53F 28%,#F1DC4C 32%,#F5E259 36%,#F8E663 40%,#F9E96B 44%,#FAEB6F 48%,#FAEB6F 52%,#F9E96B 56%,#F8E663 60%,#F5E259 64%,#F1DC4C 68%,#ECD53F 72%,#E6CD32 76%,#DFC526 80%,#D7BC1C 84%,#D0B414 88%,#C9AD0E 92%,#C3A609 96%,#BEA106 100%)`
  Layers: specular streak at 5% · clear coat over the top half · feathered gold, top to bottom.
  Gold stops: edge `#BEA106` · body `#E6CD32` · bright `#F8E663` · shine `#FAEB6F`.
  Superseded 2026-10-12: the merged gold `linear-gradient(180deg,#D6B720,#E8CA31 24%,#F5E369 41%,#FFF8B6 50%,#F5E369 59%,#E8CA31 76%,#D6B720)` (locked 2026-10-10, *"lock the merged gold"*).
  Retired, never reuse: the custard quad `#6E5414 · #B8902F · #F0D27A · #FFF6CF` (rejected 2026-07-03 and 2026-10-10: *"this is the mixed custard you forced on me"*).
- **Solid text:** headings `#16233F` (14.4:1) · body `#29313D` (12.1:1) · gold-ink for small gold labels `#7A5C0A` (5.77:1) — all on paper `#F7F6F1`. Navy on gold button `#102347` (6.5:1).
- Chart IOB gold `#C9A24B` stays solid (data only).

## 2 — bone / ivory  · the connector (used by both)
- **Bone (solid ground):** `#F7F6F1` — reconciles `.ai` paper `#F7F6F1` and `.app` paper `#F4F5EF` into one shared neutral. Body copy on bone passes AAA (≈11–13:1 with the ink colours).
- **Bone sheen (optional, large surfaces only):** `radial-gradient(circle at 40% 60%, #FAFAF8 0%, rgba(247,246,241,0.2) 30%, #F7F6F1 100%)` — a whisper, never on text.
- **Hairline:** `#E0DBCF` (dividers/borders only).

## 3 — .app  (greens + sapphire)  · below the bridge
- **Sapphire sheen (gradient — wordmark / hero / sparkle):**
  `linear-gradient(100deg,#04065B,#0B2E8E 28%,#1042C7 44%,#1160F0 52%,#1042C7 60%,#0B2E8E 74%,#04065B)` — the blue of the stone, moving.
- **Botanical-green sheen (gradient):**
  `linear-gradient(100deg,#33422C,#4E6444 30%,#738B6E 50%,#4E6444 70%,#33422C)` — true forest green.
- **Sage canvas (solid surfaces):** `#F4F5EF` paper · `#E6E7DB` card · `#BCC4AC` section.
- **Matte slate (solid calm surfaces):** `#303F46` · `#3C4F5A` · `#455865` · `#506A85`.
- **Solid text:** sapphire body `#0F52BA` (6.5:1 on paper — LOCKED) · forest-green secondary `#4E6444` (5.2:1).
- Chart glucose `#1A5FB4` stays solid (data only) — kept distinct from text `#0F52BA`.

---

## Verifier results
- **Separation:** retired 2026-10-12 — blue, gold and bone are free on both sites. IOB gold + glucose still never repurposed as chrome.
- **Contrast:** ✅ every solid text/data pairing PASS (AA or AAA), recomputed independently.
- **Open (wiring to-do):** wordmarks/headings in `glumiraAiLanding.styles.css` (.ai) and `landing.css`/`.gm-app-theme` (.app) currently flat — apply the gradients above via `background-clip:text` on display elements; leave body text + chart JS solid.
