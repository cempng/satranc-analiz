import { Chess } from 'chess.js';
import { create } from 'zustand';
import { PRACTICE_CHECK_DEPTH, PRACTICE_TOLERANCE } from '../analysis/config';
import { buildPuzzles, judgeFromLines, judgeFromScore, type Puzzle, type PuzzleFilter, type Verdict } from '../analysis/practice';
import { getEngine } from '../engine/stockfish';
import { uciLineToSan, type Score } from '../engine/uci';
import { localSan, t } from '../i18n/core';
import { useAnalysisStore } from './analysisStore';
import { useGameStore } from './gameStore';

export type PracticeStatus = 'solving' | 'checking' | 'correct' | 'wrong' | 'revealed';

interface PracticeState {
  active: boolean;
  filter: PuzzleFilter;
  puzzles: Puzzle[];
  index: number;
  status: PracticeStatus;
  message: string;
  /** Tahtada gösterilecek pozisyon (doğru cevap ya da çözüm sonrası). */
  shownFen: string | null;
  /** Son denenen (ya da çözüm) hamlesinin kareleri. */
  shownMove: { from: string; to: string } | null;
  hint: boolean;
  /** Bu oturumda ilk denemede çözülen bulmacalar. */
  solvedFirstTry: number;
  attempts: number;

  /** Bulmaca sayısını döndürür (0 ise alıştırma başlamaz). */
  start: (filter: PuzzleFilter) => number;
  stop: () => void;
  submit: (from: string, to: string, promotion?: string) => boolean;
  showHint: () => void;
  reveal: () => void;
  goToPuzzle: (index: number) => void;
}

let checkId = 0;

const fresh = { status: 'solving' as const, message: '', shownFen: null, shownMove: null, hint: false, attempts: 0 };

function sanOf(fen: string, uci: string): string {
  return localSan(uciLineToSan(fen, [uci])[0] ?? uci);
}

export const usePracticeStore = create<PracticeState>((set, get) => {
  /** Değerlendirme sonucunu duruma yansıtır. */
  const applyVerdict = (verdict: Verdict, fenAfter: string, from: string, to: string) => {
    const p = get().puzzles[get().index];
    if (verdict.kind === 'correct') {
      const firstTry = get().attempts === 1;
      set({
        status: 'correct',
        shownFen: fenAfter,
        shownMove: { from, to },
        solvedFirstTry: get().solvedFirstTry + (firstTry ? 1 : 0),
        message: verdict.best ? t('practice.correctBest') : t('practice.correctAlt', { move: sanOf(p.fen, p.solution) }),
      });
    } else if (verdict.kind === 'wrong') {
      set({
        status: 'wrong',
        shownFen: null,
        shownMove: null,
        message: t('practice.wrong', { loss: Math.round(verdict.loss) }),
      });
    }
  };

  return {
    active: false,
    filter: 'all',
    puzzles: [],
    index: 0,
    ...fresh,
    solvedFirstTry: 0,

    start: (filter) => {
      const { game, evals, classification } = useAnalysisStore.getState();
      if (!game || game !== useGameStore.getState().game || !classification) return 0;
      const puzzles = buildPuzzles(game, classification.moves, evals, filter);
      if (puzzles.length === 0) return 0;
      useGameStore.getState().exitVariant();
      set({ active: true, filter, puzzles, index: 0, solvedFirstTry: 0, ...fresh });
      return puzzles.length;
    },

    stop: () => {
      checkId++;
      const last = get().puzzles[get().index];
      set({ active: false, puzzles: [], ...fresh });
      // Alıştırmadan çıkınca son bulmacanın oyundaki yerine git.
      if (last) useGameStore.getState().goTo(last.moveIndex);
    },

    submit: (from, to, promotion) => {
      const state = get();
      const p = state.puzzles[state.index];
      if (!state.active || !p || (state.status !== 'solving' && state.status !== 'wrong')) return false;
      const chess = new Chess(p.fen);
      let move;
      try {
        move = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      const uci = move.from + move.to + (move.promotion ?? '');
      const fenAfter = chess.fen();
      set({ attempts: state.attempts + 1 });

      const verdict = judgeFromLines(p, uci, PRACTICE_TOLERANCE);
      if (verdict.kind !== 'unknown') {
        applyVerdict(verdict, fenAfter, from, to);
        return verdict.kind === 'correct';
      }

      // Motorun ilk 3 hamlesi dışında: pozisyonu motorla kontrol et.
      const id = ++checkId;
      set({ status: 'checking', shownFen: fenAfter, shownMove: { from, to }, message: t('practice.checking') });
      void getEngine()
        .analyze(fenAfter, PRACTICE_CHECK_DEPTH)
        .then((result) => {
          if (id !== checkId) return;
          if (!result) {
            set({ status: 'solving', shownFen: null, shownMove: null, message: t('practice.checkFailed') });
            return;
          }
          const score: Score = result.lines[0]?.score ?? { type: 'cp', cp: 0 };
          applyVerdict(judgeFromScore(p, score, PRACTICE_TOLERANCE), fenAfter, from, to);
        });
      return true;
    },

    showHint: () => set({ hint: true }),

    reveal: () => {
      const p = get().puzzles[get().index];
      if (!p) return;
      checkId++;
      const chess = new Chess(p.fen);
      chess.move({ from: p.solution.slice(0, 2), to: p.solution.slice(2, 4), promotion: p.solution[4] });
      set({
        status: 'revealed',
        shownFen: chess.fen(),
        shownMove: { from: p.solution.slice(0, 2), to: p.solution.slice(2, 4) },
        message: t('practice.solution', { move: sanOf(p.fen, p.solution) }),
      });
    },

    goToPuzzle: (index) => {
      checkId++;
      const i = Math.max(0, Math.min(get().puzzles.length - 1, index));
      set({ index: i, ...fresh });
    },
  };
});
