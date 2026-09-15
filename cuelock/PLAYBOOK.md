# CueLock playbook — acceptance loop

Run this after every change. If any step fails, fix wiring before adding UI.

## Automated sanity (no browser)

```bash
cd cuelock
npx --yes tsx -e "
import { loadMelbourneDemo, applyFix, runCheck } from './src/lib/store.ts';

const demo = loadMelbourneDemo(15);
console.assert(!demo.lastResult!.summary.pass, '1 demo must FAIL');
console.assert(demo.lastResult!.summary.failCount >= 1, '2 has failures');

const fixed = applyFix(demo.cues, 15, 'melbourne');
console.assert(fixed.fixChanges.length > 0, '3 fix mutated cues');
console.assert(fixed.lastResult!.summary.pass, '4 fix must PASS');
const alt = fixed.cues.find(c => c.role === 'route_alt')!;
console.assert(alt.secondaryEncoding.pattern === 'dashed', '5 backup dashed');
const hazard = fixed.cues.find(c => c.role === 'hazard')!;
console.assert(hazard.secondaryEncoding.icon === 'triangle', '6 hazard triangle');
console.assert(hazard.secondaryEncoding.labelOnMap === true, '7 hazard labeled');

const again = runCheck(fixed.cues, 15, 'melbourne', fixed.fixChanges);
console.assert(again.lastResult!.summary.pass, '8 re-check still PASS');
console.log('PLAYBOOK OK', {
  failCount: demo.lastResult!.summary.failCount,
  fixChanges: fixed.fixChanges,
});
"
```

## Manual (browser)

1. Open app (fresh load) — Melbourne demo auto-loaded, map shows green + red routes + pins.
2. Status strip shows FAIL with a number ≥ 1; Problems cards show real titles + `difference N → M`.
3. Click **Fix automatically** — backup route becomes **dashed** (visible), hazard becomes **triangle + label**.
4. Status shows PASS; right panel shows green Fixed panel with what changed.
5. Click **Copy testing report** — toast “Testing report copied”; paste contains cues + ΔE / PASS result.
6. Click **Melbourne demo** again — back to FAIL; repeat Fix → PASS.

## Definition of done

Demo → FAIL → Fix → PASS → Copy report works every time with real math and real map updates.
