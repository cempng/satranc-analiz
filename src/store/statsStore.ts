import { create } from 'zustand';
import { t } from '../i18n/core';
import { loadOpeningBook } from '../analysis/openings';
import { computeGameStat, prepareGame, type GameStat } from '../analysis/stats';
import { cacheKey, loadCachedAnalysis, saveCachedAnalysis } from '../engine/analysisCache';
import { engineFlavor, getEngine, type AnalysisResult } from '../engine/stockfish';
import { fetchOnlineGames, OnlineGamesError, type OnlineSite } from '../lib/onlineGames';
import { useAnalysisStore } from './analysisStore';
import { useSettingsStore } from './settingsStore';

/** Toplu analizde varsayılan derinlik (hız için düşük tutulur). */
export const STATS_DEFAULT_DEPTH = 12;
export const STATS_GAME_COUNTS = [5, 10, 20, 30] as const;

interface StatsState {
  status: 'idle' | 'fetching' | 'running' | 'done' | 'cancelled' | 'error';
  site: OnlineSite;
  username: string;
  depth: number;
  error: string | null;
  /** Getirilen oyun sayısı ve kaçıncısının analiz edildiği. */
  progress: { game: number; games: number; position: number; positions: number; skipped: number };
  results: GameStat[];

  run: (site: OnlineSite, username: string, count: number, depth: number) => Promise<void>;
  cancel: () => void;
}

let runId = 0;
let abort: AbortController | null = null;

export const useStatsStore = create<StatsState>((set, get) => ({
  status: 'idle',
  site: 'lichess',
  username: '',
  depth: STATS_DEFAULT_DEPTH,
  error: null,
  progress: { game: 0, games: 0, position: 0, positions: 0, skipped: 0 },
  results: [],

  run: async (site, username, count, depth) => {
    const id = ++runId;
    abort?.abort();
    abort = new AbortController();
    set({
      status: 'fetching',
      site,
      username: username.trim(),
      depth,
      error: null,
      results: [],
      progress: { game: 0, games: 0, position: 0, positions: 0, skipped: 0 },
    });

    let online;
    try {
      online = await fetchOnlineGames(site, username, count, abort.signal);
    } catch (e) {
      if (id !== runId) return;
      set({ status: 'error', error: e instanceof OnlineGamesError ? e.message : t('online.err.generic') });
      return;
    }
    if (id !== runId) return;
    if (online.length === 0) {
      set({ status: 'error', error: t('online.err.none') });
      return;
    }

    // Motor tek; tek oyun analizi sürüyorsa durdur.
    useAnalysisStore.getState().cancel();
    const book = await loadOpeningBook();
    const engine = getEngine();
    const flavor = engineFlavor();
    set({ status: 'running', progress: { ...get().progress, games: online.length } });

    for (let g = 0; g < online.length; g++) {
      if (id !== runId) return;
      const prepared = prepareGame(online[g], username);
      if (!prepared) {
        set({ progress: { ...get().progress, game: g + 1, skipped: get().progress.skipped + 1 } });
        continue;
      }
      const { game, color } = prepared;
      const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];
      const key = cacheKey(fens, depth, flavor);
      let evals = loadCachedAnalysis(key, fens.length);

      if (!evals) {
        const fresh: AnalysisResult[] = [];
        for (let i = 0; i < fens.length; i++) {
          set({ progress: { ...get().progress, game: g + 1, position: i + 1, positions: fens.length } });
          let result = await engine.analyze(fens[i], depth);
          if (!result && id === runId) result = await engine.analyze(fens[i], depth);
          if (id !== runId) return;
          if (!result) break;
          fresh.push(result);
        }
        if (fresh.length !== fens.length) {
          set({ progress: { ...get().progress, skipped: get().progress.skipped + 1 } });
          continue;
        }
        evals = fresh;
        saveCachedAnalysis(key, evals);
      }

      const stat = computeGameStat(online[g], game, color, evals, book, useSettingsStore.getState().thresholds);
      set({
        results: stat ? [...get().results, stat] : get().results,
        progress: { ...get().progress, game: g + 1, skipped: get().progress.skipped + (stat ? 0 : 1) },
      });
    }
    if (id === runId) set({ status: 'done' });
  },

  cancel: () => {
    if (get().status !== 'running' && get().status !== 'fetching') return;
    runId++;
    abort?.abort();
    getEngine().stop();
    set({ status: 'cancelled' });
  },
}));
