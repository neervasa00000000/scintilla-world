"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { installWindowAPI } from "@/lib/api";
import { copyTestingReport, failingCueIds } from "@/lib/export";
import { buildProblems, plainSummary } from "@/lib/plainEnglish";
import {
  applyFix,
  loadMelbourneDemo,
  runCheck,
  type AppSnapshot,
} from "@/lib/store";
import { MapPane } from "@/components/MapPane";

export function ToolApp() {
  const [snap, setSnap] = useState<AppSnapshot>(() => loadMelbourneDemo(15));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [threshold, setThreshold] = useState(15);
  const [resetToken, setResetToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  useEffect(() => {
    installWindowAPI();
  }, []);

  const problems = useMemo(
    () => (snap.lastResult ? buildProblems(snap.lastResult) : []),
    [snap.lastResult]
  );
  const summary = useMemo(
    () =>
      snap.lastResult ? plainSummary(snap.lastResult, problems) : null,
    [snap.lastResult, problems]
  );
  const failIds = useMemo(
    () => (snap.lastResult ? failingCueIds(snap.lastResult) : new Set<string>()),
    [snap.lastResult]
  );
  const callouts = useMemo(() => {
    if (snap.phase === "checked_pass") return [];
    const preferred = [
      "These two routes look too similar",
      "Hazard may be missed",
    ];
    const fromProblems = [...new Set(problems.map((p) => p.mapCallout))];
    const ordered = preferred.filter((c) => fromProblems.includes(c));
    const rest = fromProblems.filter((c) => !preferred.includes(c));
    return [...ordered, ...rest].slice(0, 2);
  }, [problems, snap.phase]);

  const onDemo = useCallback(() => {
    setError(null);
    const next = loadMelbourneDemo(threshold);
    setSnap(next);
    setResetToken((t) => t + 1);
    setOpenDetails({});
  }, [threshold]);

  const onCheck = useCallback(() => {
    setError(null);
    setSnap((s) => runCheck(s.cues, threshold, s.demo, s.fixChanges));
  }, [threshold]);

  const onFix = useCallback(() => {
    setError(null);
    try {
      setSnap((s) => {
        const next = applyFix(s.cues, threshold, s.demo);
        if (!next.lastResult?.summary.pass) {
          console.warn("Fix applied but still FAIL", next.lastResult?.summary);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fix failed");
    }
  }, [threshold]);

  const onCopy = useCallback(async () => {
    if (!snap.lastResult) return;
    await copyTestingReport(snap.lastResult, {
      demo: snap.demo,
      appUrl: window.location.href,
      fixChanges: snap.fixChanges,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [snap]);

  const topProblems = problems.slice(0, 3);
  const isPass = snap.phase === "checked_pass";

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel)] px-2">
        <span className="mr-2 px-1 text-[13px] font-semibold">CueLock</span>
        <Btn onClick={onDemo}>Melbourne demo</Btn>
        <Btn accent onClick={onCheck}>
          Check
        </Btn>
        <Btn onClick={onFix}>Fix automatically</Btn>
        <Btn onClick={() => void onCopy()} disabled={!snap.lastResult}>
          {copied ? "Copied" : "Copy testing report"}
        </Btn>
        <button
          type="button"
          className="ml-auto text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? "Hide advanced" : "Advanced"}
        </button>
      </header>

      {copied && (
        <div className="border-b border-[var(--border)] bg-[#142018] px-3 py-1.5 text-[12px] text-[var(--ok)]">
          Testing report copied
        </div>
      )}

      {error && (
        <div className="border-b border-[var(--border)] bg-[#2a1818] px-3 py-1.5 text-[12px] text-[var(--danger)]">
          {error}
        </div>
      )}

      {summary && (
        <div
          className={`border-b border-[var(--border)] px-4 py-3 text-[15px] font-medium ${
            isPass ? "bg-[#142018] text-[var(--ok)]" : "bg-[#2a1818] text-[#f0c0c0]"
          }`}
        >
          {isPass
            ? "All clear — critical cues stay distinguishable."
            : `${summary.problemCount} problems — some routes/markers look the same for colour-blind users.`}
        </div>
      )}

      {advancedOpen && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[12px]">
          <label className="flex items-center gap-2 text-[var(--muted)]">
            ΔE threshold
            <input
              type="number"
              min={5}
              max={40}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 15)}
              className="mono w-16 rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5"
            />
          </label>
          <span className="text-[11px] text-[var(--dim)]">
            Machado 2009 · CIEDE2000 · dual-encoding gate · phase: {snap.phase}
          </span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.65fr)_minmax(280px,0.35fr)]">
        <section className="relative min-h-[360px] border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <MapPane
            cues={snap.cues}
            failingIds={failIds}
            callouts={callouts}
            resetToken={resetToken}
          />
        </section>

        <section className="flex min-h-0 flex-col bg-[var(--panel)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[12px] text-[var(--muted)]">
            Problems
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {isPass ? (
              <div className="rounded-lg border border-[var(--ok)]/35 bg-[var(--ok)]/10 p-4">
                <p className="text-[14px] font-semibold text-[var(--ok)]">
                  Fixed.
                </p>
                <p className="mt-2 text-[13px] text-[var(--text)]">
                  {snap.fixChanges.length
                    ? snap.fixChanges.join(". ") + "."
                    : "Backup route is dashed; hazard has an icon + label."}
                </p>
                <div className="mt-4">
                  <Btn accent onClick={() => void onCopy()}>
                    {copied ? "Copied" : "Copy testing report"}
                  </Btn>
                </div>
              </div>
            ) : (
              topProblems.map((p) => (
                <article
                  key={p.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3"
                >
                  <h3 className="text-[13px] font-semibold">{p.title}</h3>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    Affects: {p.affectsPlain.replace(/ \(.*\)/, "")}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--accent)]">
                    Fix: {p.fixPlain}
                  </p>
                  <p className="mono mt-1 text-[11px] text-[var(--dim)]">
                    difference {p.deltaEBefore.toFixed(0)} →{" "}
                    {p.deltaEAfter.toFixed(0)} (need {p.threshold})
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-[var(--dim)] underline-offset-2 hover:underline"
                    onClick={() =>
                      setOpenDetails((s) => ({ ...s, [p.id]: !s[p.id] }))
                    }
                  >
                    {openDetails[p.id] ? "Hide details" : "Details"}
                  </button>
                  {openDetails[p.id] && (
                    <p className="mt-1 text-[11px] text-[var(--dim)]">
                      {p.whatHappens} · {p.technicalLine}
                    </p>
                  )}
                </article>
              ))
            )}
            {!isPass && topProblems.length === 0 && (
              <p className="text-[12px] text-[var(--dim)]">
                Click Check to evaluate cues.
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-[var(--border)] px-3 py-1 text-[10px] text-[var(--dim)]">
        CueLock · Neer Vasa · Monash MIT · scintilla.world
      </footer>
    </div>
  );
}

function Btn({
  children,
  onClick,
  accent,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[12px] transition disabled:opacity-40 ${
        accent
          ? "border-[var(--accent)] bg-[var(--accent)]/20"
          : "border-[var(--border)] bg-[var(--bg)] hover:border-[#3a414a]"
      }`}
    >
      {children}
    </button>
  );
}
