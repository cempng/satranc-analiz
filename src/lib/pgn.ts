import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';

export type Color = 'w' | 'b';

/** Oyundaki tek bir yarım hamle (ply) ve ardından gelen pozisyon. */
export interface PlyMove {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  color: Color;
  /** Hamle numarası (1. e4 e5 → ikisi de 1). */
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  headers: Record<string, string>;
  startFen: string;
  moves: PlyMove[];
  /** Ham PGN metni (önbellek anahtarı vb. için). */
  raw: string;
}

export interface GameParseResult {
  game?: ParsedGame;
  error?: string;
  /** Listede göstermek için başlıklar (hatalı oyunda da dolu olabilir). */
  headers: Record<string, string>;
}

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '½-½', '*']);

/** Birden çok oyun içeren PGN metnini tek tek oyun metinlerine böler. */
export function splitGames(text: string): string[] {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && seenMoves) {
      games.push(current.join('\n'));
      current = [];
      seenMoves = false;
    }
    if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('%')) seenMoves = true;
    current.push(line);
  }
  if (current.join('').trim()) games.push(current.join('\n'));
  return games.map((g) => g.trim()).filter(Boolean);
}

/** [Etiket "değer"] — genelde kendi satırındadır ama hamlelerle aynı satırda da olabilir. */
const headerRegex = () => /\[(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/g;

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const re = headerRegex();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) headers[m[1]] = m[2].replace(/\\(.)/g, '$1');
  return headers;
}

/** Hamle metninden yorumları, varyantları, NAG'leri ve hamle numaralarını temizleyip SAN listesi döndürür. */
function tokenizeMoves(text: string): string[] {
  const body = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('%'))
    .join(' ')
    .replace(headerRegex(), ' ');

  let out = '';
  let braceDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (braceDepth > 0) {
      if (ch === '}') braceDepth--;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      continue;
    }
    if (ch === '(') {
      parenDepth++;
      continue;
    }
    if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
      continue;
    }
    if (parenDepth > 0) continue;
    out += ch;
  }

  return out
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, '')) // "12." veya "12..." öneki
    .map((t) => t.replace(/^\.+/, ''))
    .filter((t) => t && !/^\d+$/.test(t) && !t.startsWith('$'))
    .map((t) => t.replace(/[?!]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O'));
}

function stripLineComments(text: string): string {
  return text
    .split('\n')
    .map((l) => {
      if (l.trim().startsWith('[')) return l;
      const idx = l.indexOf(';');
      return idx >= 0 ? l.slice(0, idx) : l;
    })
    .join('\n');
}

/** Tek bir oyunun PGN metnini ayrıştırır; hata olursa Türkçe mesaj döndürür. */
export function parseGame(raw: string): GameParseResult {
  const headers = parseHeaders(raw);
  const startFen = headers.FEN?.trim() || DEFAULT_POSITION;

  const chess = new Chess();
  try {
    chess.load(startFen);
  } catch {
    return { headers, error: `[FEN] etiketindeki pozisyon geçersiz: "${startFen}"` };
  }

  const tokens = tokenizeMoves(stripLineComments(raw));
  const moves: PlyMove[] = [];

  for (const token of tokens) {
    if (RESULT_TOKENS.has(token)) break;
    const color = chess.turn();
    const moveNumber = chess.moveNumber();
    const fenBefore = chess.fen();
    let move;
    try {
      move = chess.move(token);
    } catch {
      move = null;
    }
    if (!move) {
      const side = color === 'w' ? 'Beyaz' : 'Siyah';
      const prefix = color === 'w' ? `${moveNumber}.` : `${moveNumber}...`;
      return {
        headers,
        error: `${moveNumber}. hamlede sorun var (${side}): "${prefix} ${token}" bu pozisyonda geçerli bir hamle değil.`,
      };
    }
    moves.push({
      san: move.san,
      uci: move.from + move.to + (move.promotion ?? ''),
      from: move.from,
      to: move.to,
      color,
      moveNumber,
      fenBefore,
      fenAfter: chess.fen(),
    });
  }

  if (moves.length === 0 && !headers.FEN) {
    return { headers, error: 'PGN içinde hiç hamle bulunamadı.' };
  }

  return { headers, game: { headers, startFen, moves, raw } };
}

/** PGN metnindeki tüm oyunları ayrıştırır. */
export function parsePgn(text: string): GameParseResult[] {
  return splitGames(text).map(parseGame);
}

const TR_PIECES: Record<string, string> = { K: 'Ş', Q: 'V', R: 'K', B: 'F', N: 'A' };

/** İngilizce SAN'ı Türkçe taş harflerine çevirir (N→A, B→F, R→K, Q→V, K→Ş). */
export function toTurkishSan(san: string): string {
  if (san.startsWith('O-O')) return san;
  return san.replace(/[KQRBN]/g, (p) => TR_PIECES[p]);
}
