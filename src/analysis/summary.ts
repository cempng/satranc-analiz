import type { Color, ParsedGame } from '../lib/pgn';
import { gameAccuracy, type PlayerAccuracy } from './accuracy';
import type { MoveClassification } from './classify';
import { MOVE_CLASS_ORDER, type MoveClass } from './moveClasses';

export interface CriticalMoment {
  /** Hamleden sonraki ply (gezinme için). */
  ply: number;
  cls: MoveClass;
  loss: number;
  kind: 'error' | 'highlight';
}

export interface GameSummary {
  accuracy: Record<Color, PlayerAccuracy>;
  counts: Record<Color, Record<MoveClass, number>>;
  critical: CriticalMoment[];
}

const ERRORS: MoveClass[] = ['inaccuracy', 'mistake', 'blunder', 'missed'];
const HIGHLIGHTS: MoveClass[] = ['brilliant', 'great'];
/** Kritik anlarda gösterilecek en büyük hata sayısı. */
const TOP_ERRORS = 3;

function emptyCounts(): Record<MoveClass, number> {
  return Object.fromEntries(MOVE_CLASS_ORDER.map((c) => [c, 0])) as Record<MoveClass, number>;
}

/** Oyun özeti: doğruluk, sınıf sayıları ve kritik anlar (saf fonksiyon). */
export function summarizeGame(game: ParsedGame, classes: (MoveClassification | undefined)[]): GameSummary {
  const counts = { w: emptyCounts(), b: emptyCounts() };
  game.moves.forEach((move, i) => {
    const c = classes[i];
    if (c) counts[move.color][c.cls]++;
  });

  const moments = classes.flatMap((c, i) => (c ? [{ ply: i + 1, cls: c.cls, loss: c.loss }] : []));
  const errors = moments
    .filter((m) => ERRORS.includes(m.cls))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, TOP_ERRORS)
    .map((m) => ({ ...m, kind: 'error' as const }));
  const highlights = moments.filter((m) => HIGHLIGHTS.includes(m.cls)).map((m) => ({ ...m, kind: 'highlight' as const }));
  const critical = [...errors, ...highlights].sort((a, b) => a.ply - b.ply);

  return { accuracy: gameAccuracy(game, classes), counts, critical };
}
