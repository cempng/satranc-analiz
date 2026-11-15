import { create } from 'zustand';
import { classifyGame, type GameClassification } from '../analysis/classifyGame';
import { loadOpeningBook, type OpeningBook } from '../analysis/openings';
import { cacheKey, loadCachedAnalysis, saveCachedAnalysis } from '../engine/analysisCache';
import { getEngine, type AnalysisResult } from '../engine/stockfish';
import type { ParsedGame } from '../lib/pgn';
import { useEngineStore } from './engineStore';
import { useCurrentFen, useGameStore } from './gameStore';

interface AnalysisState {
  status: 'idle' | 'running' | 'done' | 'cancelled';
  /** Analiz edilen oyun (oyun değişince sonuçlar geçersiz olur). */
  game: ParsedGame | null;
  depth: number;
  /** Pozisyon başına motor sonucu (indeks = ply, 0 = başlangıç). */
  evals: (AnalysisResult | undefined)[];
  /** Şu an analiz edilen pozisyonun indeksi. */
  current: number;
  book: OpeningBook;
  classification: GameClassification | null;

  /** Oyunu analiz eder; önbellekte varsa oradan yükler (`force` ile yeniden hesaplar). */
  start: (game: ParsedGame, depth: number, options?: { force?: boolean }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

let runId = 0;

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  status: 'idle',
  game: null,
  depth: 0,
  evals: [],
  current: 0,
  book: {},
  classification: null,

  start: async (game, depth, options) => {
    const id = ++runId;
    const book = await loadOpeningBook();
    if (id !== runId) return;

    const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];
    const key = cacheKey(fens, depth);
    const cached = options?.force ? null : loadCachedAnalysis(key, fens.length);
    if (cached) {
      set({
        status: 'done',
        game,
        depth,
        evals: cached,
        current: fens.length - 1,
        book,
        classification: classifyGame(game, cached, book),
      });
      return;
    }

    set({
      status: 'running',
      game,
      depth,
      evals: [],
      current: 0,
      book,
      classification: classifyGame(game, [], book),
    });

    const engine = getEngine();
    for (let i = 0; i < fens.length; i++) {
      if (id !== runId) return;
      set({ current: i });
      let result = await engine.analyze(fens[i], depth);
      // Başka bir istek araya girdiyse (iptal edilmediysek) bir kez daha dene.
      if (!result && id === runId) result = await engine.analyze(fens[i], depth);
      if (id !== runId) return;
      if (!result) break;
      const evals = [...get().evals];
      evals[i] = result;
      set({ evals, classification: classifyGame(game, evals, book) });
    }
    if (id !== runId) return;
    const complete = get().evals.length === fens.length && get().evals.every(Boolean);
    set({ status: complete ? 'done' : 'cancelled' });
    if (complete) saveCachedAnalysis(key, get().evals as AnalysisResult[]);
  },

  cancel: () => {
    runId++;
    getEngine().stop();
    if (get().status === 'running') set({ status: 'cancelled' });
  },

  reset: () => {
    runId++;
    if (get().status === 'running') getEngine().stop();
    set({ status: 'idle', game: null, evals: [], current: 0, classification: null });
  },
}));

/** Ekrandaki pozisyonun tam-oyun analizindeki sonucu (varsa). */
export function useStoredEval(): AnalysisResult | undefined {
  const fen = useCurrentFen();
  const ply = useGameStore((s) => s.ply);
  const game = useGameStore((s) => s.game);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const stored = useAnalysisStore((s) => s.evals[ply]);
  return game === analyzedGame && stored?.fen === fen ? stored : undefined;
}

/** Ekranda gösterilecek motor sonucu: önce tam-oyun analizi, yoksa canlı analiz. */
export function useDisplayedAnalysis(): AnalysisResult | null {
  const fen = useCurrentFen();
  const stored = useStoredEval();
  const live = useEngineStore((s) => s.live);
  if (stored) return stored;
  return live?.fen === fen ? live : null;
}
