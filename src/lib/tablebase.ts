import { fenTurn } from '../engine/uci';
import { TABLEBASE_MAX_PIECES } from '../analysis/config';
import { localSan, t } from '../i18n/core';

/** lichess oyun sonu veritabanı (Syzygy) yanıtının kullandığımız kısmı. Kategoriler sırası gelen tarafa göredir. */
export interface TablebaseResult {
  category: string;
  /** Mata kalan yarım hamle (varsa). */
  dtm?: number | null;
  /** 50 hamle kuralına göre sıfırlamaya kalan yarım hamle. */
  dtz?: number | null;
  moves: { uci: string; san: string; category: string; dtm?: number | null; dtz?: number | null }[];
}

/** FEN'deki taş sayısı (şahlar dahil). */
export function pieceCount(fen: string): number {
  return (fen.split(' ')[0].match(/[prnbqk]/gi) ?? []).length;
}

export function isTablebasePosition(fen: string): boolean {
  return pieceCount(fen) <= TABLEBASE_MAX_PIECES;
}

const cache = new Map<string, TablebaseResult>();

export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TablebaseResult> {
  const hit = cache.get(fen);
  if (hit) return hit;
  const res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = (await res.json()) as TablebaseResult;
  cache.set(fen, result);
  return result;
}

const WIN = ['win', 'syzygy-win', 'maybe-win'];
const LOSS = ['loss', 'syzygy-loss', 'maybe-loss'];

/** Sonucu arayüz dilinde cümleye çevirir: "Beyaz kazanır (mat 12 hamlede)", "Berabere" … */
export function describeTablebase(result: TablebaseResult, fen: string): string {
  const turn = fenTurn(fen);
  const mover = t(turn === 'w' ? 'common.white' : 'common.black');
  const other = t(turn === 'w' ? 'common.black' : 'common.white');
  const mateIn = result.dtm ? t('tablebase.mateIn', { n: Math.ceil(Math.abs(result.dtm) / 2) }) : '';
  const c = result.category;
  if (WIN.includes(c)) return t('tablebase.wins', { side: mover }) + mateIn;
  if (LOSS.includes(c)) return t('tablebase.wins', { side: other }) + mateIn;
  if (c === 'cursed-win') return t('tablebase.cursed', { side: mover });
  if (c === 'blessed-loss') return t('tablebase.cursed', { side: other });
  if (c === 'draw') return t('tablebase.draw');
  return t('tablebase.unknown');
}

/** En iyi hamle (arayüz dilinin notasyonuyla); oynanacak hamle yoksa undefined. */
export function bestTablebaseMove(result: TablebaseResult): string | undefined {
  const m = result.moves[0];
  return m ? localSan(m.san) : undefined;
}
