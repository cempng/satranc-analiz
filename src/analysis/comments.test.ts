import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { Score } from '../engine/uci';
import { parseGame } from '../lib/pgn';
import { OPERA_GAME } from '../data/sampleGames';
import { withAccusative } from '../lib/notation';
import { aggregateAccuracy, gameAccuracy, gamePhases, moveAccuracy } from './accuracy';
import { classifyMove, type MoveClassification, type PositionEval } from './classify';
import { buildComment } from './comments';
import { summarizeGame } from './summary';
import { castlingRights, detectFork, detectPin, hangingPieces, materialSwing } from './tactics';

const cp = (value: number): Score => ({ type: 'cp', cp: value });
const evalOf = (score: Score, pv: string[]): PositionEval => ({ lines: [{ score, pv }] });

/** Verilen pozisyondan tek hamle oynayıp PlyMove benzeri nesne döndürür. */
function playMove(fen: string, san: string) {
  const chess = new Chess(fen);
  const m = chess.move(san);
  return {
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    from: m.from,
    to: m.to,
    color: m.color,
    moveNumber: Number(fen.split(' ')[5]),
    fenBefore: fen,
    fenAfter: chess.fen(),
  };
}

describe('Doğruluk', () => {
  it('kayıpsız hamle %100, formül ve kırpma', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 3);
    expect(moveAccuracy(10)).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 3.1669, 6);
    expect(moveAccuracy(500)).toBe(0);
  });

  it('aritmetik ve harmonik ortalamanın ortalaması', () => {
    const accs = [100, 50];
    const arithmetic = 75;
    const harmonic = 2 / (1 / 100 + 1 / 50);
    expect(aggregateAccuracy(accs)).toBeCloseTo((arithmetic + harmonic) / 2);
    expect(aggregateAccuracy([])).toBeUndefined();
  });

  it('zorunlu hamleler doğruluğa katılmaz', () => {
    const game = parseGame('1. e4 e5 *').game!;
    const mk = (cls: MoveClassification['cls'], loss: number): MoveClassification => ({
      cls,
      loss,
      winBefore: 50,
      winAfter: 50 - loss,
      isBest: false,
    });
    const acc = gameAccuracy(game, [mk('blunder', 40), mk('forced', 40)]);
    expect(acc.w.overall).toBeCloseTo(moveAccuracy(40));
    expect(acc.b.overall).toBeUndefined();
  });

  it('evreler: açılış → oyun ortası, Opera oyununda oyun sonu yok', () => {
    const game = parseGame(OPERA_GAME).game!;
    const phases = gamePhases(game, []);
    expect(phases[0]).toBe('opening');
    expect(phases[25]).toBe('middlegame');
    expect(phases).not.toContain('endgame');
  });

  it('az taş kalınca oyun sonu', () => {
    const game = parseGame('[FEN "4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1"]\n\n1. Ra8+ Kd7 *').game!;
    expect(gamePhases(game, [])).toEqual(['endgame', 'endgame']);
  });
});

describe('Taktik tespitleri', () => {
  it('at çatalı (şah ve kale)', () => {
    // Beyaz at c7'de: e8'deki şahı ve a8'deki kaleyi tehdit ediyor.
    const fork = detectFork('r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1', 'c7');
    expect(fork?.map((t) => t.type).sort()).toEqual(['k', 'r']);
  });

  it('korunan piyonlara saldırı çatal değildir', () => {
    expect(detectFork('4k3/8/8/2p1p3/8/3N4/8/4K3 w - - 0 1', 'd3')).toBeNull();
  });

  it('fil ile şaha karşı açmaz', () => {
    // Fb5, c6'daki atı e8'deki şaha karşı açmaza alıyor.
    const pin = detectPin('4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1', 'b5');
    expect(pin).toMatchObject({ pinned: { square: 'c6', type: 'n' }, behind: { type: 'k' } });
  });

  it('korumasız taş', () => {
    const hanging = hangingPieces('4k3/8/8/3q4/8/8/3N4/4K3 w - - 0 1', 'b');
    expect(hanging).toEqual([]); // vezire kimse saldırmıyor
    expect(hangingPieces('4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1', 'b')).toEqual([{ square: 'd5', type: 'q' }]);
  });

  it('materyal değişimi ve rok hakları', () => {
    const fen = '4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1';
    expect(materialSwing(fen, ['e3d5'], 'w', 2)).toBe(9);
    expect(castlingRights('r3k2r/8/8/8/8/8/8/R3K2R w KQq - 0 1', 'b')).toBe('Q');
  });

  it('Türkçe belirtme hâli eki', () => {
    expect(['1', '2', '3', '4', '5', '6', '9', '10', '40'].map((n) => withAccusative(Number(n)))).toEqual([
      "1'i",
      "2'yi",
      "3'ü",
      "4'ü",
      "5'i",
      "6'yı",
      "9'u",
      "10'u",
      "40'ı",
    ]);
  });
});

describe('Yorumlar', () => {
  it('Büyük Hata: daha iyi hamleyi ve rakibin kazandığı taşı söyler', () => {
    // Siyah veziri korumasız d5'e götürüyor; beyaz at alabiliyor.
    const start = '4k3/8/8/8/8/4N3/8/3qK3 b - - 0 1';
    const move = playMove(start, 'Qd5');
    const before = evalOf(cp(-900), ['d1d2']);
    const after = evalOf(cp(0), ['e3d5', 'e8d7']);
    const info = classifyMove({ uci: move.uci, color: 'b', before, after, isBook: false, legalMoves: 20, sacrifice: 0 });
    expect(info.cls).toBe('blunder');
    const c = buildComment({ move, info, before, after });
    expect(c.headline).toBe('Bu bir Büyük Hata (??). Daha iyisi Vd2+ idi.');
    expect(c.details.join(' ')).toContain('Şimdi rakip Axd5 ile veziri kazanıyor.');
    expect(c.details.join(' ')).toContain('d5 karesindeki vezir korumasız (asılı) kaldı.');
    expect(c.evalChange).toBe('-9.0 → +0.0');
    expect(c.line?.label).toBe('Önerilen devam');
  });

  it('kaçırılan mat', () => {
    const start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    const move = playMove(start, 'Kf2');
    const before = evalOf({ type: 'mate', moves: 1, winner: 'w' }, ['a1a8']);
    const after = evalOf(cp(500), ['g8f8']);
    const info = classifyMove({ uci: move.uci, color: 'w', before, after, isBook: false, legalMoves: 20, sacrifice: 0 });
    const c = buildComment({ move, info, before, after });
    expect(c.details).toContain("Mat 1'i kaçırdın.");
  });

  it('kitap hamlesinde açılış adı', () => {
    const move = playMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4');
    const ev = evalOf(cp(30), ['e2e4']);
    const info = classifyMove({ uci: move.uci, color: 'w', before: ev, after: ev, isBook: true, legalMoves: 20, sacrifice: 0 });
    expect(buildComment({ move, info, before: ev, after: ev, openingName: "King's Pawn Game" }).headline).toBe(
      "Kitap hamlesi (King's Pawn Game).",
    );
  });

  it('rok hakkı kaybı', () => {
    const move = playMove('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'Ke2');
    const ev = evalOf(cp(0), ['a8a7']);
    const info = classifyMove({ uci: move.uci, color: 'w', before: ev, after: ev, isBook: false, legalMoves: 20, sacrifice: 0 });
    expect(buildComment({ move, info, before: ev, after: ev }).details).toContain('Bu hamleyle rok hakkını tamamen kaybettin.');
  });
});

describe('Özet', () => {
  it('sınıf sayıları ve kritik anlar', () => {
    const game = parseGame('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 *').game!;
    const mk = (cls: MoveClassification['cls'], loss: number): MoveClassification => ({
      cls,
      loss,
      winBefore: 50,
      winAfter: 50 - loss,
      isBest: false,
    });
    const s = summarizeGame(game, [
      mk('book', 0),
      mk('book', 0),
      mk('great', 0),
      mk('mistake', 12),
      mk('inaccuracy', 6),
      mk('blunder', 30),
    ]);
    expect(s.counts.w.book).toBe(1);
    expect(s.counts.b.blunder).toBe(1);
    expect(s.critical.map((m) => [m.ply, m.kind])).toEqual([
      [3, 'highlight'],
      [4, 'error'],
      [5, 'error'],
      [6, 'error'],
    ]);
  });
});
