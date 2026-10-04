import Link from "next/link";

export default function ScintillaHome() {
  return <div className="home-shell">
    <header className="app-header">
      <Link href="/" className="brand" aria-label="Scintilla home"><span className="brand-mark" aria-hidden="true">S</span> Scintilla</Link>
      <span className="header-tag">Tools for clearer maps</span>
    </header>
    <main className="home-main">
      <div className="home-hero">
        <div>
          <p className="eyebrow">Introducing CueLock</p>
          <h1>Can everyone read your map?</h1>
          <p>Colour alone can make a route, hazard, or destination hard to recognise. CueLock checks critical map cues under simulated colour vision differences, then shows how pattern, shape, and labels can help.</p>
          <div className="home-actions"><Link className="button button-primary" href="/cuelock">Try the Melbourne demo <span aria-hidden="true">↗</span></Link><a className="button button-secondary" href="https://github.com/neervasa00000000" target="_blank" rel="noopener noreferrer">View GitHub</a></div>
        </div>
        <div className="home-preview" aria-hidden="true">
          <span className="preview-label">MELBOURNE DEMO</span>
          <div className="preview-route preview-route-a" />
          <div className="preview-route preview-route-b" />
          <span className="preview-pin preview-start">A</span><span className="preview-pin preview-end">B</span>
          <div className="preview-status"><span>✓</span> Clear with shape + pattern</div>
        </div>
      </div>
      <section className="home-how" aria-labelledby="how-title">
        <div className="home-how-intro"><p className="eyebrow">How it works</p><h2 id="how-title">A practical check for map designers.</h2></div>
        <div className="home-cards"><article><span>01</span><h3>Check</h3><p>Compare routes and markers across three simulated colour vision modes.</p></article><article><span>02</span><h3>Improve</h3><p>Apply distinct line patterns, marker shapes, and labels to the demo.</p></article><article><span>03</span><h3>Share</h3><p>Export a testing report with results, cue states, and the method used.</p></article></div>
      </section>
      <p className="method-note">CueLock is a research tool for evaluating visual map cues. It is not a journey planner or a WCAG certification.</p>
    </main>
    <footer className="app-footer">Neer Vasa · Monash MIT <Link href="/cuelock">Open CueLock</Link></footer>
  </div>;
}
