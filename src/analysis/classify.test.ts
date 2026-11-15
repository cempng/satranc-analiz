import { describe, expect, it } from 'vitest';
import type { Score } from '../engine/uci';
import { classByLoss, classifyMove, type ClassifyInput, type PositionEval } from './classify';
import { sacrificedMaterial } from './sacrifice';
import { winPctFromCp } from './winPct';
import { parseGame } from '../lib/pgn';
import { OPERA_GAME } from '../data/sampleGames';

const cp = (value: number): Score => ({ type: 'cp', cp: value });
const evalOf = (...lines: [Score, string][]): PositionEval => ({
  lines: lines.map(([score, move]) => ({ score, pv: [move] })),
});

/** Beyaz e2e4 oynuyor; varsayılan: en iyi hamle e2e4, pozisyon eşit. */
function input(over: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    uci: 'e2e4',
    color: 'w',
    before: evalOf([cp(0), 'e2e4'], [cp(-10), 'd2d4']),
    after: evalOf([cp(0), 'e7e5']),
    isBook: false,
    legalMoves: 20,
    sacrifice: 0,
    ...over,
  };
}

/** Beyaz için Win% kaybı `loss` olacak şekilde hamle sonrası cp değeri bulur (önce 0 cp). */
function cpForLoss(loss: number): number {
  let lo = -1000;
  let hi = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (50 - winPctFromCp(mid) > loss) lo = mid;
    else hi = mid;
  }
  return hi;
}

describe('Kayba göre sınıf eşikleri', () => {
  it.each([
    [0, 'excellent'],
    [1.99, 'excellent'],
    [2, 'good'],
    [4.99, 'good'],
    [5, 'inaccuracy'],
    [9.99, 'inaccuracy'],
    [10, 'mistake'],
    [19.99, 'mistake'],
    [20, 'blunder'],
    [60, 'blunder'],
  ] as const)('kayıp %s → %s', (loss, cls) => {
    expect(classByLoss(loss)).toBe(cls);
  });

  it('classifyMove kaybı doğru hesaplar ve sınıflar', () => {
    const r = classifyMove(input({ uci: 'a2a3', after: evalOf([cp(cpForLoss(12)), 'e7e5']) }));
    expect(r.loss).toBeCloseTo(12, 1);
    expect(r.cls).toBe('mistake');
  });
});

describe('Özel sınıflar', () => {
  it('tek yasal hamle → Zorunlu (kitaptan da önce)', () => {
    expect(classifyMove(input({ legalMoves: 1, isBook: true })).cls).toBe('forced');
  });

  it('kitap pozisyonu → Kitap', () => {
    expect(classifyMove(input({ isBook: true })).cls).toBe('book');
  });

  it('motorun 1 numaralı hamlesi → En İyi', () => {
    expect(classifyMove(input()).cls).toBe('best');
  });

  it('ikinci hamleden ≥10 Win% iyi olan tek hamle → Harika', () => {
    const before = evalOf([cp(0), 'e2e4'], [cp(-300), 'd2d4']);
    expect(classifyMove(input({ before })).cls).toBe('great');
  });

  it('rakibin hatasını cezalandırıp kazanana geçen en iyi hamle → Harika', () => {
    const before = evalOf([cp(400), 'e2e4'], [cp(350), 'd2d4']);
    const r = classifyMove(
      input({ before, after: evalOf([cp(400), 'e7e5']), prevOpponentClass: 'blunder', winBeforeOpponentMove: 50 }),
    );
    expect(r.cls).toBe('great');
  });

  it('kayıpsız taş fedası, eşit pozisyonda → Brillant', () => {
    expect(classifyMove(input({ uci: 'f1f7', sacrifice: 3 })).cls).toBe('brilliant');
  });

  it('zaten ezici üstünken yapılan feda Brillant değildir', () => {
    const before = evalOf([cp(900), 'f1f7'], [cp(880), 'd2d4']);
    const r = classifyMove(input({ uci: 'f1f7', sacrifice: 3, before, after: evalOf([cp(900), 'e7e5']) }));
    expect(r.cls).toBe('best');
  });

  it('rakip hata yaptı, kazanan devam vardı ama kaçırıldı → Kaçırılan Fırsat', () => {
    const before = evalOf([cp(500), 'e2e4'], [cp(450), 'd2d4']);
    const r = classifyMove(input({ uci: 'a2a3', before, after: evalOf([cp(0), 'e7e5']), prevOpponentClass: 'mistake' }));
    expect(r.cls).toBe('missed');
  });

  it('pozisyon zaten belliyse hata sınıfı yumuşatılır', () => {
    // Mattan (%100) +10'a (%97.5) inmek: kayıp 2.5 → İyi (hata sınıfı değil, aynen kalır).
    const before = evalOf([{ type: 'mate', moves: 3, winner: 'w' }, 'e2e4']);
    expect(classifyMove(input({ uci: 'a2a3', before, after: evalOf([cp(1000), 'e7e5']) })).cls).toBe('good');
    // Siyah zaten kaybetmiş (%0) ve hamle sonrası da kaybetmiş: kayıp 0 → Mükemmel.
    const lostBefore = evalOf([{ type: 'mate', moves: 5, winner: 'w' }, 'e7e5']);
    const lostAfter = evalOf([{ type: 'mate', moves: 2, winner: 'w' }, 'g1f3']);
    expect(classifyMove(input({ uci: 'a7a6', color: 'b', before: lostBefore, after: lostAfter })).cls).toBe('excellent');
  });
});

describe('Mat skorları ve perspektif', () => {
  it('siyahın hamlesinde kayıp siyah perspektifinden hesaplanır', () => {
    const before = evalOf([cp(0), 'e7e5']);
    const after = evalOf([cp(300), 'g1f3']); // beyaz +3 oldu → siyah kaybetti
    const r = classifyMove(input({ uci: 'f7f6', color: 'b', before, after }));
    expect(r.winBefore).toBeCloseTo(50);
    expect(r.loss).toBeGreaterThan(20);
    expect(r.cls).toBe('blunder');
  });

  it('kazanılmış mattan eşitliğe düşmek Büyük Hatadır', () => {
    const before = evalOf([{ type: 'mate', moves: 2, winner: 'w' }, 'd1h5']);
    const r = classifyMove(input({ uci: 'a2a3', before, after: evalOf([cp(0), 'e7e5']) }));
    expect(r.loss).toBe(50);
    expect(r.cls).toBe('blunder');
  });

  it('mat eden hamle kaybetmez', () => {
    const before = evalOf([{ type: 'mate', moves: 1, winner: 'w' }, 'd1h5']);
    const after = evalOf([{ type: 'mate', moves: 0, winner: 'w' }, '']);
    const r = classifyMove(input({ uci: 'd1h5', before, after }));
    expect(r.loss).toBe(0);
    expect(r.cls).toBe('best');
  });
});

describe('Feda tespiti', () => {
  it('Opera oyunu 16. Vb8+: vezir korumasız bırakılıyor', () => {
    const move = parseGame(OPERA_GAME).game!.moves[30];
    expect(move.san).toBe('Qb8+');
    expect(sacrificedMaterial(move.fenBefore, move.uci)).toBe(9);
  });

  it('korunan kareye çıkmak feda değildir', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(sacrificedMaterial(start, 'g1f3')).toBe(0);
  });

  it('piyon kaybı feda sayılmaz', () => {
    // 1. e4 d5 2. ... beyaz piyonu d5'e alınabilir yerde bırakır
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2';
    expect(sacrificedMaterial(fen, 'e2e4')).toBe(0);
  });

  it('Fxf7+ Şxf7: fil piyon karşılığı verilir (net 2)', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(sacrificedMaterial(fen, 'c4f7')).toBe(2);
  });
});
