import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(javascript, filename);
};

const { melbourneBadCues } = require("../src/lib/demo.ts");
const { verifyCues, applySafeEncoding } = require("../src/lib/verify.ts");

const original = melbourneBadCues();
const before = verifyCues(original);
assert.equal(before.summary.pass, false, "Original demo should expose issues");
assert.ok(before.summary.failCount > 0, "Original demo should have failing comparisons");

const after = verifyCues(applySafeEncoding(original));
assert.equal(after.summary.pass, true, "Suggested encoding should pass");
assert.equal(after.summary.failCount, 0, "No comparisons should fail after fixing");
console.log(`Demo verified: ${before.summary.failCount} failing comparisons → 0.`);
