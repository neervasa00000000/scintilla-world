# CueLock

Run locally with `npm ci && npm run dev`. Use `npm run verify:demo` to check that the original Melbourne cues fail and the suggested encodings pass. `npm run build` creates the static site in `out/` for Netlify.

CueLock operates in both **Preset Demo mode** (Melbourne CBD, Transit vs Walk, Evacuation Corridor) and a **Full Custom Map Studio** where designers can upload GeoJSON, edit cue roles, colors, patterns, and marker shapes, toggle live CVD simulation modes (Normal, Protanopia, Deuteranopia, Tritanopia), and export audit reports or evidence cards.

### What CueLock is
Semantic verifier for navigation cues on web maps.

### What it is not
Not the first CVD simulator. Related: Color Oracle, Sim Daltonism, TextureMap, Map Colouriser.

### What’s different
Named roles (main/backup/hazard/destination) + fail if colour collapses under CVD without dual encoding + auto-fix + re-verify + testing report for CI/review.

### Method
Machado et al. 2009 · CIEDE2000 · dual-encoding rule · research instrument, not WCAG certification.

### Author
Neer Vasa · Monash MIT · https://scintilla.world/cuelock · https://github.com/neervasa00000000
