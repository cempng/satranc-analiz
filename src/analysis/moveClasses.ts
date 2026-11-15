export type MoveClass =
  | 'forced'
  | 'book'
  | 'brilliant'
  | 'great'
  | 'missed'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveClassMeta {
  label: string;
  /** Rozet içindeki kısa simge. */
  symbol: string;
  color: string;
}

export const MOVE_CLASS_META: Record<MoveClass, MoveClassMeta> = {
  brilliant: { label: 'Brillant', symbol: '!!', color: '#22d3ee' },
  great: { label: 'Harika', symbol: '!', color: '#3b82f6' },
  best: { label: 'En İyi', symbol: '★', color: '#16a34a' },
  excellent: { label: 'Mükemmel', symbol: '✓', color: '#22c55e' },
  good: { label: 'İyi', symbol: '✓', color: '#86c97a' },
  book: { label: 'Kitap', symbol: 'book', color: '#a0703c' },
  forced: { label: 'Zorunlu', symbol: '→', color: '#7c8aa0' },
  inaccuracy: { label: 'Belirsiz', symbol: '?!', color: '#eab308' },
  mistake: { label: 'Hata', symbol: '?', color: '#f97316' },
  blunder: { label: 'Büyük Hata', symbol: '??', color: '#ef4444' },
  missed: { label: 'Kaçırılan Fırsat', symbol: '✕', color: '#ec4899' },
};

/** Özet tablolarında kullanılan sıra. */
export const MOVE_CLASS_ORDER: MoveClass[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed',
];
