import { t } from '../i18n/core';

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
  /** Arayüz dilindeki ad (her okunuşta geçerli dile göre). */
  readonly label: string;
  /** Rozet içindeki kısa simge. */
  symbol: string;
  color: string;
}

export const MOVE_CLASS_META: Record<MoveClass, MoveClassMeta> = {
  brilliant: { get label() { return t('class.brilliant'); }, symbol: '!!', color: '#22d3ee' },
  great: { get label() { return t('class.great'); }, symbol: '!', color: '#3b82f6' },
  best: { get label() { return t('class.best'); }, symbol: '★', color: '#16a34a' },
  excellent: { get label() { return t('class.excellent'); }, symbol: '✓', color: '#22c55e' },
  good: { get label() { return t('class.good'); }, symbol: '✓', color: '#86c97a' },
  book: { get label() { return t('class.book'); }, symbol: 'book', color: '#a0703c' },
  forced: { get label() { return t('class.forced'); }, symbol: '→', color: '#7c8aa0' },
  inaccuracy: { get label() { return t('class.inaccuracy'); }, symbol: '?!', color: '#eab308' },
  mistake: { get label() { return t('class.mistake'); }, symbol: '?', color: '#f97316' },
  blunder: { get label() { return t('class.blunder'); }, symbol: '??', color: '#ef4444' },
  missed: { get label() { return t('class.missed'); }, symbol: '✕', color: '#ec4899' },
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
