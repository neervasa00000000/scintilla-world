# See-the-Route

**Accessibility stress tester for map & routing UIs.**

Built by [Neer Vasa](https://github.com/neervasa00000000) · Monash MIT · [scintilla.world](https://scintilla.world)

## Problem

Popular map and route interfaces often encode meaning with colour alone — transit lines, traffic, legends, pins. Those encodings can collapse for people with colour vision deficiency (CVD) or low vision. Teams rarely see the failure until a demo or complaint.

## What it does

1. **Upload** a PNG/JPG screenshot of any map/route UI (client-side only).
2. **Simulate** Normal, Protanopia, Deuteranopia, Tritanopia, and Low vision side-by-side.
3. **Flag** likely colour-only / contrast risks with High / Medium / Low severity.
4. **Export** a one-page **Accessibility Stress Card** PNG for email, slides, or papers.

No accounts. No backend. No LLM.

## Method

- **CVD model:** Machado, Oliveira & Fernandes (2009) linear-RGB 3×3 transforms at severity 1.0, applied after sRGB→linear decode. Documented in-app under Method.
- **Low vision:** mild separable blur + contrast compression toward mid-grey.
- **Heuristics (honest):** red–green separation collapse, legend-like chip confusion, local edge-contrast drop, luminance-similar red/green adjacency.  
  *Heuristic flags for research demos — not a WCAG audit.*

## Research question

> How often do popular route/map UIs fail under CVD and low vision?

## Run locally

```bash
cd see-the-route
npm install
npm run generate-samples   # once
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build / deploy

```bash
cd see-the-route
npm run build
```

Static export lands in `see-the-route/out`.

### Vercel

From `see-the-route/`:

```bash
npx vercel
```

Or set the Vercel project root to `see-the-route`.

### Netlify (scintilla.world)

Repo `netlify.toml` builds this app and publishes `see-the-route/out` as the site root.

## Author

**Neer Vasa** · Monash MIT  
- https://scintilla.world  
- https://github.com/neervasa00000000
