# GluMira Colour Mixer

The founder's colour method as a live tool. Open `colour-mixer.html` in a browser: it needs no server and nothing to install.

## The method

Three primaries make every colour: Winsor & Newton Cobalt Blue, Permanent Alizarin Crimson and Yellow Ochre. White lifts the value. Black is used only when a truly dark tone is needed. A colour's light is mixed from one or two primaries. Its shadow is the same colour muted by a single drop of the third primary (the arsenic principle). A shadow is never lighter than its light.

- `method/COLOUR-METHOD.md` is the full method.
- `method/MIXER-RULINGS.md` holds the founder's rulings on the tool, in his own words.
- `method/` also holds the palette canon and the swatch board, `GluMira-Color-Swatches_v1.0.html`.

## The tool

- Mixer on the left: one tab per colour (Gold, Gold text, Navy, Light navy, Bone, Blue group, Green group, Sapphire sheen, Green sheen).
  - Light: parts of each paint.
  - Shadow: drops of Cobalt, Alizarin, Ochre and Black, plus Depth. 1-1-1 adds one drop each of Cobalt, Alizarin and Ochre.
  - Gradient: Feather, More yellow, Brightness, Body at, Bright at, Highlight, Shadow at, Shadow width, Shadow strength, Gloss.
  - Lock copies the CSS.
- Mood board on the right: a UI kit painted live in the mixed colours. It switches to the full colour chart; click a swatch to mix toward it.

## How the paint is mixed

The tool mixes the way paint does (spectral Kubelka-Munk), not by blending screen colours. Each pigment has a smooth reflectance curve, and its strength was fitted to the recipes in `method/App-Locked-Palette_v1.0.md`.

The page is built from the files in `source/`:
- `head2.html` and `body2.html` give the layout.
- `params.js` and `engine2.js` are the paint engine.
- `chartdata.js` is the colour chart.
- `app2.js` is the logic.

`spec.js`, `fitspec.js` and `fitc.js` are the fitting scripts that produced `curves.json` and `cobalt.json`.

Two limits of real paint:
- Navy mixes to #192C4F, against the locked #102347.
- Sapphire #1160F0 is beyond what paint can mix.
