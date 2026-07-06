import { RoutePlanner } from "@/components/RoutePlanner";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Zippy <span className="text-sky-400">⚡</span>
          </h1>
          <p className="text-sm text-slate-400">
            Wormhole-aware route planner for EVE Online. Gates + live holes, shortest path.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <a
            className="text-slate-300 hover:text-sky-300"
            href="https://github.com/PaulClavet/zippy"
            target="_blank"
            rel="noreferrer"
          >
            Zippy on GitHub ↗
          </a>
          <a
            className="text-slate-500 hover:text-slate-300"
            href="https://github.com/secondfry/shortcircuit/"
            target="_blank"
            rel="noreferrer"
          >
            inspired by Short Circuit ↗
          </a>
        </div>
      </header>

      <RoutePlanner />

      <footer className="mt-10 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        Zippy — free software under{" "}
        <a className="hover:text-slate-400" href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
          AGPL-3.0
        </a>
        , no warranty ·{" "}
        <a className="hover:text-slate-400" href="https://github.com/PaulClavet/zippy" target="_blank" rel="noreferrer">
          source code
        </a>
        . EVE Online is a trademark of CCP hf. Not affiliated with CCP.
      </footer>
    </main>
  );
}
