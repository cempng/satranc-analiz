import { Chess, type Square } from 'chess.js';
import { PIECE_VALUES } from './config';

/**
 * Hamleden sonra rakibin hemen kazanabileceği en yüksek net materyal (puan).
 * Yalnızca piyon olmayan taşların alınması sayılır. Basit değişim hesabı:
 * alınan taş − (geri alınabiliyorsa alan taş) − bu hamlede bizim aldığımız taş.
 */
export function sacrificedMaterial(fenBefore: string, uci: string): number {
  const chess = new Chess(fenBefore);
  let move;
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return 0;
  }
  if (chess.isGameOver()) return 0;

  const mover = move.color;
  const ourCapture = move.captured ? PIECE_VALUES[move.captured] : 0;
  const fenAfter = chess.fen();
  let best = 0;

  for (const reply of chess.moves({ verbose: true })) {
    if (!reply.captured || reply.captured === 'p') continue;
    let gain = PIECE_VALUES[reply.captured];
    const board = new Chess(fenAfter);
    board.move(reply);
    const canRecapture = board
      .moves({ verbose: true })
      .some((m) => m.color === mover && m.to === (reply.to as Square));
    if (canRecapture) gain -= PIECE_VALUES[reply.piece];
    best = Math.max(best, gain - ourCapture);
  }
  return best;
}
