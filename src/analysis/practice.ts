import type { Score } from '../engine/uci';
import type { Color, ParsedGame, PlyMove } from '../lib/pgn';
import type { MoveClassification, PositionEval } from './classify';
import type { MoveClass } from './moveClasses';
import { winPctFor } from './winPct';

/** Alıştırma bulmacası üretilen sınıflar. */
export const PUZZLE_CLASSES: MoveClass[] = ['mistake', 'blunder', 'missed'];

export type PuzzleFilter = 'all' | Color;

export interface Puzzle {
  /** Hamlenin oyundaki sırası (0 tabanlı). */
  moveIndex: number;
  /** Hatadan önceki pozisyon: oyuncunun doğru hamleyi bulması gereken yer. */
  fen: string;
  color: Color;
  /** Motorun en iyi hamlesi (UCI). */
  solution: string;
  lines: PositionEval['lines'];
  winBefore: number;
  /** Oyunda oynanan (hatalı) hamle. */
  played: PlyMove;
  cls: MoveClass;
}

/** Analiz edilmiş oyundaki Hata / Büyük Hata / Kaçırılan Fırsat anlarından bulmaca listesi üretir. */
export function buildPuzzles(
  game: ParsedGame,
  classes: (MoveClassification | undefined)[],
  evals: (PositionEval | undefined)[],
  filter: PuzzleFilter = 'all',
): Puzzle[] {
  return game.moves.flatMap((move, i) => {
    const c = classes[i];
    const before = evals[i];
    if (!c || !before || !c.bestMove || !PUZZLE_CLASSES.includes(c.cls)) return [];
    if (filter !== 'all' && move.color !== filter) return [];
    return [
      {
        moveIndex: i,
        fen: move.fenBefore,
        color: move.color,
        solution: c.bestMove,
        lines: before.lines,
        winBefore: c.winBefore,
        played: move,
        cls: c.cls,
      },
    ];
  });
}

export type Verdict =
  | { kind: 'correct'; best: boolean; loss: number }
  | { kind: 'wrong'; loss: number }
  /** Hamle motorun ilk satırları arasında değil; motorla ayrıca kontrol edilmeli. */
  | { kind: 'unknown' };

/** Denenen hamleyi motorun mevcut satırlarına göre değerlendirir. */
export function judgeFromLines(puzzle: Puzzle, uci: string, tolerance: number): Verdict {
  if (uci === puzzle.solution) return { kind: 'correct', best: true, loss: 0 };
  const line = puzzle.lines.find((l) => l.pv[0] === uci);
  if (!line) return { kind: 'unknown' };
  return judgeFromScore(puzzle, line.score, tolerance);
}

/** Hamleden sonraki pozisyonun skoruna (beyaz perspektifi) göre değerlendirir. */
export function judgeFromScore(puzzle: Puzzle, scoreAfter: Score, tolerance: number): Verdict {
  const loss = Math.max(0, puzzle.winBefore - winPctFor(scoreAfter, puzzle.color));
  return loss <= tolerance ? { kind: 'correct', best: false, loss } : { kind: 'wrong', loss };
}
