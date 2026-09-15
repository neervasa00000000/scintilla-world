/**
 * Public JS API: window.cuelock.verify(cues)
 * Also usable from Node for CI after importing verifyCues.
 */

import { verifyCues } from "./verify";
import type { Cue, VerifyOptions, VerifyReport } from "./types";

export type CueLockAPI = {
  verify: (cues: Cue[], options?: VerifyOptions) => VerifyReport;
  version: string;
};

export function createCueLockAPI(): CueLockAPI {
  return {
    version: "1.0.0",
    verify: (cues, options) => verifyCues(cues, options),
  };
}

export function installWindowAPI() {
  if (typeof window === "undefined") return;
  const api = createCueLockAPI();
  (window as unknown as { cuelock: CueLockAPI }).cuelock = api;
}
