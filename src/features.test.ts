import { describe, expect, it } from 'vitest';
import type { Score } from './engine/uci';
import { cacheKey } from './engine/analysisCache';
import { CLASSIFY } from './analysis/config';
import { classifyMove, type ClassifyInput, type MoveClassification, type PositionEval } from './analysis/classify';
import { evalTag, exportAnnotatedPgn, pgnFileName } from './analysis/exportPgn';
import { buildPuzzles, judgeFromLines, judgeFromScore } from './analysis/practice';
import { aggregateStats, computeGameStat, prepareGame, type GameStat } from './analysis/stats';
import { parseChessComArchive, parseLichessNdjson, userColor, type OnlineGame } from './lib/onlineGames';
import { parseGame } from './lib/pgn';
import { soundForSan } from './lib/sounds';
import { bestTablebaseMove, describeTablebase, isTablebasePosition, pieceCount } from './lib/tablebase';
import { DEFAULT_SETTINGS, mergeSettings } from './store/settingsStore';
import { OPERA_GAME } from './data/sampleGames';

const cp = (value: number): Score => ({ type: 'cp', cp: value });
const evalOf = (...lines: [Score, string][]): PositionEval => ({ lines: lines.map(([score, m]) => ({ score, pv: [m] })) });
const mk = (cls: MoveClassification['cls'], loss = 0, bestMove = 'e2e4'): MoveClassification => ({
  cls,
  loss,
  winBefore: 50,
  winAfter: 50 - loss,
  isBest: cls === 'best',
  bestMove,
});

describe('Ayarlanabilir eşikler', () => {
  const input = (over: Partial<ClassifyInput> = {}): ClassifyInput => ({
    uci: 'f1f7',
    color: 'w',
    before: evalOf([cp(900), 'f1f7'], [cp(880), 'd2d4']),
    after: evalOf([cp(900), 'e7e5']),
    isBook: false,
    legalMoves: 20,
    sacrifice: 3,
    ...over,
  });

  it('varsayılanda ezici üstünken feda Brillant değil; eşik yükseltilince Brillant', () => {
    expect(classifyMove(input()).cls).toBe('best');
    const loose = { ...CLASSIFY, brilliant: { ...CLASSIFY.brilliant, maxWinBefore: 100 } };
    expect(classifyMove(input(), loose).cls).toBe('brilliant');
  });

  it('kayıp eşikleri değişince sınıf değişir', () => {
    const before = evalOf([cp(0), 'e2e4']);
    const after = evalOf([cp(-60), 'e7e5']); // ~%5.5 kayıp
    const base = { uci: 'a2a3', before, after, sacrifice: 0 };
    expect(classifyMove(input(base)).cls).toBe('inaccuracy');
    expect(classifyMove(input(base), { ...CLASSIFY, goodMaxLoss: 8 }).cls).toBe('good');
  });

  it('kayıtlı ayarlar varsayılanlarla birleşir, bozuk değerler atılır', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const merged = mergeSettings({
      boardTheme: 'kahve',
      engine: 'full',
      sounds: 'evet',
      thresholds: { goodMaxLoss: 7, brilliant: { maxWinBefore: 95, minSacrifice: 'x' } },
    });
    expect(merged.boardTheme).toBe('kahve');
    expect(merged.engine).toBe('full');
    expect(merged.sounds).toBe(true);
    expect(merged.thresholds.goodMaxLoss).toBe(7);
    expect(merged.thresholds.brilliant.maxWinBefore).toBe(95);
    expect(merged.thresholds.brilliant.minSacrifice).toBe(CLASSIFY.brilliant.minSacrifice);
    expect(mergeSettings({ boardTheme: 'neon' }).boardTheme).toBe('mavi');
  });

  it('önbellek anahtarı motor türüne göre ayrılır, lite eski anahtarla aynı kalır', () => {
    expect(cacheKey(['a'], 16, 'lite')).toBe(cacheKey(['a'], 16));
    expect(cacheKey(['a'], 16, 'full')).not.toBe(cacheKey(['a'], 16));
  });
});

describe('Analizli PGN', () => {
  const game = parseGame('[White "Ali"]\n[Black "Veli"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0').game!;
  const classes = [mk('book'), mk('book'), mk('inaccuracy', 6, 'g1f3'), mk('best'), mk('best'), mk('blunder', 40, 'g7g6'), mk('best')];
  const evals = Array.from({ length: 8 }, (_, i) => evalOf([i === 7 ? { type: 'mate', moves: 0, winner: 'w' } : cp(i * 10), 'e2e4']));

  it('başlıklar, NAG, [%eval] ve yorumlar', () => {
    const pgn = exportAnnotatedPgn(game, classes, evals);
    const flat = pgn.replace(/\s+/g, ' ');
    expect(pgn.startsWith('[Event "?"]\n[Site "?"]\n[Date "?"]\n[Round "?"]\n[White "Ali"]')).toBe(true);
    expect(pgn).toContain('[Annotator "Satranç Analiz (Stockfish 19)"]');
    expect(flat).toContain('2. Qh5 $6 {[%eval 0.30] Belirsiz. Daha iyisi Nf3 idi.}');
    expect(flat).toContain('3... Nf6 $4 {[%eval 0.60] Büyük Hata. Daha iyisi g6 idi.}');
    expect(flat).toContain('4. Qxf7# {[%eval #0] En İyi.}');
    expect(pgn.trim().endsWith('1-0')).toBe(true);
    // Yeniden okunabilmeli.
    expect(parseGame(pgn).game!.moves).toHaveLength(7);
  });

  it('eval etiketi ve dosya adı', () => {
    expect(evalTag({ type: 'mate', moves: 3, winner: 'b' })).toBe('#-3');
    expect(evalTag(cp(-125))).toBe('-1.25');
    expect(pgnFileName(game)).toBe('Ali-Veli-analiz.pgn');
  });
});

describe('Alıştırma', () => {
  const game = parseGame(OPERA_GAME).game!;
  const classes = game.moves.map((_, i) => (i === 17 ? mk('mistake', 11, 'b8a6') : i === 19 ? mk('inaccuracy', 9) : mk('best')));
  const evals = game.moves.map(() => evalOf([cp(-250), 'b8a6'], [cp(-280), 'f8e7'], [cp(300), 'h7h6']));

  it('yalnızca hata anlarından ve seçilen renkten bulmaca üretir', () => {
    const all = buildPuzzles(game, classes, evals);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ moveIndex: 17, color: 'b', solution: 'b8a6' });
    expect(buildPuzzles(game, classes, evals, 'w')).toHaveLength(0);
  });

  it('cevabı değerlendirir', () => {
    const p = { ...buildPuzzles(game, classes, evals)[0], winBefore: 100 - 27.8 };
    expect(judgeFromLines(p, 'b8a6', 5)).toEqual({ kind: 'correct', best: true, loss: 0 });
    expect(judgeFromLines(p, 'f8e7', 5).kind).toBe('correct');
    expect(judgeFromLines(p, 'h7h6', 5).kind).toBe('wrong');
    expect(judgeFromLines(p, 'a7a6', 5).kind).toBe('unknown');
    expect(judgeFromScore(p, { type: 'mate', moves: 2, winner: 'w' }, 5).kind).toBe('wrong');
  });
});

describe('Lichess / Chess.com', () => {
  it('lichess NDJSON', () => {
    const text = [
      JSON.stringify({ id: 'abc', variant: 'standard', winner: 'black', players: { white: { user: { name: 'Ali' }, rating: 1500 }, black: { user: { name: 'Veli' }, rating: 1600 } }, speed: 'blitz', lastMoveAt: 1700000000000, pgn: '1. e4 e5 0-1' }),
      JSON.stringify({ id: 'z', variant: 'crazyhouse', pgn: '1. e4' }),
      'bozuk satır',
      JSON.stringify({ id: 'd', status: 'draw', players: { white: { aiLevel: 3 }, black: { user: { name: 'Ali' } } }, pgn: '1. d4 d5 1/2-1/2' }),
    ].join('\n');
    const games = parseLichessNdjson(text);
    expect(games.map((g) => g.id)).toEqual(['abc', 'd']);
    expect(games[0]).toMatchObject({ white: 'Ali', black: 'Veli', whiteElo: 1500, result: '0-1', url: 'https://lichess.org/abc' });
    expect(games[1]).toMatchObject({ white: 'Stockfish seviye 3', result: '1/2-1/2' });
  });

  it('chess.com arşivi (en yenisi önce, yalnızca standart)', () => {
    const games = parseChessComArchive({
      games: [
        { uuid: '1', rules: 'chess', pgn: 'x', white: { username: 'A', result: 'win', rating: 1200 }, black: { username: 'B', result: 'resigned' }, end_time: 100, time_class: 'rapid' },
        { uuid: '2', rules: 'chess960', pgn: 'y', white: {}, black: {} },
        { uuid: '3', rules: 'chess', pgn: 'z', white: { username: 'B', result: 'agreed' }, black: { username: 'A', result: 'agreed' }, end_time: 200 },
      ],
    });
    expect(games.map((g) => [g.id, g.result])).toEqual([
      ['3', '1/2-1/2'],
      ['1', '1-0'],
    ]);
    expect(games[1].playedAt).toBe(100000);
  });

  it('kullanıcının rengi (büyük/küçük harf duyarsız)', () => {
    expect(userColor({ white: 'Ali', black: 'Veli' }, 'ali')).toBe('w');
    expect(userColor({ white: 'Ali', black: 'Veli' }, ' VELI ')).toBe('b');
    expect(userColor({ white: 'Ali', black: 'Veli' }, 'can')).toBeUndefined();
  });
});

describe('İstatistik', () => {
  const online = (over: Partial<OnlineGame>): OnlineGame => ({
    id: 'x',
    site: 'lichess',
    pgn: '[White "Ali"]\n[Black "Veli"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 1-0',
    white: 'Ali',
    black: 'Veli',
    result: '1-0',
    ...over,
  });

  it('oyun istatistiği kullanıcının tarafından hesaplanır', () => {
    const o = online({});
    const prepared = prepareGame(o, 'veli')!;
    expect(prepared.color).toBe('b');
    const evals = [0, 1, 2, 3].map(() => evalOf([cp(0), 'e2e4']));
    const book = {
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': '',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': "C20|King's Pawn Game",
    };
    const stat = computeGameStat(o, prepared.game, prepared.color, evals, book, CLASSIFY)!;
    expect(stat.outcome).toBe('loss');
    expect(stat.opening).toBe("King's Pawn Game");
    expect(stat.counts.book).toBe(1);
    expect(prepareGame(o, 'can')).toBeNull();
  });

  it('toplama: sonuçlar, ortalamalar, açılış aileleri', () => {
    const base = { byPhase: { opening: 90, middlegame: 80, endgame: undefined }, counts: Object.fromEntries(['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced', 'inaccuracy', 'mistake', 'blunder', 'missed'].map((c) => [c, 0])) } as unknown as GameStat;
    const g = (outcome: GameStat['outcome'], opening: string, accuracy: number, blunders: number): GameStat => ({
      ...base,
      online: online({}),
      color: 'w',
      outcome,
      opening,
      openingFamily: opening.split(':')[0],
      accuracy,
      counts: { ...base.counts, blunder: blunders },
    });
    const s = aggregateStats([
      g('win', 'Sicilian Defense: Najdorf', 90, 0),
      g('loss', 'Sicilian Defense: Dragon', 70, 2),
      g('draw', 'French Defense', 80, 1),
    ]);
    expect([s.wins, s.draws, s.losses]).toEqual([1, 1, 1]);
    expect(s.accuracy).toBeCloseTo(80);
    expect(s.perGame.blunder).toBeCloseTo(1);
    expect(s.openings[0]).toMatchObject({ name: 'Sicilian Defense', games: 2, score: 50, accuracy: 80 });
    expect(s.byPhase.endgame).toBeUndefined();
    expect(aggregateStats([]).games).toBe(0);
  });
});

describe('Oyun sonu veritabanı ve sesler', () => {
  it('taş sayısı', () => {
    expect(pieceCount('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1')).toBe(3);
    expect(isTablebasePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
  });

  it('sonucu Türkçe yazar (kategori sırası gelen tarafa göre)', () => {
    const fen = '8/8/8/4k3/8/8/4P3/4K3 b - - 0 1';
    const moves = [{ uci: 'e5e4', san: 'Ke4', category: 'win', dtm: 30 }];
    expect(describeTablebase({ category: 'loss', dtm: -31, moves }, fen)).toBe('Beyaz kazanır (mat 16 hamlede)');
    expect(describeTablebase({ category: 'draw', moves }, fen)).toBe('Berabere');
    expect(describeTablebase({ category: 'cursed-win', moves }, fen)).toContain('50 hamle kuralı');
    expect(bestTablebaseMove({ category: 'loss', moves })).toBe('Şe4');
  });

  it('hamle sesi türü (dosya adlarıyla)', () => {
    expect(soundForSan('Rd8#', true)).toBe('move-check');
    expect(soundForSan('Bxb5+', false)).toBe('move-check');
    expect(soundForSan('exd8=Q', true)).toBe('promote');
    expect(soundForSan('O-O-O', true)).toBe('castle');
    expect(soundForSan('Nxe5', false)).toBe('capture');
    expect(soundForSan('e4', true)).toBe('move-self');
    expect(soundForSan('e5', false)).toBe('move-opponent');
  });
});
