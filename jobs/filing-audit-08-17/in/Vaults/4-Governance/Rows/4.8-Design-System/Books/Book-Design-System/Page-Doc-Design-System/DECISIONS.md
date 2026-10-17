# Design system decisions
edition : Original
status : DONE
date : 2026-10-15

One rule per category, for every GluMira surface: the Production Builder, glumira.app and glumira.ai. Each rule names the founder's words that decide it (ids in `LEDGER.md`). Colour values come from the glumira-color-method skill and its swatch board in `docs/04_Brand`, never from this page's own taste. The founder approved the Design System page on 2026-10-15, verbatim: "Approve (Recommended)".

His words decide each rule; where a rule needs a number he never gave (a px value, a count of levels), the number is the council's choice and is said so. How it was decided: a council of three seats (audit, design, engineering) answered the same twelve questions on 2026-10-15; the chair settled each one. Where a seat disagreed, the dissent is kept at the end.

## D-01 Capitals

Sentence case for tabs, pane titles, headings, buttons, links and body. One named exception, the eyebrow: a small section label in capitals, 11px, weight 400, tracking 0.06em, muted ink. Acronyms keep their letters (IOB, PK, AI).
Decided by L-001, his latest word (10:54): "Smaller more discreet caps no caps", with his crop of the tab row (image 17). His UI-kit mood board agrees: section titles in sentence case, capitals only on tiny labels.

## D-02 Corners

Three radii, by role. 0 for structure (header bars, pane edges, dividers). 4px for controls (button, input, select, chip, tab marker, table row). 8px for containers (card, menu, toast, open card). Round only for things that are physically round: the toggle, the slider thumb, the status dot. No pill buttons.
Decided by L-001 ("rounded edges and square edges" mixed is the defect). The three values are the council's choice, from the 4, 8 and 12px steps of his mood board.

## D-03 Alignment

One grid. Row 1 (brand and small icons) 48px. Row 2 (tabs, status, chat controls) 40px, its cells on the same x as the panes below. Every pane starts with a pane head, 40px, always drawn, the chat pane too. The first content line sits 8px below the pane head, the same y in every pane. Gutter 16px. Pane lines 1px, from below row 2 to the bottom of the screen. Scrollbars start at one y. Every height is a multiple of 4.
Decided by L-003, L-004, L-005, L-006 and the green line on his image 18. The cause in the Builder today: the three panes begin with a label, a heading with an extra top margin, and a message card, and row 2 uses 16 or 20px over panes padded 24px.

## D-04 Type

Hanken Grotesk for every interface; ui-monospace for times and ids only; Fraunces only for website display headings (h1, h2), never in the Builder. Weights 400 and 600 only; 600 is for headings and sub-headings, never for links or body.
Builder (renders at 125%): body 13/20, the one body size; meta 11/16 for the eyebrow, times and ids only; heading 15/20; title 18/24.
Websites: body 16/24; h3 18/24; h2 22/28; h1 32/40.
Decided by L-046 "unify text size", L-045 bold only for headings, L-047 "bold of links is disturbing", L-049 "The one you do now" (the three families). L-056 Calibri was for the Jev picker page only.

## D-05 Spacing and density

Scale 4, 8, 12, 16, 24, 32 (websites add 48, 64). 8 inside a component, 12 between list rows, 16 for pane padding and between groups, 24 between sections. Never shrink type to make content fit: move it behind navigation.
Decided by L-033 "so much white space", L-041 "Make you screen margins smaller" and L-042 "too conjested" (compact, never cramped), and L-051 "just making something smaller ruins the design" (never shrink type). Moving content behind navigation is L-023. The scale values are the council's choice.

## D-06 Buttons

One height: 32px in the Builder, 40px on the websites. Radius 4, padding 0 16, label at body size, weight 400, sentence case.
- Gold: the bottom band of the gold gradient only, navy label. Nothing else carries the gold band: toggles, slider thumbs, progress bars and step ticks use the navy family. Only the one forward action of a view: Send in the Builder; one call to action per section on the websites. Always on the right.
- Standard: raised navy fill, 1px line, ink label.
- Quiet: text only, muted, ink on hover (Clear, Save idea, Load, Park).
States: hover moves one step toward the colour's own shadow; pressed shows an inner shadow; disabled at 50% with no light; loading keeps its width and label and shows the three-bar loader.
Decided by L-069 "Agent misunderstood and made all buttons that gold", L-067 "We only use the bottom part of the gradient", L-065, L-066 "replace yes write prompt with send and move right", L-004 "Next is never left".

## D-07 Icons

One glyph size, 14px, one outline set (Streamline Core Line, its line as it ships: 1px at 14px). Hit area 28px, 4px between hit areas. No circle, ring or fill behind an icon. The shield logo is the named exception.
Decided by L-074 "compact icon spacing and make them smaller", L-075 "all tttthe same", L-077 "remove circles from icons", L-076.

## D-08 Shadows

Two levels and one inner shadow, all mixed from the deepest navy, never black, never lighter than the surface that casts them. They fall down and to the left, away from the light.
- Rest (cards, buttons): -1px 2px 4px.
- Raised (menus, toast, a card opened next to its menu): -3px 8px 20px.
- Inner (pressed button, input): inset -1px 1px 2px.
Every raised surface also carries a lit edge on its top and right: one step lighter in its own family, never white.
Decided by L-092 "ave you ever seen a shadow that is lighter than it's owner" (never lighter), L-090 "light from right makes design alive" (the direction), and the colour method (never black). Two levels, not three, keep it quiet in the spirit of L-095 "Beautiful quiet statement"; the offsets are the council's choice.

## D-09 Light

Light comes from the top right. Surface gradients run at 225 degrees, from the lit step to the base. The ground stays flat: a gradient that wide shows as horizontal bands, and L-094 says "I dont want solid horizontal lines it must be blended". Light shows on raised surfaces and buttons. Gloss is the colour's own lighter band, never white mixed in. Light never touches body text, data, charts, inputs' text, the disclaimer or the footer, and nothing moves.
Decided by L-090 "light from right makes design alive", L-069 "see light streak coming from right top - do the same", L-091 "your gloss adds white - that is not gloss it is diluting color", L-096.

## D-10 Heading colour

Headings and sub-headings use the third colour: navy lifted with bone, the step that reads on its ground. Dark theme navy-300 #ABB0B9 (7.1:1 on navy). Light theme navy-500 #636F84 (4.7:1 on bone), the same step as his "navy +35% white". Gold leaves headings.
Decided by L-046 "Give me a third color for the headings / Use the darkest blue toned with white to make a lighter non intrusive blue" (08:33) and L-060 "navy +35% white - show" (08:36). These replace his earlier mark-up L-059 "HEADING IN GOLD" (07:14) the same morning; L-059 is the ruling this one supersedes, not support for it. On dark navy that step reads 3.1:1, too faint for "i am old and half blind" (L-104), so the dark theme uses the next lighter step of the same ramp.

## D-11 Gold text

Gold text is #C9A24B and sits only on navy: the GluMira word, the active tab mark, card ids. Row 1 and row 2 stay navy in both themes, so the gold word always has its navy.
Decided by L-101 "USE THIS" and L-102 "the gold is too much". #C9A24B reads 6.5:1 on navy and 2.2:1 on bone.

## D-12 Borders and dividers

One thickness, 1px, soft. A border only on fields you type in and on structural dividers. Cards are set apart by their fill and the rest shadow. Notes and disclaimers sit on the ground with no box. The footer is the thin navy strip with the two logos, the one footer everywhere (L-087), with its disclaimer on the strip and no box around it. Table heads are sentence case: capitals stay in the eyebrow (D-01).
Decided by L-084 "Remove borser from disclaimer and have it sit on bCKGROUND", L-083, L-086 "line contast must be a lot softer".

## D-13 Components

Card, button, icon button, input, textarea, select, toggle, slider (large thumb, L-072), three-bar progress (L-096), toast, a card that opens next to its menu instead of a modal (L-023; a modal only to confirm), table row, tabs, status dot with text, pane head, eyebrow, step list with a tick in the left margin (L-024), empty state, the thin two-logo footer (L-087), shield and wordmark (L-080, L-081).

## Dissents kept

- Audit seat: small capitals also on the tab row. Not taken: his "disappointing" crop (image 17) is exactly the tab row.
- Audit seat: "navy +35% white" in both themes. Not taken for the dark theme: it reads 3.1:1 there.
- Engineering seat: one radius for everything. Not taken: two of three seats and his mood board separate controls from containers.
- "Resting state is light; interaction walks toward the shadow" comes from `docs/04_Brand/Living-Light-Shadow-Application_v1.0.md`, a method plan, not his own words. It is filed as method.
- Open for the founder: a 2026-08-13 ruling (Nabucco) says design councils are "hyped tools"; the 2026-08-11 working style asks for one when a UI item is argued more than twice. This system used one.
