# Scintilla World - Project Structure

## 📁 Directory Organization

```
scintilla-world/
├── website/              # Main website files
│   └── index.html       # Homepage
│
├── assets/              # Shared assets (images, logos, etc.)
│   └── logo/           # Logo files
│       ├── scintilla.png
│       ├── FFBE98.png
│       └── nutrithrive-enhanced.png
│
├── tools/              # Web tools and utilities
│   └── crazy-ideas/   # Individual tool projects
│       ├── calendar-reminder/
│       ├── clothes-size-finder/
│       ├── convoter/
│       ├── cost-per-serve/
│       ├── earning-finder/
│       ├── hex-colour-finder/
│       ├── Image-Enhancer/
│       ├── place-near-me/
│       ├── quick-recipes/
│       └── sleep-cycle-calculator/
│
├── extensions/         # Chrome extensions
│   ├── SynapseSave/   # Main extension
│   └── big-test/      # Test extension
│
├── docs/              # Documentation files
│   ├── README.md
│   ├── DEPLOYMENT.md
│   ├── QUICK-START.md
│   └── SETUP-COMPLETE.md
│
├── blogs/            # Blog posts (future)
│
├── netlify.toml      # Netlify deployment configuration
├── vercel.json       # Vercel deployment configuration
└── CNAME             # Custom domain configuration
```

## 🎯 Purpose of Each Folder

### `website/`
Contains the main website homepage and core website files. This is the entry point for `scintilla.world`.

### `assets/`
Shared assets used across the entire project:
- **logo/**: Logo files and brand assets
- Future: fonts, shared CSS, images, etc.

### `tools/`
All web-based tools and utilities:
- Each tool is self-contained in its own folder
- Tools are accessible via `/tools/crazy-ideas/[tool-name]/`

### `extensions/`
Chrome browser extensions:
- Each extension is self-contained
- Extensions are accessible via `/extensions/[extension-name]/`

### `docs/`
Project documentation:
- Setup guides
- Deployment instructions
- Project structure (this file)

## 🔗 URL Structure

- **Homepage**: `https://scintilla.world/` → `/website/index.html`
- **Tools**: `https://scintilla.world/tools/crazy-ideas/[tool-name]/`
- **Extensions**: `https://scintilla.world/extensions/[extension-name]/`
- **Assets**: `https://scintilla.world/assets/[asset-path]`

## 📝 Notes

- All paths use absolute URLs from root (`/assets/...`, `/tools/...`)
- Netlify handles routing via `netlify.toml`
- Favicon path: `/assets/logo/scintilla.png`


