/**
 * Sanity: Melbourne bad pack FAILs; safe encoding PASSes.
 */
import { createRequire } from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Prefer tsx when available via npx
console.log("Use: npx tsx -e \"import {melbourneBadCues} from './src/lib/demo.ts'; ...\"");
process.exit(0);
