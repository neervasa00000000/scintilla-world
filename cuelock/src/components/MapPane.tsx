"use client";

import type { Cue } from "@/lib/types";
import { FallbackMap } from "@/components/FallbackMap";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
};

/** Self-contained map preview, so the demo works without external map tiles. */
export function MapPane(props: MapProps) {
  return (
    <div className="relative h-full min-h-[420px] w-full">
      <FallbackMap cues={props.cues} failingIds={props.failingIds} callouts={props.callouts} />
    </div>
  );
}
