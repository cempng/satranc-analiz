import { lazy, Suspense, useEffect, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Board } from './components/Board';
import { CommentBox } from './components/CommentBox';
import { EnginePanel } from './components/EnginePanel';
import { EvalBar } from './components/EvalBar';
import { GameHeader } from './components/GameHeader';
import { MoveList } from './components/MoveList';
import { NavControls } from './components/NavControls';
import { PgnInput } from './components/PgnInput';
import { SettingsDialog } from './components/SettingsDialog';
import { SummaryPanel } from './components/SummaryPanel';
import { VariantPanel } from './components/VariantPanel';
import { useLiveAnalysis } from './engine/useLiveAnalysis';
import { useAnalysisStore } from './store/analysisStore';
import { useEngineStore } from './store/engineStore';
import { useCurrentFen, useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';

function useKeyboardNavigation() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, select, [role="dialog"], [contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useGameStore.getState();
      const actions: Record<string, () => void> = {
        ArrowLeft: s.prev,
        ArrowRight: s.next,
        Home: s.first,
        End: s.last,
        f: s.flip,
        F: s.flip,
      };
      const action = actions[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Yeni oyun yüklenince (motor hazırsa) tam-oyun analizini otomatik başlatır. */
function useAutoAnalyze() {
  const game = useGameStore((s) => s.game);
  const engineReady = useEngineStore((s) => s.status === 'ready');
  useEffect(() => {
    const analysis = useAnalysisStore.getState();
    if (!game || !engineReady || analysis.game === game) return;
    void analysis.start(game, useEngineStore.getState().depth);
  }, [game, engineReady]);
}

// Grafik kütüphanesi büyük olduğu için ayrı dosyada, gerektiğinde yüklenir.
const EvalChart = lazy(() => import('./components/EvalChart').then((m) => ({ default: m.EvalChart })));

export default function App() {
  useKeyboardNavigation();
  useLiveAnalysis(useCurrentFen());
  const game = useGameStore((s) => s.game);
  useAutoAnalyze();
  const [showInput, setShowInput] = useState(true);
  const inputVisible = showInput || !game;
  const [tab, setTab] = useState<'moves' | 'summary'>('moves');
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-sky-400">♞</span> Satranç Analiz
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-md px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ⚙ Ayarlar
        </button>
      </header>
      <SettingsDialog />

      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:flex-row lg:items-start">
        {/* Sol: eval bar + tahta + gezinme */}
        <section className="flex w-full flex-col gap-3 lg:max-w-[640px]">
          <div className="flex gap-2">
            <EvalBar />
            <div className="min-w-0 flex-1">
              <Board />
            </div>
          </div>
          <NavControls />
          <Suspense fallback={null}>
            <EvalChart />
          </Suspense>
          <p className="hidden text-center text-xs text-slate-500 sm:block">
            Klavye: ← → hamle · Home / End başa / sona · F tahtayı çevir
          </p>
        </section>

        {/* Sağ: panel */}
        <aside className="flex w-full min-w-0 flex-col gap-3 lg:flex-1">
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">PGN</h2>
              {game && (
                <button
                  type="button"
                  onClick={() => setShowInput((v) => !v)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  {inputVisible ? 'Gizle' : 'Yeni oyun yükle'}
                </button>
              )}
            </div>
            {inputVisible && <PgnInput onLoaded={() => setShowInput(false)} />}
          </div>

          <GameHeader />

          <AnalysisPanel />

          <VariantPanel />

          <CommentBox />

          <EnginePanel />

          <div className="rounded-lg bg-slate-900 p-2">
            <div className="mb-2 flex gap-1 rounded-md bg-slate-800 p-0.5" role="tablist">
              {(
                [
                  ['moves', 'Hamleler'],
                  ['summary', 'Özet'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded px-3 py-1 text-sm transition ${
                    tab === id ? 'bg-slate-950 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'moves' ? <MoveList /> : <SummaryPanel />}
          </div>
        </aside>
      </main>
    </div>
  );
}
