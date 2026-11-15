import { Chess } from 'chess.js';
import type { Color } from '../lib/pgn';

/**
 * Beyaz perspektifinden değerlendirme.
 * - cp: santipiyon, pozitif = beyaz önde.
 * - mate: `moves` hamlede mat; `winner` mat eden taraf (moves = 0 → tahtada mat var).
 */
export type Score = { type: 'cp'; cp: number } | { type: 'mate'; moves: number; winner: Color };

/** UCI "info" satırından çıkarılan ham bilgi (skor sırası gelen tarafa göre). */
export interface RawInfo {
  depth: number;
  multipv: number;
  scoreType: 'cp' | 'mate';
  scoreValue: number;
  pv: string[];
}

/** "info depth 16 multipv 1 score cp 35 ... pv e2e4 e7e5" satırını ayrıştırır. Skor yoksa null. */
export function parseInfo(line: string): RawInfo | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.trim().split(/\s+/);
  let depth = -1;
  let multipv = 1;
  let scoreType: 'cp' | 'mate' | null = null;
  let scoreValue = 0;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i]);
        break;
      case 'multipv':
        multipv = Number(tokens[++i]);
        break;
      case 'score':
        scoreType = tokens[++i] as 'cp' | 'mate';
        scoreValue = Number(tokens[++i]);
        // Sınır (bound) skorları kesin değildir; atla.
        if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') return null;
        break;
      case 'pv':
        pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      case 'string':
        return null;
    }
  }

  if (depth < 0 || scoreType === null || Number.isNaN(scoreValue)) return null;
  return { depth, multipv, scoreType, scoreValue, pv };
}

/** Sırası gelen tarafa göre verilen UCI skorunu beyaz perspektifine çevirir. */
export function toWhiteScore(type: 'cp' | 'mate', value: number, turn: Color): Score {
  const other: Color = turn === 'w' ? 'b' : 'w';
  if (type === 'cp') return { type: 'cp', cp: turn === 'w' ? value : 0 - value };
  // mate > 0: sırası gelen mat ediyor; mate <= 0: sırası gelen mat oluyor.
  return { type: 'mate', moves: Math.abs(value), winner: value > 0 ? turn : other };
}

/** FEN'deki sırası gelen taraf. */
export function fenTurn(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** UCI hamle dizisini (e2e4 e7e5 …) verilen pozisyondan SAN'a çevirir; geçersiz hamlede durur. */
export function uciLineToSan(fen: string, uciMoves: string[], limit = uciMoves.length): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves.slice(0, limit)) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}

/** Skoru metne çevirir: "+1.25", "-0.40", "M3", "-M2", "#". */
export function formatScore(score: Score, digits = 2): string {
  if (score.type === 'mate') {
    if (score.moves === 0) return '#';
    return `${score.winner === 'w' ? '' : '-'}M${score.moves}`;
  }
  const pawns = score.cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(digits)}`;
}
