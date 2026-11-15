import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { Color } from '../lib/pgn';
import { PIECE_VALUES } from './config';

/** Taş adları ve hâlleri. */
export const PIECE_NAMES: Record<PieceSymbol, { nom: string; acc: string; dat: string }> = {
  p: { nom: 'piyon', acc: 'piyonu', dat: 'piyona' },
  n: { nom: 'at', acc: 'atı', dat: 'ata' },
  b: { nom: 'fil', acc: 'fili', dat: 'file' },
  r: { nom: 'kale', acc: 'kaleyi', dat: 'kaleye' },
  q: { nom: 'vezir', acc: 'veziri', dat: 'vezire' },
  k: { nom: 'şah', acc: 'şahı', dat: 'şaha' },
};

const FILES = 'abcdefgh';

interface BoardPiece {
  type: PieceSymbol;
  color: Color;
}

type Grid = (BoardPiece | null)[][];

function toXY(square: string): [number, number] {
  return [FILES.indexOf(square[0]), Number(square[1]) - 1];
}

function toSquare(x: number, y: number): Square {
  return `${FILES[x]}${y + 1}` as Square;
}

/** grid[x][y] biçiminde tahta (x: a–h, y: 1–8). */
function grid(chess: Chess): Grid {
  const g: Grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  chess.board().forEach((row, r) =>
    row.forEach((sq, x) => {
      if (sq) g[x][7 - r] = { type: sq.type, color: sq.color };
    }),
  );
  return g;
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function slidingDirs(type: PieceSymbol): number[][] {
  if (type === 'r') return ROOK_DIRS;
  if (type === 'b') return BISHOP_DIRS;
  if (type === 'q') return [...ROOK_DIRS, ...BISHOP_DIRS];
  return [];
}

const inside = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;

/** Bir taşın saldırdığı kareler (sıradan bağımsız). */
function attackedSquares(g: Grid, square: Square): Square[] {
  const piece = g[toXY(square)[0]][toXY(square)[1]];
  if (!piece) return [];
  const [x, y] = toXY(square);
  const out: Square[] = [];
  const add = (dx: number, dy: number) => inside(x + dx, y + dy) && out.push(toSquare(x + dx, y + dy));

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? 1 : -1;
    add(1, dir);
    add(-1, dir);
  } else if (piece.type === 'n') KNIGHT.forEach(([dx, dy]) => add(dx, dy));
  else if (piece.type === 'k') KING.forEach(([dx, dy]) => add(dx, dy));
  else {
    for (const [dx, dy] of slidingDirs(piece.type)) {
      for (let cx = x + dx, cy = y + dy; inside(cx, cy); cx += dx, cy += dy) {
        out.push(toSquare(cx, cy));
        if (g[cx][cy]) break;
      }
    }
  }
  return out;
}

export interface TargetPiece {
  square: Square;
  type: PieceSymbol;
}

/**
 * Çatal: `square`daki taş aynı anda en az iki değerli rakip taşa saldırıyor mu?
 * Değerli: şah, saldırandan daha değerli taş ya da korumasız taş (piyonlar hariç).
 */
export function detectFork(fen: string, square: Square): TargetPiece[] | null {
  const chess = new Chess(fen);
  const g = grid(chess);
  const [x, y] = toXY(square);
  const attacker = g[x][y];
  if (!attacker) return null;
  const enemy: Color = attacker.color === 'w' ? 'b' : 'w';

  const targets = attackedSquares(g, square)
    .map((sq) => {
      const [tx, ty] = toXY(sq);
      return { square: sq, piece: g[tx][ty] };
    })
    .filter(({ piece }) => piece && piece.color === enemy && piece.type !== 'p')
    .filter(({ square: sq, piece }) => {
      if (piece!.type === 'k') return true;
      if (PIECE_VALUES[piece!.type] > PIECE_VALUES[attacker.type]) return true;
      return chess.attackers(sq, enemy).length === 0;
    })
    .map(({ square: sq, piece }) => ({ square: sq, type: piece!.type }));

  return targets.length >= 2 ? targets : null;
}

export interface Pin {
  pinned: TargetPiece;
  behind: TargetPiece;
}

/** Açmaz: `square`daki uzun menzilli taş bir rakip taşı şaha ya da daha değerli bir taşa karşı açmaza alıyor mu? */
export function detectPin(fen: string, square: Square): Pin | null {
  const g = grid(new Chess(fen));
  const [x, y] = toXY(square);
  const attacker = g[x][y];
  if (!attacker) return null;

  for (const [dx, dy] of slidingDirs(attacker.type)) {
    let first: TargetPiece | null = null;
    for (let cx = x + dx, cy = y + dy; inside(cx, cy); cx += dx, cy += dy) {
      const piece = g[cx][cy];
      if (!piece) continue;
      if (piece.color === attacker.color) break;
      if (!first) {
        if (piece.type === 'k') break;
        first = { square: toSquare(cx, cy), type: piece.type };
        continue;
      }
      const morevaluable = piece.type === 'k' || PIECE_VALUES[piece.type] > PIECE_VALUES[first.type];
      if (morevaluable && first.type !== 'p') return { pinned: first, behind: { square: toSquare(cx, cy), type: piece.type } };
      break;
    }
  }
  return null;
}

/** Rakibin saldırdığı ve hiç korunmayan taşlar (şah ve piyonlar hariç). */
export function hangingPieces(fen: string, color: Color): TargetPiece[] {
  const chess = new Chess(fen);
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const out: TargetPiece[] = [];
  chess.board().forEach((row) =>
    row.forEach((sq) => {
      if (!sq || sq.color !== color || sq.type === 'k' || sq.type === 'p') return;
      if (chess.attackers(sq.square, enemy).length > 0 && chess.attackers(sq.square, color).length === 0) {
        out.push({ square: sq.square, type: sq.type });
      }
    }),
  );
  return out;
}

/** Bir tarafın tahtadaki toplam materyali (şah hariç). */
export function material(fen: string, color: Color): number {
  return new Chess(fen)
    .board()
    .flat()
    .reduce((sum, sq) => (sq && sq.color === color ? sum + PIECE_VALUES[sq.type] : sum), 0);
}

/** `color` için materyal farkı (kendi − rakip). */
export function materialBalance(fen: string, color: Color): number {
  return material(fen, color) - material(fen, color === 'w' ? 'b' : 'w');
}

/** Verilen UCI çizgisini oynayıp `color` açısından materyal dengesindeki değişimi döndürür. */
export function materialSwing(fen: string, pv: string[], color: Color, plies: number): number {
  const chess = new Chess(fen);
  const start = materialBalance(fen, color);
  for (const uci of pv.slice(0, plies)) {
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      break;
    }
  }
  return materialBalance(chess.fen(), color) - start;
}

/** FEN'deki rok hakları içinden `color`a ait olanlar ("K", "Q" harfleri, büyük harfle). */
export function castlingRights(fen: string, color: Color): string {
  const field = fen.split(' ')[2] ?? '-';
  const own = color === 'w' ? field.replace(/[^KQ]/g, '') : field.replace(/[^kq]/g, '').toUpperCase();
  return own;
}
