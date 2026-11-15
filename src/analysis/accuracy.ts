import { Chess } from 'chess.js';
import { t } from '../i18n/core';
import type { Color, ParsedGame } from '../lib/pgn';
import type { MoveClassification } from './classify';
import { ACCURACY, PHASES, PIECE_VALUES } from './config';

/** Tek hamlenin doğruluğu (0–100): 103.1668 * exp(-0.04354 * kayıp) - 3.1669. */
export function moveAccuracy(loss: number): number {
  const raw = ACCURACY.a * Math.exp(-ACCURACY.k * loss) + ACCURACY.b;
  return Math.max(0, Math.min(100, raw));
}

/** Oyuncu doğruluğu: aritmetik ve harmonik ortalamanın ortalaması. Hamle yoksa undefined. */
export function aggregateAccuracy(accuracies: number[]): number | undefined {
  if (accuracies.length === 0) return undefined;
  const arithmetic = accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
  // Harmonik ortalamada sıfıra bölmeyi önlemek için alt sınır.
  const harmonic = accuracies.length / accuracies.reduce((s, a) => s + 1 / Math.max(a, ACCURACY.harmonicFloor), 0);
  return (arithmetic + harmonic) / 2;
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/** Evre adları (her okunuşta geçerli arayüz diline göre). */
export const PHASE_LABELS: Record<GamePhase, string> = {
  get opening() {
    return t('phase.opening');
  },
  get middlegame() {
    return t('phase.middlegame');
  },
  get endgame() {
    return t('phase.endgame');
  },
};

/** Şah ve piyonlar hariç tahtadaki toplam taş değeri. */
export function nonPawnMaterial(fen: string): number {
  return new Chess(fen)
    .board()
    .flat()
    .reduce((sum, sq) => (sq && sq.type !== 'p' && sq.type !== 'k' ? sum + PIECE_VALUES[sq.type] : sum), 0);
}

/**
 * Hamlenin oynandığı evre (hamleden önceki pozisyona göre).
 * Oyun sonu: toplam taş değeri eşiğin altında. Açılış: ilk N yarım hamle veya hâlâ kitapta.
 * Oyun sonuna girildikten sonra geri dönülmez; açılıştan çıkıldıktan sonra açılışa dönülmez.
 */
export function gamePhases(game: ParsedGame, classes: (MoveClassification | undefined)[]): GamePhase[] {
  const phases: GamePhase[] = [];
  let phase: GamePhase = 'opening';
  game.moves.forEach((move, i) => {
    if (phase !== 'endgame' && nonPawnMaterial(move.fenBefore) <= PHASES.endgameMaxMaterial) phase = 'endgame';
    else if (phase === 'opening' && i >= PHASES.openingPlies && classes[i]?.cls !== 'book') phase = 'middlegame';
    phases.push(phase);
  });
  return phases;
}

export interface PlayerAccuracy {
  overall?: number;
  byPhase: Record<GamePhase, number | undefined>;
}

/** Her iki oyuncunun genel ve evre bazında doğruluğu. Zorunlu hamleler sayılmaz. */
export function gameAccuracy(
  game: ParsedGame,
  classes: (MoveClassification | undefined)[],
): Record<Color, PlayerAccuracy> {
  const phases = gamePhases(game, classes);
  const result = {} as Record<Color, PlayerAccuracy>;
  for (const color of ['w', 'b'] as Color[]) {
    const all: number[] = [];
    const byPhase: Record<GamePhase, number[]> = { opening: [], middlegame: [], endgame: [] };
    game.moves.forEach((move, i) => {
      const c = classes[i];
      if (move.color !== color || !c || c.cls === 'forced') return;
      const acc = moveAccuracy(c.loss);
      all.push(acc);
      byPhase[phases[i]].push(acc);
    });
    result[color] = {
      overall: aggregateAccuracy(all),
      byPhase: {
        opening: aggregateAccuracy(byPhase.opening),
        middlegame: aggregateAccuracy(byPhase.middlegame),
        endgame: aggregateAccuracy(byPhase.endgame),
      },
    };
  }
  return result;
}
