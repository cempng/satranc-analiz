import { uciLineToSan, type Score } from '../engine/uci';
import type { ParsedGame } from '../lib/pgn';
import { t } from '../i18n/core';
import { gameAccuracy } from './accuracy';
import type { MoveClassification, PositionEval } from './classify';
import { MOVE_CLASS_META, type MoveClass } from './moveClasses';

/** Standart PGN işaretleri (NAG): $1 !, $2 ?, $3 !!, $4 ??, $6 ?! */
const NAGS: Partial<Record<MoveClass, string>> = {
  brilliant: '$3',
  great: '$1',
  inaccuracy: '$6',
  mistake: '$2',
  blunder: '$4',
};

const ROSTER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];

/** Skoru lichess/ChessBase uyumlu [%eval] biçimine çevirir: "0.35", "-1.20", "#3", "#-2". */
export function evalTag(score: Score): string {
  if (score.type === 'mate') return `#${score.winner === 'w' ? '' : '-'}${score.moves}`;
  return (score.cp / 100).toFixed(2);
}

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeComment(text: string): string {
  return text.replace(/[{}]/g, '');
}

/** Satırları 80 karakteri geçmeyecek şekilde böler. */
function wrap(tokens: string[], width = 80): string {
  const lines: string[] = [];
  let line = '';
  for (const t of tokens) {
    if (line && line.length + 1 + t.length > width) {
      lines.push(line);
      line = t;
    } else {
      line = line ? `${line} ${t}` : t;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Oyunu sınıflar (NAG), motor değerlendirmesi ([%eval]) ve arayüz dilindeki kısa yorumlarla PGN olarak yazar.
 * Hamleler, diğer programlarla uyum için İngilizce notasyonda kalır.
 */
export function exportAnnotatedPgn(
  game: ParsedGame,
  classes: (MoveClassification | undefined)[],
  evals: (PositionEval | undefined)[],
  annotator = `${t('app.title')} (Stockfish 19)`,
): string {
  const accuracy = gameAccuracy(game, classes);
  const headers: Record<string, string> = { ...game.headers, Result: game.headers.Result ?? '*', Annotator: annotator };
  if (accuracy.w.overall !== undefined) headers.WhiteAccuracy = accuracy.w.overall.toFixed(1);
  if (accuracy.b.overall !== undefined) headers.BlackAccuracy = accuracy.b.overall.toFixed(1);
  for (const tag of ROSTER) headers[tag] ??= '?';

  const order = [...ROSTER, ...Object.keys(headers).filter((k) => !ROSTER.includes(k))];
  const headerText = order.map((k) => `[${k} "${escapeHeader(headers[k])}"]`).join('\n');

  const tokens: string[] = [];
  let needNumber = true;
  game.moves.forEach((move, i) => {
    if (move.color === 'w') tokens.push(`${move.moveNumber}.`);
    else if (needNumber) tokens.push(`${move.moveNumber}...`);
    tokens.push(move.san);
    needNumber = false;

    const c = classes[i];
    const after = evals[i + 1]?.lines[0]?.score;
    if (c && NAGS[c.cls]) tokens.push(NAGS[c.cls]!);
    if (c || after) {
      const parts: string[] = [];
      if (after) parts.push(`[%eval ${evalTag(after)}]`);
      if (c) {
        let text = MOVE_CLASS_META[c.cls].label + '.';
        if (!c.isBest && c.bestMove && c.cls !== 'book' && c.cls !== 'forced') {
          const best = uciLineToSan(move.fenBefore, [c.bestMove])[0];
          if (best) text += ` Daha iyisi ${best} idi.`;
        }
        parts.push(text);
      }
      tokens.push(`{${escapeComment(parts.join(' '))}}`);
      // Yorumdan sonra siyahın hamlesi "12..." ile yazılır.
      needNumber = true;
    }
  });
  tokens.push(headers.Result);

  return `${headerText}\n\n${wrap(tokens)}\n`;
}

/** İndirilecek dosya adı: "Beyaz-Siyah.pgn" (güvenli karakterlerle). */
export function pgnFileName(game: ParsedGame): string {
  const clean = (s?: string) => (s ?? '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'oyun';
  return `${clean(game.headers.White)}-${clean(game.headers.Black)}-analiz.pgn`;
}
