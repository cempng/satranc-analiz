import type { Color } from '../lib/pgn';
import type { Score } from '../engine/uci';
import { CLASSIFY } from './config';
import type { MoveClass } from './moveClasses';
import { winPctFor } from './winPct';

/** Bir pozisyonun motor değerlendirmesi (skorlar beyaz perspektifinden, satırlar en iyiden kötüye). */
export interface PositionEval {
  lines: { score: Score; pv: string[] }[];
}

export interface ClassifyInput {
  uci: string;
  color: Color;
  before: PositionEval;
  after: PositionEval;
  /** Hamleden sonraki pozisyon açılış kitabında mı (ve önceki hamleler de kitaptaydı mı)? */
  isBook: boolean;
  /** Hamleden önceki pozisyondaki yasal hamle sayısı. */
  legalMoves: number;
  /** Hamle sonrası rakibin hemen kazanabileceği net materyal (bkz. sacrificedMaterial). */
  sacrifice: number;
  /** Rakibin bir önceki hamlesinin sınıfı. */
  prevOpponentClass?: MoveClass;
  /** Rakibin önceki hamlesinden önce, hamleyi yapan oyuncunun Win%'i. */
  winBeforeOpponentMove?: number;
}

export interface MoveClassification {
  cls: MoveClass;
  /** Hamleyi yapanın perspektifinden Win% kaybı (0 veya pozitif). */
  loss: number;
  winBefore: number;
  winAfter: number;
  /** Motorun önerdiği en iyi hamle (UCI). */
  bestMove?: string;
  /** Oynanan hamle motorun 1 numaralı hamlesi mi? */
  isBest: boolean;
}

const NEUTRAL: Score = { type: 'cp', cp: 0 };

/** Kayıp miktarına göre temel sınıf. */
export function classByLoss(loss: number): MoveClass {
  if (loss < CLASSIFY.excellentMaxLoss) return 'excellent';
  if (loss < CLASSIFY.goodMaxLoss) return 'good';
  if (loss < CLASSIFY.inaccuracyMaxLoss) return 'inaccuracy';
  if (loss < CLASSIFY.mistakeMaxLoss) return 'mistake';
  return 'blunder';
}

const SOFTER: Partial<Record<MoveClass, MoveClass>> = {
  blunder: 'mistake',
  mistake: 'inaccuracy',
  inaccuracy: 'good',
};

/** Tek bir hamleyi sınıflandırır (saf fonksiyon). */
export function classifyMove(input: ClassifyInput): MoveClassification {
  const { color, before, after } = input;
  const bestLine = before.lines[0];
  const bestMove = bestLine?.pv[0];
  const winBefore = winPctFor(bestLine?.score ?? NEUTRAL, color);
  const winAfter = winPctFor(after.lines[0]?.score ?? NEUTRAL, color);
  const loss = Math.max(0, winBefore - winAfter);
  const isBest = bestMove === input.uci;
  const result = (cls: MoveClass): MoveClassification => ({ cls, loss, winBefore, winAfter, bestMove, isBest });

  if (input.legalMoves === 1) return result('forced');
  if (input.isBook) return result('book');

  const b = CLASSIFY.brilliant;
  if (
    loss <= b.maxLoss &&
    input.sacrifice >= b.minSacrifice &&
    winBefore < b.maxWinBefore &&
    winAfter >= b.minWinAfter
  ) {
    return result('brilliant');
  }

  const opponentErred = input.prevOpponentClass === 'mistake' || input.prevOpponentClass === 'blunder';

  if (isBest) {
    const second = before.lines[1];
    const onlyGoodMove =
      second !== undefined && winBefore - winPctFor(second.score, color) >= CLASSIFY.great.minGapToSecond;
    const turnsGame =
      opponentErred &&
      input.winBeforeOpponentMove !== undefined &&
      input.winBeforeOpponentMove <= CLASSIFY.great.turningMaxWinBefore &&
      winAfter >= CLASSIFY.great.turningMinWinAfter;
    if (onlyGoodMove || turnsGame) return result('great');
  }

  if (opponentErred && winBefore >= CLASSIFY.missed.minBestWin && loss >= CLASSIFY.missed.minLoss) {
    return result('missed');
  }

  if (isBest) return result('best');

  let cls = classByLoss(loss);
  const { high, low } = CLASSIFY.decided;
  const decided = (winBefore > high && winAfter > high) || (winBefore < low && winAfter < low);
  if (decided && SOFTER[cls]) cls = SOFTER[cls]!;
  return result(cls);
}
