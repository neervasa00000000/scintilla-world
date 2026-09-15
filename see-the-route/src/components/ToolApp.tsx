"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { analyzeImageData, compareDocs, evaluateProbe } from "@/lib/pipeline";
import {
  applyLowVision,
  downscale,
  imageDataToUrl,
  loadFile,
  loadUrl,
  sampleRgbWindow,
  simulateImageData,
  toImageData,
} from "@/lib/cvd";
import { downloadBlob, exportReportPng } from "@/lib/exportReport";
import { rgbCss, rgbHex } from "@/lib/color";
import { unionBBox } from "@/lib/analysis";
import {
  CVD_LABELS,
  CVD_MODES,
  DEFAULT_SETTINGS,
  type AnalysisSettings,
  type CompareSummary,
  type ConfusablePair,
  type CvdMode,
  type ImageDoc,
  type ProbePoint,
} from "@/lib/types";

type ToolMode = "select" | "probe";
type SortKey = "severity" | "collapse" | "mode";

const SAMPLES: {
  id: string;
  label: string;
  src: string;
  seed: [{ x: number; y: number }, { x: number; y: number }];
}[] = [
  {
    id: "transit",
    label: "Transit lines",
    src: "/samples/transit-map.png",
    // red line vs green line sample points (image coords for 960×640)
    seed: [
      { x: 400, y: 380 },
      { x: 360, y: 340 },
    ],
  },
  {
    id: "nav",
    label: "Turn-by-turn",
    src: "/samples/nav-route.png",
    seed: [
      { x: 480, y: 200 },
      { x: 280, y: 360 },
    ],
  },
  {
    id: "pins",
    label: "Competing pins",
    src: "/samples/legend-heavy.png",
    seed: [
      { x: 120, y: 140 },
      { x: 320, y: 140 },
    ],
  },
];

function severityRank(s: ConfusablePair["severity"]) {
  return s === "high" ? 0 : s === "medium" ? 1 : 2;
}

async function buildDoc(
  img: HTMLImageElement,
  name: string,
  id: "A" | "B",
  settings: AnalysisSettings,
  seed?: [{ x: number; y: number }, { x: number; y: number }]
): Promise<ImageDoc> {
  const full = toImageData(img);
  const work = downscale(full, 900);
  const sims = {} as Record<CvdMode, string>;
  for (const mode of CVD_MODES) {
    sims[mode] = imageDataToUrl(simulateImageData(work, mode));
  }
  const { clusters, findings } = analyzeImageData(work, settings);

  let probe = null as ImageDoc["probe"];
  if (seed) {
    const scaleX = work.width / (img.naturalWidth || img.width);
    const scaleY = work.height / (img.naturalHeight || img.height);
    const p1: ProbePoint = {
      x: seed[0].x * scaleX,
      y: seed[0].y * scaleY,
      rgb: sampleRgbWindow(work, seed[0].x * scaleX, seed[0].y * scaleY),
      label: "P1",
    };
    const p2: ProbePoint = {
      x: seed[1].x * scaleX,
      y: seed[1].y * scaleY,
      rgb: sampleRgbWindow(work, seed[1].x * scaleX, seed[1].y * scaleY),
      label: "P2",
    };
    probe = evaluateProbe(p1, p2, settings.deltaEThreshold);
  }

  return {
    id,
    name,
    width: work.width,
    height: work.height,
    imageData: work,
    url: imageDataToUrl(work),
    sims,
    clusters,
    findings,
    probe,
    seedProbe: seed,
  };
}

export function ToolApp() {
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [docA, setDocA] = useState<ImageDoc | null>(null);
  const [docB, setDocB] = useState<ImageDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("probe");
  const [probeDraft, setProbeDraft] = useState<ProbePoint | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null
  );
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [simFocus, setSimFocus] = useState<CvdMode>("protanopia");
  const [lvPreviewUrl, setLvPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = activeSlot === "A" ? docA : docB;
  const compareSummary: CompareSummary | null = useMemo(() => {
    if (!compareMode || !docA || !docB) return null;
    return compareDocs(docA, docB);
  }, [compareMode, docA, docB]);

  const findings = useMemo(() => {
    if (!active) return [];
    const list = [...active.findings];
    list.sort((a, b) => {
      if (sortKey === "severity")
        return severityRank(a.severity) - severityRank(b.severity);
      if (sortKey === "collapse") return b.collapse - a.collapse;
      return a.mode.localeCompare(b.mode);
    });
    return list;
  }, [active, sortKey]);

  const selectedFinding =
    findings.find((f) => f.id === selectedFindingId) ?? findings[0] ?? null;

  const ingest = useCallback(
    async (
      img: HTMLImageElement,
      name: string,
      slot: "A" | "B",
      seed?: [{ x: number; y: number }, { x: number; y: number }]
    ) => {
      setBusy(true);
      setError(null);
      try {
        const doc = await buildDoc(img, name, slot, settings, seed);
        if (slot === "A") setDocA(doc);
        else setDocB(doc);
        setActiveSlot(slot);
        setSelectedFindingId(doc.findings[0]?.id ?? null);
        setProbeDraft(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setBusy(false);
      }
    },
    [settings]
  );

  const onFile = useCallback(
    async (file: File) => {
      const img = await loadFile(file);
      await ingest(img, file.name, compareMode ? activeSlot : "A");
    },
    [ingest, compareMode, activeSlot]
  );

  const onSample = useCallback(
    async (s: (typeof SAMPLES)[0]) => {
      const img = await loadUrl(s.src);
      await ingest(img, s.label, compareMode ? activeSlot : "A", s.seed);
    },
    [ingest, compareMode, activeSlot]
  );

  // Clipboard paste
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await onFile(file);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  // Auto-load first sample once
  useEffect(() => {
    void onSample(SAMPLES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Low-vision preview (optional, separate)
  useEffect(() => {
    if (!active || !settings.lowVision.enabled) {
      setLvPreviewUrl(null);
      return;
    }
    const lv = applyLowVision(active.imageData, settings.lowVision);
    setLvPreviewUrl(imageDataToUrl(lv));
  }, [active, settings.lowVision]);

  const captureTab = useCallback(async () => {
    // Browser extension API not available on web — fall back to screen capture or paste hint
    try {
      // Prefer display media if user grants (visible tab-ish)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // @ts-expect-error preferCurrentTab is Chromium
        preferCurrentTab: true,
      });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d")!.drawImage(video, 0, 0);
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      const blob = await new Promise<Blob | null>((res) =>
        c.toBlob((b) => res(b), "image/png")
      );
      if (!blob) throw new Error("Capture failed");
      const file = new File([blob], "capture.png", { type: "image/png" });
      await onFile(file);
    } catch {
      setError(
        "Capture cancelled or unsupported. Paste a screenshot (⌘V / Ctrl+V) instead."
      );
    }
  }, [onFile]);

  const onCanvasClick = useCallback(
    (imgX: number, imgY: number) => {
      if (!active || tool !== "probe") return;
      const rgb = sampleRgbWindow(active.imageData, imgX, imgY);
      const point: ProbePoint = {
        x: imgX,
        y: imgY,
        rgb,
        label: probeDraft ? "P2" : "P1",
      };
      if (!probeDraft) {
        setProbeDraft(point);
        return;
      }
      const probe = evaluateProbe(
        { ...probeDraft, label: "P1" },
        point,
        settings.deltaEThreshold
      );
      const updated = { ...active, probe };
      if (active.id === "A") setDocA(updated);
      else setDocB(updated);
      setProbeDraft(null);
    },
    [active, tool, probeDraft, settings.deltaEThreshold]
  );

  const onExport = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      const blob = await exportReportPng({
        doc: active,
        compare:
          compareMode && docA && docB && compareSummary
            ? {
                other: active.id === "A" ? docB : docA,
                summary: compareSummary,
              }
            : null,
      });
      downloadBlob(
        blob,
        `see-the-route-report-${active.name.replace(/\W+/g, "_")}.png`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [active, compareMode, docA, docB, compareSummary]);

  // Re-analyze when thresholds change (keep image)
  const reanalyze = useCallback(() => {
    if (!docA && !docB) return;
    setBusy(true);
    try {
      const run = (doc: ImageDoc): ImageDoc => {
        const { clusters, findings } = analyzeImageData(
          doc.imageData,
          settings
        );
        const probe = doc.probe
          ? evaluateProbe(doc.probe.a, doc.probe.b, settings.deltaEThreshold)
          : null;
        return { ...doc, clusters, findings, probe };
      };
      if (docA) setDocA(run(docA));
      if (docB) setDocB(run(docB));
    } finally {
      setBusy(false);
    }
  }, [docA, docB, settings]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-3">
        <div className="mr-2 flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight">
            See-the-Route
          </span>
          <span className="hidden text-[11px] text-[var(--dim)] sm:inline">
            Machado 2009 · CIEDE2000
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />

        <BarBtn onClick={() => fileRef.current?.click()}>Open</BarBtn>
        <BarBtn onClick={() => void captureTab()}>Capture</BarBtn>
        <BarBtn
          active={compareMode}
          onClick={() => setCompareMode((v) => !v)}
        >
          Compare A/B
        </BarBtn>
        <BarBtn onClick={() => void onExport()} disabled={!active || busy}>
          Export report
        </BarBtn>
        <BarBtn
          active={showSettings}
          onClick={() => setShowSettings((v) => !v)}
        >
          Settings
        </BarBtn>

        <div className="ml-auto flex items-center gap-2">
          {SAMPLES.map((s) => (
            <BarBtn key={s.id} onClick={() => void onSample(s)} muted>
              {s.label}
            </BarBtn>
          ))}
        </div>
      </header>

      {showSettings && (
        <div className="flex flex-wrap items-end gap-4 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[12px]">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">ΔE fail threshold</span>
            <input
              type="number"
              min={5}
              max={40}
              value={settings.deltaEThreshold}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  deltaEThreshold: Number(e.target.value) || 15,
                }))
              }
              className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">Min ΔE (normal)</span>
            <input
              type="number"
              min={10}
              max={60}
              value={settings.minNormalDeltaE}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  minNormalDeltaE: Number(e.target.value) || 20,
                }))
              }
              className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono"
            />
          </label>
          <label className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={settings.lowVision.enabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  lowVision: { ...s.lowVision, enabled: e.target.checked },
                }))
              }
            />
            <span>Low-vision preview (optional)</span>
          </label>
          {settings.lowVision.enabled && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--muted)]">
                  Blur σ ({settings.lowVision.blurSigma})
                </span>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.5}
                  value={settings.lowVision.blurSigma}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      lowVision: {
                        ...s.lowVision,
                        blurSigma: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--muted)]">
                  Contrast ({settings.lowVision.contrast.toFixed(2)})
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={settings.lowVision.contrast}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      lowVision: {
                        ...s.lowVision,
                        contrast: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
            </>
          )}
          <BarBtn onClick={reanalyze}>Apply thresholds</BarBtn>
          <p className="max-w-md text-[11px] text-[var(--dim)]">
            Pairs fail when CIEDE2000 under CVD drops below the threshold while
            remaining ≥ min ΔE in Normal. Low-vision is preview-only — never
            auto-flagged as CVD risk.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="border-b border-[var(--border)] bg-[#2a1818] px-3 py-1.5 text-[12px] text-[#e8b4b4]"
        >
          {error}
        </div>
      )}

      {compareMode && (
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-[12px]">
          <span className="text-[var(--muted)]">Active slot</span>
          {(["A", "B"] as const).map((s) => (
            <BarBtn
              key={s}
              active={activeSlot === s}
              onClick={() => setActiveSlot(s)}
            >
              Image {s}
              {s === "A" && docA ? ` · ${docA.name}` : ""}
              {s === "B" && docB ? ` · ${docB.name}` : ""}
            </BarBtn>
          ))}
          {compareSummary && (
            <span className="ml-2 text-[var(--accent)]">
              {compareSummary.sentence}
            </span>
          )}
        </div>
      )}

      {/* Main workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Left: source + overlay */}
        <section className="flex min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <div className="flex h-9 items-center gap-2 border-b border-[var(--border)] px-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
              Source
            </span>
            <div className="ml-auto flex gap-1">
              <BarBtn
                active={tool === "select"}
                onClick={() => setTool("select")}
                muted
              >
                Select finding
              </BarBtn>
              <BarBtn
                active={tool === "probe"}
                onClick={() => {
                  setTool("probe");
                  setProbeDraft(null);
                }}
                muted
              >
                Eyedropper
                {probeDraft ? " · click P2" : " · click P1"}
              </BarBtn>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[#0a0c0e] p-2">
            {active ? (
              <ImageStage
                url={active.url}
                width={active.width}
                height={active.height}
                finding={selectedFinding}
                probe={active.probe}
                probeDraft={probeDraft}
                onClick={onCanvasClick}
                interactive={tool === "probe"}
              />
            ) : (
              <EmptyHint busy={busy} />
            )}
          </div>
        </section>

        {/* Right: simulation strip */}
        <section className="flex min-h-0 flex-col">
          <div className="flex h-9 items-center gap-2 border-b border-[var(--border)] px-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
              Simulations
            </span>
            {busy && (
              <span className="text-[11px] text-[var(--accent)]">Working…</span>
            )}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-auto bg-[var(--border)]">
            {CVD_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSimFocus(mode)}
                className={`flex flex-col bg-[var(--panel)] text-left ${
                  simFocus === mode ? "ring-1 ring-inset ring-[var(--accent)]" : ""
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[var(--muted)]">
                  <span>{CVD_LABELS[mode]}</span>
                  {selectedFinding && selectedFinding.mode === mode && (
                    <span className="text-[var(--accent)]">focus</span>
                  )}
                </div>
                <div className="relative min-h-[120px] flex-1 bg-black/40">
                  {active?.sims[mode] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={active.sims[mode]}
                      alt={CVD_LABELS[mode]}
                      className="h-full w-full object-contain"
                    />
                  )}
                  {active && selectedFinding && mode === selectedFinding.mode && (
                    <OverlayBoxes
                      width={active.width}
                      height={active.height}
                      finding={selectedFinding}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
          {lvPreviewUrl && (
            <div className="border-t border-[var(--border)] p-2">
              <div className="mb-1 text-[11px] text-[var(--dim)]">
                Low-vision simulation (preview only — not in CVD findings)
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lvPreviewUrl}
                alt="Low vision preview"
                className="max-h-40 w-full object-contain"
              />
            </div>
          )}
        </section>
      </div>

      {/* Probe metrics */}
      {active?.probe && (
        <div className="border-t border-[var(--border)] bg-[var(--panel)] px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-3 text-[12px]">
            <span className="text-[var(--muted)]">Eyedropper probe</span>
            <Swatch rgb={active.probe.a.rgb} label="P1" />
            <Swatch rgb={active.probe.b.rgb} label="P2" />
            <span className="text-[var(--dim)]">
              Pass if CIEDE2000 ≥ {active.probe.threshold}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CVD_MODES.map((m) => {
              const cell = active.probe!.byMode[m];
              return (
                <div
                  key={m}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted)]">
                      {CVD_LABELS[m]}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        cell.pass ? "text-[var(--ok)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {cell.pass ? "pass" : "fail"}
                    </span>
                  </div>
                  <div className="mono text-[14px]">
                    ΔE {cell.deltaE.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Findings drawer */}
      <section className="flex max-h-[38vh] shrink-0 flex-col border-t border-[var(--border)] bg-[var(--panel)]">
        <div className="flex h-8 items-center gap-3 border-b border-[var(--border)] px-3 text-[11px]">
          <span className="uppercase tracking-wide text-[var(--dim)]">
            Findings
          </span>
          <span className="mono text-[var(--muted)]">
            {findings.filter((f) => f.severity === "high").length} high ·{" "}
            {findings.filter((f) => f.severity === "medium").length} med ·{" "}
            {findings.filter((f) => f.severity === "low").length} low
          </span>
          <label className="ml-auto flex items-center gap-1 text-[var(--muted)]">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5"
            >
              <option value="severity">severity</option>
              <option value="collapse">ΔE collapse</option>
              <option value="mode">simulation</option>
            </select>
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[var(--panel-2)] text-[11px] text-[var(--dim)]">
              <tr>
                <th className="px-2 py-1 font-medium">Sev</th>
                <th className="px-2 py-1 font-medium">Pair / region</th>
                <th className="px-2 py-1 font-medium">Metric</th>
                <th className="px-2 py-1 font-medium">Mode</th>
                <th className="px-2 py-1 font-medium">Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {findings.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[var(--dim)]"
                  >
                    {active
                      ? "No confusable pairs under current thresholds."
                      : "Open an image or load a sample."}
                  </td>
                </tr>
              )}
              {findings.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => {
                    setSelectedFindingId(f.id);
                    setSimFocus(f.mode);
                    setTool("select");
                  }}
                  className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.03] ${
                    selectedFinding?.id === f.id ? "bg-white/[0.05]" : ""
                  }`}
                >
                  <td className="px-2 py-1.5">
                    <SevBadge s={f.severity} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm border border-black/40"
                        style={{ background: rgbCss(f.a.mean) }}
                      />
                      <span
                        className="inline-block h-3 w-3 rounded-sm border border-black/40"
                        style={{ background: rgbCss(f.b.mean) }}
                      />
                      <span>{f.title}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 mono text-[11px] text-[var(--muted)]">
                    {f.metric}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--muted)]">
                    {CVD_LABELS[f.mode]}
                  </td>
                  <td className="max-w-[280px] px-2 py-1.5 text-[var(--dim)]">
                    {f.suggestion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--border)] px-3 py-1 text-[10px] text-[var(--dim)]">
          Heuristic research instrument — not a formal WCAG audit. Paste
          screenshot with ⌘V / Ctrl+V.
        </div>
      </section>
    </div>
  );
}

function BarBtn({
  children,
  onClick,
  active,
  disabled,
  muted,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[12px] transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
          : muted
            ? "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-white/[0.03]"
            : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[#3a414a]"
      }`}
    >
      {children}
    </button>
  );
}

function SevBadge({ s }: { s: ConfusablePair["severity"] }) {
  const color =
    s === "high"
      ? "bg-[var(--danger)]/20 text-[var(--danger)]"
      : s === "medium"
        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
        : "bg-[var(--ok)]/20 text-[var(--ok)]";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${color}`}
    >
      {s}
    </span>
  );
}

function Swatch({ rgb, label }: { rgb: { r: number; g: number; b: number }; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 mono text-[11px]">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-[var(--border)]"
        style={{ background: rgbCss(rgb) }}
      />
      {label} {rgbHex(rgb)}
    </span>
  );
}

function EmptyHint({ busy }: { busy: boolean }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center text-[12px] text-[var(--dim)]">
      {busy
        ? "Analysing…"
        : "Open image, Capture, paste (⌘V), or load a sample."}
    </div>
  );
}

function ImageStage({
  url,
  width,
  height,
  finding,
  probe,
  probeDraft,
  onClick,
  interactive,
}: {
  url: string;
  width: number;
  height: number;
  finding: ConfusablePair | null;
  probe: ImageDoc["probe"];
  probeDraft: ProbePoint | null;
  onClick: (x: number, y: number) => void;
  interactive: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handle = (e: React.MouseEvent) => {
    if (!interactive || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    onClick(x, y);
  };

  return (
    <div ref={wrapRef} className="relative inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt="Source"
        width={width}
        height={height}
        onClick={handle}
        className={`max-h-[min(58vh,720px)] w-auto max-w-full object-contain ${
          interactive ? "cursor-crosshair" : ""
        }`}
      />
      {finding && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {[finding.a, finding.b].map((c) => (
            <g key={c.id}>
              <rect
                x={c.bbox.x}
                y={c.bbox.y}
                width={c.bbox.w}
                height={c.bbox.h}
                fill="none"
                stroke="#c49a3c"
                strokeWidth={Math.max(2, width / 400)}
              />
              <text
                x={c.bbox.x}
                y={Math.max(12, c.bbox.y - 4)}
                fill="#c49a3c"
                fontSize={Math.max(11, width / 70)}
                fontFamily="ui-monospace, monospace"
              >
                {c.label}
              </text>
            </g>
          ))}
          <rect
            x={unionBBox(finding.a.bbox, finding.b.bbox).x}
            y={unionBBox(finding.a.bbox, finding.b.bbox).y}
            width={unionBBox(finding.a.bbox, finding.b.bbox).w}
            height={unionBBox(finding.a.bbox, finding.b.bbox).h}
            fill="rgba(196,154,60,0.06)"
            stroke="none"
          />
        </svg>
      )}
      {(probe || probeDraft) && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {probeDraft && (
            <circle
              cx={probeDraft.x}
              cy={probeDraft.y}
              r={6}
              fill="#c49a3c"
              stroke="#0f1113"
              strokeWidth={2}
            />
          )}
          {probe &&
            [probe.a, probe.b].map((p) => (
              <g key={p.label}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill={rgbCss(p.rgb)}
                  stroke="#e8eaed"
                  strokeWidth={2}
                />
                <text
                  x={p.x + 10}
                  y={p.y - 8}
                  fill="#e8eaed"
                  fontSize={12}
                  fontFamily="ui-monospace, monospace"
                >
                  {p.label}
                </text>
              </g>
            ))}
        </svg>
      )}
    </div>
  );
}

function OverlayBoxes({
  width,
  height,
  finding,
}: {
  width: number;
  height: number;
  finding: ConfusablePair;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {[finding.a, finding.b].map((c) => (
        <rect
          key={c.id}
          x={c.bbox.x}
          y={c.bbox.y}
          width={c.bbox.w}
          height={c.bbox.h}
          fill="none"
          stroke="#c45c5c"
          strokeWidth={Math.max(2, width / 350)}
        />
      ))}
    </svg>
  );
}
