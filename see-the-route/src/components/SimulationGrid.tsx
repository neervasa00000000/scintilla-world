"use client";

import {
  SIMULATION_LABELS,
  type SimulationKind,
} from "@/lib/cvd";
import type { FailureFlag, FailureReport } from "@/lib/heuristics";

interface SimulationGridProps {
  panels: Partial<Record<SimulationKind, string>>;
  loading: boolean;
}

const ORDER: SimulationKind[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "lowVision",
];

export function SimulationGrid({ panels, loading }: SimulationGridProps) {
  return (
    <section aria-label="Vision simulations" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
            Vision simulations
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Same source · Machado et al. 2009 CVD matrices · canvas pixel pipeline
          </p>
        </div>
        {loading && (
          <span
            className="inline-flex items-center gap-2 text-xs text-emerald-300/90"
            role="status"
            aria-live="polite"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Simulating…
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ORDER.map((kind) => (
          <figure
            key={kind}
            className="overflow-hidden rounded-xl border border-white/8 bg-[#12151c]"
          >
            <div className="relative aspect-[4/3] bg-black/40">
              {panels[kind] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panels[kind]}
                  alt={`${SIMULATION_LABELS[kind]} simulation`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {loading ? "Processing" : "Awaiting image"}
                </div>
              )}
            </div>
            <figcaption className="border-t border-white/6 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              {SIMULATION_LABELS[kind]}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: FailureFlag["severity"] }) {
  const styles =
    severity === "High"
      ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
      : severity === "Medium"
        ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
        : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${styles}`}
    >
      {severity}
    </span>
  );
}

interface FailuresPanelProps {
  report: FailureReport | null;
}

export function FailuresPanel({ report }: FailuresPanelProps) {
  return (
    <section aria-label="Failures and risks" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
            Failures / Risks
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Heuristic flags for research demos — not a WCAG audit.
          </p>
        </div>
        {report && (
          <p className="font-mono text-xs text-zinc-400">
            High: {report.counts.high}
            <span className="mx-2 text-zinc-700">·</span>
            Medium: {report.counts.medium}
            <span className="mx-2 text-zinc-700">·</span>
            Low: {report.counts.low}
          </p>
        )}
      </div>

      {!report ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-8 text-center text-sm text-zinc-600">
          Upload or load a sample to generate risk flags.
        </div>
      ) : (
        <ul className="space-y-2">
          {report.flags.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-white/8 bg-[#12151c] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <h3 className="text-sm font-medium text-zinc-100">{f.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {f.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
