"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { installWindowAPI } from "@/lib/api";
import { melbourneBadCues } from "@/lib/demo";
import {
  buildProblems,
  describeSafeChanges,
  FRIENDLY_ROLE,
  plainSummary,
} from "@/lib/plainEnglish";
import {
  copyTestingReport,
  downloadBlob,
  downloadJson,
  downloadMarkdown,
  downloadTestingReport,
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
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--dim)]">
        Loading map…
      </div>
    ),
  }
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
  const [cuesBeforeFix, setCuesBeforeFix] = useState<Cue[] | null>(null);
  const [fixChanges, setFixChanges] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(15);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [mapInstance, setMapInstance] =
    useState<import("maplibre-gl").Map | null>(null);
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showPdt, setShowPdt] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [demo, setDemo] = useState<"melbourne" | "custom">("melbourne");
  const [openTech, setOpenTech] = useState<Record<string, boolean>>({});

  useEffect(() => {
    installWindowAPI();
  }, []);

  const problems = useMemo(
    () => (report ? buildProblems(report) : []),
    [report]
  );
  const summary = useMemo(
    () =>
      report
        ? plainSummary(report, problems)
        : null,
    [report, problems]
  );
  const failIds = useMemo(
    () => (report ? failingCueIds(report) : new Set<string>()),
    [report]
  );
  const callouts = useMemo(
    () => [...new Set(problems.map((p) => p.mapCallout))],
    [problems]
  );

  const runVerify = useCallback(() => {
    const r = verifyCues(cues, { threshold });
    setReport(r);
    return r;
  }, [cues, threshold]);

  useEffect(() => {
    setReport(verifyCues(melbourneBadCues(), { threshold: 15 }));
  }, []);

  const applySafe = useCallback(() => {
    setCuesBeforeFix(cues);
    const next = applySafeEncoding(cues);
    const changes = describeSafeChanges(cues, next);
    setFixChanges(changes);
    setCues(next);
    setReport(verifyCues(next, { threshold }));
  }, [cues, threshold]);

  const resetDemo = useCallback(() => {
    const next = melbourneBadCues();
    setDemo("melbourne");
    setCues(next);
    setCuesBeforeFix(null);
    setFixChanges([]);
    setReport(verifyCues(next, { threshold }));
  }, [threshold]);

  const reportCtx = useCallback(() => {
    const center = mapInstance?.getCenter();
    return {
      demo,
      appUrl: typeof window !== "undefined" ? window.location.href : "",
      mapCenter: center
        ? ([center.lng, center.lat] as [number, number])
        : undefined,
      mapZoom: mapInstance?.getZoom(),
      fixChanges,
      cuesBeforeFix: cuesBeforeFix ?? undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}×${window.innerHeight}`
          : "",
    };
  }, [demo, mapInstance, fixChanges, cuesBeforeFix]);

  const onExportPng = async () => {
    if (!report) return;
    setBusy(true);
    setDownloadOpen(false);
    try {
      let snap: string | null = null;
      try {
        snap = mapInstance?.getCanvas().toDataURL("image/png") ?? null;
      } catch {
        /* tainted canvas */
      }
      const blob = await exportEvidencePng(report, {
        mapDataUrl: snap,
        demo,
        fixChanges,
      });
      downloadBlob(blob, "cuelock-report.png");
    } finally {
      setBusy(false);
    }
  };

  const onCopyTesting = async () => {
    if (!report) return;
    await copyTestingReport(report, reportCtx());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateCue = (id: string, patch: Partial<Cue>) => {
    setCues((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
    setDemo("custom");
    setCues((prev) => [
      ...prev,
      {
        id: `cue-${Date.now()}`,
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
        properties?: {
          id?: string;
          role?: CueRole;
          colour?: string;
          label?: string;
        };
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
          pattern: "solid",
          width: f.geometry?.type === "LineString" ? 5 : 0,
          icon: f.geometry?.type === "Point" ? "circle" : undefined,
          labelOnMap: false,
        },
        geometryRef: id,
        critical: true,
      });
    }
    if (next.length) {
      setDemo("custom");
      setCues(next);
      setReport(verifyCues(next, { threshold }));
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel)] px-2">
        <span className="mr-1 px-1 text-[13px] font-semibold tracking-tight">
          CueLock
        </span>
        <Btn onClick={resetDemo}>Melbourne demo</Btn>
        <Btn accent onClick={() => runVerify()}>
          Check
        </Btn>
        <Btn onClick={applySafe}>Fix colours &amp; patterns</Btn>

        <div className="relative">
          <Btn onClick={() => setDownloadOpen((v) => !v)} disabled={!report || busy}>
            Download report ▾
          </Btn>
          {downloadOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded border border-[var(--border)] bg-[var(--panel-2)] py-1 shadow-lg">
              <MenuItem
                onClick={() => void onExportPng()}
                label="Evidence PNG"
              />
              <MenuItem
                onClick={() => {
                  if (report) downloadMarkdown(report, reportCtx());
                  setDownloadOpen(false);
                }}
                label="Markdown"
              />
              {advancedOpen && (
                <MenuItem
                  onClick={() => {
                    if (report) downloadJson(report, reportCtx());
                    setDownloadOpen(false);
                  }}
                  label="JSON (CI)"
                />
              )}
            </div>
          )}
        </div>

        <Btn onClick={() => void onCopyTesting()} disabled={!report}>
          {copied ? "Copied" : "Copy testing report"}
        </Btn>
        <Btn
          muted
          onClick={() => {
            if (report) downloadTestingReport(report, reportCtx());
          }}
          disabled={!report}
        >
          Download testing-report.md
        </Btn>

        <button
          type="button"
          className="ml-auto text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? "Hide advanced" : "Advanced"}
        </button>
      </header>

      {/* Status banner */}
      {summary && (
        <div
          className={`border-b border-[var(--border)] px-4 py-4 ${
            summary.result === "pass" ? "bg-[#142018]" : "bg-[#2a1818]"
          }`}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${
                    summary.result === "pass"
                      ? "bg-[var(--ok)] text-[#0f1113]"
                      : "bg-[var(--danger)] text-white"
                  }`}
                >
                  {summary.result === "pass" ? "Looks good" : "Needs fixes"}
                </span>
              </div>
              <p className="text-[18px] font-semibold leading-snug text-[var(--text)] sm:text-[20px]">
                {summary.headline}
              </p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                {summary.subline}
              </p>
            </div>
            {summary.result === "fail" && (
              <Btn accent onClick={applySafe}>
                Fix automatically
              </Btn>
            )}
          </div>
        </div>
      )}

      {advancedOpen && (
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[12px]">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">ΔE threshold</span>
            <input
              type="number"
              min={5}
              max={40}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 15)}
              className="mono w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={showPdt}
              onChange={(e) => setShowPdt(e.target.checked)}
            />
            Show P/D/T columns
          </label>
          <Btn
            onClick={() => document.getElementById("geo-import")?.click()}
          >
            Import GeoJSON
          </Btn>
          <input
            id="geo-import"
            type="file"
            accept=".json,.geojson,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importGeoJSON(f);
              e.target.value = "";
            }}
          />
          <Btn onClick={addCue}>Add cue</Btn>
          <Btn onClick={() => runVerify()}>Re-check</Btn>
          <p className="max-w-md text-[11px] text-[var(--dim)]">
            Machado et al. 2009 CVD simulation · CIEDE2000 distance · dual-encoding
            gate (pattern / width / icon / label).
          </p>
        </div>
      )}

      {/* Main: map + problems */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)]">
        <section className="relative min-h-[340px] border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <MapWorkspace
            cues={cues}
            failingIds={failIds}
            callouts={summary?.result === "fail" ? callouts : []}
            onMapReady={setMapInstance}
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-[var(--panel)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[12px] font-medium text-[var(--muted)]">
            Problems
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
            {summary?.result === "pass" && (
              <div className="rounded-lg border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-3 py-4 text-[13px] text-[var(--ok)]">
                No colour-only navigation problems under the current check.
              </div>
            )}
            {problems.map((p) => (
              <article
                key={p.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3"
              >
                <h3 className="text-[14px] font-semibold text-[var(--text)]">
                  {p.title}
                </h3>
                <dl className="mt-2 space-y-1.5 text-[12px]">
                  <div>
                    <dt className="text-[var(--dim)]">Who it affects</dt>
                    <dd>{p.affectsPlain}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">What happens</dt>
                    <dd className="text-[var(--muted)]">{p.whatHappens}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">Proof</dt>
                    <dd>{p.proofPlain}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--dim)]">Fix</dt>
                    <dd className="text-[var(--accent)]">{p.fixPlain}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--dim)]">
                  <span>Before</span>
                  <Swatch hex={p.colours[0]} />
                  <Swatch hex={p.colours[1]} />
                  <span className="text-[var(--border)]">|</span>
                  <span>Under {p.affectsPlain.split("(")[0].trim().toLowerCase()}</span>
                  <Swatch hex={p.coloursUnderMode[0]} />
                  <Swatch hex={p.coloursUnderMode[1]} />
                </div>
                <button
                  type="button"
                  className="mt-2 text-[11px] text-[var(--dim)] underline-offset-2 hover:underline"
                  onClick={() =>
                    setOpenTech((s) => ({ ...s, [p.id]: !s[p.id] }))
                  }
                >
                  {openTech[p.id] ? "Hide technical details" : "Technical details"}
                </button>
                {openTech[p.id] && (
                  <p className="mono mt-1 text-[11px] text-[var(--dim)]">
                    {p.technicalLine}
                  </p>
                )}
              </article>
            ))}
            {!report && (
              <p className="text-[12px] text-[var(--dim)]">
                Click Check to review this map.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Advanced cue editor + technical table */}
      {advancedOpen && (
        <section className="max-h-[40vh] shrink-0 overflow-auto border-t border-[var(--border)] bg-[var(--panel-2)]">
          <div className="border-b border-[var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--dim)]">
            Edit cues · technical results
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[var(--panel)] text-[10px] text-[var(--dim)]">
                <tr>
                  <th className="px-2 py-1">Role</th>
                  <th className="px-2 py-1">Colour</th>
                  <th className="px-2 py-1">Secondary</th>
                  {showPdt && (
                    <>
                      <th className="px-2 py-1">P</th>
                      <th className="px-2 py-1">D</th>
                      <th className="px-2 py-1">T</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {cues.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5 align-top">
                      <select
                        value={c.role}
                        onChange={(e) =>
                          updateCue(c.id, { role: e.target.value as CueRole })
                        }
                        className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 text-[11px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {FRIENDLY_ROLE[r]}
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
                      <input
                        type="color"
                        value={c.colour}
                        onChange={(e) =>
                          updateCue(c.id, { colour: e.target.value })
                        }
                        className="h-7 w-7 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                      />
                      <div className="mt-1 flex gap-0.5">
                        {(
                          ["protanopia", "deuteranopia", "tritanopia"] as const
                        ).map((m) => (
                          <span
                            key={m}
                            className="inline-block h-3 w-3 rounded-sm border border-black/40"
                            style={{ background: simulateHex(c.colour, m) }}
                          />
                        ))}
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
                    {showPdt && report && (
                      <>
                        {(["protanopia", "deuteranopia", "tritanopia"] as const).map(
                          (m) => {
                            const fail = report.pairs.some(
                              (p) =>
                                p.status === "FAIL" &&
                                p.mode === m &&
                                (p.aId === c.id || p.bId === c.id)
                            );
                            return (
                              <td key={m} className="px-2 py-1.5 align-top">
                                <span
                                  className={
                                    fail
                                      ? "text-[var(--danger)]"
                                      : "text-[var(--ok)]"
                                  }
                                >
                                  {fail ? "FAIL" : "ok"}
                                </span>
                              </td>
                            );
                          }
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report && (
            <div className="border-t border-[var(--border)]">
              <div className="px-3 py-1.5 text-[11px] text-[var(--dim)]">
                Technical results table
              </div>
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="text-[10px] text-[var(--dim)]">
                  <tr>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Pair</th>
                    <th className="px-2 py-1">Mode</th>
                    <th className="px-2 py-1">ΔE</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pairs
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
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-2 py-1">{p.status}</td>
                        <td className="px-2 py-1">
                          {FRIENDLY_ROLE[p.aRole]} vs {FRIENDLY_ROLE[p.bRole]}
                        </td>
                        <td className="mono px-2 py-1">{p.mode}</td>
                        <td className="mono px-2 py-1">
                          {p.deltaENormal.toFixed(1)} → {p.deltaECvd.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <footer className="border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--dim)]">
        CueLock · Neer Vasa · Monash MIT · scintilla.world — research instrument,
        not a WCAG certificate.
      </footer>
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

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-white/[0.05]"
    >
      {label}
    </button>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-sm border border-[var(--border)]"
      style={{ background: hex }}
      title={hex}
    />
  );
}
