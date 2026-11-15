import type { AnalysisResult } from './stockfish';

/** localStorage benzeri arayüz (testlerde sahte depo kullanılabilsin diye). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'satranc-analiz:analysis:';
const INDEX_KEY = 'satranc-analiz:analysis-index';
/** Saklanacak en fazla oyun sayısı (en eskisi silinir). */
const MAX_ENTRIES = 30;
/** Depoda yer kazanmak için saklanan devam çizgisi uzunluğu (yarım hamle). */
const STORED_PV_PLIES = 12;
const VERSION = 1;

/** FNV-1a 32 bit özet (hızlı, kriptografik değil). */
export function hashString(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Önbellek anahtarı: oyunun pozisyonları + derinlik. Yorum/boşluk farkları anahtarı değiştirmez. */
export function cacheKey(fens: string[], depth: number): string {
  return `${hashString(`v${VERSION}|${depth}|${fens.join('|')}`)}-${fens.length}-${depth}`;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readIndex(storage: KeyValueStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Önbellekten okur; yoksa ya da bozuksa null. */
export function loadCachedAnalysis(
  key: string,
  expectedLength: number,
  storage: KeyValueStorage | null = defaultStorage(),
): AnalysisResult[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const evals = JSON.parse(raw) as AnalysisResult[];
    if (!Array.isArray(evals) || evals.length !== expectedLength || evals.some((e) => !e?.fen || !Array.isArray(e.lines))) {
      return null;
    }
    return evals;
  } catch {
    return null;
  }
}

/** Sonuçları önbelleğe yazar; yer kalmazsa en eski kayıtları silip yeniden dener. Hata fırlatmaz. */
export function saveCachedAnalysis(
  key: string,
  evals: AnalysisResult[],
  storage: KeyValueStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  const compact = evals.map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l, pv: l.pv.slice(0, STORED_PV_PLIES) })) }));
  const payload = JSON.stringify(compact);
  let index = readIndex(storage).filter((k) => k !== key);

  for (let attempt = 0; attempt <= MAX_ENTRIES; attempt++) {
    while (index.length >= MAX_ENTRIES) {
      storage.removeItem(PREFIX + index.shift()!);
    }
    try {
      storage.setItem(PREFIX + key, payload);
      storage.setItem(INDEX_KEY, JSON.stringify([...index, key]));
      return true;
    } catch {
      // Muhtemelen kota doldu: en eski kaydı silip tekrar dene.
      const oldest = index.shift();
      if (oldest === undefined) return false;
      try {
        storage.removeItem(PREFIX + oldest);
      } catch {
        return false;
      }
    }
  }
  return false;
}
