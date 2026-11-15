import { parseGame, type Color, type ParsedGame } from '../lib/pgn';
import { userColor, type OnlineGame } from '../lib/onlineGames';
import type { GamePhase } from './accuracy';
import type { PositionEval } from './classify';
import { classifyGame } from './classifyGame';
import type { ClassifyConfig } from './config';
import { MOVE_CLASS_ORDER, type MoveClass } from './moveClasses';
import type { OpeningBook } from './openings';
import { summarizeGame } from './summary';

export type Outcome = 'win' | 'draw' | 'loss';

/** Toplu analizde tek bir oyunun, kullanıcının bakış açısından özeti. */
export interface GameStat {
  online: OnlineGame;
  color: Color;
  outcome: Outcome;
  /** Açılış ailesi ("Sicilian Defense: Najdorf" → "Sicilian Defense"). */
  openingFamily: string;
  opening: string;
  accuracy?: number;
  byPhase: Record<GamePhase, number | undefined>;
  counts: Record<MoveClass, number>;
}

export interface OpeningStat {
  name: string;
  games: number;
  /** Puan yüzdesi: galibiyet 1, beraberlik 0.5. */
  score: number;
  accuracy?: number;
}

export interface StatsSummary {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  accuracy?: number;
  byPhase: Record<GamePhase, number | undefined>;
  /** Oyun başına ortalama sınıf sayıları. */
  perGame: Record<MoveClass, number>;
  openings: OpeningStat[];
}

function outcomeOf(result: string, color: Color): Outcome | undefined {
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return color === 'w' ? 'win' : 'loss';
  if (result === '0-1') return color === 'b' ? 'win' : 'loss';
  return undefined;
}

/** Oyunun ayrıştırılmış hâli ve kullanıcının rengi; ayrıştırılamıyor ya da kullanıcı oyunda değilse null. */
export function prepareGame(online: OnlineGame, username: string): { game: ParsedGame; color: Color } | null {
  const color = userColor(online, username);
  const parsed = parseGame(online.pgn);
  return color && parsed.game ? { game: parsed.game, color } : null;
}

/** Motor sonuçları hazır bir oyunun kullanıcı istatistiğini hesaplar (saf fonksiyon). */
export function computeGameStat(
  online: OnlineGame,
  game: ParsedGame,
  color: Color,
  evals: PositionEval[],
  book: OpeningBook,
  config: ClassifyConfig,
): GameStat | null {
  const outcome = outcomeOf(online.result, color);
  if (!outcome) return null;
  const classification = classifyGame(game, evals, book, config);
  const summary = summarizeGame(game, classification.moves);
  const named = [...classification.openings].reverse().find(Boolean);
  const opening = named?.name ?? game.headers.Opening ?? 'Bilinmeyen açılış';
  return {
    online,
    color,
    outcome,
    opening,
    openingFamily: opening.split(':')[0].trim(),
    accuracy: summary.accuracy[color].overall,
    byPhase: summary.accuracy[color].byPhase,
    counts: summary.counts[color],
  };
}

function mean(values: (number | undefined)[]): number | undefined {
  const v = values.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined;
}

/** Oyun istatistiklerini toplar (saf fonksiyon). */
export function aggregateStats(stats: GameStat[]): StatsSummary {
  const perGame = Object.fromEntries(
    MOVE_CLASS_ORDER.map((c) => [c, stats.length ? stats.reduce((s, g) => s + g.counts[c], 0) / stats.length : 0]),
  ) as Record<MoveClass, number>;

  const byOpening = new Map<string, GameStat[]>();
  for (const g of stats) byOpening.set(g.openingFamily, [...(byOpening.get(g.openingFamily) ?? []), g]);
  const openings = [...byOpening.entries()]
    .map(([name, games]) => ({
      name,
      games: games.length,
      score: (games.reduce((s, g) => s + (g.outcome === 'win' ? 1 : g.outcome === 'draw' ? 0.5 : 0), 0) / games.length) * 100,
      accuracy: mean(games.map((g) => g.accuracy)),
    }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

  return {
    games: stats.length,
    wins: stats.filter((g) => g.outcome === 'win').length,
    draws: stats.filter((g) => g.outcome === 'draw').length,
    losses: stats.filter((g) => g.outcome === 'loss').length,
    accuracy: mean(stats.map((g) => g.accuracy)),
    byPhase: {
      opening: mean(stats.map((g) => g.byPhase.opening)),
      middlegame: mean(stats.map((g) => g.byPhase.middlegame)),
      endgame: mean(stats.map((g) => g.byPhase.endgame)),
    },
    perGame,
    openings,
  };
}
