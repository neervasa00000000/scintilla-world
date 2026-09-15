# See-the-Route

In-browser **CVD confusable-pair instrument** for map and route UIs.

Neer Vasa · Monash MIT · [scintilla.world](https://scintilla.world) · [github.com/neervasa00000000](https://github.com/neervasa00000000)

## What it does

1. Open / paste / capture a map or route screenshot.
2. Simulate Normal, Protanopia, Deuteranopia, Tritanopia (Machado et al. 2009).
3. Detect **confusable colour pairs** with CIEDE2000 collapse + bounding boxes.
4. Eyedropper-probe any two pixels; live ΔE under each CVD mode.
5. Optional A/B compare and evidence-style PNG report.

Low-vision blur/contrast is an optional preview — never auto-merged into CVD findings.

## Method

- **CVD:** Machado, Oliveira & Fernandes (2009), linear-RGB severity 1.0.
- **Distance:** CIEDE2000 on simulated sRGB colours.
- **Flags:** pairs distinguishable in Normal (ΔE ≥ min) that fall below threshold under CVD.
- Heuristic research instrument — **not** a WCAG audit.

## Research question

How often do popular route/map UIs fail under CVD when meaning is hue-encoded?

## Run

```bash
cd see-the-route
npm install
npm run generate-samples
npm run dev
```

## Build

```bash
npm run build
```

Static export → `out/` (published via repo `/deploy` on Netlify).
