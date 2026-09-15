"use client";

import type { Cue } from "@/lib/types";
import { MapWorkspace } from "@/components/MapWorkspace";
import { FallbackMap } from "@/components/FallbackMap";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  resetToken?: number;
};

/** Real street map, with schematic fallback if tiles/Leaflet crash. */
export function MapPane(props: MapProps) {
  return (
    <div className="relative h-full min-h-[420px] w-full">
      <ErrorBoundary
        fallback={
          <FallbackMap
            cues={props.cues}
            failingIds={props.failingIds}
            callouts={props.callouts}
          />
        }
      >
        <MapWorkspace
          cues={props.cues}
          failingIds={props.failingIds}
          callouts={props.callouts}
          resetToken={props.resetToken}
        />
      </ErrorBoundary>
    </div>
  );
}
