# PixelPet - Virtual Pet Game Extension

A virtual pet game built with React, TypeScript, Firebase, and Tailwind CSS.

## Features

- Virtual pet with multiple actions (idle, walking, eating, sleeping, happy, fighting, levelup)
- Leveling system with XP
- Multiplayer support via Firebase
- Real-time stats (hunger, happiness, energy)
- Beautiful pixel art panda character

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
   - Update `popup.html` and `index.html` with your Firebase configuration
   - Replace the placeholder values in the `__firebase_config` script tag

3. Build the extension:
```bash
npm run build
```

4. Load the extension:
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder (or the root folder for development)

## Development

Run the development server:
```bash
npm run dev
```

## Project Structure

- `App.tsx` - Main React component with game logic
- `src/main.tsx` - React entry point
- `popup.html` - Extension popup HTML
- `index.html` - Standalone page HTML
- `manifest.json` - Chrome extension manifest
- `vite.config.ts` - Vite build configuration

## Firebase Setup

You'll need to:
1. Create a Firebase project
2. Enable Authentication (Anonymous and Google)
3. Create a Firestore database
4. Set up the following Firestore structure:
   - Collection: `artifacts/{appId}/public/players`
   - Document structure matches the `PlayerData` interface

## Notes

- The game works in offline mode if Firebase is not configured
- Player data syncs every second when online
- Multiplayer features require Firebase configuration


