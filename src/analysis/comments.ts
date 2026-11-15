import { Chess, type Square } from 'chess.js';
import { formatScore, uciLineToSan } from '../engine/uci';
import { formatUciLine, withAccusative } from '../lib/notation';
import { toTurkishSan, type PlyMove } from '../lib/pgn';
import type { MoveClassification, PositionEval } from './classify';
import { CLASSIFY, PIECE_VALUES, type ClassifyConfig } from './config';
import { MOVE_CLASS_META, type MoveClass } from './moveClasses';
import {
  castlingRights,
  detectFork,
  detectPin,
  hangingPieces,
  materialBalance,
  materialSwing,
  PIECE_NAMES,
} from './tactics';
import { winPctFor } from './winPct';

export interface MoveComment {
  /** Sınıf ve kısa açıklama. */
  headline: string;
  /** Taktik tespitler ve nedenler. */
  details: string[];
  /** Motorun önerdiği devam (Türkçe notasyon). */
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
}

/** Bir devamda materyal kaybını değerlendirmek için bakılan yarım hamle sayısı. */
const SWING_PLIES = 6;
/** Yorumda gösterilen devam çizgisinin uzunluğu (yarım hamle). */
const LINE_PLIES = 8;

const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder', 'missed'];

function sanOf(fen: string, uci?: string): string | undefined {
  if (!uci) return undefined;
  const san = uciLineToSan(fen, [uci])[0];
  return san ? toTurkishSan(san) : undefined;
}

function joinTr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ve ${items.at(-1)}`;
}

function headlineFor(input: CommentInput, bestSan?: string): string {
  const { info, before, move, openingName } = input;
  const label = MOVE_CLASS_META[info.cls].label;
  const better = bestSan ? ` Daha iyisi ${bestSan} idi.` : '';
  switch (info.cls) {
    case 'book':
      return openingName ? `Kitap hamlesi (${openingName}).` : 'Kitap hamlesi.';
    case 'forced':
      return 'Zorunlu hamle: başka yasal hamle yoktu.';
    case 'brilliant':
      return 'Brillant hamle! Taş feda ediliyor ama pozisyon korunuyor.';
    case 'great': {
      const second = before.lines[1];
      const gap = second ? info.winBefore - winPctFor(second.score, move.color) : 0;
      return gap >= (input.config ?? CLASSIFY).great.minGapToSecond
        ? 'Harika hamle! Bu pozisyondaki tek iyi hamle.'
        : 'Harika hamle! Rakibin hatasını cezalandırarak oyunun gidişatını değiştiriyor.';
    }
    case 'best':
      return 'En iyi hamle.';
    case 'excellent':
      return `Mükemmel hamle; motorun seçimine çok yakın.${better}`;
    case 'good':
      return `İyi hamle, ama daha güçlüsü vardı.${better}`;
    case 'missed':
      return `Kaçırılan Fırsat: rakibin hatasından yararlanamadın.${better}`;
    case 'inaccuracy':
      return `Bu belirsiz bir hamle (?!).${better}`;
    default:
      return `Bu bir ${label} (${MOVE_CLASS_META[info.cls].symbol}).${better}`;
  }
}

/** Hamle için kural tabanlı Türkçe yorum üretir (saf fonksiyon). */
export function buildComment(input: CommentInput): MoveComment {
  const { move, info, before, after } = input;
  const mover = move.color;
  const enemy = mover === 'w' ? 'b' : 'w';
  const bad = BAD.includes(info.cls);
  const details: string[] = [];

  const bestSan = !info.isBest && info.cls !== 'book' && info.cls !== 'forced' ? sanOf(move.fenBefore, info.bestMove) : undefined;
  const bestScore = before.lines[0]?.score;
  const afterScore = after.lines[0]?.score;
  const reply = after.lines[0]?.pv[0];
  const replySan = sanOf(move.fenAfter, reply);

  // Mat durumları
  if (afterScore?.type === 'mate' && afterScore.moves === 0) {
    details.push('Mat! Oyun bitti.');
  } else {
    const hadMate = bestScore?.type === 'mate' && bestScore.winner === mover;
    const keepsMate = afterScore?.type === 'mate' && afterScore.winner === mover;
    if (hadMate && !keepsMate) details.push(`Mat ${withAccusative(bestScore.moves)} kaçırdın.`);
    else if (hadMate && keepsMate && afterScore.moves >= bestScore.moves) {
      details.push(`Daha hızlı bir mat vardı (Mat ${bestScore.moves}).`);
    } else if (keepsMate) details.push(`Zorlayıcı mat var: Mat ${afterScore.moves}.`);

    const enemyMateBefore = bestScore?.type === 'mate' && bestScore.winner === enemy;
    if (afterScore?.type === 'mate' && afterScore.winner === enemy && !enemyMateBefore) {
      details.push(
        `Bu hamleden sonra rakibin zorlayıcı bir matı var (Mat ${afterScore.moves})${replySan ? `, ${replySan} ile başlıyor` : ''}.`,
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
      details.push(`Şimdi rakip ${replySan} ile ${PIECE_NAMES[target.type].acc} kazanıyor.`);
    } else if (bad && swing <= -2) {
      details.push(`Rakip ${replySan} ile başlayan devamda yaklaşık ${Math.abs(swing)} puanlık materyal kazanıyor.`);
    }
    if (bad) {
      const replyBoard = new Chess(move.fenAfter);
      try {
        replyBoard.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
        const fork = detectFork(replyBoard.fen(), reply.slice(2, 4) as Square);
        if (fork) details.push(`Rakip ${replySan} ile çatal yapıyor: ${joinTr(fork.map((t) => PIECE_NAMES[t.type].acc))} aynı anda tehdit ediyor.`);
      } catch {
        /* geçersiz çizgi */
      }
    }
  }

  // Korumasız taşlar
  if (bad) {
    const hanging = hangingPieces(move.fenAfter, mover);
    if (hanging.length) {
      details.push(
        `${joinTr(hanging.map((h) => `${h.square} karesindeki ${PIECE_NAMES[h.type].nom}`))} korumasız (asılı) kaldı.`,
      );
    }
  }

  // Oynanan hamlenin yarattığı taktikler (kötü hamlelerde çürütülmüş olabilir, gösterme)
  const checkmate = afterScore?.type === 'mate' && afterScore.moves === 0;
  if (!bad && !checkmate) {
    const fork = detectFork(move.fenAfter, move.to);
    if (fork) {
      details.push(`Çatal! ${toTurkishSan(move.san)} aynı anda ${joinTr(fork.map((t) => PIECE_NAMES[t.type].acc))} tehdit ediyor.`);
    }
    const pin = detectPin(move.fenAfter, move.to);
    if (pin) {
      const kind = pin.behind.type === 'k' ? 'tam açmaz' : 'açmaz';
      details.push(
        `Açmaz: ${pin.pinned.square} karesindeki ${PIECE_NAMES[pin.pinned.type].nom}, ${PIECE_NAMES[pin.behind.type].dat} karşı ${kind}da.`,
      );
    }
    if (info.cls === 'brilliant') {
      details.push('Rakip feda edilen taşı alabilir, ama karşılığında pozisyon avantajı kaybolmuyor.');
    }
  }

  // Değişim
  const captured = new Chess(move.fenBefore).get(move.to);
  if (captured && reply && reply.slice(2, 4) === move.to) {
    const recapturer = new Chess(move.fenAfter).get(move.to);
    if (recapturer && PIECE_VALUES[captured.type] === PIECE_VALUES[recapturer.type]) {
      details.push('Taş değişimi.');
    }
  }

  // Rok hakkı
  if (!move.san.startsWith('O-O')) {
    const lostRights = castlingRights(move.fenBefore, mover).split('').filter((r) => !castlingRights(move.fenAfter, mover).includes(r));
    if (lostRights.length === 2) details.push('Bu hamleyle rok hakkını tamamen kaybettin.');
    else if (lostRights.length === 1) details.push(`Bu hamleyle ${lostRights[0] === 'K' ? 'kısa' : 'uzun'} rok hakkını kaybettin.`);
  }

  let line: MoveComment['line'];
  if (bestSan && before.lines[0]?.pv.length) {
    line = { label: 'Önerilen devam', text: formatUciLine(move.fenBefore, before.lines[0].pv, LINE_PLIES) };
  } else if (after.lines[0]?.pv.length) {
    line = { label: 'Motorun devamı', text: formatUciLine(move.fenAfter, after.lines[0].pv, LINE_PLIES) };
  }

  const evalChange =
    bestScore && afterScore ? `${formatScore(bestScore, 1)} → ${formatScore(afterScore, 1)}` : undefined;

  return { headline: headlineFor(input, bestSan), details, line, evalChange };
}
