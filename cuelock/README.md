# CueLock

**Semantic Navigation Cue Verifier** for web maps.

CueLock answers one question:

> If this map encodes navigation meaning in colour, does that meaning survive protanopia / deuteranopia / tritanopia — and is there a non-colour backup cue?

Neer Vasa · Monash MIT · [scintilla.world](https://scintilla.world) · [github.com/neervasa00000000](https://github.com/neervasa00000000)

## Problem

Route UIs routinely encode critical roles (active route, alternate, hazard, destination) as hue. Colour-vision simulators exist, but they do not verify **semantic cue survivability** with a dual-encoding gate, and they do not emit CI-ready evidence.

## Related work (how CueLock differs)

| Tool | What it does | Gap CueLock fills |
| --- | --- | --- |
| [Color Oracle](https://colororacle.org/) (Jenny) | OS-level CVD screenshot filter | No semantic roles, no dual-encoding rule, no CI report |
| Sim Daltonism | Live CVD filter | Same — perception, not navigation-cue verification |
| TextureMap / Map Colouriser | Map colour advice | Not a verify gate for route-role pairs |
| AccessMap | Accessible routing research | Domain-specific product, not a general cue verifier |

CueLock’s angle: **named Cue roles + CIEDE2000 under Machado 2009 + dual-encoding rescue/fail + machine-readable evidence**.

## Method

1. Represent navigation meaning as `Cue` objects (`route_active`, `route_alt`, `hazard`, `destination`, …) with colour + secondary encoding (pattern / width / icon / label).
2. Simulate cue colours with **Machado, Oliveira & Fernandes (2009)** dichromacy matrices.
3. Measure pairwise distance with **CIEDE2000**.
4. **Fail** a critical pair when ΔE under CVD drops below threshold **and** secondary encodings are identical (colour-only encoding).
5. **Pass** when secondary encodings differ even if hue collapses (dual-encoding rescue) — the map still carries meaning via pattern/icon/label.

Heuristic research instrument — not a formal WCAG audit.

## Research question

When route UIs encode critical navigation roles in colour, how often does meaning collapse under CVD without secondary encoding?

## Demo (Melbourne)

1. Open the app — Flinders St → Melbourne Central loads with a deliberately bad hue-only palette.
2. **Run verify** → FAIL with named pairs and ΔE (e.g. active green vs alt red under deuteranopia).
3. **Apply safe encoding** → dashed alt route, hazard triangle + label, destination label → PASS.

## Run

```bash
cd cuelock
npm install
npm run dev
```

## Build / deploy

```bash
npm run build   # static export → out/
```

## JS API (browser / CI)

```js
// In the browser console after load:
window.cuelock.verify(cues, { threshold: 15 })
```

Node / Action:

```ts
import { verifyCues } from "./src/lib/verify";
const report = verifyCues(cues, { threshold: 15 });
if (!report.summary.pass) process.exit(1);
```

See `.github/workflows/cuelock-ci.example.yml`.

## Scintilla bridge

Point CueLock at Scintilla / MapLibre route layers by exporting features as GeoJSON with properties:

```json
{
  "properties": {
    "id": "route-active",
    "role": "route_active",
    "colour": "#22c55e",
    "label": "Active route"
  }
}
```

Import via **Import GeoJSON route**, assign secondary encodings in the cue table, then **Run verify**. For live Scintilla builds, call `window.cuelock.verify(cues)` from the map app after reading paint properties from your style layers.

## Export

- `cuelock-evidence.png` — annotated evidence card
- `cuelock-report.json` — CI machine report
- `cuelock-report.md` — PR / paper summary

## Author

**Neer Vasa** · Monash MIT  
https://scintilla.world · https://github.com/neervasa00000000
