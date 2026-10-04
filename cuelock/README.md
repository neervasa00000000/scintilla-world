# CueLock

Run locally with `npm ci && npm run dev`. Use `npm run verify:demo` to check that the original Melbourne cues fail and the suggested encodings pass. `npm run build` creates the static site in `out/` for Netlify.

The on-page Melbourne map is a self-contained schematic preview, so the demo works without map tiles or an API key. The report can be copied or downloaded.

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
