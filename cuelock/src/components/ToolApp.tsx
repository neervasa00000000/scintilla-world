"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { installWindowAPI } from "@/lib/api";
import { buildTestingReport, downloadTestingReport, failingCueIds } from "@/lib/export";
import { buildProblems } from "@/lib/plainEnglish";
import { applyFix, loadMelbourneDemo, runCheck, type AppSnapshot } from "@/lib/store";
import { MapPane } from "@/components/MapPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function ToolApp() {
  const [snap, setSnap] = useState<AppSnapshot>(() => loadMelbourneDemo());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { installWindowAPI(); }, []);

  const problems = useMemo(() => snap.lastResult ? buildProblems(snap.lastResult) : [], [snap.lastResult]);
  const failingIds = useMemo(() => snap.lastResult ? failingCueIds(snap.lastResult) : new Set<string>(), [snap.lastResult]);
  const isPass = snap.phase === "checked_pass";
  const callouts = isPass ? [] : [...new Set(problems.map((p) => p.mapCallout))].slice(0, 2);

  function resetDemo() {
    setSnap(loadMelbourneDemo(snap.threshold));
    setNotice("Demo reset to its original cues.");
    setError("");
  }
  function check(threshold = snap.threshold) {
    try {
      const next = runCheck(snap.cues, threshold, snap.demo, snap.fixChanges);
      setSnap(next);
      setNotice(next.phase === "checked_pass" ? "Check complete: all critical cues pass." : "Check complete: review the issues below.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The check could not finish.");
    }
  }
  function fix() {
    try {
      const next = applyFix(snap.cues, snap.threshold, snap.demo, snap.fixChanges);
      setSnap(next);
      setNotice(next.phase === "checked_pass" ? "Suggested changes applied and checked again." : "Changes applied. Some issues still need attention.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The suggested changes could not be applied.");
    }
  }
  function reportContext() {
    return {
      demo: snap.demo,
      appUrl: window.location.href,
      fixChanges: snap.fixChanges,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
    };
  }
  async function copyReport() {
    if (!snap.lastResult) return;
    try {
      await navigator.clipboard.writeText(buildTestingReport(snap.lastResult, reportContext()));
      setNotice("Testing report copied.");
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Use Download report instead.");
    }
  }
  function downloadReport() {
    if (!snap.lastResult) return;
    downloadTestingReport(snap.lastResult, reportContext());
    setNotice("Testing report downloaded.");
    setError("");
  }

  return <div className="app-shell">
    <a className="skip-link" href="#results">Skip to results</a>
    <header className="app-header">
      <Link href="/" className="brand" aria-label="Scintilla home"><span className="brand-mark" aria-hidden="true">S</span> Scintilla</Link>
      <span className="brand-divider" aria-hidden="true" />
      <span className="product-name">CueLock</span>
      <span className="header-tag">Map cue checker</span>
    </header>
    <main className="workspace-page">
      <section className="workspace-intro" aria-labelledby="page-title">
        <div><p className="eyebrow">Interactive Melbourne demo</p><h1 id="page-title">Make every map cue clear.</h1>
          <p className="intro-copy">Check whether routes and markers stay distinguishable for people with colour vision differences. Explore the issues, apply suggested visual cues, then export the result.</p></div>
        <ol className="steps" aria-label="How CueLock works"><li><span>1</span> Check cues</li><li><span>2</span> Review issues</li><li><span>3</span> Apply and export</li></ol>
      </section>
      <section className="work-panel" aria-label="CueLock demo">
        <div className="toolbar"><div className="toolbar-main">
          <button type="button" className="button button-secondary" onClick={resetDemo}>Reset demo</button>
          <button type="button" className="button button-secondary" onClick={() => check()}>Run check</button>
          <button type="button" className="button button-primary" onClick={fix} disabled={isPass}>Apply suggested fixes</button>
        </div><button type="button" className="button button-text" aria-expanded={settingsOpen} aria-controls="check-settings" onClick={() => setSettingsOpen(!settingsOpen)}>{settingsOpen ? "Hide settings" : "Check settings"}</button></div>
        {settingsOpen && <div id="check-settings" className="settings-panel"><label htmlFor="threshold">Colour difference threshold</label>
          <select id="threshold" value={snap.threshold} onChange={(event) => check(Number(event.target.value))}>{[10,15,20,25,30].map((value) => <option key={value} value={value}>ΔE {value}{value === 15 ? " (default)" : ""}</option>)}</select>
          <p>Higher values flag more colour pairs. Changing this setting runs the check again.</p></div>}
        <div className={`result-banner ${isPass ? "result-pass" : "result-fail"}`} role="status" aria-live="polite">
          <span className="result-icon" aria-hidden="true">{isPass ? "✓" : "!"}</span><div>
            <h2>{isPass ? "All critical cue pairs pass" : `${problems.length} issues need attention`}</h2>
            <p>{isPass ? "Routes and markers have a visual cue beyond colour where needed." : "Some routes or markers could be confused under simulated colour vision differences."}</p>
          </div></div>
        <div className="feedback" aria-live="polite">{notice && <p>{notice}</p>}{error && <p className="feedback-error" role="alert">{error}</p>}</div>
        <div className="workspace-grid">
          <section className="map-section" aria-label="Melbourne demonstration map">
            <div className="section-heading"><div><span className="eyebrow">Map preview</span><h2>Flinders Street to Melbourne Central</h2></div><span className="demo-pill">Demo data</span></div>
            <div className="map-frame"><ErrorBoundary><MapPane cues={snap.cues} failingIds={failingIds} callouts={callouts} /></ErrorBoundary></div>
          </section>
          <section className="results-section" id="results" aria-labelledby="results-title">
            <div className="section-heading"><div><span className="eyebrow">Check results</span><h2 id="results-title">{isPass ? "What changed" : `Issues (${problems.length})`}</h2></div></div>
            <div className="results-body">{isPass ? <div className="success-card"><span className="success-mark" aria-hidden="true">✓</span><h3>Ready to share</h3>
              <p>The check passes for the simulated vision modes. The demo uses line pattern, marker shape, and labels to reinforce meaning.</p>
              {snap.fixChanges.length > 0 && <ul>{snap.fixChanges.map((change, index) => <li key={index}>{change}</li>)}</ul>}</div>
            : problems.map((problem, index) => <details className="issue-card" key={problem.id} open={index === 0}>
                <summary><span className="issue-number">{String(index + 1).padStart(2, "0")}</span><span className="issue-title">{problem.title}<small>{problem.affectsPlain}</small></span><span className="disclosure-icon" aria-hidden="true">⌄</span></summary>
                <div className="issue-content"><p>{problem.whatHappens}</p><p><strong>Suggested fix:</strong> {problem.fixPlain}</p><p className="technical-detail">Colour difference: {problem.deltaEBefore.toFixed(1)} → {problem.deltaEAfter.toFixed(1)} under simulation. Threshold: {problem.threshold}.</p></div>
              </details>)}</div>
            <div className="export-panel"><h3>Testing report</h3><p>Includes cue states, simulated results, method, and changes made.</p><div className="export-actions"><button type="button" className="button button-secondary" onClick={() => void copyReport()}>Copy report</button><button type="button" className="button button-secondary" onClick={downloadReport}>Download report</button></div></div>
          </section>
        </div>
      </section>
      <p className="method-note">CueLock uses Machado 2009 simulation, CIEDE2000, and a dual encoding rule. It is a research tool, not a WCAG certification.</p>
    </main>
    <footer className="app-footer">CueLock · Neer Vasa · Monash MIT <Link href="/">Scintilla home</Link></footer>
  </div>;
}
