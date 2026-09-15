"use client";

import type { Cue } from "@/lib/types";
import { FallbackMap } from "@/components/FallbackMap";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  resetToken?: number;
};

/**
 * Reliable Melbourne demo map bound to cues[] state.
 * MapLibre is optional later — never block the product on a tile/chunk load.
 */
export function MapPane(props: MapProps) {
  return (
    <div className="relative h-full min-h-[360px] w-full">
      <FallbackMap
        cues={props.cues}
        failingIds={props.failingIds}
        callouts={props.callouts}
      />
    </div>
  );
}
