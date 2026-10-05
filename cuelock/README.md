# CueLock

Run locally with `npm ci && npm run dev`. Use `npm run verify:demo` to check that the original Melbourne cues fail and the suggested encodings pass. `npm run build` creates the static site in `out/` for Netlify.

CueLock opens on a real OpenStreetMap street map. Designers can pan and zoom anywhere, draw routes or place markers directly, or import GeoJSON Point, LineString, and MultiLineString features. A schematic fallback stays available when street tiles cannot load. The app also includes Melbourne, transit, and evacuation presets; cue editing; simulated colour vision modes; and report exports. The simulation changes cue colours only, not the underlying street tiles.

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
