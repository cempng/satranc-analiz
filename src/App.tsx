import { Chess, type Square } from 'chess.js';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Board } from './components/Board';
import { CommentBox } from './components/CommentBox';
import { EnginePanel } from './components/EnginePanel';
import { EvalBar } from './components/EvalBar';
import { GameHeader } from './components/GameHeader';
import { GameSource } from './components/GameSource';
import { MoveList } from './components/MoveList';
import { NavControls } from './components/NavControls';
import { PracticeLauncher, PracticePanel } from './components/PracticePanel';
import { SettingsDialog } from './components/SettingsDialog';
import { StatsPage } from './components/StatsPage';
import { SummaryPanel } from './components/SummaryPanel';
import { VariantPanel } from './components/VariantPanel';
import { useLiveAnalysis } from './engine/useLiveAnalysis';
import { playMoveSound, soundForSan } from './lib/sounds';
import { useAnalysisStore } from './store/analysisStore';
import { useEngineStore } from './store/engineStore';
import { useCurrentFen, useGameStore } from './store/gameStore';
import { usePracticeStore } from './store/practiceStore';
import { useSettingsStore } from './store/settingsStore';
import { useStatsStore } from './store/statsStore';

type View = 'analysis' | 'stats';

function useKeyboardNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, select, [role="dialog"], [contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Alıştırmada gezinme kapalı (cevabı ele vermesin).
      if (usePracticeStore.getState().active) return;
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
  }, [enabled]);
}

/** Yeni oyun yüklenince (motor hazırsa ve toplu analiz sürmüyorsa) tam-oyun analizini otomatik başlatır. */
function useAutoAnalyze() {
  const game = useGameStore((s) => s.game);
  const engineReady = useEngineStore((s) => s.status === 'ready');
  const batchRunning = useStatsStore((s) => s.status === 'running' || s.status === 'fetching');
  useEffect(() => {
    const analysis = useAnalysisStore.getState();
    if (!game || !engineReady || batchRunning || analysis.game === game) return;
    void analysis.start(game, useEngineStore.getState().depth);
  }, [game, engineReady, batchRunning]);
}

/** İleri yönde oynanan her hamlede (ana hat, varyant, alıştırma) ses çalar. */
function useMoveSounds() {
  useEffect(() => {
    const unsubGame = useGameStore.subscribe((s, prev) => {
      if (!useSettingsStore.getState().sounds) return;
      let san: string | undefined;
      if (s.variant && s.variant.index > 0 && s.variant.index > (prev.variant?.index ?? 0)) {
        san = s.variant.moves[s.variant.index - 1].san;
      } else if (!s.variant && !prev.variant && s.game === prev.game && s.ply === prev.ply + 1) {
        san = s.game?.moves[s.ply - 1]?.san;
      }
      if (san) playMoveSound(soundForSan(san));
    });
    const unsubPractice = usePracticeStore.subscribe((s, prev) => {
      if (!useSettingsStore.getState().sounds || !s.shownMove || s.shownMove === prev.shownMove) return;
      const puzzle = s.puzzles[s.index];
      if (!puzzle) return;
      const captured = new Chess(puzzle.fen).get(s.shownMove.to as Square);
      playMoveSound(captured ? 'capture' : 'move');
    });
    return () => {
      unsubGame();
      unsubPractice();
    };
  }, []);
}

// Grafik kütüphanesi büyük olduğu için ayrı dosyada, gerektiğinde yüklenir.
const EvalChart = lazy(() => import('./components/EvalChart').then((m) => ({ default: m.EvalChart })));

export default function App() {
  const [view, setView] = useState<View>('analysis');
  useKeyboardNavigation(view === 'analysis');
  useLiveAnalysis(useCurrentFen());
  useAutoAnalyze();
  useMoveSounds();
  const game = useGameStore((s) => s.game);
  const practiceActive = usePracticeStore((s) => s.active);
  const batchRunning = useStatsStore((s) => s.status === 'running');
  const [showInput, setShowInput] = useState(true);
  const inputVisible = showInput || !game;
  const [tab, setTab] = useState<'moves' | 'summary'>('moves');
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  const switchView = (next: View) => {
    if (next === 'stats' && usePracticeStore.getState().active) usePracticeStore.getState().stop();
    setView(next);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-sky-400">♞</span> <span className="hidden sm:inline">Satranç Analiz</span>
        </h1>
        <nav className="flex gap-1 rounded-md bg-slate-900 p-0.5" aria-label="Sayfa">
          {(
            [
              ['analysis', 'Analiz'],
              ['stats', 'İstatistik'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => switchView(id)}
              className={`rounded px-3 py-1 text-sm transition ${
                view === id ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
              {id === 'stats' && batchRunning && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="ml-auto rounded-md px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ⚙ Ayarlar
        </button>
      </header>
      <SettingsDialog />

      {view === 'stats' ? (
        <StatsPage onOpenGame={() => setView('analysis')} />
      ) : (
        <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:flex-row lg:items-start">
          {/* Sol: eval bar + tahta + gezinme */}
          <section className="flex w-full flex-col gap-3 lg:max-w-[640px]">
            <div className="flex gap-2">
              <EvalBar />
              <div className="min-w-0 flex-1">
                <Board />
              </div>
            </div>
            {!practiceActive && (
              <>
                <NavControls />
                <Suspense fallback={null}>
                  <EvalChart />
                </Suspense>
                <p className="hidden text-center text-xs text-slate-500 sm:block">
                  Klavye: ← → hamle · Home / End başa / sona · F tahtayı çevir · Taşları sürükleyerek varyant dene
                </p>
              </>
            )}
          </section>

          {/* Sağ: panel */}
          <aside className="flex w-full min-w-0 flex-col gap-3 lg:flex-1">
            {practiceActive ? (
              <>
                <GameHeader />
                <PracticePanel />
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-900 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-300">Oyun</h2>
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
                  {inputVisible && <GameSource onLoaded={() => setShowInput(false)} />}
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

                <PracticeLauncher />
              </>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
