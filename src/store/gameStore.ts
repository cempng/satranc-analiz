import { Chess, DEFAULT_POSITION } from 'chess.js';
import { create } from 'zustand';
import { t } from '../i18n/core';
import { parsePgn, type GameParseResult, type ParsedGame, type PlyMove } from '../lib/pgn';

/** Ana hattan ayrılan, kullanıcının tahtada oynadığı hamleler. */
export interface Variant {
  /** Varyantın ayrıldığı ana hat pozisyonu (ply). */
  basePly: number;
  moves: PlyMove[];
  /** Varyantta gösterilen hamle sayısı (0 = ayrılma noktası). */
  index: number;
}

interface GameState {
  /** Son yüklenen PGN dosyasındaki tüm oyunlar (hatalılar dahil). */
  candidates: GameParseResult[];
  game: ParsedGame | null;
  error: string | null;
  /** 0 = başlangıç pozisyonu, n = n. yarım hamleden sonraki pozisyon. */
  ply: number;
  orientation: 'white' | 'black';
  variant: Variant | null;

  loadPgnText: (text: string) => void;
  selectCandidate: (index: number) => void;
  goTo: (ply: number) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  flip: () => void;
  /** Ekrandaki pozisyonda hamle oynar; yasal değilse false döner. */
  playMove: (from: string, to: string, promotion?: string) => boolean;
  /** Varyanttan çıkıp ayrılma noktasına döner. */
  exitVariant: () => void;
}

/** Ana hattaki ply'nin FEN'i (oyun yoksa başlangıç pozisyonu). */
export function currentFen(game: ParsedGame | null, ply: number): string {
  if (!game) return DEFAULT_POSITION;
  return ply === 0 ? game.startFen : game.moves[ply - 1].fenAfter;
}

/** Ekrandaki pozisyonun FEN'i (varyant dahil). */
export function displayedFen(s: Pick<GameState, 'game' | 'ply' | 'variant'>): string {
  if (s.variant && s.variant.index > 0) return s.variant.moves[s.variant.index - 1].fenAfter;
  return currentFen(s.game, s.ply);
}

export const useGameStore = create<GameState>((set, get) => ({
  candidates: [],
  game: null,
  error: null,
  ply: 0,
  orientation: 'white',
  variant: null,

  loadPgnText: (text) => {
    if (!text.trim()) {
      set({ error: t('pgn.empty') });
      return;
    }
    const results = parsePgn(text);
    if (results.length === 0) {
      set({ candidates: [], error: t('pgn.noGames') });
      return;
    }
    if (results.length === 1) {
      const [r] = results;
      if (r.game) set({ candidates: [], game: r.game, error: null, ply: 0, variant: null });
      else set({ candidates: [], error: r.error ?? t('pgn.unreadable') });
      return;
    }
    set({ candidates: results, error: null });
  },

  selectCandidate: (index) => {
    const r = get().candidates[index];
    if (!r) return;
    if (r.game) set({ game: r.game, error: null, ply: 0, candidates: [], variant: null });
    else set({ error: r.error ?? t('pgn.unreadable') });
  },

  goTo: (ply) => {
    const total = get().game?.moves.length ?? 0;
    set({ ply: Math.max(0, Math.min(total, ply)), variant: null });
  },
  next: () => {
    const { variant } = get();
    if (variant) {
      if (variant.index < variant.moves.length) set({ variant: { ...variant, index: variant.index + 1 } });
      return;
    }
    get().goTo(get().ply + 1);
  },
  prev: () => {
    const { variant } = get();
    if (variant) {
      // Ayrılma noktasına (index 0) kadar geri gidilir; bir kez daha geri ana hatta döndürür.
      if (variant.index > 0) set({ variant: { ...variant, index: variant.index - 1 } });
      else set({ variant: null });
      return;
    }
    get().goTo(get().ply - 1);
  },
  first: () => get().goTo(0),
  last: () => get().goTo(Number.MAX_SAFE_INTEGER),
  flip: () => set((s) => ({ orientation: s.orientation === 'white' ? 'black' : 'white' })),

  playMove: (from, to, promotion) => {
    const state = get();
    const fen = displayedFen(state);
    const chess = new Chess(fen);
    let move;
    try {
      move = chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    const uci = move.from + move.to + (move.promotion ?? '');

    // Ana hattaki bir sonraki hamle oynandıysa yalnızca ilerle.
    const mainNext = state.game?.moves[state.ply];
    if (!state.variant && mainNext?.uci === uci) {
      set({ ply: state.ply + 1 });
      return true;
    }
    // Varyantta bir sonraki hamle aynıysa onu göster.
    const variantNext = state.variant?.moves[state.variant.index];
    if (state.variant && variantNext?.uci === uci) {
      set({ variant: { ...state.variant, index: state.variant.index + 1 } });
      return true;
    }

    const played: PlyMove = {
      san: move.san,
      uci,
      from: move.from,
      to: move.to,
      color: move.color,
      moveNumber: Number(fen.split(' ')[5]) || 1,
      fenBefore: fen,
      fenAfter: chess.fen(),
    };
    const base = state.variant ?? { basePly: state.ply, moves: [], index: 0 };
    const moves = [...base.moves.slice(0, base.index), played];
    set({ variant: { basePly: base.basePly, moves, index: moves.length } });
    return true;
  },

  exitVariant: () => set({ variant: null }),
}));

/** Ekrandaki pozisyonun FEN'i. */
export function useCurrentFen(): string {
  return useGameStore(displayedFen);
}

/** Ekranda son oynanan hamle (varyant dahil); başlangıçta undefined. */
export function useLastMove(): PlyMove | undefined {
  return useGameStore((s) => {
    if (s.variant && s.variant.index > 0) return s.variant.moves[s.variant.index - 1];
    return s.game && s.ply > 0 ? s.game.moves[s.ply - 1] : undefined;
  });
}
