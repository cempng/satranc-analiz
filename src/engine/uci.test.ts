import { describe, expect, it } from 'vitest';
import { formatScore, parseInfo, toWhiteScore, uciLineToSan } from './uci';
import { winPct, winPctFromCp, winPctFor } from '../analysis/winPct';

describe('UCI info ayrıştırma', () => {
  it('multipv, skor ve pv okur', () => {
    const info = parseInfo(
      'info depth 16 seldepth 21 multipv 2 score cp -35 nodes 123 nps 1000 time 50 pv e7e5 g1f3 b8c6',
    );
    expect(info).toEqual({ depth: 16, multipv: 2, scoreType: 'cp', scoreValue: -35, pv: ['e7e5', 'g1f3', 'b8c6'] });
  });

  it('mat skoru okur', () => {
    expect(parseInfo('info depth 5 multipv 1 score mate -2 pv h7h6')).toMatchObject({ scoreType: 'mate', scoreValue: -2 });
  });

  it('sınır skorlarını, string ve skorsuz satırları atlar', () => {
    expect(parseInfo('info depth 10 multipv 1 score cp 20 lowerbound pv e2e4')).toBeNull();
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1')).toBeNull();
  });
});

describe('Beyaz perspektifine dönüşüm', () => {
  it('sıra beyazdaysa cp aynen kalır, siyahtaysa işaret değişir', () => {
    expect(toWhiteScore('cp', 50, 'w')).toEqual({ type: 'cp', cp: 50 });
    expect(toWhiteScore('cp', 50, 'b')).toEqual({ type: 'cp', cp: -50 });
    expect(toWhiteScore('cp', -120, 'b')).toEqual({ type: 'cp', cp: 120 });
  });

  it('mat skorlarında kazananı belirler', () => {
    expect(toWhiteScore('mate', 3, 'w')).toEqual({ type: 'mate', moves: 3, winner: 'w' });
    expect(toWhiteScore('mate', 3, 'b')).toEqual({ type: 'mate', moves: 3, winner: 'b' });
    expect(toWhiteScore('mate', -2, 'b')).toEqual({ type: 'mate', moves: 2, winner: 'w' });
    // Tahtada mat: sırası gelen taraf kaybetmiştir.
    expect(toWhiteScore('mate', 0, 'b')).toEqual({ type: 'mate', moves: 0, winner: 'w' });
  });

  it('skoru biçimlendirir', () => {
    expect(formatScore({ type: 'cp', cp: 125 })).toBe('+1.25');
    expect(formatScore({ type: 'cp', cp: -40 }, 1)).toBe('-0.4');
    expect(formatScore({ type: 'mate', moves: 2, winner: 'b' })).toBe('-M2');
  });

  it('UCI çizgisini SAN’a çevirir', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciLineToSan(start, ['e2e4', 'e7e5', 'g1f3', 'zzzz', 'b8c6'])).toEqual(['e4', 'e5', 'Nf3']);
  });
});

describe('Win%', () => {
  it('0 cp için %50, simetrik', () => {
    expect(winPctFromCp(0)).toBeCloseTo(50);
    expect(winPctFromCp(300) + winPctFromCp(-300)).toBeCloseTo(100);
  });

  it('formülle uyumlu ve ±1000 ile sınırlı', () => {
    expect(winPctFromCp(100)).toBeCloseTo(59.1, 1);
    expect(winPctFromCp(5000)).toBeCloseTo(winPctFromCp(1000));
  });

  it('matta kazanana 100, kaybedene 0', () => {
    expect(winPct({ type: 'mate', moves: 4, winner: 'w' })).toBe(100);
    expect(winPctFor({ type: 'mate', moves: 4, winner: 'w' }, 'b')).toBe(0);
  });
});
