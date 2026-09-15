"use client";

import type { Cue } from "@/lib/types";
import { MapWorkspace } from "@/components/MapWorkspace";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  resetToken?: number;
};

/** Real Carto/OSM street map of Melbourne, bound to cues[] state. */
export function MapPane(props: MapProps) {
  return (
    <div className="relative h-full min-h-[420px] w-full">
      <MapWorkspace
        cues={props.cues}
        failingIds={props.failingIds}
        callouts={props.callouts}
        resetToken={props.resetToken}
      />
    </div>
  );
}
