"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { installWindowAPI } from "@/lib/api";
import {
  buildTestingReport,
  downloadJson,
  downloadTestingReport,
  downloadText,
  exportEvidencePng,
  failingCueIds,
} from "@/lib/export";
import { buildProblems } from "@/lib/plainEnglish";
import { cueStatusByMode } from "@/lib/status";
import {
  applyFix,
  loadMelbourneDemo,
  runCheck,
  type AppSnapshot,
} from "@/lib/store";
import {
  melbourneBadCues,
  transitVsWalkCues,
  emergencyEvacCues,
} from "@/lib/demo";
import {
  ALL_ROLES,
  ROLE_LABELS,
  type Cue,
  type CueRole,
  type CvdMode,
  type PatternEncoding,
} from "@/lib/types";
import { MapPane } from "@/components/MapPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CVD_TABS: Array<{ id: CvdMode; label: string; desc: string }> = [
  {
    id: "normal",
    label: "Normal Vision",
    desc: "Standard vision. Critical cue pairs are tested against CIEDE2000 thresholds.",
  },
  {
    id: "protanopia",
    label: "Protanopia (Red-Blind)",
    desc: "Red-blind vision (~1% of males). Red and green cues shift into overlapping olive/ochre shades.",
  },
  {
    id: "deuteranopia",
    label: "Deuteranopia (Green-Blind)",
    desc: "Green-blind vision (~5% of males). Red and green hues converge into identical khaki tones.",
  },
  {
    id: "tritanopia",
    label: "Tritanopia (Blue-Blind)",
    desc: "Blue-blind vision (~0.01%). Blue and yellow hues merge into teals and magentas.",
  },
];

export function ToolApp() {
  const [snap, setSnap] = useState<AppSnapshot>(() => loadMelbourneDemo(15));
  const [cvdMode, setCvdMode] = useState<CvdMode>("normal");
  const [activeTab, setActiveTab] = useState<"issues" | "editor" | "geojson">("issues");
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    installWindowAPI();
  }, []);

  const problems = useMemo(
    () => (snap.lastResult ? buildProblems(snap.lastResult) : []),
    [snap.lastResult]
  );

  const failingIds = useMemo(
    () => (snap.lastResult ? failingCueIds(snap.lastResult) : new Set<string>()),
    [snap.lastResult]
  );

  const isPass = snap.phase === "checked_pass";
  const callouts = isPass
    ? []
    : [...new Set(problems.map((p) => p.mapCallout))].slice(0, 2);

  // Preset loading
  function loadPreset(name: "melbourne" | "transit" | "evac" | "custom") {
    let newCues: Cue[];
    if (name === "melbourne") newCues = melbourneBadCues();
    else if (name === "transit") newCues = transitVsWalkCues();
    else if (name === "evac") newCues = emergencyEvacCues();
    else {
      newCues = [
        {
          id: `cue-${Date.now()}-1`,
          role: "route_active",
          label: "Primary Route",
          colour: "#22c55e",
          secondaryEncoding: { pattern: "solid", width: 5, labelOnMap: false },
          critical: true,
        },
        {
          id: `cue-${Date.now()}-2`,
          role: "route_alt",
          label: "Alternate Route",
          colour: "#ef4444",
          secondaryEncoding: { pattern: "solid", width: 5, labelOnMap: false },
          critical: true,
        },
      ];
    }

    const next = runCheck(newCues, snap.threshold, name === "melbourne" ? "melbourne" : "custom", []);
    setSnap(next);
    setSelectedCueId(null);
    setNotice(
      name === "melbourne"
        ? "Melbourne CBD demo loaded."
        : name === "transit"
        ? "Transit vs Walking route preset loaded."
        : name === "evac"
        ? "Emergency evacuation corridor preset loaded."
        : "Custom workspace ready. Add or edit cues below."
    );
    setError("");
  }

  function handleCheck(threshold = snap.threshold) {
    try {
      const next = runCheck(snap.cues, threshold, snap.demo, snap.fixChanges);
      setSnap(next);
      setNotice(
        next.phase === "checked_pass"
          ? "Check complete: all critical navigation cues pass dual-encoding verification."
          : `Check complete: ${next.lastResult?.summary.failCount ?? 0} confusable pair comparisons need attention.`
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The check could not finish.");
    }
  }

  function handleFix() {
    try {
      const next = applyFix(snap.cues, snap.threshold, snap.demo, snap.fixChanges);
      setSnap(next);
      setNotice(
        next.phase === "checked_pass"
          ? "Suggested secondary encodings applied. All cues pass under CVD simulation."
          : "Changes applied. Some cues still need attention."
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not apply fixes.");
    }
  }

  // Cue Editor Actions
  function updateCue(id: string, patch: Partial<Cue>) {
    const updated = snap.cues.map((c) => (c.id === id ? { ...c, ...patch } : c));
    const next = runCheck(updated, snap.threshold, "custom", snap.fixChanges);
    setSnap(next);
  }

  function updateSecondary(id: string, patch: Partial<Cue["secondaryEncoding"]>) {
    const updated = snap.cues.map((c) =>
      c.id === id ? { ...c, secondaryEncoding: { ...c.secondaryEncoding, ...patch } } : c
    );
    const next = runCheck(updated, snap.threshold, "custom", snap.fixChanges);
    setSnap(next);
  }

  function addCue() {
    const id = `cue-${Date.now()}`;
    const colors = ["#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981"];
    const newCue: Cue = {
      id,
      role: "custom",
      label: `New Cue ${snap.cues.length + 1}`,
      colour: colors[snap.cues.length % colors.length],
      secondaryEncoding: {
        pattern: "solid",
        width: 4,
        icon: "circle",
        labelOnMap: true,
      },
      critical: true,
    };
    const updated = [...snap.cues, newCue];
    const next = runCheck(updated, snap.threshold, "custom", snap.fixChanges);
    setSnap(next);
    setSelectedCueId(id);
    setActiveTab("editor");
    setNotice("New cue added.");
  }

  function removeCue(id: string) {
    if (snap.cues.length <= 1) {
      setError("At least one cue is required.");
      return;
    }
    const updated = snap.cues.filter((c) => c.id !== id);
    const next = runCheck(updated, snap.threshold, "custom", snap.fixChanges);
    setSnap(next);
    if (selectedCueId === id) setSelectedCueId(null);
    setNotice("Cue removed.");
  }

  // GeoJSON Import
  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        parseAndApplyGeoJson(text);
      } catch (err) {
        setError(
          "Could not parse file: " + (err instanceof Error ? err.message : String(err))
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function parseAndApplyGeoJson(text: string) {
    const json = JSON.parse(text);
    if (Array.isArray(json.cues)) {
      const next = runCheck(json.cues, snap.threshold, "custom", []);
      setSnap(next);
      setNotice(`Imported ${json.cues.length} cues from CueLock export.`);
      return;
    }

    type GeoJsonFeature = {
      type?: string;
      geometry?: {
        type?: string;
        coordinates?: [number, number][] | [number, number];
      };
      properties?: {
        id?: string;
        role?: CueRole;
        label?: string;
        name?: string;
        title?: string;
        colour?: string;
        color?: string;
        stroke?: string;
        pattern?: PatternEncoding;
        width?: number;
        icon?: string;
        labelOnMap?: boolean;
        critical?: boolean;
      };
    };

    const rawFeatures: unknown[] = json.features || (json.type === "Feature" ? [json] : []);
    const features = rawFeatures as GeoJsonFeature[];
    if (!features || features.length === 0) {
      throw new Error("No GeoJSON features found in file.");
    }

    const palette = ["#22c55e", "#ef4444", "#f97316", "#3b82f6", "#a855f7", "#06b6d4"];
    const imported: Cue[] = [];

    features.forEach((feat, idx: number) => {
      const geomType = feat.geometry?.type;
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates;
      const isLine = geomType === "LineString" || geomType === "MultiLineString";

      const role: CueRole =
        props.role && ALL_ROLES.includes(props.role)
          ? props.role
          : isLine
          ? idx === 0
            ? "route_active"
            : "route_alt"
          : idx === 0
          ? "hazard"
          : "destination";

      const label =
        props.label ||
        props.name ||
        props.title ||
        (isLine ? `Route ${idx + 1}` : `Location ${idx + 1}`);

      const colour =
        props.colour || props.color || props.stroke || palette[idx % palette.length];

      imported.push({
        id: props.id ? `imported-${props.id}` : `cue-${Date.now()}-${idx}`,
        role,
        label,
        colour,
        secondaryEncoding: {
          pattern: props.pattern || (role === "route_alt" ? "dashed" : "solid"),
          width: props.width || (isLine ? 5 : 0),
          icon: props.icon || (role === "hazard" ? "triangle" : "circle"),
          labelOnMap: Boolean(props.labelOnMap ?? true),
        },
        coordinates: coords,
        critical: true,
      });
    });

    if (imported.length > 0) {
      const next = runCheck(imported, snap.threshold, "custom", []);
      setSnap(next);
      setNotice(`Imported ${imported.length} features from GeoJSON.`);
      setActiveTab("editor");
    }
  }

  // GeoJSON Export
  function exportGeoJson() {
    const fc = {
      type: "FeatureCollection",
      features: snap.cues.map((c) => {
        const isLine = Array.isArray(c.coordinates) && Array.isArray(c.coordinates[0]);
        return {
          type: "Feature",
          id: c.id,
          properties: {
            id: c.id,
            role: c.role,
            label: c.label,
            colour: c.colour,
            pattern: c.secondaryEncoding.pattern,
            width: c.secondaryEncoding.width,
            icon: c.secondaryEncoding.icon,
            labelOnMap: c.secondaryEncoding.labelOnMap,
            critical: c.critical,
          },
          geometry: c.coordinates
            ? {
                type: isLine ? "LineString" : "Point",
                coordinates: c.coordinates,
              }
            : null,
        };
      }),
    };
    downloadText(
      "cuelock-map-cues.geojson",
      JSON.stringify(fc, null, 2),
      "application/geo+json"
    );
    setNotice("GeoJSON exported.");
  }

  // Reports
  function reportContext() {
    return {
      demo: snap.demo,
      appUrl: typeof window !== "undefined" ? window.location.href : "https://scintilla.world/cuelock",
      fixChanges: snap.fixChanges,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "CueLock",
      viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "1024×768",
    };
  }

  async function copyReport() {
    if (!snap.lastResult) return;
    try {
      await navigator.clipboard.writeText(buildTestingReport(snap.lastResult, reportContext()));
      setNotice("Testing report copied to clipboard.");
      setError("");
    } catch {
      setError("Clipboard access unavailable. Please use Download Report.");
    }
  }

  function downloadReport() {
    if (!snap.lastResult) return;
    downloadTestingReport(snap.lastResult, reportContext());
    setNotice("Testing report downloaded (.md).");
  }

  function downloadJsonReport() {
    if (!snap.lastResult) return;
    downloadJson(snap.lastResult, reportContext());
    setNotice("Public JSON report downloaded.");
  }

  async function downloadEvidence() {
    if (!snap.lastResult) return;
    try {
      const blob = await exportEvidencePng(snap.lastResult, {
        demo: snap.demo,
        fixChanges: snap.fixChanges,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuelock-evidence-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Evidence PNG card downloaded.");
    } catch (err) {
      setError("PNG generation failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>

      {/* Main App Header */}
      <header className="app-header">
        <Link href="/" className="brand" aria-label="Scintilla home">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>{" "}
          Scintilla
        </Link>
        <span className="brand-divider" aria-hidden="true" />
        <span className="product-name">CueLock</span>
        <span className="header-tag">Navigation Cue Verifier</span>
      </header>

      <main className="workspace-page" id="workspace-main">
        {/* Intro & Preset Bar */}
        <section className="workspace-intro">
          <div>
            <p className="eyebrow">
              {snap.demo === "melbourne"
                ? "Demo Mode · Melbourne CBD"
                : "Studio Mode · Custom Cues"}
            </p>
            <h1>Verify & Secure Map Cues</h1>
            <p className="intro-copy">
              Ensure critical map cues (routes, hazards, and destinations) survive colour vision
              differences. Simulate red/green/blue blindness, auto-differentiate with dual
              encodings, and export audit reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--muted)]">Presets:</span>
            <button
              type="button"
              className={`button text-xs ${snap.demo === "melbourne" ? "button-primary" : "button-secondary"}`}
              onClick={() => loadPreset("melbourne")}
            >
              Melbourne CBD
            </button>
            <button
              type="button"
              className="button button-secondary text-xs"
              onClick={() => loadPreset("transit")}
            >
              Transit vs Walk
            </button>
            <button
              type="button"
              className="button button-secondary text-xs"
              onClick={() => loadPreset("evac")}
            >
              Evacuation Corridor
            </button>
            <button
              type="button"
              className={`button text-xs ${snap.demo === "custom" ? "button-primary" : "button-secondary"}`}
              onClick={() => loadPreset("custom")}
            >
              Custom Studio
            </button>
          </div>
        </section>

        {/* Work Panel */}
        <section className="work-panel" aria-label="CueLock workspace">
          {/* Main Action Toolbar */}
          <div className="toolbar">
            <div className="toolbar-main">
              <button
                type="button"
                className="button button-primary"
                onClick={() => handleCheck()}
              >
                Run Check
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleFix}
                disabled={isPass}
              >
                Apply Suggested Fixes
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={addCue}
              >
                + Add Cue
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Import GeoJSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="button button-text"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                {settingsOpen ? "Hide Settings" : "Check Settings"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setExportOpen(!exportOpen)}
              >
                Export Options ▾
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {settingsOpen && (
            <div className="settings-panel">
              <div>
                <label htmlFor="threshold" className="mr-2">
                  Colour difference threshold (CIEDE2000):
                </label>
                <select
                  id="threshold"
                  value={snap.threshold}
                  onChange={(event) => handleCheck(Number(event.target.value))}
                >
                  {[10, 15, 20, 25, 30].map((val) => (
                    <option key={val} value={val}>
                      ΔE {val} {val === 15 ? "(default recommendation)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                Higher ΔE thresholds enforce greater perceptual contrast between critical navigation cues.
              </p>
            </div>
          )}

          {/* Export Dropdown / Bar */}
          {exportOpen && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[#191f24] px-4 py-3">
              <span className="text-xs font-semibold text-[var(--accent)]">Export & Share:</span>
              <button type="button" className="button button-secondary text-xs" onClick={() => void copyReport()}>
                Copy Report (Markdown)
              </button>
              <button type="button" className="button button-secondary text-xs" onClick={downloadReport}>
                Download Report (.md)
              </button>
              <button type="button" className="button button-secondary text-xs" onClick={downloadJsonReport}>
                Download Public JSON
              </button>
              <button type="button" className="button button-secondary text-xs" onClick={exportGeoJson}>
                Export GeoJSON
              </button>
              <button type="button" className="button button-secondary text-xs" onClick={() => void downloadEvidence()}>
                Download PNG Evidence
              </button>
            </div>
          )}

          {/* Vision Simulation Tabs */}
          <div className="border-b border-[var(--border)] bg-[#13161a] px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-2 text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
                  CVD Simulation:
                </span>
                {CVD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCvdMode(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      cvdMode === tab.id
                        ? "bg-[var(--accent)] text-[#121517] shadow"
                        : "bg-[#1d2227] text-[var(--muted)] hover:bg-[#252c32] hover:text-[var(--text)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-[var(--dim)]">
                {CVD_TABS.find((t) => t.id === cvdMode)?.desc}
              </div>
            </div>
          </div>

          {/* Result Banner */}
          <div className={`result-banner ${isPass ? "result-pass" : "result-fail"}`} role="status">
            <span className="result-icon" aria-hidden="true">
              {isPass ? "✓" : "!"}
            </span>
            <div className="flex-1">
              <h2>
                {isPass
                  ? "All critical cue pairs pass CVD verification"
                  : `${problems.length} cue pair issue${problems.length === 1 ? "" : "s"} detected under simulation`}
              </h2>
              <p>
                {isPass
                  ? "Every route and marker retains distinguishable secondary encodings (patterns, marker shapes, or labels) so colour collapse cannot compromise navigation."
                  : "Some routes or markers could be confused under simulated colour vision differences. Apply suggested fixes to restore dual encodings."}
              </p>
            </div>
          </div>

          {/* Notification / Error Feedback */}
          <div className="feedback">
            {notice && <p>{notice}</p>}
            {error && <p className="feedback-error" role="alert">{error}</p>}
          </div>

          {/* Workspace Grid */}
          <div className="workspace-grid">
            {/* Map Column */}
            <section className="map-section" aria-label="Navigation map preview">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Interactive Map Canvas</span>
                  <h2>
                    {snap.demo === "melbourne"
                      ? "Flinders Street to Melbourne Central"
                      : "Navigation Route & Cue Canvas"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="demo-pill">
                    {snap.demo === "melbourne" ? "Melbourne Demo" : `${snap.cues.length} Cues`}
                  </span>
                </div>
              </div>

              <div className="map-frame">
                <ErrorBoundary>
                  <MapPane
                    cues={snap.cues}
                    failingIds={failingIds}
                    callouts={callouts}
                    cvdMode={cvdMode}
                    selectedCueId={selectedCueId}
                    onSelectCue={(id) => {
                      setSelectedCueId(id);
                      setActiveTab("editor");
                    }}
                    title={
                      cvdMode !== "normal"
                        ? `Live ${cvdMode.toUpperCase()} simulation · Machado 2009`
                        : "Normal vision preview"
                    }
                  />
                </ErrorBoundary>
              </div>
            </section>

            {/* Right Column: Tabbed Workspace */}
            <section className="results-section" id="results">
              {/* Tabs Navigation */}
              <div className="flex items-center border-b border-[var(--border)] bg-[#171b1f] px-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("issues")}
                  className={`border-b-2 px-3 py-3 text-xs font-bold transition ${
                    activeTab === "issues"
                      ? "border-[var(--accent)] text-[var(--text)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Issues & Verification ({problems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("editor")}
                  className={`border-b-2 px-3 py-3 text-xs font-bold transition ${
                    activeTab === "editor"
                      ? "border-[var(--accent)] text-[var(--text)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Cue Studio & Editor ({snap.cues.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("geojson")}
                  className={`border-b-2 px-3 py-3 text-xs font-bold transition ${
                    activeTab === "geojson"
                      ? "border-[var(--accent)] text-[var(--text)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  GeoJSON / Raw
                </button>
              </div>

              <div className="results-body">
                {/* TAB 1: Issues */}
                {activeTab === "issues" && (
                  <div>
                    {isPass ? (
                      <div className="success-card">
                        <span className="success-mark" aria-hidden="true">
                          ✓
                        </span>
                        <h3>Dual-Encoding Verified</h3>
                        <p>
                          All critical cue pairs maintain sufficient contrast or secondary visual
                          differentiators across Protanopia, Deuteranopia, and Tritanopia.
                        </p>
                        {snap.fixChanges.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-bold text-[var(--ok)]">Applied Protections:</h4>
                            <ul>
                              {snap.fixChanges.map((change, index) => (
                                <li key={index}>{change}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            className="button button-secondary text-xs"
                            onClick={() => void copyReport()}
                          >
                            Copy Audit Report
                          </button>
                          <button
                            type="button"
                            className="button button-secondary text-xs"
                            onClick={downloadReport}
                          >
                            Download Report (.md)
                          </button>
                        </div>
                      </div>
                    ) : (
                      problems.map((problem, index) => (
                        <details
                          className="issue-card"
                          key={problem.id}
                          open={index === 0}
                        >
                          <summary>
                            <span className="issue-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="issue-title">
                              {problem.title}
                              <small>{problem.affectsPlain}</small>
                            </span>
                            <span className="disclosure-icon" aria-hidden="true">
                              ⌄
                            </span>
                          </summary>
                          <div className="issue-content">
                            <p>{problem.whatHappens}</p>
                            <p>
                              <strong>Suggested Fix:</strong> {problem.fixPlain}
                            </p>
                            <p className="technical-detail">
                              ΔE difference: {problem.deltaEBefore.toFixed(1)} →{" "}
                              {problem.deltaEAfter.toFixed(1)} under {problem.affects}. Threshold:{" "}
                              {problem.threshold}.
                            </p>
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 2: Cue Editor */}
                {activeTab === "editor" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs text-[var(--muted)]">
                        Customize roles, colors, patterns, and icons:
                      </span>
                      <button
                        type="button"
                        className="button button-secondary text-xs"
                        onClick={addCue}
                      >
                        + Add Cue
                      </button>
                    </div>

                    {snap.cues.map((cue) => {
                      const st = snap.lastResult
                        ? cueStatusByMode(snap.lastResult, cue.id)
                        : { protanopia: "—", deuteranopia: "—", tritanopia: "—" };
                      const isSelected = selectedCueId === cue.id;
                      const isLine =
                        cue.role.includes("route") ||
                        cue.role.includes("mode") ||
                        (cue.secondaryEncoding.width ?? 0) > 0;

                      return (
                        <article
                          key={cue.id}
                          className={`rounded-lg border p-3.5 transition ${
                            isSelected
                              ? "border-[var(--accent)] bg-[#22292f]"
                              : "border-[var(--border)] bg-[#191d21]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {/* Color picker */}
                              <input
                                type="color"
                                value={cue.colour}
                                onChange={(e) => updateCue(cue.id, { colour: e.target.value })}
                                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                                title="Change colour"
                              />
                              <input
                                type="text"
                                value={cue.label}
                                onChange={(e) => updateCue(cue.id, { label: e.target.value })}
                                className="rounded border border-[var(--border)] bg-[#101416] px-2 py-1 text-xs font-semibold text-[var(--text)]"
                                placeholder="Cue label"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCue(cue.id)}
                              className="text-xs text-[var(--danger)] hover:underline"
                              title="Delete cue"
                            >
                              Remove
                            </button>
                          </div>

                          {/* Role & Pattern Row */}
                          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-[var(--dim)]">Role:</label>
                              <select
                                value={cue.role}
                                onChange={(e) => updateCue(cue.id, { role: e.target.value as CueRole })}
                                className="mt-0.5 w-full rounded border border-[var(--border)] bg-[#121618] px-2 py-1 text-xs text-[var(--text)]"
                              >
                                {ALL_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[11px] text-[var(--dim)]">
                                {isLine ? "Pattern:" : "Icon Shape:"}
                              </label>
                              {isLine ? (
                                <select
                                  value={cue.secondaryEncoding.pattern ?? "solid"}
                                  onChange={(e) =>
                                    updateSecondary(cue.id, {
                                      pattern: e.target.value as PatternEncoding,
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[#121618] px-2 py-1 text-xs text-[var(--text)]"
                                >
                                  <option value="solid">Solid Line</option>
                                  <option value="dashed">Dashed Line</option>
                                  <option value="dotted">Dotted Line</option>
                                </select>
                              ) : (
                                <select
                                  value={cue.secondaryEncoding.icon ?? "circle"}
                                  onChange={(e) =>
                                    updateSecondary(cue.id, { icon: e.target.value })
                                  }
                                  className="mt-0.5 w-full rounded border border-[var(--border)] bg-[#121618] px-2 py-1 text-xs text-[var(--text)]"
                                >
                                  <option value="circle">Circle</option>
                                  <option value="triangle">Warning Triangle</option>
                                  <option value="square">Square</option>
                                  <option value="diamond">Diamond</option>
                                </select>
                              )}
                            </div>
                          </div>

                          {/* Options & Status */}
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#2a3138] pt-2 text-xs">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                                <input
                                  type="checkbox"
                                  checked={cue.secondaryEncoding.labelOnMap ?? false}
                                  onChange={(e) =>
                                    updateSecondary(cue.id, { labelOnMap: e.target.checked })
                                  }
                                />
                                Map label
                              </label>
                              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                                <input
                                  type="checkbox"
                                  checked={cue.critical ?? true}
                                  onChange={(e) => updateCue(cue.id, { critical: e.target.checked })}
                                />
                                Critical
                              </label>
                            </div>

                            {/* Simulated Color Chips + CVD Status */}
                            <div className="flex items-center gap-1 text-[10px]">
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${
                                  st.protanopia === "PASS"
                                    ? "bg-[#183020] text-[var(--ok)]"
                                    : st.protanopia === "FAIL"
                                    ? "bg-[#331c1c] text-[var(--danger)]"
                                    : "bg-[#20252a] text-[var(--dim)]"
                                }`}
                                title="Protanopia status"
                              >
                                P: {st.protanopia}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${
                                  st.deuteranopia === "PASS"
                                    ? "bg-[#183020] text-[var(--ok)]"
                                    : st.deuteranopia === "FAIL"
                                    ? "bg-[#331c1c] text-[var(--danger)]"
                                    : "bg-[#20252a] text-[var(--dim)]"
                                }`}
                                title="Deuteranopia status"
                              >
                                D: {st.deuteranopia}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${
                                  st.tritanopia === "PASS"
                                    ? "bg-[#183020] text-[var(--ok)]"
                                    : st.tritanopia === "FAIL"
                                    ? "bg-[#331c1c] text-[var(--danger)]"
                                    : "bg-[#20252a] text-[var(--dim)]"
                                }`}
                                title="Tritanopia status"
                              >
                                T: {st.tritanopia}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* TAB 3: GeoJSON & Raw Data */}
                {activeTab === "geojson" && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--muted)]">
                      Paste or inspect the raw GeoJSON FeatureCollection for your map cues:
                    </p>
                    <textarea
                      readOnly
                      rows={14}
                      value={JSON.stringify(
                        {
                          type: "FeatureCollection",
                          features: snap.cues.map((c) => ({
                            type: "Feature",
                            id: c.id,
                            properties: {
                              role: c.role,
                              label: c.label,
                              colour: c.colour,
                              pattern: c.secondaryEncoding.pattern,
                              width: c.secondaryEncoding.width,
                              icon: c.secondaryEncoding.icon,
                              labelOnMap: c.secondaryEncoding.labelOnMap,
                            },
                            geometry: c.coordinates
                              ? {
                                  type: Array.isArray(c.coordinates[0]) ? "LineString" : "Point",
                                  coordinates: c.coordinates,
                                }
                              : null,
                          })),
                        },
                        null,
                        2
                      )}
                      className="mono w-full rounded border border-[var(--border)] bg-[#101416] p-2.5 text-[11px] text-[#c5cad0]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="button button-secondary text-xs"
                        onClick={exportGeoJson}
                      >
                        Download GeoJSON
                      </button>
                      <button
                        type="button"
                        className="button button-secondary text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload GeoJSON File
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Testing Report Actions */}
              <div className="export-panel">
                <h3>Testing & CI Report</h3>
                <p>Exports verification proofs, CIEDE2000 calculations, and cue states.</p>
                <div className="export-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void copyReport()}
                  >
                    Copy Report
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={downloadReport}
                  >
                    Download (.md)
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void downloadEvidence()}
                  >
                    Evidence PNG
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>

        <p className="method-note">
          CueLock verifies navigation cues using Machado, Oliveira & Fernandes (2009) linear-RGB
          simulation, CIEDE2000 color difference, and a strict dual-encoding rule. It is a research
          instrument for map designers, not a formal WCAG certification.
        </p>
      </main>

      <footer className="app-footer">
        <span>CueLock · Monash MIT · Neer Vasa</span>
        <div className="flex gap-4">
          <Link href="/">Scintilla Home</Link>
          <a
            href="https://github.com/neervasa00000000/scintilla-world"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
