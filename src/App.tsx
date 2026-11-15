import { Chess } from 'chess.js';
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
import { useT } from './i18n/react';
import type { PlyMove } from './lib/pgn';
import { playSound, preloadSounds, soundForSan } from './lib/sounds';
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

/**
 * Sesler: ileri yönde oynanan her hamlede (ana hat, varyant, alıştırma) hamle sesi;
 * yeni oyun yüklenince "game-start", bitmiş bir oyunun son hamlesine gelince "game-end",
 * alıştırmada yanlış cevapta "illegal".
 */
function useMoveSounds() {
  useEffect(() => {
    preloadSounds(['move-self', 'move-opponent', 'capture', 'castle', 'move-check', 'promote', 'game-start', 'game-end', 'illegal']);
    const enabled = () => useSettingsStore.getState().sounds;
    // Tahtanın alt tarafındaki oyuncunun hamlesi "kendi" hamlesi sayılır.
    const isSelf = (color: 'w' | 'b') => color === (useGameStore.getState().orientation === 'white' ? 'w' : 'b');

    const unsubGame = useGameStore.subscribe((s, prev) => {
      if (!enabled()) return;
      if (s.game && s.game !== prev.game) {
        playSound('game-start');
        return;
      }
      let move: PlyMove | undefined;
      let finished = false;
      if (s.variant && s.variant.index > 0 && s.variant.index > (prev.variant?.index ?? 0)) {
        move = s.variant.moves[s.variant.index - 1];
      } else if (s.game && !s.variant && !prev.variant && s.game === prev.game && s.ply === prev.ply + 1) {
        move = s.game.moves[s.ply - 1];
        finished = s.ply === s.game.moves.length && ['1-0', '0-1', '1/2-1/2'].includes(s.game.headers.Result ?? '');
      }
      if (!move) return;
      playSound(soundForSan(move.san, isSelf(move.color)));
      if (finished) playSound('game-end', 0.25);
    });

    const unsubPractice = usePracticeStore.subscribe((s, prev) => {
      if (!enabled() || s.status === prev.status) return;
      const puzzle = s.puzzles[s.index];
      if (!puzzle) return;
      if (s.status === 'wrong') {
        playSound('illegal');
      } else if (s.shownMove && (s.status === 'correct' || s.status === 'revealed' || s.status === 'checking')) {
        const chess = new Chess(puzzle.fen);
        try {
          const move = chess.move({ from: s.shownMove.from, to: s.shownMove.to, promotion: 'q' });
          playSound(soundForSan(move.san, true));
        } catch {
          playSound('move-self');
        }
      }
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
  const { t } = useT();
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
          <span className="text-sky-400">♞</span> <span className="hidden sm:inline">{t('app.title')}</span>
        </h1>
        <nav className="flex gap-1 rounded-md bg-slate-900 p-0.5" aria-label={t('nav.page')}>
          {(
            [
              ['analysis', t('nav.analysis')],
              ['stats', t('nav.stats')],
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
          {t('nav.settings')}
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
                  {t('keyboard.hint')}
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
                    <h2 className="text-sm font-semibold text-slate-300">{t('source.title')}</h2>
                    {game && (
                      <button
                        type="button"
                        onClick={() => setShowInput((v) => !v)}
                        className="text-xs text-sky-400 hover:text-sky-300"
                      >
                        {inputVisible ? t('common.hide') : t('source.newGame')}
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
                        ['moves', t('moves.title')],
                        ['summary', t('summary.title')],
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
