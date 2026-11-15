import { afterEach, describe, expect, it } from 'vitest';
import { buildComment } from '../analysis/comments';
import { classifyMove, type PositionEval } from '../analysis/classify';
import { MOVE_CLASS_META } from '../analysis/moveClasses';
import { formatLine } from '../lib/notation';
import { parseGame } from '../lib/pgn';
import { describeTablebase } from '../lib/tablebase';
import { en } from './en';
import { localSan, setLang, t } from './core';
import { tr } from './tr';

const evalOf = (score: PositionEval['lines'][0]['score'], pv: string[]): PositionEval => ({ lines: [{ score, pv }] });

describe('Dil desteği', () => {
  afterEach(() => setLang('tr'));

  it('iki sözlük aynı anahtarlara ve aynı yer tutuculara sahip', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).filter((h) => h !== '{nAcc}' && h !== '{n}').sort();
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      expect(holes(en[key]), key).toEqual(holes(tr[key]));
    }
  });

  it('yer tutucuları doldurur, verilen dili kullanır', () => {
    expect(t('analysis.progress', { current: 3, total: 40, depth: 16 }, 'en')).toBe('Analyzing move 3/40… (depth 16)');
    expect(t('analysis.progress', { current: 3, total: 40, depth: 16 })).toBe('Hamle 3/40 analiz ediliyor… (derinlik 16)');
  });

  it('notasyon dile göre', () => {
    expect(localSan('Nxe5', 'tr')).toBe('Axe5');
    expect(localSan('Nxe5', 'en')).toBe('Nxe5');
    expect(formatLine('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e4', 'e5', 'Nf3'], 'en')).toBe('1. e4 e5 2. Nf3');
  });

  it('sınıf adları, PGN hataları ve oyun sonu metni geçerli dile göre', () => {
    setLang('en');
    expect(MOVE_CLASS_META.blunder.label).toBe('Blunder');
    expect(parseGame('1. e4 e5 2. Nf3 Nc6 3. Bxf7 a6').error).toBe(
      'Problem at move 3 (White): "3. Bxf7" is not a legal move in this position.',
    );
    expect(describeTablebase({ category: 'loss', dtm: -31, moves: [] }, '8/8/8/4k3/8/8/4P3/4K3 b - - 0 1')).toBe(
      'White wins (mate in 16)',
    );
    setLang('tr');
    expect(MOVE_CLASS_META.blunder.label).toBe('Büyük Hata');
  });

  it('kural tabanlı yorum İngilizce', () => {
    const start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    const game = parseGame(`[FEN "${start}"]\n\n1. Kf2 *`).game!;
    const move = game.moves[0];
    const before = evalOf({ type: 'mate', moves: 1, winner: 'w' }, ['a1a8']);
    const after = evalOf({ type: 'cp', cp: 500 }, ['g8f8']);
    const info = classifyMove({ uci: move.uci, color: 'w', before, after, isBook: false, legalMoves: 20, sacrifice: 0 });
    const c = buildComment({ move, info, before, after, lang: 'en' });
    expect(c.headline).toBe('This is a mistake (?). Ra8# was better.');
    expect(c.details).toContain('You missed mate in 1.');
    expect(c.line?.label).toBe('Suggested line');
    expect(buildComment({ move, info, before, after, lang: 'tr' }).details).toContain("Mat 1'i kaçırdın.");
  });
});
