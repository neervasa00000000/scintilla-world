"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FailuresPanel, SimulationGrid } from "@/components/SimulationGrid";
import { UploadZone } from "@/components/UploadZone";
import {
  SIMULATION_ORDER,
  downscaleImageData,
  imageDataToObjectUrl,
  imageToImageData,
  loadImageFile,
  loadImageUrl,
  processImageData,
  type SimulationKind,
} from "@/lib/cvd";
import { analyzeFailures, type FailureReport } from "@/lib/heuristics";
import { downloadBlob, exportStressCard } from "@/lib/stressCard";

const SAMPLES = [
  { id: "transit", label: "Transit lines", src: "/samples/transit-map.png" },
  { id: "nav", label: "Turn-by-turn", src: "/samples/nav-route.png" },
  { id: "legend", label: "Legend chips", src: "/samples/legend-heavy.png" },
];

export function AppShell() {
  const [panels, setPanels] = useState<Partial<Record<SimulationKind, string>>>(
    {}
  );
  const [report, setReport] = useState<FailureReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const runPipeline = useCallback(async (img: HTMLImageElement, name: string) => {
    setLoading(true);
    setError(null);
    setSourceName(name);
    try {
      const full = imageToImageData(img);
      const work = downscaleImageData(full, 720);

      // Yield so loading state paints
      await new Promise((r) => setTimeout(r, 16));

      const next: Partial<Record<SimulationKind, string>> = {};
      for (const kind of SIMULATION_ORDER) {
        const processed = processImageData(work, kind);
        next[kind] = imageDataToObjectUrl(processed);
        // progressive reveal
        setPanels((prev) => ({ ...prev, [kind]: next[kind] }));
        await new Promise((r) => setTimeout(r, 0));
      }

      const failureReport = analyzeFailures(work);
      setReport(failureReport);
      setPanels(next);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const onFile = useCallback(
    async (file: File) => {
      try {
        const img = await loadImageFile(file);
        await runPipeline(img, file.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read image");
      }
    },
    [runPipeline]
  );

  const onSample = useCallback(
    async (src: string, label: string) => {
      try {
        const img = await loadImageUrl(src);
        await runPipeline(img, label);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load sample");
      }
    },
    [runPipeline]
  );

  const onExport = useCallback(async () => {
    if (!panels.normal || !report) return;
    setExporting(true);
    try {
      const blob = await exportStressCard({
        panels,
        flags: report.flags,
        sourceName,
      });
      downloadBlob(blob, "see-the-route-stress-card.png");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [panels, report, sourceName]);

  const canExport = Boolean(panels.normal && report && !loading);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07080c] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(61,255,168,0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(80,120,255,0.06), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <header className="relative z-10 border-b border-white/6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">
              See-the-Route
            </span>
            <span className="hidden text-[11px] text-zinc-600 sm:inline">
              scintilla.world
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-xs text-zinc-500">
            <a
              href="#method"
              className="rounded px-2 py-1 transition hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              Method
            </a>
            <a
              href="https://github.com/neervasa00000000"
              target="_blank"
              rel="noreferrer"
              className="rounded px-2 py-1 transition hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-400/90">
            Accessibility research tool
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            See-the-Route
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            Stress-test map and routing UIs for colour vision deficiency and low
            vision.
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            Built for accessibility research demos — not another AI wrapper.
          </p>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_280px]">
          <UploadZone onFile={onFile} disabled={loading} />
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/8 bg-[#0e1117] p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Demo pack
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Zero upload — load a sample map UI.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onSample(s.src, s.label)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-50"
                >
                  Load sample · {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canExport || exporting}
            onClick={onExport}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#04110a] transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? "Exporting…" : "Export stress card"}
          </button>
          {sourceName && (
            <span className="font-mono text-xs text-zinc-600">
              Active: {sourceName}
            </span>
          )}
        </div>

        <div className="mt-12 space-y-12">
          <SimulationGrid panels={panels} loading={loading} />
          <FailuresPanel report={report} />
        </div>

        <section
          id="method"
          className="mt-16 rounded-2xl border border-white/8 bg-[#0e1117] p-6 sm:p-8"
        >
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
            Method
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-500">
            <p>
              <span className="text-zinc-300">CVD model:</span> Machado,
              Oliveira &amp; Fernandes (2009) linear-RGB 3×3 transforms at
              severity 1.0 (dichromacy), applied after sRGB→linear decode and
              re-encoded to sRGB. Not CSS hue-rotate.
            </p>
            <p>
              <span className="text-zinc-300">Low vision:</span> mild separable
              blur approximating a Gaussian, plus contrast compression toward
              mid-grey.
            </p>
            <p>
              <span className="text-zinc-300">Heuristics:</span> red–green
              separation collapse under protanopia/deuteranopia, legend-like
              saturated chip confusion, local edge-contrast drop, and
              luminance-similar red/green adjacency. Flags are for research
              demos — not a WCAG audit.
            </p>
            <p>
              <span className="text-zinc-300">Research question:</span> How
              often do popular route/map UIs fail under CVD and low vision?
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Built by Neer Vasa · Monash MIT ·{" "}
            <a
              href="https://scintilla.world"
              className="text-zinc-400 underline-offset-2 hover:underline"
            >
              scintilla.world
            </a>
          </p>
          <p>
            <a
              href="https://github.com/neervasa00000000"
              className="text-zinc-400 underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              github.com/neervasa00000000
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
