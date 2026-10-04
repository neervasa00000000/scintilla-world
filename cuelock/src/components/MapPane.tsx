"use client";

import type { Cue, CvdMode } from "@/lib/types";
import { FallbackMap } from "@/components/FallbackMap";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  cvdMode?: CvdMode;
  selectedCueId?: string | null;
  onSelectCue?: (cueId: string) => void;
  title?: string;
};

/** Self-contained map engine supporting custom routes, CVD simulation, and demo presets. */
export function MapPane(props: MapProps) {
  return (
    <div className="relative h-full min-h-[440px] w-full">
      <FallbackMap {...props} />
    </div>
  );
}
