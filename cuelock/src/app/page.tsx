import Link from "next/link";

export default function ScintillaHome() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0f1113] text-[#e8eaed] selection:bg-[#c49a3c]/30">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Scintilla
        </h1>
        <p className="mb-8 max-w-[600px] text-lg text-[#8b929a] sm:text-xl">
          Accessible routing — plan travel with real accessibility needs in mind.
        </p>
        
        <ul className="mb-10 flex flex-col gap-3 text-sm text-[#c5cad0] sm:flex-row sm:gap-6 sm:text-base">
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c49a3c]" />
            Accessible routing focus
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c49a3c]" />
            Colour-vision aware design
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c49a3c]" />
            Research tooling via CueLock
          </li>
        </ul>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/cuelock"
            className="rounded-md bg-[#c49a3c] px-6 py-2.5 text-sm font-semibold text-[#0f1113] transition hover:bg-[#d4a849]"
          >
            Open CueLock
          </Link>
          <a
            href="https://github.com/neervasa00000000"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[#2a2f36] bg-[#171a1d] px-6 py-2.5 text-sm font-semibold text-[#e8eaed] transition hover:border-[#3a414a] hover:bg-[#1c2024]"
          >
            GitHub
          </a>
        </div>
      </main>

      <footer className="border-t border-[#2a2f36] py-6 text-center text-xs text-[#5c6570]">
        <p>Neer Vasa · Monash MIT · scintilla.world</p>
      </footer>
    </div>
  );
}
