import { beforeEach, describe, expect, it } from 'vitest';
import { OPERA_GAME } from '../data/sampleGames';
import { displayedFen, useGameStore } from './gameStore';

const store = () => useGameStore.getState();

describe('Gezinme ve varyant modu', () => {
  beforeEach(() => {
    useGameStore.setState({ game: null, ply: 0, variant: null, candidates: [], error: null });
    store().loadPgnText(OPERA_GAME);
  });

  it('ana hattaki hamleyi tahtada oynamak varyant açmaz', () => {
    expect(store().playMove('e2', 'e4')).toBe(true);
    expect(store().ply).toBe(1);
    expect(store().variant).toBeNull();
  });

  it('farklı hamle varyant açar, pozisyon değişir, ana hatta dönülür', () => {
    store().goTo(1); // 1. e4
    expect(store().playMove('c7', 'c5')).toBe(true);
    const v = store().variant!;
    expect(v.basePly).toBe(1);
    expect(v.moves.map((m) => m.san)).toEqual(['c5']);
    expect(displayedFen(store())).toContain('2p5'); // c5 piyonu
    expect(store().playMove('g1', 'f3')).toBe(true);
    expect(store().variant!.moves).toHaveLength(2);

    store().exitVariant();
    expect(store().variant).toBeNull();
    expect(store().ply).toBe(1);
    expect(displayedFen(store())).toBe(store().game!.moves[0].fenAfter);
  });

  it('yasa dışı hamle reddedilir', () => {
    expect(store().playMove('e2', 'e5')).toBe(false);
    expect(store().variant).toBeNull();
  });

  it('varyantta geri/ileri ve geri gidip farklı hamle oynamak sonrasını keser', () => {
    store().playMove('d2', 'd4');
    store().playMove('d7', 'd5');
    store().playMove('c2', 'c4');
    store().prev();
    store().prev();
    expect(store().variant!.index).toBe(1);
    store().next();
    expect(store().variant!.index).toBe(2);
    store().prev();
    store().playMove('g8', 'f6');
    expect(store().variant!.moves.map((m) => m.san)).toEqual(['d4', 'Nf6']);
    // Başa kadar geri gidip bir kez daha geri: ana hatta döner.
    store().prev();
    store().prev();
    expect(store().variant!.index).toBe(0);
    store().prev();
    expect(store().variant).toBeNull();
  });

  it('hamle listesinden gitmek varyanttan çıkarır', () => {
    store().playMove('d2', 'd4');
    store().goTo(5);
    expect(store().variant).toBeNull();
    expect(store().ply).toBe(5);
  });

  it('piyon terfisi', () => {
    store().loadPgnText('[FEN "8/4P3/8/8/8/8/k7/4K3 w - - 0 1"]\n\n*');
    expect(store().playMove('e7', 'e8', 'n')).toBe(true);
    expect(store().variant!.moves[0].san).toBe('e8=N');
  });
});
