import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { formatScore, uciLineToSan } from '../engine/uci';
import { formatUciLine, withAccusative } from '../lib/notation';
import type { PlyMove } from '../lib/pgn';
import { getLang, localSan, t, type Lang, type MessageKey } from '../i18n/core';
import type { MoveClassification, PositionEval } from './classify';
import { CLASSIFY, PIECE_VALUES, type ClassifyConfig } from './config';
import type { MoveClass } from './moveClasses';
import {
  castlingRights,
  detectFork,
  detectPin,
  hangingPieces,
  materialBalance,
  materialSwing,
} from './tactics';
import { winPctFor } from './winPct';

export interface MoveComment {
  /** Sınıf ve kısa açıklama. */
  headline: string;
  /** Taktik tespitler ve nedenler. */
  details: string[];
  /** Motorun önerdiği devam (arayüz dilinin notasyonuyla). */
  line?: { label: string; text: string };
  /** "+1.2 → -2.5" */
  evalChange?: string;
}

export interface CommentInput {
  move: PlyMove;
  info: MoveClassification;
  before: PositionEval;
  after: PositionEval;
  openingName?: string;
  config?: ClassifyConfig;
  lang?: Lang;
}

/** Bir devamda materyal kaybını değerlendirmek için bakılan yarım hamle sayısı. */
const SWING_PLIES = 6;
/** Yorumda gösterilen devam çizgisinin uzunluğu (yarım hamle). */
const LINE_PLIES = 8;

const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder', 'missed'];

function sanOf(fen: string, uci: string | undefined, lang: Lang): string | undefined {
  if (!uci) return undefined;
  const san = uciLineToSan(fen, [uci])[0];
  return san ? localSan(san, lang) : undefined;
}

function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')}${t('c.and', undefined, lang)}${items.at(-1)}`;
}

const HEADLINE_KEYS: Partial<Record<MoveClass, MessageKey>> = {
  excellent: 'c.excellent',
  good: 'c.good',
  missed: 'c.missed',
  inaccuracy: 'c.inaccuracy',
  mistake: 'c.mistake',
  blunder: 'c.blunder',
};

function headlineFor(input: CommentInput, lang: Lang, bestSan?: string): string {
  const { info, before, move, openingName } = input;
  const better = bestSan ? t('c.better', { move: bestSan }, lang) : '';
  switch (info.cls) {
    case 'book':
      return openingName ? t('c.bookNamed', { name: openingName }, lang) : t('c.book', undefined, lang);
    case 'forced':
      return t('c.forced', undefined, lang);
    case 'brilliant':
      return t('c.brilliant', undefined, lang);
    case 'great': {
      const second = before.lines[1];
      const gap = second ? info.winBefore - winPctFor(second.score, move.color) : 0;
      return t(gap >= (input.config ?? CLASSIFY).great.minGapToSecond ? 'c.greatOnly' : 'c.greatTurn', undefined, lang);
    }
    case 'best':
      return t('c.best', undefined, lang);
    default:
      return t(HEADLINE_KEYS[info.cls]!, { better }, lang);
  }
}

/** Hamle için kural tabanlı yorum üretir (saf fonksiyon; dil verilmezse geçerli arayüz dili). */
export function buildComment(input: CommentInput): MoveComment {
  const { move, info, before, after } = input;
  const lang = input.lang ?? getLang();
  const piece = (type: PieceSymbol, form: 'nom' | 'acc' | 'dat' = 'nom') =>
    t((form === 'nom' ? `piece.${type}` : `piece.${form}.${type}`) as MessageKey, undefined, lang);
  const mover = move.color;
  const enemy = mover === 'w' ? 'b' : 'w';
  const bad = BAD.includes(info.cls);
  const details: string[] = [];

  const bestSan = !info.isBest && info.cls !== 'book' && info.cls !== 'forced' ? sanOf(move.fenBefore, info.bestMove, lang) : undefined;
  const bestScore = before.lines[0]?.score;
  const afterScore = after.lines[0]?.score;
  const reply = after.lines[0]?.pv[0];
  const replySan = sanOf(move.fenAfter, reply, lang);

  // Mat durumları
  if (afterScore?.type === 'mate' && afterScore.moves === 0) {
    details.push(t('c.checkmate', undefined, lang));
  } else {
    const hadMate = bestScore?.type === 'mate' && bestScore.winner === mover;
    const keepsMate = afterScore?.type === 'mate' && afterScore.winner === mover;
    if (hadMate && !keepsMate) details.push(t('c.missedMate', { n: bestScore.moves, nAcc: withAccusative(bestScore.moves) }, lang));
    else if (hadMate && keepsMate && afterScore.moves >= bestScore.moves) {
      details.push(t('c.fasterMate', { n: bestScore.moves }, lang));
    } else if (keepsMate) details.push(t('c.forcedMate', { n: afterScore.moves }, lang));

    const enemyMateBefore = bestScore?.type === 'mate' && bestScore.winner === enemy;
    if (afterScore?.type === 'mate' && afterScore.winner === enemy && !enemyMateBefore) {
      details.push(
        replySan
          ? t('c.enemyMateFrom', { n: afterScore.moves, move: replySan }, lang)
          : t('c.enemyMate', { n: afterScore.moves }, lang),
      );
    }
  }

  // Rakibin cevabıyla materyal kaybı (hamleden önceki pozisyona göre; bu hamlede alınan taş da hesaba katılır)
  if (reply && replySan && afterScore?.type !== 'mate') {
    const swing =
      materialBalance(move.fenAfter, mover) -
      materialBalance(move.fenBefore, mover) +
      materialSwing(move.fenAfter, after.lines[0].pv, mover, SWING_PLIES);
    const target = new Chess(move.fenAfter).get(reply.slice(2, 4) as Square);
    if (bad && swing <= -2 && target && target.color === mover && PIECE_VALUES[target.type] >= 3) {
      details.push(t('c.winsPiece', { move: replySan, piece: piece(target.type, 'acc') }, lang));
    } else if (bad && swing <= -2) {
      details.push(t('c.winsMaterial', { move: replySan, n: Math.abs(swing) }, lang));
    }
    if (bad) {
      const replyBoard = new Chess(move.fenAfter);
      try {
        replyBoard.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
        const fork = detectFork(replyBoard.fen(), reply.slice(2, 4) as Square);
        if (fork) {
          const targets = joinList(fork.map((f) => piece(f.type, 'acc')), lang);
          details.push(t('c.enemyFork', { move: replySan, targets }, lang));
        }
      } catch {
        /* geçersiz çizgi */
      }
    }
  }

  // Korumasız taşlar
  if (bad) {
    const hanging = hangingPieces(move.fenAfter, mover);
    if (hanging.length) {
      const items = hanging.map((h) => t('c.hangingItem', { square: h.square, piece: piece(h.type) }, lang));
      details.push(t('c.hanging', { pieces: joinList(items, lang) }, lang));
    }
  }

  // Oynanan hamlenin yarattığı taktikler (kötü hamlelerde çürütülmüş olabilir, gösterme)
  const checkmate = afterScore?.type === 'mate' && afterScore.moves === 0;
  if (!bad && !checkmate) {
    const fork = detectFork(move.fenAfter, move.to);
    if (fork) {
      const targets = joinList(fork.map((f) => piece(f.type, 'acc')), lang);
      details.push(t('c.fork', { move: localSan(move.san, lang), targets }, lang));
    }
    const pin = detectPin(move.fenAfter, move.to);
    if (pin) {
      details.push(
        t(
          pin.behind.type === 'k' ? 'c.pinAbsolute' : 'c.pin',
          { square: pin.pinned.square, piece: piece(pin.pinned.type), behind: piece(pin.behind.type, 'dat') },
          lang,
        ),
      );
    }
    if (info.cls === 'brilliant') {
      details.push(t('c.sacrifice', undefined, lang));
    }
  }

  // Değişim
  const captured = new Chess(move.fenBefore).get(move.to);
  if (captured && reply && reply.slice(2, 4) === move.to) {
    const recapturer = new Chess(move.fenAfter).get(move.to);
    if (recapturer && PIECE_VALUES[captured.type] === PIECE_VALUES[recapturer.type]) {
      details.push(t('c.exchange', undefined, lang));
    }
  }

  // Rok hakkı
  if (!move.san.startsWith('O-O')) {
    const lostRights = castlingRights(move.fenBefore, mover).split('').filter((r) => !castlingRights(move.fenAfter, mover).includes(r));
    if (lostRights.length === 2) details.push(t('c.castleLost', undefined, lang));
    else if (lostRights.length === 1) details.push(t(lostRights[0] === 'K' ? 'c.castleLostShort' : 'c.castleLostLong', undefined, lang));
  }

  let line: MoveComment['line'];
  if (bestSan && before.lines[0]?.pv.length) {
    line = { label: t('c.lineSuggested', undefined, lang), text: formatUciLine(move.fenBefore, before.lines[0].pv, LINE_PLIES, lang) };
  } else if (after.lines[0]?.pv.length) {
    line = { label: t('c.lineEngine', undefined, lang), text: formatUciLine(move.fenAfter, after.lines[0].pv, LINE_PLIES, lang) };
  }

  const evalChange =
    bestScore && afterScore ? `${formatScore(bestScore, 1)} → ${formatScore(afterScore, 1)}` : undefined;

  return { headline: headlineFor(input, lang, bestSan), details, line, evalChange };
}
