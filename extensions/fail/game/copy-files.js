import { copyFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, 'dist');
const distAssetsDir = join(distDir, 'assets');

// Ensure assets directory exists
try {
  mkdirSync(distAssetsDir, { recursive: true });
} catch (e) {
  // Directory might already exist
}

// Copy manifest and icons
copyFileSync(join(__dirname, 'manifest.json'), join(distDir, 'manifest.json'));
copyFileSync(join(__dirname, 'icon16.png'), join(distDir, 'icon16.png'));
copyFileSync(join(__dirname, 'icon48.png'), join(distDir, 'icon48.png'));
copyFileSync(join(__dirname, 'icon128.png'), join(distDir, 'icon128.png'));

// Copy config.js to assets
copyFileSync(join(__dirname, 'src', 'config.js'), join(distAssetsDir, 'config.js'));

// Copy content script to dist root (content scripts go in root, not assets)
const assetsFiles = readdirSync(distAssetsDir);
const contentScriptFile = assetsFiles.find(f => f.startsWith('content-') && f.endsWith('.js'));
if (contentScriptFile) {
  const contentScriptPath = join(distDir, 'content.js');
  copyFileSync(join(distAssetsDir, contentScriptFile), contentScriptPath);
  console.log(`✓ Content script copied: ${contentScriptFile} -> content.js`);
}

// Fix manifest paths
const manifestPath = join(distDir, 'manifest.json');
let manifest = readFileSync(manifestPath, 'utf8');
manifest = manifest.replace('dist/popup.html', 'popup.html');
writeFileSync(manifestPath, manifest);

// Fix popup.html paths - use relative paths for Chrome extension compatibility
const popupPath = join(distDir, 'popup.html');
let popup = readFileSync(popupPath, 'utf8');
// Fix config.js path
popup = popup.replace('/src/config.js', './assets/config.js');
// Remove any remaining source file references (Vite should have replaced these, but just in case)
popup = popup.replace(/<script[^>]*src="\/src\/[^"]*"[^>]*><\/script>/g, '');
// Ensure all asset paths are relative (not absolute)
popup = popup.replace(/src="\/assets\//g, 'src="./assets/');
popup = popup.replace(/href="\/assets\//g, 'href="./assets/');
// Remove crossorigin attributes for Chrome extension compatibility
popup = popup.replace(/\s+crossorigin/g, '');
// Keep type="module" for ES modules (Chrome extensions support ES modules)
// Ensure the main app script has type="module"
popup = popup.replace(/<script[^>]*src="\.\/assets\/(popup-[^"]+\.js)"[^>]*(?!type="module")[^>]*><\/script>/g, '<script type="module" src="./assets/$1"></script>');
writeFileSync(popupPath, popup);

console.log('✓ Files copied to dist/');

