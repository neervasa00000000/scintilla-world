"use client";

import { useEffect, useState } from "react";
import type { Cue, CvdMode } from "@/lib/types";
import { FallbackMap } from "@/components/FallbackMap";
import { StreetMap } from "@/components/StreetMap";

type MapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  cvdMode?: CvdMode;
  selectedCueId?: string | null;
  onSelectCue?: (cueId: string) => void;
  placingCueId?: string | null;
  onPlaceCoordinate?: (point: [number, number]) => void;
  title?: string;
};

/** Real street map with a schematic fallback for unavailable tiles. */
export function MapPane(props: MapProps) {
  const [view, setView] = useState<"street" | "schematic">("street");
  const [unavailable, setUnavailable] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [jumpTarget, setJumpTarget] = useState<[number, number] | null>(null);
  const [jumpError, setJumpError] = useState("");
  useEffect(() => {
    if (props.placingCueId && !unavailable) setView("street");
  }, [props.placingCueId, unavailable]);
  function jumpToCoordinates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = locationInput.split(",").map((value) => Number(value.trim()));
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value)) || Math.abs(values[0]) > 90 || Math.abs(values[1]) > 180) {
      setJumpError("Enter latitude, longitude, for example -33.8688, 151.2093.");
      return;
    }
    setJumpError("");
    setJumpTarget([values[0], values[1]]);
  }
  return (
    <div className="map-pane">
      <div className="map-pane-toolbar">
        <div className="map-pane-actions">
          <div className="map-view-switch" role="group" aria-label="Map view">
            <button type="button" aria-pressed={view === "street"} onClick={() => { setUnavailable(false); setView("street"); }}>Street map</button>
            <button type="button" aria-pressed={view === "schematic"} onClick={() => setView("schematic")}>Schematic</button>
          </div>
          {view === "street" && <form className="map-jump" onSubmit={jumpToCoordinates}>
            <label htmlFor="map-coordinates">Go to coordinates</label>
            <input id="map-coordinates" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder="latitude, longitude" inputMode="decimal" />
            <button type="submit">Go</button>
          </form>}
        </div>
        <span>{props.placingCueId && view === "street" ? "Click the map to place the selected cue" : props.placingCueId ? "Street map required for drawing" : view === "street" ? "Pan and zoom to explore" : "Offline preview"}</span>
      </div>
      {jumpError && <div className="map-jump-error" role="alert">{jumpError}</div>}
      {unavailable && <div className="map-unavailable" role="status">Street tiles could not load. The schematic preview is available; select Street map to retry.</div>}
      <div className="map-pane-body">
        {view === "street" ? <StreetMap
          cues={props.cues}
          cvdMode={props.cvdMode ?? "normal"}
          failingIds={props.failingIds}
          selectedCueId={props.selectedCueId}
          placingCueId={props.placingCueId}
          targetCenter={jumpTarget}
          onSelectCue={props.onSelectCue}
          onPlaceCoordinate={props.onPlaceCoordinate}
          onUnavailable={() => { setUnavailable(true); setView("schematic"); }}
        /> : <FallbackMap {...props} />}
      </div>
    </div>
  );
}
