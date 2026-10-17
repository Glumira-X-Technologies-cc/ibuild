# GluMira design system
edition : Original
status : DONE
date : 2026-10-15

The brand book of the Design System page (https://claude.ai/artifact/3wTaQQBLaUxScnAhmveH5r), where every component has a live preview and its guideline. This file and `Page-Prog-Design-System` (tokens.json, tokens.css, bundle.css) are the repo copies; the page is the viewer. Change a rule here first, then publish the page.

One rule per category, for every GluMira surface: the Production Builder, glumira.app and glumira.ai. Every rule below comes from the founder's own words; the id in brackets (L-001) finds them, word for word with source and date, in the ledger: Glumira-7.2, `Vaults/4-Governance/Rows/4.8-Design-System/Books/Book-Design-System/Page-Doc-Design-System/LEDGER.md`. The decisions are `DECISIONS.md` beside it (D-01 to D-13). If a screen needs something this system does not have, add it here first, then build it. Never a one-off.

## How to use it

- Load `tokens.css` and `components/bundle.css`. Build from the `gm-` classes. Never write a loose hex, size, radius or shadow.
- Colour is the founder's painting method (the glumira-color-method skill and `docs/04_Brand`). Never ask him a colour question; take the role tokens here.
- The insulin charts and the PK engine are under the Insulin-Lock. This system styles the chrome around a chart, never the chart.

## Content

- Plain words, short sentences, sentence case. No em dashes (L-117). No emoji.
- Never invent text or taglines: use what the repo has (L-116).
- Write what a person recognises: "Save idea", "Send", "Builder running".
- Times as 09:25 or am / pm, never "a" and "p" (L-119). Dates as 15/10/26 in the Builder.
- Never put agent notes or reminders on his screens: "no periwinkle is your reminder not mine. Stop adding your notes on my ui" (L-098).
- No dark or cryptic names: "I don't want death, I don't want ghosts, I don't want skeleton" (L-118).

## Capitals (D-01)

Sentence case everywhere: tabs, pane titles, headings, buttons, links, body. The one place for capitals is the eyebrow (`gm-eyebrow`, style `b-eyebrow`): 11px, weight 400, tracking 0.06em, `muted`. Acronyms keep their letters (IOB, AI). His words: "Smaller more discreet caps no caps" (L-001).

## Type (D-04)

- Hanken Grotesk for every interface (`font-sans`), ui-monospace for times and ids (`font-mono`), Fraunces for website display headings only (`font-display`). "The one you do now" (L-049).
- One body size: `b-body` 13/20 in the Builder (it renders at 125%), `w-body` 16/24 on the websites. "unify text size" (L-046).
- Weights 400 and 600 only. 600 is for headings and sub-headings, never for chat text, buttons or links. "Bold reserved for headings and sub headings" (L-045); "bold of links is disturbing" (L-047).
- Headings in `heading`, the third colour. Body in `ink`. Meta in `muted`.
- Never shrink type to make something fit: "just making something smaller ruins the design" (L-051).

## Colour roles

- `ground`, `raised`, `overlay`: the three surfaces. `header`: row 1 and row 2, navy in both themes.
- `ink` (body), `heading` (headings, navy lifted with bone, D-10), `muted` (meta and quiet buttons).
- `gold-text` (#C9A24B) only on navy: the GluMira word, the active tab mark, card ids (D-11). "USE THIS" (L-101); "the gold is too much" (L-102).
- Gold fill only on the one forward action: `gold-band-top` to `gold-band-bottom`, "We only use the bottom part of the gradient" (L-067).
- Every blue is a step of the navy ramp (`navy-950` to `navy-150`): "your blue is not from the same base color dark blue" (L-099).
- `success`, `warning`, `error` only as a status dot with a word beside it.

## Corners (D-02)

`radius-0` for structure (bars, pane edges, image slots), `radius-1` (4px) for controls, `radius-2` (8px) for containers. `radius-round` only for things that are physically round: toggle, slider thumb, status dot. No pill buttons, no pill chips. His words: "rounded edges and square edges" mixed was the defect (L-001).

## The grid (D-03)

- Row 1 `row-1` (48px): shield, name, small icons. Row 2 `row-2` (40px): tabs, status, chat controls, its cells on the same columns as the panes.
- Every pane starts with a pane head `pane-head` (40px), always drawn. The first content line sits `space-2` below it, the same height in every pane.
- Gutter `gutter` (16px). Pane lines 1px from below row 2 to the bottom, never cut. Scrollbars start at one height.
- Controls left-aligned; the forward action always on the right. "Next is never left" (L-004); "Lines like this should line up and controls should be left aligned - i read from left to right" (L-003); "All horizontal lines must align 100% on all screen sizes" (L-005).
- The Builder is desktop only and opens at 125% (L-110, L-109). The websites are designed desktop first and the phone view is derived (L-112).

## Spacing (D-05)

`space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 24, `space-6` 32; websites add `space-7` 48 and `space-8` 64. 8 inside a component, 12 between rows, 16 pane padding and between groups, 24 between sections. Compact, never cramped: "so much white space" (L-033) and "too conjested" (L-042) are both defects.

## Light and shadow (D-08, D-09)

- Light comes from the top right: "light from right makes design alive" (L-090). Surface gradients run at `light-angle` (225deg) from the lit step to the base; a raised surface has a 1px lit edge on its top and right (`raised-lit`).
- Shadows fall down and to the left, mixed from `navy-950` (`shadow-ink`), never black and never lighter than their owner: "ave you ever seen a shadow that is lighter than it's owner" (L-092). Two levels: `shadow-rest` (cards, buttons) and `shadow-raised` (menus, toast, open card); `shadow-inner` for pressed buttons and fields.
- Gloss is the colour's own lighter band, never white mixed in: "your gloss adds white - that is not gloss it is diluting color" (L-091).
- The ground stays flat: a wide gradient shows as horizontal bands, and "I dont want solid horizontal lines it must be blended" (L-094). Light shows on raised surfaces and buttons only.
- Light never touches body text, data, charts, field text, the disclaimer or the footer. Nothing animates: "the small three bar visual" (L-096).

## Borders (D-12)

One thickness, `border-1` (1px), soft. A border only on fields you type in (`line-input`) and on structural dividers (`line`). Cards are set apart by fill and shadow. Notes and disclaimers sit on the ground with no box; the footer is the thin navy strip with the two logos (L-087), the one footer everywhere: "Remove borser from disclaimer and have it sit on bCKGROUND" (L-084).

## Buttons (D-06)

One height (`control-h` 32px Builder, `control-h-web` 40px websites), `radius-1`, body size, weight 400, sentence case. Gold (`gm-btn--send`) only for the one forward action of a view, on the right. Standard (`gm-btn`) for the rest. Quiet (`gm-btn--quiet`) for Clear, Load, Park. "Agent misunderstood and made all buttons that gold" (L-069).

## Iconography (D-07)

- One set: Streamline Core Line (CC BY 4.0), the Icons asset group, credited "Free icons from Streamline" in the footer. Single ink: the SVGs stroke in `currentColor`, so inline them to take `muted` or `ink`; as an `<img>` they show black.
- One size: `icon` (14px) in a `hit` (28px) area, `space-1` apart. No circles, rings or fills behind icons (L-077). "compact icon spacing and make them smaller" (L-074); "all tttthe same" (L-075).
- The logo is the IOB Hunter shield (Logos group), sitting directly on navy, never on a white block (L-081), beside the wordmark everywhere (L-080).

## Named exceptions

| Exception | Rule it bends | Why |
|---|---|---|
| Eyebrow capitals | Sentence case | His "Smaller more discreet caps" |
| Physical round | Three radii | A switch, a thumb and a dot are round |
| Shield logo size | One icon size | It is the brand mark, not an icon |
| Jev picker page font | Hanken Grotesk | His "Change font to Calibri" for that page only (L-056) |

## Checks an adopter adds

Capitals only in `.gm-eyebrow` (table heads too are sentence case). Every radius is a `radius-` token. No black and no `rgba(0, 0, 0` in any shadow; every shadow is a `shadow-` token. Weights 400 and 600 only. The gold band only on `gm-btn--send`. The three pane heads end at the same height.
