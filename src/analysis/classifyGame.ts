import { Chess } from 'chess.js';
import type { ParsedGame } from '../lib/pgn';
import { classifyMove, type MoveClassification, type PositionEval } from './classify';
import { lookupOpening, type OpeningBook, type OpeningInfo } from './openings';
import { sacrificedMaterial } from './sacrifice';
import { winPctFor } from './winPct';

export interface GameClassification {
  /** Hamle başına sınıf (indeks = hamle sırası); henüz değerlendirilmemişse undefined. */
  moves: (MoveClassification | undefined)[];
  /** Her pozisyona (ply) kadar oynanan en son adlandırılmış açılış. */
  openings: (OpeningInfo | undefined)[];
}

/**
 * Oyundaki hamleleri, mevcut motor değerlendirmeleriyle sınıflandırır.
 * evals[i] = i. pozisyonun (0 = başlangıç) değerlendirmesi; eksik olanlar atlanır.
 */
export function classifyGame(
  game: ParsedGame,
  evals: (PositionEval | undefined)[],
  book: OpeningBook,
): GameClassification {
  const moves: (MoveClassification | undefined)[] = [];
  const openings: (OpeningInfo | undefined)[] = [lookupOpening(book, game.startFen) ?? undefined];
  let inBook = true;

  game.moves.forEach((move, i) => {
    const opening = lookupOpening(book, move.fenAfter);
    inBook = inBook && opening !== undefined;
    openings.push(opening ?? openings[i]);

    const before = evals[i];
    const after = evals[i + 1];
    if (!before || !after) {
      moves.push(undefined);
      return;
    }

    const prev = i > 0 ? moves[i - 1] : undefined;
    const beforeOpponent = i > 0 ? evals[i - 1] : undefined;
    moves.push(
      classifyMove({
        uci: move.uci,
        color: move.color,
        before,
        after,
        isBook: inBook,
        legalMoves: new Chess(move.fenBefore).moves().length,
        sacrifice: sacrificedMaterial(move.fenBefore, move.uci),
        prevOpponentClass: prev?.cls,
        winBeforeOpponentMove: beforeOpponent?.lines[0]
          ? winPctFor(beforeOpponent.lines[0].score, move.color)
          : undefined,
      }),
    );
  });

  return { moves, openings };
}
