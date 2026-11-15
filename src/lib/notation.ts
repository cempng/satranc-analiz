import { fenTurn, uciLineToSan } from '../engine/uci';
import { toTurkishSan } from './pgn';

/** Pozisyondan başlayarak SAN listesini "12. Fxf7+ Şxf7 13. …" biçiminde (Türkçe harflerle) yazar. */
export function formatLine(fen: string, san: string[]): string {
  let moveNumber = Number(fen.split(' ')[5]) || 1;
  let turn = fenTurn(fen);
  return san
    .map((m, i) => {
      let prefix = '';
      if (turn === 'w') prefix = `${moveNumber}. `;
      else if (i === 0) prefix = `${moveNumber}… `;
      if (turn === 'b') moveNumber++;
      turn = turn === 'w' ? 'b' : 'w';
      return prefix + toTurkishSan(m);
    })
    .join(' ');
}

/** UCI çizgisini doğrudan Türkçe numaralı metne çevirir. */
export function formatUciLine(fen: string, pv: string[], plies: number): string {
  return formatLine(fen, uciLineToSan(fen, pv, plies));
}

const DIGIT_SUFFIX = ['', 'i', 'yi', 'ü', 'ü', 'i', 'yı', 'yi', 'i', 'u'];
const TENS_SUFFIX = ['', 'u', 'yi', 'u', 'ı', 'yi', 'ı', 'i', 'i', 'ı'];

/** Sayıya belirtme hâli eki ekler: 1'i, 2'yi, 3'ü, 6'yı, 10'u, 40'ı. */
export function withAccusative(n: number): string {
  let suffix: string;
  if (n % 10 !== 0) suffix = DIGIT_SUFFIX[n % 10];
  else if (n % 100 !== 0) suffix = TENS_SUFFIX[(n / 10) % 10];
  else suffix = 'ü';
  return `${n}'${suffix}`;
}
