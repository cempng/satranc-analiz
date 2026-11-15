/** Açılış kitabı: EPD → "ECO|Ad" (ara pozisyonlarda boş dize). Kaynak: lichess-org/chess-openings (CC0). */
export type OpeningBook = Record<string, string>;

let loading: Promise<OpeningBook> | null = null;

export function loadOpeningBook(): Promise<OpeningBook> {
  loading ??= fetch(`${import.meta.env.BASE_URL}openings.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<OpeningBook>;
    })
    .catch(() => {
      loading = null;
      return {};
    });
  return loading;
}

export function toEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export interface OpeningInfo {
  eco: string;
  name: string;
}

/** Pozisyon kitapta mı? Adı varsa döndürür; yalnızca ara pozisyonsa `null`; kitapta değilse `undefined`. */
export function lookupOpening(book: OpeningBook, fen: string): OpeningInfo | null | undefined {
  const value = book[toEpd(fen)];
  if (value === undefined) return undefined;
  if (!value) return null;
  const [eco, name] = value.split('|');
  return { eco, name };
}
