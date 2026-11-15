import { describe, expect, it } from 'vitest';
import { parseGame, parsePgn, splitGames, toTurkishSan } from './pgn';
import { OPERA_GAME } from '../data/sampleGames';

describe('PGN ayrıştırma', () => {
  it('Opera oyununu okur', () => {
    const { game, error } = parseGame(OPERA_GAME);
    expect(error).toBeUndefined();
    expect(game!.moves).toHaveLength(33);
    expect(game!.headers.White).toBe('Paul Morphy');
    expect(game!.moves.at(-1)!.san).toBe('Rd8#');
  });

  it('yorum, varyant, NAG ve işaretleri yok sayar', () => {
    const pgn = '1. e4 {iyi} e5!? (1... c5 2. Nf3) 2. Nf3 $1 Nc6 ; satır yorumu\n3. Bb5?! a6 1/2-1/2';
    const { game, error } = parseGame(pgn);
    expect(error).toBeUndefined();
    expect(game!.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  });

  it('hatalı hamlede hamle numarasını söyler', () => {
    const bad = parseGame('1. e4 e5 2. Nf3 Nc6 3. Bxf7 a6');
    expect(bad.error).toContain('3. hamlede');
    expect(bad.error).toContain('Beyaz');
  });

  it('[FEN] etiketinden başlar', () => {
    const pgn = '[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1"]\n\n1... Kd7 2. e4 *';
    const { game, error } = parseGame(pgn);
    expect(error).toBeUndefined();
    expect(game!.moves[0].color).toBe('b');
    expect(game!.moves).toHaveLength(2);
  });

  it('birden çok oyunu böler', () => {
    const text = `${OPERA_GAME}\n\n[White "A"]\n[Black "B"]\n\n1. d4 d5 *`;
    expect(splitGames(text)).toHaveLength(2);
    expect(parsePgn(text)[1].game!.moves).toHaveLength(2);
  });

  it('Türkçe notasyona çevirir', () => {
    expect(toTurkishSan('Nxe5')).toBe('Axe5');
    expect(toTurkishSan('Qb8+')).toBe('Vb8+');
    expect(toTurkishSan('e8=Q#')).toBe('e8=V#');
    expect(toTurkishSan('O-O-O')).toBe('O-O-O');
  });
});

describe('Aynı satırda başlık ve hamleler', () => {
  it('başlık hamlelerle aynı satırda olsa da okunur; [%clk] yorumları bozulmaz', () => {
    const { game, error } = parseGame('[FEN "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"] 1. Kd2 {[%clk 0:01:00]} Kd4 *');
    expect(error).toBeUndefined();
    expect(game!.headers.FEN).toBe('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
    expect(game!.moves.map((m) => m.san)).toEqual(['Kd2', 'Kd4']);
  });
});
