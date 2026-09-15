"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { installWindowAPI } from "@/lib/api";
import { melbourneBadCues } from "@/lib/demo";
import {
  cueStatusByMode,
  downloadBlob,
  downloadJson,
  downloadMarkdown,
  exportEvidencePng,
  failingCueIds,
} from "@/lib/export";
import { simulateHex } from "@/lib/cvd";
import {
  ROLE_LABELS,
  type Cue,
  type CueRole,
  type PatternEncoding,
  type VerifyReport,
} from "@/lib/types";
import { applySafeEncoding, verifyCues } from "@/lib/verify";

const MapWorkspace = dynamic(
  () => import("@/components/MapWorkspace").then((m) => m.MapWorkspace),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-[12px] text-[var(--dim)]">Loading map…</div> }
);

const ROLES: CueRole[] = [
  "route_active",
  "route_alt",
  "hazard",
  "destination",
  "mode_walk",
  "mode_transit",
  "legend_chip",
  "custom",
];

export function ToolApp() {
  const [cues, setCues] = useState<Cue[]>(() => melbourneBadCues());
  const [threshold, setThreshold] = useState(15);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    installWindowAPI();
  }, []);

  const failIds = useMemo(
    () => (report ? failingCueIds(report) : new Set<string>()),
    [report]
  );

  const runVerify = useCallback(() => {
    const r = verifyCues(cues, { threshold });
    setReport(r);
    return r;
  }, [cues, threshold]);

  // Auto-run once on mount so demo fails immediately
  useEffect(() => {
    setReport(verifyCues(melbourneBadCues(), { threshold: 15 }));
  }, []);

  const applySafe = useCallback(() => {
    const next = applySafeEncoding(cues);
    setCues(next);
    const r = verifyCues(next, { threshold });
    setReport(r);
  }, [cues, threshold]);

  const resetBad = useCallback(() => {
    const next = melbourneBadCues();
    setCues(next);
    setReport(verifyCues(next, { threshold }));
  }, [threshold]);

  const updateCue = (id: string, patch: Partial<Cue>) => {
    setCues((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const updateSecondary = (
    id: string,
    patch: Partial<Cue["secondaryEncoding"]>
  ) => {
    setCues((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, secondaryEncoding: { ...c.secondaryEncoding, ...patch } }
          : c
      )
    );
  };

  const addCue = () => {
    const id = `cue-${Date.now()}`;
    setCues((prev) => [
      ...prev,
      {
        id,
        role: "custom",
        label: "New cue",
        colour: "#a78bfa",
        secondaryEncoding: { pattern: "solid", width: 3, labelOnMap: false },
        critical: true,
      },
    ]);
  };

  const importGeoJSON = async (file: File) => {
    const text = await file.text();
    const geo = JSON.parse(text) as {
      features?: Array<{
        properties?: { id?: string; role?: CueRole; colour?: string; label?: string };
        geometry?: { type?: string };
      }>;
    };
    const next: Cue[] = [];
    for (const f of geo.features ?? []) {
      const role = (f.properties?.role as CueRole) || "custom";
      const id = String(f.properties?.id ?? `import-${next.length}`);
      next.push({
        id: `cue-${id}`,
        role,
        label: f.properties?.label ?? ROLE_LABELS[role] ?? id,
        colour: f.properties?.colour ?? "#22c55e",
        secondaryEncoding: {
          pattern: f.geometry?.type === "LineString" ? "solid" : "solid",
          width: f.geometry?.type === "LineString" ? 5 : 0,
          icon: f.geometry?.type === "Point" ? "circle" : undefined,
          labelOnMap: false,
        },
        geometryRef: id,
        critical: true,
      });
    }
    if (next.length) {
      setCues(next);
      setReport(verifyCues(next, { threshold }));
    }
  };

  const onExport = async (kind: "png" | "json" | "md" | "all") => {
    setBusy(true);
    try {
      const r = report ?? runVerify();
      let snap = mapSnapshot;
      if (mapInstance && (kind === "png" || kind === "all")) {
        try {
          snap = mapInstance.getCanvas().toDataURL("image/png");
          setMapSnapshot(snap);
        } catch {
          /* CORS tiles may taint canvas — evidence still exports without map */
        }
      }
      if (kind === "json" || kind === "all") downloadJson(r);
      if (kind === "md" || kind === "all") downloadMarkdown(r);
      if (kind === "png" || kind === "all") {
        const blob = await exportEvidencePng(r, snap);
        downloadBlob(blob, "cuelock-evidence.png");
      }
    } finally {
      setBusy(false);
    }
  };

  const geoInputId = "geojson-import";

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel)] px-2">
        <span className="mr-2 px-1 text-[13px] font-semibold tracking-tight">
          CueLock
        </span>
        <Btn onClick={resetBad}>Open Melbourne demo</Btn>
        <label className="inline-flex">
          <input
            id={geoInputId}
            type="file"
            accept=".json,.geojson,application/geo+json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importGeoJSON(f);
              e.target.value = "";
            }}
          />
          <Btn onClick={() => document.getElementById(geoInputId)?.click()}>
            Import GeoJSON route
          </Btn>
        </label>
        <Btn onClick={addCue}>Add cue</Btn>
        <Btn onClick={() => runVerify()} accent>
          Run verify
        </Btn>
        <Btn onClick={applySafe}>Apply safe encoding</Btn>
        <div className="ml-auto flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
            ΔE thr
            <input
              type="number"
              min={5}
              max={40}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 15)}
              className="mono w-14 rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5"
            />
          </label>
          <Btn onClick={() => void onExport("all")} disabled={busy}>
            Export
          </Btn>
        </div>
      </header>

      {report && (
        <div
          className={`flex items-center gap-3 border-b border-[var(--border)] px-3 py-1.5 text-[12px] ${
            report.summary.pass
              ? "bg-[#142018] text-[var(--ok)]"
              : "bg-[#2a1818] text-[var(--danger)]"
          }`}
        >
          <span className="mono font-semibold">
            {report.summary.pass ? "PASS" : "FAIL"}
          </span>
          <span className="text-[var(--muted)]">
            {report.summary.failCount} failing · {report.summary.passCount}{" "}
            passing · colour-only collapses{" "}
            {report.summary.colourOnlyFails} · Machado 2009 · CIEDE2000
          </span>
          {!report.summary.pass && (
            <span className="ml-auto text-[var(--accent)]">
              Apply safe encoding to restore dual-cue backups, then re-verify.
            </span>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
        <section className="relative min-h-[360px] border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <MapWorkspace
            cues={cues}
            failingIds={failIds}
            onMapReady={setMapInstance}
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-[var(--border)] px-2 py-1.5 text-[11px] uppercase tracking-wide text-[var(--dim)]">
            Cue table
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[var(--panel-2)] text-[10px] text-[var(--dim)]">
                <tr>
                  <th className="px-2 py-1 font-medium">Role</th>
                  <th className="px-2 py-1 font-medium">Colour</th>
                  <th className="px-2 py-1 font-medium">Secondary</th>
                  <th className="px-2 py-1 font-medium">P</th>
                  <th className="px-2 py-1 font-medium">D</th>
                  <th className="px-2 py-1 font-medium">T</th>
                </tr>
              </thead>
              <tbody>
                {cues.map((c) => {
                  const st = report
                    ? cueStatusByMode(report, c.id)
                    : { protanopia: "—", deuteranopia: "—", tritanopia: "—" };
                  return (
                    <tr
                      key={c.id}
                      className={`border-t border-[var(--border)] ${
                        failIds.has(c.id) ? "bg-[#1f1414]" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5 align-top">
                        <select
                          value={c.role}
                          onChange={(e) =>
                            updateCue(c.id, {
                              role: e.target.value as CueRole,
                            })
                          }
                          className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <input
                          value={c.label}
                          onChange={(e) =>
                            updateCue(c.id, { label: e.target.value })
                          }
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={c.colour}
                            onChange={(e) =>
                              updateCue(c.id, { colour: e.target.value })
                            }
                            className="h-6 w-6 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                          />
                          <div className="flex gap-0.5">
                            {(["protanopia", "deuteranopia", "tritanopia"] as const).map(
                              (m) => (
                                <span
                                  key={m}
                                  title={m}
                                  className="inline-block h-3 w-3 rounded-sm border border-black/40"
                                  style={{
                                    background: simulateHex(c.colour, m),
                                  }}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex flex-col gap-1">
                          <select
                            value={c.secondaryEncoding.pattern ?? "solid"}
                            onChange={(e) =>
                              updateSecondary(c.id, {
                                pattern: e.target.value as PatternEncoding,
                              })
                            }
                            className="rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                          >
                            <option value="solid">solid</option>
                            <option value="dashed">dashed</option>
                            <option value="dotted">dotted</option>
                            <option value="hatch">hatch</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={12}
                            value={c.secondaryEncoding.width ?? 0}
                            onChange={(e) =>
                              updateSecondary(c.id, {
                                width: Number(e.target.value),
                              })
                            }
                            className="mono w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                            title="Stroke width"
                          />
                          <select
                            value={c.secondaryEncoding.icon ?? ""}
                            onChange={(e) =>
                              updateSecondary(c.id, {
                                icon: e.target.value || undefined,
                              })
                            }
                            className="rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                          >
                            <option value="">no icon</option>
                            <option value="circle">circle</option>
                            <option value="triangle">triangle</option>
                            <option value="square">square</option>
                          </select>
                          <label className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                            <input
                              type="checkbox"
                              checked={!!c.secondaryEncoding.labelOnMap}
                              onChange={(e) =>
                                updateSecondary(c.id, {
                                  labelOnMap: e.target.checked,
                                })
                              }
                            />
                            label on map
                          </label>
                        </div>
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <StatusChip s={st.protanopia as string} />
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <StatusChip s={st.deuteranopia as string} />
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <StatusChip s={st.tritanopia as string} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Verify results drawer */}
      <section className="flex max-h-[34vh] shrink-0 flex-col border-t border-[var(--border)] bg-[var(--panel)]">
        <div className="flex h-8 items-center gap-3 border-b border-[var(--border)] px-3 text-[11px]">
          <span className="uppercase tracking-wide text-[var(--dim)]">
            Verify results
          </span>
          <span className="text-[var(--dim)]">
            Critical pairs · dual-encoding gate · named ΔE
          </span>
          <div className="ml-auto flex gap-1">
            <Btn muted onClick={() => void onExport("json")}>
              JSON
            </Btn>
            <Btn muted onClick={() => void onExport("md")}>
              Markdown
            </Btn>
            <Btn muted onClick={() => void onExport("png")}>
              Evidence PNG
            </Btn>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[var(--panel-2)] text-[10px] text-[var(--dim)]">
              <tr>
                <th className="px-2 py-1 font-medium">Status</th>
                <th className="px-2 py-1 font-medium">Pair</th>
                <th className="px-2 py-1 font-medium">Mode</th>
                <th className="px-2 py-1 font-medium">ΔE</th>
                <th className="px-2 py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(report?.pairs ?? [])
                .slice()
                .sort((a, b) =>
                  a.status === b.status
                    ? 0
                    : a.status === "FAIL"
                      ? -1
                      : 1
                )
                .map((p, i) => (
                  <tr
                    key={`${p.aId}-${p.bId}-${p.mode}-${i}`}
                    className={`border-t border-[var(--border)] ${
                      p.status === "FAIL" ? "bg-[#1f1414]" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <StatusChip s={p.status} />
                    </td>
                    <td className="px-2 py-1.5">
                      {p.aLabel}{" "}
                      <span className="text-[var(--dim)]">vs</span> {p.bLabel}
                    </td>
                    <td className="px-2 py-1.5 mono text-[var(--muted)]">
                      {p.mode}
                    </td>
                    <td className="px-2 py-1.5 mono text-[var(--muted)]">
                      {p.deltaENormal.toFixed(1)} → {p.deltaECvd.toFixed(1)}
                    </td>
                    <td className="max-w-[420px] px-2 py-1.5 text-[11px] text-[var(--dim)]">
                      {p.reason}
                    </td>
                  </tr>
                ))}
              {!report && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[var(--dim)]"
                  >
                    Run verify to evaluate critical cue pairs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--border)] px-3 py-1 text-[10px] text-[var(--dim)]">
          CueLock · Neer Vasa · Monash MIT · scintilla.world — not a WCAG
          certification. window.cuelock.verify(cues) available in console.
        </div>
      </section>
    </div>
  );
}

function Btn({
  children,
  onClick,
  accent,
  muted,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[12px] transition disabled:opacity-40 ${
        accent
          ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]"
          : muted
            ? "border-transparent text-[var(--muted)] hover:border-[var(--border)]"
            : "border-[var(--border)] bg-[var(--bg)] hover:border-[#3a414a]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusChip({ s }: { s: string }) {
  if (s === "FAIL")
    return (
      <span className="rounded bg-[var(--danger)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--danger)]">
        FAIL
      </span>
    );
  if (s === "PASS")
    return (
      <span className="rounded bg-[var(--ok)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ok)]">
        PASS
      </span>
    );
  return <span className="text-[var(--dim)]">—</span>;
}
