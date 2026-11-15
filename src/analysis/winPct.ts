import type { Color } from '../lib/pgn';
import type { Score } from '../engine/uci';
import { WIN_PCT_CP_CLAMP, WIN_PCT_K } from './config';

/** Beyazın kazanma olasılığı (0–100), cp beyaz perspektifinden. */
export function winPctFromCp(cp: number): number {
  const c = Math.max(-WIN_PCT_CP_CLAMP, Math.min(WIN_PCT_CP_CLAMP, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_PCT_K * c)) - 1);
}

/** Beyazın kazanma olasılığı (0–100). Matta kazanan taraf için 100, kaybeden için 0. */
export function winPct(score: Score): number {
  if (score.type === 'mate') return score.winner === 'w' ? 100 : 0;
  return winPctFromCp(score.cp);
}

/** Verilen tarafın kazanma olasılığı (0–100). */
export function winPctFor(score: Score, color: Color): number {
  const white = winPct(score);
  return color === 'w' ? white : 100 - white;
}
